import { supabase } from "../../lib/supabase";
import { supabaseAdmin } from "../../lib/supabaseAdmin";

const db = supabaseAdmin ?? supabase;

export type ReferralOwnerType = "customer" | "partner";
export type PartnerType = "hoa" | "property_manager" | "landscaper" | "realtor" | "pest_control" | "other";
export type ReferralStatus = "pending" | "converted" | "rewarded" | "invalid";
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
