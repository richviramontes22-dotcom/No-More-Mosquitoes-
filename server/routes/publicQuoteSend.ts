import { Router } from "express";
import type { Request, Response } from "express";
import { checkRateLimit } from "../services/parcel/rateLimit";
import {
  upsertLeadFromQuote,
  createQuoteInvite,
  recordLeadActivity,
} from "../services/leads/leadService";
import {
  getEmailProvider,
  getSmsProvider,
  getSmsFromNumber,
  getFromEmail,
} from "../services/notifications/providers/index";
import { buildAdminQuoteEmail } from "../services/notifications/emailTemplates";
import { buildAdminQuoteSms } from "../services/notifications/smsTemplates";
import { logNotification } from "../services/notifications/notificationLogger";

const router = Router();

/**
 * POST /api/public/quote-send
 *
 * Public endpoint — called by QuoteWidgetSection after address + contact info are
 * collected. Creates/enriches a lead record and sends the quote via email + SMS
 * using the same infrastructure as POST /api/admin/leads/:id/send-quote.
 *
 * Rate-limited (same in-memory bucket as /api/parcel/quote).
 * Does NOT require authentication.
 */
router.post("/public/quote-send", async (req: Request, res: Response) => {
  const { allowed, retryAfterMs } = checkRateLimit(req);
  if (!allowed) {
    res.setHeader("Retry-After", Math.ceil(retryAfterMs / 1000).toString());
    return res.status(429).json({ ok: false, code: "RATE_LIMITED", error: "Too many requests. Please try again shortly." });
  }

  const {
    firstName,
    email,
    phone,
    address,
    city,
    state,
    zip,
    acreage,
    oversized,
    program,
    cadenceDays,
    estimatedPrice,
    lat,
    lng,
  } = req.body;

  // Validate required fields
  if (!firstName?.toString().trim()) {
    return res.status(400).json({ ok: false, error: "First name is required." });
  }
  if (!email?.toString().trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ ok: false, error: "A valid email address is required." });
  }
  if (!phone?.toString().trim()) {
    return res.status(400).json({ ok: false, error: "Phone number is required." });
  }
  if (!address?.toString().trim()) {
    return res.status(400).json({ ok: false, error: "Address is required." });
  }
  if (!zip?.toString().trim()) {
    return res.status(400).json({ ok: false, error: "ZIP code is required." });
  }
  if (acreage == null || isNaN(Number(acreage)) || Number(acreage) <= 0) {
    return res.status(400).json({ ok: false, error: "Valid acreage is required." });
  }

  const normalizedFirstName = firstName.toString().trim();
  const normalizedEmail     = email.toString().trim().toLowerCase();
  const normalizedPhone     = phone.toString().replace(/\D/g, "");
  const resolvedAcreage     = Number(acreage);
  const resolvedProgram     = program?.toString() ?? "subscription";
  const resolvedCadenceDays = cadenceDays != null ? Number(cadenceDays) : 21;
  const resolvedPrice       = estimatedPrice != null ? Number(estimatedPrice) : null;

  // Upsert lead with contact info
  const lead = await upsertLeadFromQuote({
    address: address.toString().trim(),
    city: city?.toString().trim() ?? null,
    state: state?.toString().trim() ?? null,
    zip: zip.toString().trim(),
    acreage: resolvedAcreage,
    name: normalizedFirstName,
    email: normalizedEmail,
    phone: normalizedPhone,
    source: "public_quote",
  }).catch((err) => {
    console.error("[publicQuoteSend] upsertLeadFromQuote failed:", err?.message);
    return null;
  });

  if (!lead) {
    // Lead upsert failing is non-fatal — still try to send notifications
    console.error("[publicQuoteSend] Lead upsert returned null; continuing without lead ID.");
  }

  const leadId = lead?.id ?? null;

  // For oversized properties we can't compute a final price, so skip quote send
  if (oversized) {
    if (leadId) {
      await recordLeadActivity({
        leadId,
        activityType: "quote_requested",
        payload: {
          source: "public_quote",
          oversized: true,
          address: address.toString().trim(),
          acreage: resolvedAcreage,
        },
      }).catch(() => {});
    }
    return res.json({ ok: true, leadId, sent: { email: false, sms: false }, oversized: true });
  }

  // Build price label for email/SMS
  const priceCents = resolvedPrice != null ? Math.round(resolvedPrice * 100) : null;
  const formatDollars = (cents: number) => `$${(cents / 100).toFixed(0)}`;
  const priceLabel = priceCents != null
    ? (resolvedProgram === "annual"
        ? `${formatDollars(priceCents)} / year`
        : resolvedProgram === "one_time"
          ? `${formatDollars(priceCents)} one-time`
          : `${formatDollars(priceCents)} / visit`)
    : "custom quote";

  const programLabel =
    resolvedProgram === "annual"      ? "Annual Plan" :
    resolvedProgram === "one_time"    ? "One-Time Treatment" :
    "Recurring Service";

  const cadenceDescription = resolvedProgram === "subscription"
    ? `Treatment every ${resolvedCadenceDays} days`
    : undefined;

  // Create quote invite (revokes any previous pending invite for this lead)
  let inviteResult: { token: string } | null = null;
  if (leadId) {
    inviteResult = await createQuoteInvite({
      leadId,
      address: address.toString().trim(),
      city: city?.toString().trim() ?? null,
      state: state?.toString().trim() ?? null,
      zip: zip.toString().trim(),
      planType: resolvedProgram,
      cadenceDays: resolvedProgram === "subscription" ? resolvedCadenceDays : null,
      priceCents,
      acreage: resolvedAcreage,
      priceLabel,
      programLabel,
      customerName: normalizedFirstName,
      customerEmail: normalizedEmail,
      customerPhone: normalizedPhone,
    }).catch((err) => {
      console.error("[publicQuoteSend] createQuoteInvite failed:", err?.message);
      return null;
    });
  }

  const appUrl = process.env.APP_BASE_URL || "https://nomoremosquitoes.us";
  const quoteLinkUrl = inviteResult ? `${appUrl}/quote-invite/${inviteResult.token}` : `${appUrl}/schedule`;

  const sent = { email: false, sms: false };

  // Send email
  try {
    const { subject, html, text } = buildAdminQuoteEmail({
      recipientName: normalizedFirstName,
      propertyAddress: address.toString().trim(),
      priceLabel,
      programLabel,
      cadenceDescription,
      quoteLinkUrl,
      supportEmail: process.env.SUPPORT_EMAIL || "support@nomoremosquitoes.us",
      supportPhone: process.env.SUPPORT_PHONE,
    });
    await getEmailProvider().send({ to: normalizedEmail, from: getFromEmail(), subject, html, text });
    sent.email = true;
    if (leadId) {
      await logNotification({
        recipientEmail: normalizedEmail,
        channel: "email",
        notificationType: "admin_quote_sent",
        subject,
        status: "sent",
        provider: "resend",
        sentAt: new Date().toISOString(),
        payload: { lead_id: leadId },
      }).catch(() => {});
    }
  } catch (err: any) {
    console.error("[publicQuoteSend] email send failed:", err?.message);
  }

  // Send SMS (best-effort — only if provider and from-number are configured)
  const fromNumber = getSmsFromNumber();
  if (fromNumber && normalizedPhone.length >= 10) {
    try {
      const body = buildAdminQuoteSms({
        propertyAddress: address.toString().trim(),
        priceLabel,
        quoteLinkUrl,
      });
      await getSmsProvider().send({ to: normalizedPhone, from: fromNumber, body });
      sent.sms = true;
      if (leadId) {
        await logNotification({
          recipientPhone: normalizedPhone,
          channel: "sms",
          notificationType: "admin_quote_sent",
          status: "sent",
          provider: process.env.SMS_PROVIDER || "twilio",
          sentAt: new Date().toISOString(),
          payload: { lead_id: leadId },
        }).catch(() => {});
      }
    } catch (err: any) {
      console.error("[publicQuoteSend] SMS send failed:", err?.message);
    }
  }

  if (leadId) {
    await recordLeadActivity({
      leadId,
      activityType: "quote_sent",
      actor: "system",
      payload: {
        source: "public_quote",
        channel: "both",
        program: resolvedProgram,
        priceLabel,
        sent,
      },
    }).catch(() => {});
  }

  return res.json({ ok: true, leadId, sent });
});

export default router;
