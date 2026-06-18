import { supabase } from "../../lib/supabase";
import { supabaseAdmin } from "../../lib/supabaseAdmin";

const db = supabaseAdmin ?? supabase;

export type ReferralOwnerType = "customer" | "partner";
export type PartnerType = "hoa" | "property_manager" | "landscaper" | "realtor" | "pest_control" | "other";
export type ReferralStatus = "pending" | "conversion_candidate" | "converted" | "rewarded" | "invalid";
export type RewardType = "account_credit" | "service_credit" | "free_service" | "manual_reward";
export type RewardStatus = "pending" | "approved" | "issued" | "denied";

export interface ReferralCode {
  id: string;
  code: string;
  owner_type: ReferralOwnerType;
  customer_id: string | null;
  partner_name: string | null;
  partner_type: PartnerType | null;
  partner_contact_email: string | null;
  partner_contact_phone: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Referral {
  id: string;
  referral_code_id: string;
  lead_id: string | null;
  referred_customer_id: string | null;
  appointment_id: string | null;
  subscription_id: string | null;
  conversion_value_cents: number | null;
  status: ReferralStatus;
  created_at: string;
  updated_at: string;
}

export interface ReferralReward {
  id: string;
  referral_id: string;
  reward_type: RewardType;
  amount_cents: number | null;
  status: RewardStatus;
  notes: string | null;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I — avoids ambiguous codes

function generateCode(length = 8): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

/**
 * Returns the customer's referral code, creating one on first call. Retries
 * on the rare random-code collision (unique constraint on `code`).
 */
export async function getOrCreateCustomerReferralCode(customerId: string): Promise<ReferralCode> {
  const { data: existing } = await db
    .from("referral_codes")
    .select("*")
    .eq("customer_id", customerId)
    .eq("owner_type", "customer")
    .maybeSingle();

  if (existing) return existing as ReferralCode;

  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await db
      .from("referral_codes")
      .insert({ code: generateCode(), owner_type: "customer", customer_id: customerId })
      .select("*")
      .single();

    if (!error && data) return data as ReferralCode;

    // Unique violation on `code` — try again with a new random code.
    if (error?.code !== "23505") {
      throw new Error(error?.message ?? "Failed to create referral code");
    }
  }

