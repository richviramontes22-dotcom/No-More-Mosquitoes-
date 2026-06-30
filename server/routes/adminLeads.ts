import { Router } from "express";
import { supabase } from "../lib/supabase";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { requireAdmin } from "../middleware/requireAdmin";
import {
  listLeads,
  getLead,
  updateLeadStatus,
  addLeadNote,
  assignLead,
  createFollowUp,
  updateFollowUpStatus,
  listFollowUps,
  upsertLeadFromAdminQuote,
  generateLeadQuoteToken,
  getLeadByQuoteToken,
  recordLeadActivity,
  type ListLeadsParams,
} from "../services/leads/leadService";
import { lookupParcel, isError } from "../services/parcel/parcelLookupService";
import { buildPricingQuote } from "../services/parcel/pricingQuote";
import { getEmailProvider, getSmsProvider, getFromEmail } from "../services/notifications/providers/index";
import { buildAdminQuoteEmail } from "../services/notifications/emailTemplates";
import { buildAdminQuoteSms } from "../services/notifications/smsTemplates";
import { logNotification } from "../services/notifications/notificationLogger";

const router = Router();
const db = supabaseAdmin ?? supabase;

const VALID_STATUSES = ["new", "manual_review", "scheduled", "out_of_area", "contacted", "quoted", "lost"];
const VALID_SOURCES = ["quote", "manual_review", "schedule_request", "waitlist", "admin_quote"];
const VALID_SORTS = ["created_at_desc", "created_at_asc", "last_seen_at_desc", "last_seen_at_asc"];

/** Minimal cents formatter for server-rendered template strings -- mirrors
 * client/lib/formatCents.ts, kept separate since server code can't import
 * from client/. */
function formatCentsServer(cents: number): string {
  return cents % 100 === 0 ? `$${(cents / 100).toFixed(0)}` : `$${(cents / 100).toFixed(2)}`;
}

/**
 * GET /api/admin/leads
 * Lead Inbox list — query params:
 *   status   — filter by new|manual_review|scheduled|out_of_area|contacted|quoted|lost
 *   source   — filter by quote|manual_review|schedule_request|waitlist
 *   search   — matches name, email, phone, address, zip, county, state (case-insensitive substring)
 *   sort     — created_at_desc (default) | created_at_asc | last_seen_at_desc | last_seen_at_asc
 *   page     — 1-based, default 1
 *   pageSize — default 25, max 100
 */
router.get("/leads", requireAdmin, async (req, res) => {
  const { status, source, search, sort, page, pageSize } = req.query as Record<string, string>;

  const result = await listLeads({
    status: status && VALID_STATUSES.includes(status) ? status : undefined,
    source: source && VALID_SOURCES.includes(source) ? source : undefined,
    search: search || undefined,
    sort: sort && VALID_SORTS.includes(sort) ? (sort as ListLeadsParams["sort"]) : undefined,
    page: page ? parseInt(page, 10) || 1 : undefined,
    pageSize: pageSize ? parseInt(pageSize, 10) || undefined : undefined,
  });

  res.json(result);
});

/**
 * GET /api/admin/leads/staff
 * Lists admin/employee profiles eligible to be assigned a lead or follow-up.
 * Must be registered before GET /leads/:id, or "staff" would be parsed as a lead id.
 */
router.get("/leads/staff", requireAdmin, async (_req, res) => {
  const { data, error } = await db
    .from("profiles")
    .select("id, name, email")
    .in("role", ["admin", "employee"])
    .order("name", { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ staff: data ?? [] });
});

/**
 * GET /api/admin/leads/followups
 * Cross-lead follow-up list — query params: status, assigned_to, due_before
 * Must be registered before GET /leads/:id, or "followups" would be parsed as a lead id.
 */
router.get("/leads/followups", requireAdmin, async (req, res) => {
  const { status, assigned_to, due_before } = req.query as Record<string, string>;
  const followups = await listFollowUps({
    status: status === "pending" || status === "completed" || status === "skipped" ? status : undefined,
    assignedTo: assigned_to || undefined,
    dueBefore: due_before || undefined,
  });
  res.json({ followups });
});

/**
 * GET /api/admin/leads/:id
 * Lead detail — full record, activity timeline, staff notes, and linked profile/
 * property/schedule request/subscription.
 */
router.get("/leads/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const detail = await getLead(id);
  if (!detail) return res.status(404).json({ error: "Lead not found" });
  res.json(detail);
});

/**
 * PATCH /api/admin/leads/:id
 * Manually update a lead's status. Body: { status, lost_reason? }
 * "lost" requires lost_reason. Status rank-check prevents unintentional
 * downgrades except to "lost" (terminal) or "new" (admin reset).
 */
