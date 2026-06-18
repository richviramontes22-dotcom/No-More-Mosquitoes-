import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../../lib/supabaseAdmin", async () => {
  const { createFakeSupabase } = await import("../../testUtils/fakeSupabase");
  return { supabaseAdmin: createFakeSupabase() };
});
vi.mock("../../lib/supabase", () => ({ supabase: null }));

import { supabaseAdmin } from "../../lib/supabaseAdmin";
import type { FakeSupabase } from "../../testUtils/fakeSupabase";
import {
  detectConversionCandidates,
  getRewardSettings,
  approveConversion,
  rejectConversion,
} from "./referralService";

const fakeDb = supabaseAdmin as unknown as FakeSupabase;

beforeEach(() => {
  for (const table of Object.keys(fakeDb.tables)) fakeDb.tables[table] = [];
});

describe("getRewardSettings — defaults", () => {
  it("creates a safe-by-default row when none exists", async () => {
    const settings = await getRewardSettings();
    expect(settings.enabled).toBe(false);
    expect(settings.auto_create_rewards).toBe(false);
    expect(settings.require_admin_approval).toBe(true);
  });
});

describe("detectConversionCandidates", () => {
  it("flags a pending referral whose lead has a subscription_id", async () => {
    await fakeDb.from("leads").insert({ id: "lead-1", subscription_id: "sub-1", converted_customer_id: null });
    await fakeDb.from("referrals").insert({ id: "ref-1", referral_code_id: "code-1", lead_id: "lead-1", status: "pending" });

    const result = await detectConversionCandidates();

    expect(result.checked).toBe(1);
    expect(result.flagged).toBe(1);
    expect(result.flaggedReferralIds).toEqual(["ref-1"]);
    expect(fakeDb.tables.referrals[0].status).toBe("conversion_candidate");
  });

  it("flags a pending referral whose lead has converted_customer_id (no subscription)", async () => {
    await fakeDb.from("leads").insert({ id: "lead-2", subscription_id: null, converted_customer_id: "cust-1" });
    await fakeDb.from("referrals").insert({ id: "ref-2", referral_code_id: "code-1", lead_id: "lead-2", status: "pending" });

    const result = await detectConversionCandidates();
    expect(result.flagged).toBe(1);
  });

  it("does not flag a pending referral whose lead has not converted", async () => {
    await fakeDb.from("leads").insert({ id: "lead-3", subscription_id: null, converted_customer_id: null });
    await fakeDb.from("referrals").insert({ id: "ref-3", referral_code_id: "code-1", lead_id: "lead-3", status: "pending" });

    const result = await detectConversionCandidates();

    expect(result.flagged).toBe(0);
    expect(fakeDb.tables.referrals[0].status).toBe("pending");
  });

  it("never touches a referral that isn't 'pending', even if its lead converted", async () => {
    await fakeDb.from("leads").insert({ id: "lead-4", subscription_id: "sub-2" });
    await fakeDb.from("referrals").insert({ id: "ref-4", referral_code_id: "code-1", lead_id: "lead-4", status: "invalid" });

    const result = await detectConversionCandidates();

    expect(result.checked).toBe(0);
    expect(fakeDb.tables.referrals[0].status).toBe("invalid");
  });
});

describe("approveConversion — reward automation safety", () => {
  it("marks the referral converted but creates no reward when reward automation is disabled (the default)", async () => {
    await fakeDb.from("referral_codes").insert({ id: "code-1", owner_type: "customer" });
    await fakeDb.from("referrals").insert({ id: "ref-5", referral_code_id: "code-1", status: "conversion_candidate" });

    const result = await approveConversion("ref-5", {});

    expect(result.referral?.status).toBe("converted");
    expect(result.reward).toBeNull();
    expect(fakeDb.tables.referral_rewards ?? []).toHaveLength(0);
  });

  it("creates exactly one reward row when enabled + auto_create_rewards are both true, with no status override", async () => {
    await fakeDb.from("referral_reward_settings").insert({
      enabled: true, auto_create_rewards: true, require_admin_approval: true,
      customer_reward_type: "account_credit", customer_reward_amount_cents: 2500,
      partner_reward_type: "manual_reward", partner_reward_amount_cents: null,
    });
    await fakeDb.from("referral_codes").insert({ id: "code-2", owner_type: "customer" });
    await fakeDb.from("referrals").insert({ id: "ref-6", referral_code_id: "code-2", status: "conversion_candidate" });

    const result = await approveConversion("ref-6", {});

    expect(result.referral?.status).toBe("converted");
    expect(result.reward).not.toBeNull();
    expect(result.reward?.amount_cents).toBe(2500);
    expect(fakeDb.tables.referral_rewards).toHaveLength(1);
    // createReward() never passes a status field — the DB column DEFAULT
    // 'pending' (2026-06-17_referral_program.sql) is the only thing that can
    // ever set it. The fake doesn't simulate column defaults, so this
    // asserts the application layer itself never overrides it.
    expect(fakeDb.tables.referral_rewards[0].status).toBeUndefined();
  });

  it("never auto-issues or auto-approves a reward — the insert payload never sets status at all", async () => {
    await fakeDb.from("referral_reward_settings").insert({ enabled: true, auto_create_rewards: true, require_admin_approval: true });
    await fakeDb.from("referral_codes").insert({ id: "code-3", owner_type: "partner" });
    await fakeDb.from("referrals").insert({ id: "ref-7", referral_code_id: "code-3", status: "conversion_candidate" });

    await approveConversion("ref-7", {});

    expect(fakeDb.tables.referral_rewards[0].status).not.toBe("issued");
    expect(fakeDb.tables.referral_rewards[0].status).not.toBe("approved");
  });
});

describe("rejectConversion", () => {
  it("marks the referral invalid and never creates a reward", async () => {
    await fakeDb.from("referral_reward_settings").insert({ enabled: true, auto_create_rewards: true });
    await fakeDb.from("referrals").insert({ id: "ref-8", referral_code_id: "code-1", status: "conversion_candidate" });

    const updated = await rejectConversion("ref-8");

    expect(updated?.status).toBe("invalid");
    expect(fakeDb.tables.referral_rewards ?? []).toHaveLength(0);
  });
});
