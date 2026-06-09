import { getStripeMode, logModeMismatch, type StripeMode } from './stripeMode';

export interface StripePlan {
  id: string;
  acreageMin: number;
  acreageMax: number;
  cadenceDays: number;
  priceCents: number;
  /** Live-mode Stripe price ID (price_1TWX...) */
  stripePriceId: string;
  /** Test-mode Stripe price ID (price_1T9K...) */
  stripePriceIdTest: string;
}

/**
 * Dual-mode price mapping.
 * stripePriceId     = live price (price_1TWX... — acct_1T8zGo live account)
 * stripePriceIdTest = test price (price_1T9K... — acct_1T8zHI test account)
 *
 * Source of truth: dev-notes/LIVE_STRIPE_OBJECT_MAPPING.json
 * DB (service_plans) is checked first by findStripePriceAsync — this array is the fallback.
 */
// priceCents sourced from No_More_Mosquitoes_Pricing.xlsx.
// Per-cadence prices differ: more frequent visits cost less per visit (route efficiency).
// 30-day prices match Stripe price objects. 14/21/42-day Stripe objects need updating to match.
export const STRIPE_PLANS: StripePlan[] = [
  // ── Tier 1: 0.01–0.13 acres ──────────────────────────────────────────────────
  { id: "tier_1_14d",  acreageMin: 0.01, acreageMax: 0.13, cadenceDays: 14, priceCents:  5000, stripePriceId: "price_1TWX3W1GVLFt2OB82vdhwAU4", stripePriceIdTest: "price_1T9Ku20zUTKY2M9th6O4e94a" },
  { id: "tier_1_21d",  acreageMin: 0.01, acreageMax: 0.13, cadenceDays: 21, priceCents:  8000, stripePriceId: "price_1TWX3W1GVLFt2OB8wU4PCRHL", stripePriceIdTest: "price_1T9Ku30zUTKY2M9t976B9cFU" },
  { id: "tier_1_30d",  acreageMin: 0.01, acreageMax: 0.13, cadenceDays: 30, priceCents:  9500, stripePriceId: "price_1TWX3X1GVLFt2OB8oLIlpACc", stripePriceIdTest: "price_1T9Ku30zUTKY2M9tUd010LS9" },
  { id: "tier_1_42d",  acreageMin: 0.01, acreageMax: 0.13, cadenceDays: 42, priceCents: 12500, stripePriceId: "price_1TWX3X1GVLFt2OB8LuI1UE50", stripePriceIdTest: "price_1T9Ku30zUTKY2M9tqQemuKOR" },
  // ── Tier 2: 0.14–0.20 acres ──────────────────────────────────────────────────
  { id: "tier_2_14d",  acreageMin: 0.14, acreageMax: 0.2,  cadenceDays: 14, priceCents:  7500, stripePriceId: "price_1TWX3Y1GVLFt2OB8Mab0nZMU", stripePriceIdTest: "price_1T9Ku30zUTKY2M9t2v6M2dQS" },
  { id: "tier_2_21d",  acreageMin: 0.14, acreageMax: 0.2,  cadenceDays: 21, priceCents: 10000, stripePriceId: "price_1TWX3Y1GVLFt2OB84UnjMwuR", stripePriceIdTest: "price_1T9Ku40zUTKY2M9te6mCTAxR" },
  { id: "tier_2_30d",  acreageMin: 0.14, acreageMax: 0.2,  cadenceDays: 30, priceCents: 11000, stripePriceId: "price_1TWX3Z1GVLFt2OB8r9eOHnW2", stripePriceIdTest: "price_1T9Ku40zUTKY2M9t4uq79cvU" },
  { id: "tier_2_42d",  acreageMin: 0.14, acreageMax: 0.2,  cadenceDays: 42, priceCents: 14500, stripePriceId: "price_1TWX3Z1GVLFt2OB8h4ftVWXs", stripePriceIdTest: "price_1T9Ku40zUTKY2M9tdsSSOrNm" },
  // ── Tier 3: 0.21–0.30 acres ──────────────────────────────────────────────────
  { id: "tier_3_14d",  acreageMin: 0.21, acreageMax: 0.3,  cadenceDays: 14, priceCents:  8500, stripePriceId: "price_1TWX3a1GVLFt2OB824dBZT0x", stripePriceIdTest: "price_1T9Ku40zUTKY2M9t4tJCVpaS" },
  { id: "tier_3_21d",  acreageMin: 0.21, acreageMax: 0.3,  cadenceDays: 21, priceCents: 11000, stripePriceId: "price_1TWX3b1GVLFt2OB8oOoGFL6S", stripePriceIdTest: "price_1T9Ku40zUTKY2M9tPBc1ZXIy" },
  { id: "tier_3_30d",  acreageMin: 0.21, acreageMax: 0.3,  cadenceDays: 30, priceCents: 12500, stripePriceId: "price_1TWX3b1GVLFt2OB8rFN0tqE7", stripePriceIdTest: "price_1T9Ku50zUTKY2M9tXZt2VGFl" },
  { id: "tier_3_42d",  acreageMin: 0.21, acreageMax: 0.3,  cadenceDays: 42, priceCents: 15500, stripePriceId: "price_1TWX3b1GVLFt2OB8yhbKYxeE", stripePriceIdTest: "price_1T9Ku50zUTKY2M9tPq3yBCdf" },
  // ── Tier 4: 0.31–0.40 acres ──────────────────────────────────────────────────
  { id: "tier_4_14d",  acreageMin: 0.31, acreageMax: 0.4,  cadenceDays: 14, priceCents:  9500, stripePriceId: "price_1TWX3c1GVLFt2OB8747j0xpz", stripePriceIdTest: "price_1T9Ku50zUTKY2M9tnXsbQZKW" },
  { id: "tier_4_21d",  acreageMin: 0.31, acreageMax: 0.4,  cadenceDays: 21, priceCents: 11900, stripePriceId: "price_1TWX3d1GVLFt2OB89Dt6ddUo", stripePriceIdTest: "price_1T9Ku50zUTKY2M9tv69wcbPc" },
  { id: "tier_4_30d",  acreageMin: 0.31, acreageMax: 0.4,  cadenceDays: 30, priceCents: 13500, stripePriceId: "price_1TWX3d1GVLFt2OB8SnZa4AEs", stripePriceIdTest: "price_1T9Ku50zUTKY2M9tyKhvo9WK" },
  { id: "tier_4_42d",  acreageMin: 0.31, acreageMax: 0.4,  cadenceDays: 42, priceCents: 16500, stripePriceId: "price_1TWX3e1GVLFt2OB8TmjjoUjr", stripePriceIdTest: "price_1T9Ku60zUTKY2M9t0lJ5AStr" },
  // ── Tier 5: 0.41–0.50 acres ──────────────────────────────────────────────────
  { id: "tier_5_14d",  acreageMin: 0.41, acreageMax: 0.5,  cadenceDays: 14, priceCents: 10500, stripePriceId: "price_1TWX3e1GVLFt2OB87OZL3D3q", stripePriceIdTest: "price_1T9Ku60zUTKY2M9tL0soChej" },
  { id: "tier_5_21d",  acreageMin: 0.41, acreageMax: 0.5,  cadenceDays: 21, priceCents: 12900, stripePriceId: "price_1TWX3f1GVLFt2OB87b38k9xQ", stripePriceIdTest: "price_1T9Ku60zUTKY2M9tcvDffpf2" },
  { id: "tier_5_30d",  acreageMin: 0.41, acreageMax: 0.5,  cadenceDays: 30, priceCents: 14500, stripePriceId: "price_1TWX3f1GVLFt2OB8VIuOmjhk", stripePriceIdTest: "price_1T9Ku60zUTKY2M9tY68TzT8Y" },
  { id: "tier_5_42d",  acreageMin: 0.41, acreageMax: 0.5,  cadenceDays: 42, priceCents: 17500, stripePriceId: "price_1TWX3g1GVLFt2OB84P3MTd5a", stripePriceIdTest: "price_1T9Ku60zUTKY2M9tNW9BC4Mj" },
  // ── Tier 6: 0.51–0.60 acres ──────────────────────────────────────────────────
  { id: "tier_6_14d",  acreageMin: 0.51, acreageMax: 0.6,  cadenceDays: 14, priceCents: 12500, stripePriceId: "price_1TWX3h1GVLFt2OB8hqvjwBuu", stripePriceIdTest: "price_1T9Ku70zUTKY2M9tWohnTgcJ" },
  { id: "tier_6_21d",  acreageMin: 0.51, acreageMax: 0.6,  cadenceDays: 21, priceCents: 14900, stripePriceId: "price_1TWX3h1GVLFt2OB8oFGgfhdx", stripePriceIdTest: "price_1T9Ku70zUTKY2M9tuVysJ2j2" },
  { id: "tier_6_30d",  acreageMin: 0.51, acreageMax: 0.6,  cadenceDays: 30, priceCents: 16500, stripePriceId: "price_1TWX3h1GVLFt2OB8K1dBLOPC", stripePriceIdTest: "price_1T9Ku70zUTKY2M9tZhAY8o7d" },
  { id: "tier_6_42d",  acreageMin: 0.51, acreageMax: 0.6,  cadenceDays: 42, priceCents: 19500, stripePriceId: "price_1TWX3i1GVLFt2OB8WRS5mNuM", stripePriceIdTest: "price_1T9Ku70zUTKY2M9tX77VfqRf" },
  // ── Tier 7: 0.61–0.70 acres ──────────────────────────────────────────────────
  { id: "tier_7_14d",  acreageMin: 0.61, acreageMax: 0.7,  cadenceDays: 14, priceCents: 13500, stripePriceId: "price_1TWX3j1GVLFt2OB8BvM2ZAv0", stripePriceIdTest: "price_1T9Ku80zUTKY2M9t6ya08gYV" },
  { id: "tier_7_21d",  acreageMin: 0.61, acreageMax: 0.7,  cadenceDays: 21, priceCents: 15900, stripePriceId: "price_1TWX3j1GVLFt2OB8NQLV5HzR", stripePriceIdTest: "price_1T9Ku80zUTKY2M9tsUKBkr5l" },
  { id: "tier_7_30d",  acreageMin: 0.61, acreageMax: 0.7,  cadenceDays: 30, priceCents: 17500, stripePriceId: "price_1TWX3k1GVLFt2OB8qNBxvK39", stripePriceIdTest: "price_1T9Ku80zUTKY2M9trqJVl6LH" },
  { id: "tier_7_42d",  acreageMin: 0.61, acreageMax: 0.7,  cadenceDays: 42, priceCents: 20500, stripePriceId: "price_1TWX3k1GVLFt2OB8jbAuZ02R", stripePriceIdTest: "price_1T9Ku80zUTKY2M9trVBjbqrH" },
  // ── Tier 8: 0.71–0.80 acres ──────────────────────────────────────────────────
  { id: "tier_8_14d",  acreageMin: 0.71, acreageMax: 0.8,  cadenceDays: 14, priceCents: 15000, stripePriceId: "price_1TWX3l1GVLFt2OB8vIcJfeuD", stripePriceIdTest: "price_1T9Ku80zUTKY2M9tzGX6LM8F" },
  { id: "tier_8_21d",  acreageMin: 0.71, acreageMax: 0.8,  cadenceDays: 21, priceCents: 17900, stripePriceId: "price_1TWX3l1GVLFt2OB8cL5GRW43", stripePriceIdTest: "price_1T9Ku90zUTKY2M9tkIqGW6Ea" },
  { id: "tier_8_30d",  acreageMin: 0.71, acreageMax: 0.8,  cadenceDays: 30, priceCents: 19500, stripePriceId: "price_1TWX3m1GVLFt2OB8JpK9jrzH", stripePriceIdTest: "price_1T9Ku90zUTKY2M9t9UmDpQUW" },
  { id: "tier_8_42d",  acreageMin: 0.71, acreageMax: 0.8,  cadenceDays: 42, priceCents: 22500, stripePriceId: "price_1TWX3m1GVLFt2OB8BLcokzYx", stripePriceIdTest: "price_1T9Ku90zUTKY2M9tFqLOB2pm" },
  // ── Tier 9: 0.81–1.15 acres ──────────────────────────────────────────────────
  { id: "tier_9_14d",  acreageMin: 0.81, acreageMax: 1.15, cadenceDays: 14, priceCents: 16500, stripePriceId: "price_1TWX3n1GVLFt2OB8NeJipFLN", stripePriceIdTest: "price_1T9Ku90zUTKY2M9t4XwARynK" },
  { id: "tier_9_21d",  acreageMin: 0.81, acreageMax: 1.15, cadenceDays: 21, priceCents: 19500, stripePriceId: "price_1TWX3o1GVLFt2OB8kdMgPgXP", stripePriceIdTest: "price_1T9Ku90zUTKY2M9tmeHXi5d4" },
  { id: "tier_9_30d",  acreageMin: 0.81, acreageMax: 1.15, cadenceDays: 30, priceCents: 21500, stripePriceId: "price_1TWX3o1GVLFt2OB8SZrg1Xc4", stripePriceIdTest: "price_1T9KuA0zUTKY2M9tq54rMCBb" },
  { id: "tier_9_42d",  acreageMin: 0.81, acreageMax: 1.15, cadenceDays: 42, priceCents: 24500, stripePriceId: "price_1TWX3p1GVLFt2OB8tE65BRkU", stripePriceIdTest: "price_1T9KuA0zUTKY2M9tfKZtZf6G" },
  // ── Tier 10: 1.16–1.29 acres ─────────────────────────────────────────────────
  { id: "tier_10_14d", acreageMin: 1.16, acreageMax: 1.29, cadenceDays: 14, priceCents: 18000, stripePriceId: "price_1TWX3p1GVLFt2OB8cFJYE2e4", stripePriceIdTest: "price_1T9KuA0zUTKY2M9tF7RndvWK" },
  { id: "tier_10_21d", acreageMin: 1.16, acreageMax: 1.29, cadenceDays: 21, priceCents: 20900, stripePriceId: "price_1TWX3q1GVLFt2OB8S6LRuVvQ", stripePriceIdTest: "price_1T9KuA0zUTKY2M9teWBUA0gs" },
  { id: "tier_10_30d", acreageMin: 1.16, acreageMax: 1.29, cadenceDays: 30, priceCents: 23000, stripePriceId: "price_1TWX3q1GVLFt2OB8KhxKdbec", stripePriceIdTest: "price_1T9KuA0zUTKY2M9tNL4DMpF3" },
  { id: "tier_10_42d", acreageMin: 1.16, acreageMax: 1.29, cadenceDays: 42, priceCents: 26000, stripePriceId: "price_1TWX3r1GVLFt2OB8RiBfNjem", stripePriceIdTest: "price_1T9KuB0zUTKY2M9twKJYGhTr" },
  // ── Tier 11: 1.30–1.50 acres ─────────────────────────────────────────────────
  { id: "tier_11_14d", acreageMin: 1.3,  acreageMax: 1.5,  cadenceDays: 14, priceCents: 19500, stripePriceId: "price_1TWX3r1GVLFt2OB89vhpjmxF", stripePriceIdTest: "price_1T9KuB0zUTKY2M9tJbc2tWib" },
  { id: "tier_11_21d", acreageMin: 1.3,  acreageMax: 1.5,  cadenceDays: 21, priceCents: 22900, stripePriceId: "price_1TWX3s1GVLFt2OB8O9QYKd5M", stripePriceIdTest: "price_1T9KuB0zUTKY2M9tPORnUd3l" },
  { id: "tier_11_30d", acreageMin: 1.3,  acreageMax: 1.5,  cadenceDays: 30, priceCents: 25000, stripePriceId: "price_1TWX3s1GVLFt2OB8nAwpjfhM", stripePriceIdTest: "price_1T9KuB0zUTKY2M9ttgkmG5FZ" },
  { id: "tier_11_42d", acreageMin: 1.3,  acreageMax: 1.5,  cadenceDays: 42, priceCents: 28000, stripePriceId: "price_1TWX3t1GVLFt2OB8ckMdDCQe", stripePriceIdTest: "price_1T9KuC0zUTKY2M9tgue2Nq0O" },
  // ── Tier 12: 1.51–2.00 acres ─────────────────────────────────────────────────
  { id: "tier_12_14d", acreageMin: 1.51, acreageMax: 2,    cadenceDays: 14, priceCents: 22500, stripePriceId: "price_1TWX3u1GVLFt2OB8b9tpPMbH", stripePriceIdTest: "price_1T9KuC0zUTKY2M9tbvOHTwzv" },
  { id: "tier_12_21d", acreageMin: 1.51, acreageMax: 2,    cadenceDays: 21, priceCents: 24900, stripePriceId: "price_1TWX3u1GVLFt2OB8aEZsxY74", stripePriceIdTest: "price_1T9KuC0zUTKY2M9tIarGLxXX" },
  { id: "tier_12_30d", acreageMin: 1.51, acreageMax: 2,    cadenceDays: 30, priceCents: 27000, stripePriceId: "price_1TWX3v1GVLFt2OB8e3f6aC0k", stripePriceIdTest: "price_1T9KuC0zUTKY2M9tRPPr94nO" },
  { id: "tier_12_42d", acreageMin: 1.51, acreageMax: 2,    cadenceDays: 42, priceCents: 30000, stripePriceId: "price_1TWX3v1GVLFt2OB8Psrio4Nl", stripePriceIdTest: "price_1T9KuC0zUTKY2M9tmPVCR8wo" },
  // ── One-time (flat rate, all acreages) ────────────────────────────────────────
  { id: "one_time",    acreageMin: 0,    acreageMax: 10,   cadenceDays: 0,  priceCents: 17500, stripePriceId: "price_1TWX4e1GVLFt2OB8GVrrY6ER", stripePriceIdTest: "price_1T9KuD0zUTKY2M9tDDuDwmCh" },
];

