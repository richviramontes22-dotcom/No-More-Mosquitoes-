import { supabase } from "../../lib/supabase";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { buildLeadAddressHash } from "../parcel/cache";

// Service-role bypasses RLS for lead writes triggered by anonymous customer
// flows (quote widget, schedule form) — same pattern used across server/routes/admin*.ts.
const db = supabaseAdmin ?? supabase;

export type LeadSource = "quote" | "manual_review" | "schedule_request";
export type LeadStatus = "new" | "manual_review" | "scheduled";
export type LeadActivityType =
  | "created"
  | "quote_requested"
  | "manual_review"
  | "schedule_request_received"
  | "merged";
export type LeadActivityActor = "system" | "admin";

export interface Lead {
  id: string;
  source: string;
  status: string;
  address_hash: string | null;
  address: string | null;
  zip: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  acreage: number | null;
  program: string | null;
  cadence: string | null;
  manual_review_reason: string | null;
  profile_id: string | null;
  property_id: string | null;
  subscription_id: string | null;
  schedule_request_id: string | null;
  admin_alert_id: string | null;
  converted_customer_id: string | null;
  first_seen_at: string;
  last_seen_at: string;
  converted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeadActivity {
  id: string;
  lead_id: string;
  activity_type: string;
  actor: LeadActivityActor;
  actor_id: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
}

export interface LeadDetail {
  lead: Lead;
  activities: LeadActivity[];
  linked: {
    profile: Record<string, unknown> | null;
    property: Record<string, unknown> | null;
    scheduleRequest: Record<string, unknown> | null;
    subscription: Record<string, unknown> | null;
  };
}

export interface LeadListItem extends Lead {
  activity_count: number;
}

export interface ListLeadsParams {
  status?: string;
  source?: string;
  search?: string;
  sort?: "created_at_desc" | "created_at_asc" | "last_seen_at_desc" | "last_seen_at_asc";
  page?: number;
  pageSize?: number;
}

export interface ListLeadsResult {
  leads: LeadListItem[];
  total: number;
  page: number;
  pageSize: number;
}

const DEFAULT_PAGE_SIZE = 25;

/**
 * Status precedence used by merge logic — never move a lead "backwards".
 * `scheduled` outranks `new`/`manual_review` so a later schedule request
 * always wins, but a later manual-review hit on an already-scheduled lead
 * doesn't downgrade it back to manual_review.
 */
const STATUS_RANK: Record<string, number> = {
  new: 0,
  manual_review: 0,
  scheduled: 1,
};

function shouldAdvanceStatus(currentStatus: string, nextStatus: LeadStatus): boolean {
  const currentRank = STATUS_RANK[currentStatus] ?? 0;
  const nextRank = STATUS_RANK[nextStatus] ?? 0;
  return nextRank >= currentRank;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

/**
 * Finds an existing lead to merge into, checked in dedup-priority order:
 * 1. address_hash (same property)
 * 2. email (same person, different/no address match)
 * 3. phone (same person, different/no address+email match)
 */
async function findExistingLead(params: {
  addressHash?: string | null;
  email?: string | null;
  phone?: string | null;
}): Promise<Lead | null> {
  const { addressHash, email, phone } = params;

  if (addressHash) {
    const { data } = await db
      .from("leads")
      .select("*")
      .eq("address_hash", addressHash)
      .order("last_seen_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) return data as Lead;
  }

  if (email) {
    const { data } = await db
      .from("leads")
      .select("*")
      .ilike("email", email)
      .order("last_seen_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) return data as Lead;
  }

  if (phone) {
    const { data } = await db
      .from("leads")
      .select("*")
      .eq("phone", phone)
      .order("last_seen_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) return data as Lead;
  }

  return null;
}

/**
 * Appends a row to the lead's activity timeline. Failures are logged but
 * never thrown — activity logging must not break the calling request
 * (quote/manual-review/schedule-request all run on customer-facing paths).
 */
export async function recordLeadActivity(params: {
  leadId: string;
  activityType: LeadActivityType | string;
  actor?: LeadActivityActor;
  actorId?: string | null;
  payload?: Record<string, unknown> | null;
}): Promise<void> {
  const { leadId, activityType, actor = "system", actorId = null, payload = null } = params;

  const { error } = await db.from("lead_activities").insert({
    lead_id: leadId,
    activity_type: activityType,
    actor,
    actor_id: actorId,
    payload,
  });

  if (error) {
    console.error("[leadService] Failed to record lead activity:", error.message);
  }
}

export interface UpsertLeadFromQuoteParams {
  address: string;
  city?: string | null;
  state?: string | null;
  zip: string;
  acreage?: number | null;
  county?: string | null;
  program?: string | null;
  cadence?: string | null;
  adminAlertId?: string | null;
}

/**
 * Creates or updates a lead for a successful instant quote.
 * Dedups on address_hash — a repeat quote for the same address updates
 * `last_seen_at` and logs a `quote_requested` activity instead of creating
 * a duplicate lead.
 */
export async function upsertLeadFromQuote(params: UpsertLeadFromQuoteParams): Promise<Lead | null> {
  const addressHash = buildLeadAddressHash(params.address, params.city, params.state, params.zip);
  const existing = await findExistingLead({ addressHash });
  const now = new Date().toISOString();

  if (existing) {
    const updates: Record<string, unknown> = { last_seen_at: now };
    if (params.acreage != null && existing.acreage == null) updates.acreage = params.acreage;
    if (params.program && !existing.program) updates.program = params.program;
    if (params.cadence && !existing.cadence) updates.cadence = params.cadence;

    const { data, error } = await db
      .from("leads")
      .update(updates)
      .eq("id", existing.id)
      .select("*")
      .single();

    if (error || !data) {
      console.error("[leadService] upsertLeadFromQuote update failed:", error?.message);
      return existing;
    }

    await recordLeadActivity({
      leadId: existing.id,
      activityType: "quote_requested",
      payload: {
        address: params.address,
        zip: params.zip,
        acreage: params.acreage ?? null,
        county: params.county ?? null,
      },
    });

    return data as Lead;
  }

  const { data, error } = await db
    .from("leads")
    .insert({
      source: "quote",
      status: "new",
      address_hash: addressHash,
      address: params.address,
      zip: params.zip,
      acreage: params.acreage ?? null,
      program: params.program ?? null,
      cadence: params.cadence ?? null,
      admin_alert_id: params.adminAlertId ?? null,
      first_seen_at: now,
      last_seen_at: now,
    })
    .select("*")
    .single();

  if (error || !data) {
    console.error("[leadService] upsertLeadFromQuote insert failed:", error?.message);
    return null;
  }

  await recordLeadActivity({
    leadId: data.id,
    activityType: "created",
    payload: {
      source: "quote",
      address: params.address,
      zip: params.zip,
      acreage: params.acreage ?? null,
      county: params.county ?? null,
    },
  });

  return data as Lead;
}

export interface UpsertLeadFromManualReviewParams {
  address: string;
  city?: string | null;
  state?: string | null;
  zip: string;
  manualReviewReason: string;
  adminAlertId?: string | null;
}

/**
 * Creates or updates a lead for a quote attempt that requires manual review.
 * Dedups on address_hash — uses the SAME hash inputs as upsertLeadFromQuote
 * (see buildLeadAddressHash), so a manual-review hit for an address that was
 * already instant-quoted merges into that lead instead of duplicating it.
 */
export async function upsertLeadFromManualReview(params: UpsertLeadFromManualReviewParams): Promise<Lead | null> {
  const addressHash = buildLeadAddressHash(params.address, params.city, params.state, params.zip);
  const existing = await findExistingLead({ addressHash });
  const now = new Date().toISOString();

  if (existing) {
    const updates: Record<string, unknown> = {
      last_seen_at: now,
      manual_review_reason: params.manualReviewReason,
    };
    if (shouldAdvanceStatus(existing.status, "manual_review")) {
      updates.status = "manual_review";
    }

    const { data, error } = await db
      .from("leads")
      .update(updates)
      .eq("id", existing.id)
      .select("*")
      .single();

    if (error || !data) {
      console.error("[leadService] upsertLeadFromManualReview update failed:", error?.message);
      return existing;
    }

    await recordLeadActivity({
      leadId: existing.id,
      activityType: "manual_review",
      payload: {
        reason: params.manualReviewReason,
        address: params.address,
        zip: params.zip,
      },
    });

    return data as Lead;
  }

  const { data, error } = await db
    .from("leads")
    .insert({
      source: "manual_review",
      status: "manual_review",
      address_hash: addressHash,
      address: params.address,
      zip: params.zip,
      manual_review_reason: params.manualReviewReason,
      admin_alert_id: params.adminAlertId ?? null,
      first_seen_at: now,
      last_seen_at: now,
    })
    .select("*")
    .single();

  if (error || !data) {
    console.error("[leadService] upsertLeadFromManualReview insert failed:", error?.message);
    return null;
  }

  await recordLeadActivity({
    leadId: data.id,
    activityType: "created",
    payload: {
      source: "manual_review",
      reason: params.manualReviewReason,
      address: params.address,
      zip: params.zip,
    },
  });

  return data as Lead;
}

export interface UpsertLeadFromScheduleRequestParams {
  scheduleRequestId: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  city?: string | null;
  state?: string | null;
  zip: string;
  acreage?: number | null;
  cadence?: string | null;
  profileId?: string | null;
  propertyId?: string | null;
  adminAlertId?: string | null;
}

/**
 * Creates or updates a lead for a submitted schedule request — the richest
 * lead-capture point. Dedups in priority order: address_hash, then email,
 * then phone, so a schedule request merges into an earlier anonymous
 * quote/manual-review lead for the same property (or the same person at a
 * different address) instead of creating a duplicate.
 */
export async function upsertLeadFromScheduleRequest(params: UpsertLeadFromScheduleRequestParams): Promise<Lead | null> {
  const addressHash = buildLeadAddressHash(params.address, params.city, params.state, params.zip);
  const normalizedEmail = normalizeEmail(params.email);
  const normalizedPhone = normalizePhone(params.phone);

  const existing = await findExistingLead({
    addressHash,
    email: normalizedEmail,
    phone: normalizedPhone,
  });
  const now = new Date().toISOString();

  if (existing) {
    const updates: Record<string, unknown> = {
      last_seen_at: now,
      schedule_request_id: params.scheduleRequestId,
    };
    if (shouldAdvanceStatus(existing.status, "scheduled")) updates.status = "scheduled";
    if (!existing.name) updates.name = params.name;
    if (!existing.email) updates.email = normalizedEmail;
    if (!existing.phone) updates.phone = normalizedPhone;
    if (!existing.address) updates.address = params.address;
    if (!existing.zip) updates.zip = params.zip;
    if (!existing.address_hash) updates.address_hash = addressHash;
    if (params.acreage != null && existing.acreage == null) updates.acreage = params.acreage;
    if (params.cadence && !existing.cadence) updates.cadence = params.cadence;
    if (params.profileId && !existing.profile_id) updates.profile_id = params.profileId;
    if (params.propertyId && !existing.property_id) updates.property_id = params.propertyId;

    const { data, error } = await db
      .from("leads")
      .update(updates)
      .eq("id", existing.id)
      .select("*")
      .single();

    if (error || !data) {
      console.error("[leadService] upsertLeadFromScheduleRequest update failed:", error?.message);
      return existing;
    }

    const matchedOn: "address_hash" | "email" | "phone" =
      existing.address_hash === addressHash
        ? "address_hash"
        : existing.email && existing.email === normalizedEmail
          ? "email"
          : "phone";

    await recordLeadActivity({
      leadId: existing.id,
      activityType: matchedOn === "address_hash" ? "schedule_request_received" : "merged",
      payload: {
        schedule_request_id: params.scheduleRequestId,
        matched_on: matchedOn,
        name: params.name,
        email: normalizedEmail,
        phone: normalizedPhone,
      },
    });

    return data as Lead;
  }

  const { data, error } = await db
    .from("leads")
    .insert({
      source: "schedule_request",
      status: "scheduled",
      address_hash: addressHash,
      address: params.address,
      zip: params.zip,
      name: params.name,
      email: normalizedEmail,
      phone: normalizedPhone,
      acreage: params.acreage ?? null,
      cadence: params.cadence ?? null,
      profile_id: params.profileId ?? null,
      property_id: params.propertyId ?? null,
      schedule_request_id: params.scheduleRequestId,
      admin_alert_id: params.adminAlertId ?? null,
      first_seen_at: now,
      last_seen_at: now,
    })
    .select("*")
    .single();

  if (error || !data) {
    console.error("[leadService] upsertLeadFromScheduleRequest insert failed:", error?.message);
    return null;
  }

  await recordLeadActivity({
    leadId: data.id,
    activityType: "created",
    payload: {
      source: "schedule_request",
      schedule_request_id: params.scheduleRequestId,
      name: params.name,
      email: normalizedEmail,
      phone: normalizedPhone,
    },
  });

  return data as Lead;
}

/**
 * Fetches a single lead with its full activity timeline and any linked
 * records (profile/property/schedule request/subscription) for the admin
 * lead detail view. Returns null if the lead doesn't exist.
 */
export async function getLead(id: string): Promise<LeadDetail | null> {
  const { data: lead, error } = await db.from("leads").select("*").eq("id", id).maybeSingle();
  if (error || !lead) return null;

  const { data: activities } = await db
    .from("lead_activities")
    .select("*")
    .eq("lead_id", id)
    .order("created_at", { ascending: true });

  const linked: LeadDetail["linked"] = {
    profile: null,
    property: null,
    scheduleRequest: null,
    subscription: null,
  };

  if (lead.profile_id) {
    const { data } = await db.from("profiles").select("*").eq("id", lead.profile_id).maybeSingle();
    linked.profile = data ?? null;
  }
  if (lead.property_id) {
    const { data } = await db.from("properties").select("*").eq("id", lead.property_id).maybeSingle();
    linked.property = data ?? null;
  }
  if (lead.schedule_request_id) {
    const { data } = await db.from("schedule_requests").select("*").eq("id", lead.schedule_request_id).maybeSingle();
    linked.scheduleRequest = data ?? null;
  }
  if (lead.subscription_id) {
    const { data } = await db.from("subscriptions").select("*").eq("id", lead.subscription_id).maybeSingle();
    linked.subscription = data ?? null;
  }

  return {
    lead: lead as Lead,
    activities: (activities ?? []) as LeadActivity[],
    linked,
  };
}

const SORT_MAP: Record<string, { column: string; ascending: boolean }> = {
  created_at_desc: { column: "created_at", ascending: false },
  created_at_asc: { column: "created_at", ascending: true },
  last_seen_at_desc: { column: "last_seen_at", ascending: false },
  last_seen_at_asc: { column: "last_seen_at", ascending: true },
};

/**
 * Lists leads for the admin Lead Inbox with status/source/search filters,
 * sorting, and pagination (default 25/page). Each lead is annotated with
 * its activity count for the list view.
 */
export async function listLeads(params: ListLeadsParams = {}): Promise<ListLeadsResult> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(Math.max(1, params.pageSize ?? DEFAULT_PAGE_SIZE), 100);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = db.from("leads").select("*", { count: "exact" });

  if (params.status) query = query.eq("status", params.status);
  if (params.source) query = query.eq("source", params.source);

  const term = params.search?.trim();
  if (term) {
    const like = `%${term}%`;
    query = query.or(
      [`name.ilike.${like}`, `email.ilike.${like}`, `phone.ilike.${like}`, `address.ilike.${like}`].join(","),
    );
  }

  const sort = SORT_MAP[params.sort ?? "created_at_desc"] ?? SORT_MAP.created_at_desc;
  query = query.order(sort.column, { ascending: sort.ascending }).range(from, to);

  const { data, error, count } = await query;
  if (error) {
    console.error("[leadService] listLeads failed:", error.message);
    return { leads: [], total: 0, page, pageSize };
  }

  const leads = (data ?? []) as Lead[];
  const leadIds = leads.map((l) => l.id);

  const activityCounts: Record<string, number> = {};
  if (leadIds.length > 0) {
    const { data: activityRows } = await db
      .from("lead_activities")
      .select("lead_id")
      .in("lead_id", leadIds);

    for (const row of activityRows ?? []) {
      activityCounts[row.lead_id] = (activityCounts[row.lead_id] ?? 0) + 1;
    }
  }

  return {
    leads: leads.map((lead) => ({ ...lead, activity_count: activityCounts[lead.id] ?? 0 })),
    total: count ?? 0,
    page,
    pageSize,
  };
}
