import { Router } from "express";
import { supabase } from "../lib/supabase";
import { requireAdmin } from "../middleware/requireAdmin";
import {
  getOrCreateCustomerReferralCode,
  createPartnerReferralCode,
  listReferralCodes,
  updateReferralCode,
  validateReferralCode,
  listReferrals,
  countConvertedReferralsForCode,
  updateReferralStatus,
  createReward,
  updateRewardStatus,
  listRewardsForReferral,
  type PartnerType,
  type ReferralStatus,
  type RewardStatus,
} from "../services/referrals/referralService";

const router = Router();

async function getAuthenticatedUser(req: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader) throw Object.assign(new Error("Missing auth header"), { status: 401 });

  const token = authHeader.split(" ")[1];
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) throw Object.assign(new Error("Invalid session"), { status: 401 });
  return user;
}

// ─── Customer-facing (authenticated, non-admin) ──────────────────────────────

// GET /api/referrals/my-code — creates the customer's code on first call
router.get("/referrals/my-code", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    const referralCode = await getOrCreateCustomerReferralCode(user.id);
    const convertedCount = await countConvertedReferralsForCode(referralCode.id);
    res.json({ code: referralCode.code, active: referralCode.active, converted_count: convertedCount });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ─── Public (no auth) ─────────────────────────────────────────────────────────

// POST /api/referrals/validate
router.post("/referrals/validate", async (req, res) => {
  const { code } = req.body ?? {};
  const result = await validateReferralCode(code);
  if (!result.valid) return res.status(400).json({ error: result.error || "Invalid code" });
  res.json({ valid: true });
});

// ─── Admin: referral codes ────────────────────────────────────────────────────

const VALID_PARTNER_TYPES: PartnerType[] = ["hoa", "property_manager", "landscaper", "realtor", "pest_control", "other"];

router.get("/admin/referrals/codes", requireAdmin, async (_req, res) => {
  const codes = await listReferralCodes();
  res.json({ codes });
});

router.post("/admin/referrals/codes", requireAdmin, async (req, res) => {
  const { partnerName, partnerType, contactEmail, contactPhone, code } = req.body ?? {};
  if (!partnerName || typeof partnerName !== "string" || !partnerName.trim()) {
    return res.status(400).json({ error: "partnerName is required" });
  }
  if (partnerType && !VALID_PARTNER_TYPES.includes(partnerType)) {
    return res.status(400).json({ error: `partnerType must be one of: ${VALID_PARTNER_TYPES.join(", ")}` });
  }

  try {
    const created = await createPartnerReferralCode({ partnerName, partnerType, contactEmail, contactPhone, code });
    res.status(201).json({ code: created });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.patch("/admin/referrals/codes/:id", requireAdmin, async (req, res) => {
  const { active, partner_name, partner_type, partner_contact_email, partner_contact_phone } = req.body ?? {};
  const updated = await updateReferralCode(req.params.id, {
    ...(active !== undefined ? { active } : {}),
    ...(partner_name !== undefined ? { partner_name } : {}),
    ...(partner_type !== undefined ? { partner_type } : {}),
    ...(partner_contact_email !== undefined ? { partner_contact_email } : {}),
    ...(partner_contact_phone !== undefined ? { partner_contact_phone } : {}),
  });
  if (!updated) return res.status(404).json({ error: "Referral code not found or update failed" });
  res.json({ code: updated });
});

// ─── Admin: referrals ──────────────────────────────────────────────────────────

const VALID_REFERRAL_STATUSES: ReferralStatus[] = ["pending", "converted", "rewarded", "invalid"];

router.get("/admin/referrals", requireAdmin, async (req, res) => {
  const { status, referral_code_id } = req.query as Record<string, string>;
  const referrals = await listReferrals({
    status: status && VALID_REFERRAL_STATUSES.includes(status as ReferralStatus) ? (status as ReferralStatus) : undefined,
    referralCodeId: referral_code_id || undefined,
  });
  res.json({ referrals });
});

router.patch("/admin/referrals/:id", requireAdmin, async (req, res) => {
  const { status, appointment_id, subscription_id, conversion_value_cents, referred_customer_id } = req.body ?? {};
  if (status && !VALID_REFERRAL_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${VALID_REFERRAL_STATUSES.join(", ")}` });
  }

  const updated = await updateReferralStatus(req.params.id, {
    ...(status !== undefined ? { status } : {}),
    ...(appointment_id !== undefined ? { appointment_id } : {}),
    ...(subscription_id !== undefined ? { subscription_id } : {}),
    ...(conversion_value_cents !== undefined ? { conversion_value_cents } : {}),
    ...(referred_customer_id !== undefined ? { referred_customer_id } : {}),
  });
  if (!updated) return res.status(404).json({ error: "Referral not found or update failed" });
  res.json({ referral: updated });
});

// ─── Admin: rewards ─────────────────────────────────────────────────────────────

const VALID_REWARD_TYPES = ["account_credit", "service_credit", "free_service", "manual_reward"];
const VALID_REWARD_STATUSES: RewardStatus[] = ["pending", "approved", "issued", "denied"];

router.get("/admin/referrals/:id/rewards", requireAdmin, async (req, res) => {
  const rewards = await listRewardsForReferral(req.params.id);
  res.json({ rewards });
});

router.post("/admin/referrals/:id/rewards", requireAdmin, async (req, res) => {
  const { rewardType, amountCents, notes } = req.body ?? {};
  if (!rewardType || !VALID_REWARD_TYPES.includes(rewardType)) {
    return res.status(400).json({ error: `rewardType must be one of: ${VALID_REWARD_TYPES.join(", ")}` });
  }

  const reward = await createReward({
    referralId: req.params.id,
    rewardType,
    amountCents,
    notes,
    approvedBy: req.adminUserId ?? null,
  });
  if (!reward) return res.status(400).json({ error: "Failed to create reward" });
  res.status(201).json({ reward });
});

router.patch("/admin/referrals/rewards/:id", requireAdmin, async (req, res) => {
  const { status } = req.body ?? {};
  if (!status || !VALID_REWARD_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${VALID_REWARD_STATUSES.join(", ")}` });
  }

  const reward = await updateRewardStatus(req.params.id, status, req.adminUserId ?? null);
  if (!reward) return res.status(404).json({ error: "Reward not found or update failed" });
  res.json({ reward });
});

export default router;