  throw new Error("Failed to generate a unique referral code after 5 attempts");
}

export interface CreatePartnerCodeParams {
  partnerName: string;
  partnerType?: PartnerType;
  contactEmail?: string;
  contactPhone?: string;
  code?: string; // optional human-chosen code (e.g. "SUNVALLEY-HOA")
}

export async function createPartnerReferralCode(params: CreatePartnerCodeParams): Promise<ReferralCode> {
  const code = (params.code?.trim().toUpperCase()) || generateCode(10);

  const { data, error } = await db
    .from("referral_codes")
    .insert({
      code,
      owner_type: "partner",
      partner_name: params.partnerName,
      partner_type: params.partnerType ?? "other",
      partner_contact_email: params.contactEmail ?? null,
      partner_contact_phone: params.contactPhone ?? null,
    })
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Failed to create partner referral code");
  return data as ReferralCode;
}

export async function listReferralCodes(): Promise<ReferralCode[]> {
  const { data } = await db.from("referral_codes").select("*").order("created_at", { ascending: false });
  return (data ?? []) as ReferralCode[];
}

export async function updateReferralCode(
  id: string,
  updates: Partial<Pick<ReferralCode, "active" | "partner_name" | "partner_type" | "partner_contact_email" | "partner_contact_phone">>
): Promise<ReferralCode | null> {
  const { data, error } = await db.from("referral_codes").update(updates).eq("id", id).select("*").single();
  if (error) {
    console.error("[referralService] updateReferralCode failed:", error.message);
    return null;
  }
  return data as ReferralCode;
}

export interface ValidateReferralCodeResult {
  valid: boolean;
  referral_code_id?: string;
  owner_type?: ReferralOwnerType;
  error?: string;
}

/** Public-facing validation — used before attributing a lead to a code. */
export async function validateReferralCode(code: string): Promise<ValidateReferralCodeResult> {
  if (!code || typeof code !== "string") return { valid: false, error: "Code is required" };

  const normalized = code.trim().toUpperCase();
  const { data, error } = await db
    .from("referral_codes")
    .select("id, owner_type, active")
    .eq("code", normalized)
    .eq("active", true)
    .maybeSingle();

  if (error) return { valid: false, error: "Unable to validate code. Please try again." };
  if (!data) return { valid: false, error: "This referral code is not valid." };

  return { valid: true, referral_code_id: data.id, owner_type: data.owner_type };
}

/**
 * Attributes a lead to a referral code. Best-effort: failures (invalid code,
 * already-attributed lead) are returned as null rather than thrown, since
 * callers (schedule-request submission) must never fail the customer-facing
 * request because of a referral-attribution problem.
 */
export async function attributeReferral(params: { code: string; leadId: string }): Promise<Referral | null> {
  const validation = await validateReferralCode(params.code);
  if (!validation.valid || !validation.referral_code_id) {
    console.warn(`[referralService] attributeReferral: invalid code "${params.code}" — skipping`);
    return null;
  }

  const { data, error } = await db
    .from("referrals")
    .insert({ referral_code_id: validation.referral_code_id, lead_id: params.leadId })
    .select("*")
    .single();

  if (error) {
    // Unique violation (23505) means this lead was already attributed — not an error, just a no-op.
    if (error.code !== "23505") {
      console.error("[referralService] attributeReferral insert failed:", error.message);
    }
    return null;
  }

  return data as Referral;
}

export interface ListReferralsParams {
  status?: ReferralStatus;
  referralCodeId?: string;
}

export async function listReferrals(params: ListReferralsParams = {}): Promise<Referral[]> {
  let query = db.from("referrals").select("*").order("created_at", { ascending: false });
  if (params.status) query = query.eq("status", params.status);
  if (params.referralCodeId) query = query.eq("referral_code_id", params.referralCodeId);

  const { data } = await query;
  return (data ?? []) as Referral[];
}

export async function countConvertedReferralsForCode(referralCodeId: string): Promise<number> {
  const { count } = await db
    .from("referrals")
    .select("id", { count: "exact", head: true })
    .eq("referral_code_id", referralCodeId)
    .in("status", ["converted", "rewarded"]);
  return count ?? 0;
}

/**
 * Manual admin action — marks a referral converted/rewarded/invalid and
 * optionally attaches the resulting appointment/subscription/value. Does
 * NOT touch Stripe or any billing flow — see REFERRAL_PROGRAM_DESIGN_REPORT.md
 * for why automatic conversion detection is out of scope for this foundation.
 */
export async function updateReferralStatus(
  id: string,
  updates: Partial<Pick<Referral, "status" | "appointment_id" | "subscription_id" | "conversion_value_cents" | "referred_customer_id">>
): Promise<Referral | null> {
  const { data, error } = await db.from("referrals").update(updates).eq("id", id).select("*").single();
  if (error) {
    console.error("[referralService] updateReferralStatus failed:", error.message);
    return null;
  }
  return data as Referral;
}

// ─── Conversion detection (Platform Growth Phase 2) ───────────────────────────
// Read-only observation: flags referrals as 'conversion_candidate' when the
// underlying lead now has a subscription/converted_customer_id. Never marks a
// referral 'converted' itself, never creates a reward, never touches Stripe —
// an admin always makes the actual conversion call. See
// REFERRAL_AUTOMATION_PHASE2_REPORT.md for the full design rationale.

export interface DetectConversionCandidatesResult {
  checked: number;
  flagged: number;
  flaggedReferralIds: string[];
}

export async function detectConversionCandidates(): Promise<DetectConversionCandidatesResult> {
  const { data: pendingReferrals } = await db
    .from("referrals")
    .select("id, lead_id")
    .eq("status", "pending")
    .not("lead_id", "is", null);

  const rows = pendingReferrals ?? [];
  if (rows.length === 0) return { checked: 0, flagged: 0, flaggedReferralIds: [] };

  const leadIds = [...new Set(rows.map((r: any) => r.lead_id))];
  const { data: leads } = await db
    .from("leads")
    .select("id, subscription_id, converted_customer_id")
    .in("id", leadIds);

  const convertedLeadIds = new Set(
    (leads ?? [])
      .filter((l: any) => l.subscription_id != null || l.converted_customer_id != null)
      .map((l: any) => l.id)
  );

  const toFlag = rows.filter((r: any) => convertedLeadIds.has(r.lead_id)).map((r: any) => r.id);

  if (toFlag.length > 0) {
    await db.from("referrals").update({ status: "conversion_candidate" }).in("id", toFlag);
  }

  return { checked: rows.length, flagged: toFlag.length, flaggedReferralIds: toFlag };
}

// ─── Reward rule settings (singleton) ─────────────────────────────────────────

export interface ReferralRewardSettings {
  id: string;
  enabled: boolean;
  customer_reward_type: RewardType;
  customer_reward_amount_cents: number | null;
  partner_reward_type: RewardType;
  partner_reward_amount_cents: number | null;
  auto_create_rewards: boolean;
  require_admin_approval: boolean;
  updated_by: string | null;
  updated_at: string;
  created_at: string;
}

const DEFAULT_REWARD_SETTINGS = {
  enabled: false,
  customer_reward_type: "account_credit" as RewardType,
  customer_reward_amount_cents: null,
  partner_reward_type: "manual_reward" as RewardType,
  partner_reward_amount_cents: null,
  auto_create_rewards: false,
  require_admin_approval: true,
};

export async function getRewardSettings(): Promise<ReferralRewardSettings> {
  const { data } = await db
    .from("referral_reward_settings")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (data) return data as ReferralRewardSettings;

  const { data: created, error } = await db
    .from("referral_reward_settings")
    .insert(DEFAULT_REWARD_SETTINGS)
    .select("*")
    .single();

  if (error || !created) {
    return { id: "", ...DEFAULT_REWARD_SETTINGS, updated_by: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  }
  return created as ReferralRewardSettings;
}

export async function updateRewardSettings(
  updates: Partial<Omit<ReferralRewardSettings, "id" | "created_at" | "updated_at">>
): Promise<ReferralRewardSettings> {
  const current = await getRewardSettings();
  const { data, error } = await db
    .from("referral_reward_settings")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", current.id)
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Failed to update reward settings");
  return data as ReferralRewardSettings;
}

/**
 * Admin approves a conversion candidate (or any pending referral) as a real
 * conversion. Optionally creates a single PENDING reward row — never issues
 * it, never touches Stripe/credits — only when reward automation is both
 * enabled and configured to auto-create. require_admin_approval on the
 * reward settings is informational here (issuing a reward is already a
 * separate, always-manual step via updateRewardStatus); it exists so a
 * future stricter mode could also gate reward *creation* on a second admin
 * action, without a schema change.
 */
export async function approveConversion(
  referralId: string,
  params: { appointmentId?: string; subscriptionId?: string; conversionValueCents?: number; referredCustomerId?: string } = {}
): Promise<{ referral: Referral | null; reward: ReferralReward | null }> {
  const { data: referral, error } = await db
    .from("referrals")
    .update({
      status: "converted",
      appointment_id: params.appointmentId ?? null,
      subscription_id: params.subscriptionId ?? null,
      conversion_value_cents: params.conversionValueCents ?? null,
      referred_customer_id: params.referredCustomerId ?? null,
    })
    .eq("id", referralId)
    .select("*")
    .single();

  if (error || !referral) {
    console.error("[referralService] approveConversion failed:", error?.message);
    return { referral: null, reward: null };
  }

  const settings = await getRewardSettings();
  if (!settings.enabled || !settings.auto_create_rewards) {
    return { referral: referral as Referral, reward: null };
  }

  const { data: code } = await db
    .from("referral_codes")
    .select("owner_type")
    .eq("id", (referral as any).referral_code_id)
    .maybeSingle();

  const isPartner = code?.owner_type === "partner";
  const reward = await createReward({
    referralId,
    rewardType: isPartner ? settings.partner_reward_type : settings.customer_reward_type,
    amountCents: (isPartner ? settings.partner_reward_amount_cents : settings.customer_reward_amount_cents) ?? undefined,
    notes: "Auto-created pending reward — requires admin approval before issuance.",
  });

  return { referral: referral as Referral, reward };
}

/** Admin rejects a conversion candidate — marks the referral invalid, no reward. */
export async function rejectConversion(referralId: string): Promise<Referral | null> {
  const { data, error } = await db.from("referrals").update({ status: "invalid" }).eq("id", referralId).select("*").single();
  if (error) {
    console.error("[referralService] rejectConversion failed:", error.message);
    return null;
  }
  return data as Referral;
}

export interface CreateRewardParams {
  referralId: string;
  rewardType: RewardType;
  amountCents?: number;
  notes?: string;
  approvedBy?: string | null;
}

export async function createReward(params: CreateRewardParams): Promise<ReferralReward | null> {
  const { data, error } = await db
    .from("referral_rewards")
    .insert({
      referral_id: params.referralId,
      reward_type: params.rewardType,
      amount_cents: params.amountCents ?? null,
      notes: params.notes ?? null,
      approved_by: params.approvedBy ?? null,
    })
    .select("*")
    .single();

  if (error) {
    console.error("[referralService] createReward failed:", error.message);
    return null;
  }
  return data as ReferralReward;
}

export async function updateRewardStatus(
  id: string,
  status: RewardStatus,
  approvedBy?: string | null
): Promise<ReferralReward | null> {
  const updates: Record<string, unknown> = { status };
  if (status === "approved" && approvedBy) updates.approved_by = approvedBy;

  const { data, error } = await db.from("referral_rewards").update(updates).eq("id", id).select("*").single();
  if (error) {
    console.error("[referralService] updateRewardStatus failed:", error.message);
    return null;
  }
  return data as ReferralReward;
}

export async function listRewardsForReferral(referralId: string): Promise<ReferralReward[]> {
  const { data } = await db
    .from("referral_rewards")
    .select("*")
    .eq("referral_id", referralId)
    .order("created_at", { ascending: false });
  return (data ?? []) as ReferralReward[];
}