/**
 * Returns the mode-appropriate price ID from a plan object.
 * Resolves the correct ID so callers don't need to branch on mode.
 */
function resolvePriceId(plan: StripePlan, mode: StripeMode): string {
  if (mode === 'test') return plan.stripePriceIdTest || plan.stripePriceId;
  return plan.stripePriceId;
}

/**
 * Synchronous static-map lookup. Returned stripePriceId is already mode-resolved.
 */
export function findStripePrice(
  acreage: number,
  cadenceDays: number,
  isOneTime = false,
  mode?: StripeMode,
): StripePlan | undefined {
  const resolvedMode = mode ?? getStripeMode();

  if (isOneTime) {
    const plan = STRIPE_PLANS.find(p => p.id === 'one_time');
    if (!plan) return undefined;
    return { ...plan, stripePriceId: resolvePriceId(plan, resolvedMode) };
  }

  const tierPlans = STRIPE_PLANS.filter(
    p => acreage >= p.acreageMin && acreage <= p.acreageMax,
  );

  const match =
    tierPlans.find(p => p.cadenceDays === cadenceDays) ||
    tierPlans.find(p => p.cadenceDays === 30);

  if (!match) return undefined;
  return { ...match, stripePriceId: resolvePriceId(match, resolvedMode) };
}