router.patch("/leads/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { status, lost_reason } = req.body ?? {};

  if (!status || typeof status !== "string") {
    return res.status(400).json({ error: "status is required" });
  }
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` });
  }
  if (status === "lost" && !lost_reason?.trim()) {
    return res.status(400).json({ error: "lost_reason is required when status is 'lost'" });
  }

  try {
    const updated = await updateLeadStatus(id, status, lost_reason ?? null, req.adminUserId ?? null);
    if (!updated) return res.status(404).json({ error: "Lead not found" });
    res.json({ lead: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/admin/leads/:id/notes
 * Add a staff note to a lead. Body: { body: string }
 * Also writes a lead_activities row so the timeline reflects the note.
 */
router.post("/leads/:id/notes", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { body } = req.body ?? {};

  if (!body || typeof body !== "string" || !body.trim()) {
    return res.status(400).json({ error: "Note body cannot be empty" });
  }

  try {
    const note = await addLeadNote(id, body, req.adminUserId ?? null);
    if (!note) return res.status(404).json({ error: "Lead not found or note could not be created" });
    res.status(201).json({ note });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/admin/leads/:id/assign
 * Assigns a lead to a staff member. Body: { assigned_to: profileId }
 * Writes a lead_assignments history row and updates leads.assigned_to.
 */
router.post("/leads/:id/assign", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { assigned_to } = req.body ?? {};

  if (!assigned_to || typeof assigned_to !== "string") {
    return res.status(400).json({ error: "assigned_to is required" });
  }

  const updated = await assignLead(id, assigned_to, req.adminUserId ?? null);
  if (!updated) return res.status(404).json({ error: "Lead not found or assignment failed" });
  res.json({ lead: updated });
});

/**
 * POST /api/admin/leads/:id/followups
 * Body: { due_at, assigned_to?, notes? }
 */
router.post("/leads/:id/followups", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { due_at, assigned_to, notes } = req.body ?? {};

  if (!due_at || typeof due_at !== "string") {
    return res.status(400).json({ error: "due_at is required" });
  }

  const followup = await createFollowUp({
    leadId: id,
    dueAt: due_at,
    assignedTo: assigned_to ?? null,
    notes: notes ?? null,
    createdBy: req.adminUserId ?? null,
  });
  if (!followup) return res.status(400).json({ error: "Failed to create follow-up" });
  res.status(201).json({ followup });
});

/**
 * PATCH /api/admin/leads/followups/:followupId
 * Body: { status: "completed" | "skipped" }
 */
router.patch("/leads/followups/:followupId", requireAdmin, async (req, res) => {
  const { followupId } = req.params;
  const { status } = req.body ?? {};

  if (status !== "completed" && status !== "skipped") {
    return res.status(400).json({ error: "status must be 'completed' or 'skipped'" });
  }

  const followup = await updateFollowUpStatus(followupId, status, req.adminUserId ?? null);
  if (!followup) return res.status(404).json({ error: "Follow-up not found" });
  res.json({ followup });
});

/**
 * POST /api/admin/leads/quote
 * Admin Quote Lookup tool — look up a prospect's address and get a quote,
 * the same way the public quote widget does, but admin-authenticated (no
 * per-IP rate limit) and always upserting a lead assigned to this admin.
 * Body: { address, zip, city?, state?, lat?, lng?, placeId? }
 */
router.post("/leads/quote", requireAdmin, async (req, res) => {
  const { address, zip, city, state, lat, lng, placeId } = req.body ?? {};

  if (typeof address !== "string" || !address.trim()) {
    return res.status(400).json({ ok: false, code: "INVALID_ADDRESS", message: "Address is required." });
  }
  if (typeof zip !== "string" || !zip.trim()) {
    return res.status(400).json({ ok: false, code: "INVALID_ADDRESS", message: "ZIP code is required." });
  }

  const cleanZip = zip.trim().replace(/\D/g, "").slice(0, 5);
  const cleanState = (state?.trim() || "CA") as string;

  const result = await lookupParcel({
    address: address.trim(),
    zip: cleanZip,
    city: city?.trim(),
    state: cleanState,
    lat: typeof lat === "number" ? lat : undefined,
    lng: typeof lng === "number" ? lng : undefined,
    placeId: typeof placeId === "string" ? placeId : undefined,
  }, (req as any).requestId);

  if (isError(result)) {
    const status =
      result.errorCode === "INVALID_ADDRESS"        ? 400 :
      result.errorCode === "MANUAL_REVIEW_REQUIRED"  ? 422 : 503;
    return res.status(status).json({ ok: false, code: result.errorCode, message: result.message });
  }

  let outOfServiceArea = false;
  try {
    const saResult = await db
      .from("service_areas")
      .select("id")
      .eq("zip", cleanZip)
      .eq("is_active", true)
      .maybeSingle();
    outOfServiceArea = !saResult.data;
  } catch (err) {
    console.error("[adminLeads] service area check failed:", err);
  }

  const quote = !outOfServiceArea && result.acreage != null ? buildPricingQuote(result.acreage) : null;
  const oversized = result.acreage != null && result.acreage > 2.0;

  const lead = await upsertLeadFromAdminQuote({
    address: result.normalizedAddress,
    city: city?.trim() || null,
    state: cleanState,
    zip: cleanZip,
    acreage: result.acreage,
    county: result.county,
    createdByAdminId: req.adminUserId!,
  });

  return res.json({
    ok: true,
    leadId: lead?.id ?? null,
    outOfServiceArea,
    normalizedAddress: result.normalizedAddress,
    county: result.county,
    acreage: result.acreage,
    acreageSource: result.acreageSource,
    confidence: result.confidence,
    quote,
    oversized,
  });
});

/**
 * POST /api/admin/leads/:id/send-quote
 * Generates a quote-link token and emails/texts it to the prospect, with
 * the address and selected plan baked into the link.
 * Body: { channel: "email" | "sms" | "both", program, cadenceDays?, acreage?, email?, phone?, name? }
 * email/phone/name override the lead's stored contact info if provided.
 * acreage overrides the lead's stored (GIS-resolved) acreage -- required
 * for an oversized/shared parcel, where the admin enters a manual
 * treatment-area size in the Quote Lookup UI instead. Persisted to the
 * lead so the quote-link endpoint reflects the same number.
 */
router.post("/leads/:id/send-quote", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { channel, program, cadenceDays, acreage, email, phone, name } = req.body ?? {};

  if (channel !== "email" && channel !== "sms" && channel !== "both") {
    return res.status(400).json({ error: "channel must be 'email', 'sms', or 'both'" });
  }
  if (program !== "subscription" && program !== "one_time" && program !== "annual") {
    return res.status(400).json({ error: "program must be 'subscription', 'one_time', or 'annual'" });
  }

  const detail = await getLead(id);
  if (!detail) return res.status(404).json({ error: "Lead not found" });
  const lead = detail.lead;

  const recipientEmail = (email?.trim() || lead.email || "") as string;
  const recipientPhone = (phone?.trim() || lead.phone || "") as string;
  if ((channel === "email" || channel === "both") && !recipientEmail) {
    return res.status(400).json({ error: "No email address on file — provide one to send by email." });
  }
  if ((channel === "sms" || channel === "both") && !recipientPhone) {
    return res.status(400).json({ error: "No phone number on file — provide one to send by SMS." });
  }

  const effectiveAcreage = typeof acreage === "number" && acreage > 0 ? acreage : lead.acreage;
  if (effectiveAcreage == null) {
    return res.status(400).json({ error: "This lead has no resolved acreage yet — look up a quote first." });
  }

  // Persist anything the admin typed in here that wasn't already on the
  // lead — this is often the first time a phone/email/name is captured for
  // an admin-initiated quote, and it's real CRM data worth keeping, not
  // just a one-off send parameter.
  const leadUpdates: Record<string, unknown> = {};
  if (effectiveAcreage !== lead.acreage) leadUpdates.acreage = effectiveAcreage;
  if (!lead.name && name?.trim()) leadUpdates.name = name.trim();
  if (!lead.email && email?.trim()) leadUpdates.email = email.trim();
  if (!lead.phone && phone?.trim()) leadUpdates.phone = phone.trim();
  if (Object.keys(leadUpdates).length > 0) {
    await db.from("leads").update(leadUpdates).eq("id", id);
  }

  const quote = buildPricingQuote(effectiveAcreage);
  let priceCents: number | null = null;
  let programLabel = "";
  let cadenceLabelForToken: string | null = null;

  if (program === "subscription") {
    const days = typeof cadenceDays === "number" ? cadenceDays : quote.programs.subscription.defaultCadenceDays;
    const option = quote.programs.subscription.cadenceOptions.find((o) => o.cadenceDays === days);
    if (!option) return res.status(400).json({ error: "No pricing available for the selected cadence at this acreage." });
    priceCents = option.cents;
    programLabel = "Recurring Service";
    cadenceLabelForToken = String(days);
  } else if (program === "one_time") {
    priceCents = quote.programs.one_time.cents;
    programLabel = "One-Time Treatment";
  } else {
    priceCents = quote.programs.annual.cents;
    programLabel = "Annual Plan";
  }
  if (priceCents == null) {
    return res.status(400).json({ error: "No pricing available for the selected plan at this acreage." });
  }

  const priceLabel = program === "subscription"
    ? `${formatCentsServer(priceCents)} every ${cadenceLabelForToken} days`
    : program === "annual"
    ? `${formatCentsServer(priceCents)} / year`
    : `${formatCentsServer(priceCents)} one-time`;

  const tokenResult = await generateLeadQuoteToken(id);
  if (!tokenResult) return res.status(500).json({ error: "Failed to generate quote link." });

  const appUrl = process.env.APP_BASE_URL || "https://nomoremosquitoes.us";
  const quoteLinkUrl = `${appUrl}/login?qt=${encodeURIComponent(tokenResult.token)}`;
  const recipientName = name?.trim() || lead.name || "there";

  // Persist the program/cadence on the lead too, so the public quote-link
  // endpoint and the eventual onboarding pre-fill don't need them passed
  // separately.
  await db.from("leads").update({
    program,
    cadence: cadenceLabelForToken,
  }).eq("id", id);

  const sent = { email: false, sms: false };

  if (channel === "email" || channel === "both") {
    try {
      const { subject, html, text } = buildAdminQuoteEmail({
        recipientName,
        propertyAddress: lead.address || "your property",
        priceLabel,
        programLabel,
        quoteLinkUrl,
        supportEmail: process.env.SUPPORT_EMAIL || "support@nomoremosquitoes.us",
      });
      await getEmailProvider().send({ to: recipientEmail, from: getFromEmail(), subject, html, text });
      await logNotification({
        recipientEmail,
        channel: "email",
        notificationType: "admin_quote_sent",
        subject,
        status: "sent",
        provider: "resend",
        sentAt: new Date().toISOString(),
        payload: { lead_id: id },
      });
      sent.email = true;
    } catch (err: any) {
      console.error("[adminLeads] send-quote email failed:", err.message);
    }
  }

  if (channel === "sms" || channel === "both") {
    const fromNumber = process.env.TWILIO_FROM_NUMBER || "";
    if (!fromNumber) {
      console.log("[adminLeads] TWILIO_FROM_NUMBER not set -- skipping SMS for lead", id);
    } else {
      try {
        const body = buildAdminQuoteSms({ propertyAddress: lead.address || "your property", priceLabel, quoteLinkUrl });
        await getSmsProvider().send({ to: recipientPhone, from: fromNumber, body });
        await logNotification({
          recipientPhone,
          channel: "sms",
          notificationType: "admin_quote_sent",
          status: "sent",
          provider: "twilio",
          sentAt: new Date().toISOString(),
          payload: { lead_id: id },
        });
        sent.sms = true;
      } catch (err: any) {
        console.error("[adminLeads] send-quote SMS failed:", err.message);
      }
    }
  }

  await recordLeadActivity({
    leadId: id,
    activityType: "quote_sent",
    actor: "admin",
    actorId: req.adminUserId ?? null,
    payload: { channel, program, priceLabel, sent },
  });

  res.json({ ok: true, sent, quoteLinkUrl });
});

/**
 * GET /api/leads/quote-link/:token
 * Public, unauthenticated. Resolves a quote-link token (sent via the admin
 * Quote Lookup tool) to the lead's quote-relevant fields only -- never the
 * full lead record. 404 if the token is missing, unknown, or expired.
 */
router.get("/leads/quote-link/:token", async (req, res) => {
  const { token } = req.params;
  const lead = await getLeadByQuoteToken(token);
  if (!lead) return res.status(404).json({ ok: false, message: "This quote link is invalid or has expired." });

  let estimatedPriceCents: number | null = null;
  if (lead.acreage != null) {
    const quote = buildPricingQuote(lead.acreage);
    if (lead.program === "subscription") {
      const days = lead.cadence ? parseInt(lead.cadence, 10) : quote.programs.subscription.defaultCadenceDays;
      estimatedPriceCents = quote.programs.subscription.cadenceOptions.find((o) => o.cadenceDays === days)?.cents ?? null;
    } else if (lead.program === "one_time") {
      estimatedPriceCents = quote.programs.one_time.cents;
    } else if (lead.program === "annual") {
      estimatedPriceCents = quote.programs.annual.cents;
    }
  }

  res.json({
    ok: true,
    address: lead.address,
    city: lead.city,
    state: lead.state,
    zip: lead.zip,
    acreage: lead.acreage,
    program: lead.program,
    cadenceDays: lead.program === "subscription" && lead.cadence ? parseInt(lead.cadence, 10) : null,
    estimatedPriceCents,
    name: lead.name,
    email: lead.email,
  });
});

export default router;