/**
 * DB-first price lookup — queries service_plans, falls back to static map.
 * Automatically selects the correct price column based on current Stripe key mode:
 *   test key  → stripe_price_id_test
 *   live key  → stripe_price_id
 */
export async function findStripePriceAsync(
  acreage: number,
  cadenceDays: number,
  isOneTime = false,
  db: any,
): Promise<StripePlan | undefined> {
  const mode = getStripeMode();
  const priceColumn = mode === 'test' ? 'stripe_price_id_test' : 'stripe_price_id';

  try {
    let query = db
      .from('service_plans')
      .select(`name, acreage_min, acreage_max, cadence_days, price_cents, stripe_price_id, stripe_price_id_test, program`)
      .eq('active', true);

    if (isOneTime) {
      query = query.eq('program', 'one_time');
    } else {
      query = query
        .eq('program', 'subscription')
        .lte('acreage_min', acreage)
        .gte('acreage_max', acreage)
        .eq('cadence_days', cadenceDays);
    }

    const { data } = await query.maybeSingle();

    if (data) {
      const priceId: string | null =
        mode === 'test' ? data.stripe_price_id_test : data.stripe_price_id;

      if (priceId) {
        console.log(`[Stripe] price resolved from DB — mode: ${mode}, column: ${priceColumn}, id: ${priceId}`);
        return {
          id: data.name || `db_${data.acreage_min}_${data.cadence_days}d`,
          acreageMin: data.acreage_min,
          acreageMax: data.acreage_max,
          cadenceDays: data.cadence_days,
          priceCents: data.price_cents,
          stripePriceId: priceId,
          stripePriceIdTest: data.stripe_price_id_test || '',
        };
      }

      // DB row exists but mode-appropriate price column is empty — log and fall through
      console.warn(
        `[Stripe] DB row found for ${data.name} but ${priceColumn} is null. ` +
        `Falling back to static map. Run the dual-mode SQL migration to populate ${priceColumn}.`,
      );
    }

    // Cadence fallback within DB (30-day default) before giving up on DB
    if (!isOneTime && data === null) {
      const { data: fallback } = await db
        .from('service_plans')
        .select(`name, acreage_min, acreage_max, cadence_days, price_cents, stripe_price_id, stripe_price_id_test`)
        .eq('active', true)
        .eq('program', 'subscription')
        .lte('acreage_min', acreage)
        .gte('acreage_max', acreage)
        .eq('cadence_days', 30)
        .maybeSingle();

      if (fallback) {
        const fallbackPriceId: string | null =
          mode === 'test' ? fallback.stripe_price_id_test : fallback.stripe_price_id;

        if (fallbackPriceId) {
          console.log(`[Stripe] price resolved from DB (30d fallback) — mode: ${mode}, id: ${fallbackPriceId}`);
          return {
            id: fallback.name || `db_${fallback.acreage_min}_30d`,
            acreageMin: fallback.acreage_min,
            acreageMax: fallback.acreage_max,
            cadenceDays: 30,
            priceCents: fallback.price_cents,
            stripePriceId: fallbackPriceId,
            stripePriceIdTest: fallback.stripe_price_id_test || '',
          };
        }
      }
    }
  } catch {
    // DB unavailable — fall through to static
  }

  // Static fallback: mode-aware
  const staticResult = findStripePrice(acreage, cadenceDays, isOneTime, mode);
  if (staticResult) {
    console.log(`[Stripe] price resolved from static map — mode: ${mode}, id: ${staticResult.stripePriceId}`);
  } else {
    logModeMismatch(
      `No price found for acreage=${acreage} cadence=${cadenceDays} isOneTime=${isOneTime} mode=${mode}`,
    );
  }
  return staticResult;
}
