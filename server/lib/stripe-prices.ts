export interface StripePlan {
  id: string; // Internal key (e.g., tier_1_30d)
  acreageMin: number;
  acreageMax: number;
  cadenceDays: number;
  priceCents: number;
  stripePriceId: string; // The sk_live or sk_test price ID
}

/**
 * PRODUCTION PRICE MAPPING
 * Automatically generated via scripts/setup-stripe-prices.cjs
 */
export const STRIPE_PLANS: StripePlan[] = [
  {
    "id": "tier_1_14d",
    "acreageMin": 0.01,
    "acreageMax": 0.13,
    "cadenceDays": 14,
    "priceCents": 9500,
    "stripePriceId": "price_1T9Ku20zUTKY2M9th6O4e94a"
  },
  {
    "id": "tier_1_21d",
    "acreageMin": 0.01,
    "acreageMax": 0.13,
    "cadenceDays": 21,
    "priceCents": 9500,
    "stripePriceId": "price_1T9Ku30zUTKY2M9t976B9cFU"
  },
  {
    "id": "tier_1_30d",
    "acreageMin": 0.01,
    "acreageMax": 0.13,
    "cadenceDays": 30,
    "priceCents": 9500,
    "stripePriceId": "price_1T9Ku30zUTKY2M9tUd010LS9"
  },
  {
    "id": "tier_1_42d",
    "acreageMin": 0.01,
    "acreageMax": 0.13,
    "cadenceDays": 42,
    "priceCents": 9500,
    "stripePriceId": "price_1T9Ku30zUTKY2M9tqQemuKOR"
  },
  {
    "id": "tier_2_14d",
    "acreageMin": 0.14,
    "acreageMax": 0.2,
    "cadenceDays": 14,
    "priceCents": 11000,
    "stripePriceId": "price_1T9Ku30zUTKY2M9t2v6M2dQS"
  },
  {
    "id": "tier_2_21d",
    "acreageMin": 0.14,
    "acreageMax": 0.2,
    "cadenceDays": 21,
    "priceCents": 11000,
    "stripePriceId": "price_1T9Ku40zUTKY2M9te6mCTAxR"
  },
  {
    "id": "tier_2_30d",
    "acreageMin": 0.14,
    "acreageMax": 0.2,
    "cadenceDays": 30,
    "priceCents": 11000,
    "stripePriceId": "price_1T9Ku40zUTKY2M9t4uq79cvU"
  },
  {
    "id": "tier_2_42d",
    "acreageMin": 0.14,
    "acreageMax": 0.2,
    "cadenceDays": 42,
    "priceCents": 11000,
    "stripePriceId": "price_1T9Ku40zUTKY2M9tdsSSOrNm"
  },
  {
    "id": "tier_3_14d",
    "acreageMin": 0.21,
    "acreageMax": 0.3,
    "cadenceDays": 14,
    "priceCents": 12500,
    "stripePriceId": "price_1T9Ku40zUTKY2M9t4tJCVpaS"
  },
  {
    "id": "tier_3_21d",
    "acreageMin": 0.21,
    "acreageMax": 0.3,
    "cadenceDays": 21,
    "priceCents": 12500,
    "stripePriceId": "price_1T9Ku40zUTKY2M9tPBc1ZXIy"
  },
  {
    "id": "tier_3_30d",
    "acreageMin": 0.21,
    "acreageMax": 0.3,
    "cadenceDays": 30,
    "priceCents": 12500,
    "stripePriceId": "price_1T9Ku50zUTKY2M9tEOnxqBGH"
  },
  {
    "id": "tier_3_42d",
    "acreageMin": 0.21,
    "acreageMax": 0.3,
    "cadenceDays": 42,
    "priceCents": 12500,
    "stripePriceId": "price_1T9Ku50zUTKY2M9tPq3yBCdf"
  },
  {
    "id": "tier_4_14d",
    "acreageMin": 0.31,
    "acreageMax": 0.4,
    "cadenceDays": 14,
    "priceCents": 13500,
    "stripePriceId": "price_1T9Ku50zUTKY2M9tnXsbQZKW"
  },
  {
    "id": "tier_4_21d",
    "acreageMin": 0.31,
    "acreageMax": 0.4,
    "cadenceDays": 21,
    "priceCents": 13500,
    "stripePriceId": "price_1T9Ku50zUTKY2M9tv69wcbPc"
  },
  {
    "id": "tier_4_30d",
    "acreageMin": 0.31,
    "acreageMax": 0.4,
    "cadenceDays": 30,
    "priceCents": 13500,
    "stripePriceId": "price_1T9Ku50zUTKY2M9tyKhvo9WK"
  },
  {
    "id": "tier_4_42d",
    "acreageMin": 0.31,
    "acreageMax": 0.4,
    "cadenceDays": 42,
    "priceCents": 13500,
    "stripePriceId": "price_1T9Ku60zUTKY2M9t0lJ5AStr"
  },
  {
    "id": "tier_5_14d",
    "acreageMin": 0.41,
    "acreageMax": 0.5,
    "cadenceDays": 14,
    "priceCents": 14500,
    "stripePriceId": "price_1T9Ku60zUTKY2M9tL0soChej"
  },
  {
    "id": "tier_5_21d",
    "acreageMin": 0.41,
    "acreageMax": 0.5,
    "cadenceDays": 21,
    "priceCents": 14500,
    "stripePriceId": "price_1T9Ku60zUTKY2M9tcvDffpf2"
  },
  {
    "id": "tier_5_30d",
    "acreageMin": 0.41,
    "acreageMax": 0.5,
    "cadenceDays": 30,
    "priceCents": 14500,
    "stripePriceId": "price_1T9Ku60zUTKY2M9tY68TzT8Y"
  },
  {
    "id": "tier_5_42d",
    "acreageMin": 0.41,
    "acreageMax": 0.5,
    "cadenceDays": 42,
    "priceCents": 14500,
    "stripePriceId": "price_1T9Ku60zUTKY2M9tNW9BC4Mj"
  },
  {
    "id": "tier_6_14d",
    "acreageMin": 0.51,
    "acreageMax": 0.6,
    "cadenceDays": 14,
    "priceCents": 16500,
    "stripePriceId": "price_1T9Ku70zUTKY2M9tWohnTgcJ"
  },
  {
    "id": "tier_6_21d",
    "acreageMin": 0.51,
    "acreageMax": 0.6,
    "cadenceDays": 21,
    "priceCents": 16500,
    "stripePriceId": "price_1T9Ku70zUTKY2M9tuVysJ2j2"
  },
  {
    "id": "tier_6_30d",
    "acreageMin": 0.51,
    "acreageMax": 0.6,
    "cadenceDays": 30,
    "priceCents": 16500,
    "stripePriceId": "price_1T9Ku70zUTKY2M9tZhAY8o7d"
  },
  {
    "id": "tier_6_42d",
    "acreageMin": 0.51,
    "acreageMax": 0.6,
    "cadenceDays": 42,
    "priceCents": 16500,
    "stripePriceId": "price_1T9Ku70zUTKY2M9tX77VfqRf"
  },
  {
    "id": "tier_7_14d",
    "acreageMin": 0.61,
    "acreageMax": 0.7,
    "cadenceDays": 14,
    "priceCents": 17500,
    "stripePriceId": "price_1T9Ku80zUTKY2M9t6ya08gYV"
  },
  {
    "id": "tier_7_21d",
    "acreageMin": 0.61,
    "acreageMax": 0.7,
    "cadenceDays": 21,
    "priceCents": 17500,
    "stripePriceId": "price_1T9Ku80zUTKY2M9tsUKBkr5l"
  },
  {
    "id": "tier_7_30d",
    "acreageMin": 0.61,
    "acreageMax": 0.7,
    "cadenceDays": 30,
    "priceCents": 17500,
    "stripePriceId": "price_1T9Ku80zUTKY2M9trqJVl6LH"
  },
  {
    "id": "tier_7_42d",
    "acreageMin": 0.61,
    "acreageMax": 0.7,
    "cadenceDays": 42,
    "priceCents": 17500,
    "stripePriceId": "price_1T9Ku80zUTKY2M9trVBjbqrH"
  },
  {
    "id": "tier_8_14d",
    "acreageMin": 0.71,
    "acreageMax": 0.8,
    "cadenceDays": 14,
    "priceCents": 19500,
    "stripePriceId": "price_1T9Ku80zUTKY2M9tzGX6LM8F"
  },
  {
    "id": "tier_8_21d",
    "acreageMin": 0.71,
    "acreageMax": 0.8,
    "cadenceDays": 21,
    "priceCents": 19500,
    "stripePriceId": "price_1T9Ku90zUTKY2M9tkIqGW6Ea"
  },
  {
    "id": "tier_8_30d",
    "acreageMin": 0.71,
    "acreageMax": 0.8,
    "cadenceDays": 30,
    "priceCents": 19500,
    "stripePriceId": "price_1T9Ku90zUTKY2M9t9UmDpQUW"
  },
  {
    "id": "tier_8_42d",
    "acreageMin": 0.71,
    "acreageMax": 0.8,
    "cadenceDays": 42,
    "priceCents": 19500,
    "stripePriceId": "price_1T9Ku90zUTKY2M9tFqLOB2pm"
  },
  {
    "id": "tier_9_14d",
    "acreageMin": 0.81,
    "acreageMax": 1.15,
    "cadenceDays": 14,
    "priceCents": 21500,
    "stripePriceId": "price_1T9Ku90zUTKY2M9t4XwARynK"
  },
  {
    "id": "tier_9_21d",
    "acreageMin": 0.81,
    "acreageMax": 1.15,
    "cadenceDays": 21,
    "priceCents": 21500,
    "stripePriceId": "price_1T9Ku90zUTKY2M9tmeHXi5d4"
  },
  {
    "id": "tier_9_30d",
    "acreageMin": 0.81,
    "acreageMax": 1.15,
    "cadenceDays": 30,
    "priceCents": 21500,
    "stripePriceId": "price_1T9KuA0zUTKY2M9tq54rMCBb"
  },
  {
    "id": "tier_9_42d",
    "acreageMin": 0.81,
    "acreageMax": 1.15,
    "cadenceDays": 42,
    "priceCents": 21500,
    "stripePriceId": "price_1T9KuA0zUTKY2M9tfKZtZf6G"
  },
  {
    "id": "tier_10_14d",
    "acreageMin": 1.16,
    "acreageMax": 1.29,
    "cadenceDays": 14,
    "priceCents": 23000,
    "stripePriceId": "price_1T9KuA0zUTKY2M9tF7RndvWK"
  },
  {
    "id": "tier_10_21d",
    "acreageMin": 1.16,
    "acreageMax": 1.29,
    "cadenceDays": 21,
    "priceCents": 23000,
    "stripePriceId": "price_1T9KuA0zUTKY2M9teWBUA0gs"
  },
  {
    "id": "tier_10_30d",
    "acreageMin": 1.16,
    "acreageMax": 1.29,
    "cadenceDays": 30,
    "priceCents": 23000,
    "stripePriceId": "price_1T9KuA0zUTKY2M9tNL4DMpF3"
  },
  {
    "id": "tier_10_42d",
    "acreageMin": 1.16,
    "acreageMax": 1.29,
    "cadenceDays": 42,
    "priceCents": 23000,
    "stripePriceId": "price_1T9KuB0zUTKY2M9twKJYGhTr"
  },
  {
    "id": "tier_11_14d",
    "acreageMin": 1.3,
    "acreageMax": 1.5,
    "cadenceDays": 14,
    "priceCents": 25000,
    "stripePriceId": "price_1T9KuB0zUTKY2M9tJbc2tWib"
  },
  {
    "id": "tier_11_21d",
    "acreageMin": 1.3,
    "acreageMax": 1.5,
    "cadenceDays": 21,
    "priceCents": 25000,
    "stripePriceId": "price_1T9KuB0zUTKY2M9tPORnUd3l"
  },
  {
    "id": "tier_11_30d",
    "acreageMin": 1.3,
    "acreageMax": 1.5,
    "cadenceDays": 30,
    "priceCents": 25000,
    "stripePriceId": "price_1T9KuB0zUTKY2M9ttgkmG5FZ"
  },
  {
    "id": "tier_11_42d",
    "acreageMin": 1.3,
    "acreageMax": 1.5,
    "cadenceDays": 42,
    "priceCents": 25000,
    "stripePriceId": "price_1T9KuC0zUTKY2M9tgue2Nq0O"
  },
  {
    "id": "tier_12_14d",
    "acreageMin": 1.51,
    "acreageMax": 2,
    "cadenceDays": 14,
    "priceCents": 27000,
    "stripePriceId": "price_1T9KuC0zUTKY2M9tbvOHTwzv"
  },
  {
    "id": "tier_12_21d",
    "acreageMin": 1.51,
    "acreageMax": 2,
    "cadenceDays": 21,
    "priceCents": 27000,
    "stripePriceId": "price_1T9KuC0zUTKY2M9tIarGLxXX"
  },
  {
    "id": "tier_12_30d",
    "acreageMin": 1.51,
    "acreageMax": 2,
    "cadenceDays": 30,
    "priceCents": 27000,
    "stripePriceId": "price_1T9KuC0zUTKY2M9tRPPr94nO"
  },
  {
    "id": "tier_12_42d",
    "acreageMin": 1.51,
    "acreageMax": 2,
    "cadenceDays": 42,
    "priceCents": 27000,
    "stripePriceId": "price_1T9KuC0zUTKY2M9tmPVCR8wo"
  },
  {
    "id": "one_time",
    "acreageMin": 0,
    "acreageMax": 10,
    "cadenceDays": 0,
    "priceCents": 27000,
    "stripePriceId": "price_1T9KuD0zUTKY2M9tDDuDwmCh"
  }
];

export function findStripePrice(acreage: number, cadenceDays: number, isOneTime: boolean = false): StripePlan | undefined {
  if (isOneTime) return STRIPE_PLANS.find(p => p.id === "one_time");

  // Find the tier that matches the acreage
  const matchingTierPlans = STRIPE_PLANS.filter(p =>
    acreage >= p.acreageMin &&
    acreage <= p.acreageMax
  );

  // Then find the specific cadence within that tier
  // If the specific cadence isn't found, default to 30 days if available
  return matchingTierPlans.find(p => p.cadenceDays === cadenceDays) ||
         matchingTierPlans.find(p => p.cadenceDays === 30);
}

/**
 * DB-first price lookup — queries service_plans table, falls back to hardcoded map.
 * Pass the Supabase client so this file has no direct dependency on the DB module.
 */
export async function findStripePriceAsync(
  acreage: number,
  cadenceDays: number,
  isOneTime: boolean = false,
  db: any
): Promise<StripePlan | undefined> {
  try {
    let query = db
      .from("service_plans")
      .select("name, acreage_min, acreage_max, cadence_days, price_cents, stripe_price_id, program")
      .eq("active", true);

    if (isOneTime) {
      query = query.eq("program", "one_time");
    } else {
      query = query
        .eq("program", "subscription")
        .lte("acreage_min", acreage)
        .gte("acreage_max", acreage)
        .eq("cadence_days", cadenceDays);
    }

    const { data } = await query.maybeSingle();

    if (data?.stripe_price_id) {
      return {
        id: data.name || `db_${data.acreage_min}_${data.cadence_days}d`,
        acreageMin: data.acreage_min,
        acreageMax: data.acreage_max,
        cadenceDays: data.cadence_days,
        priceCents: data.price_cents,
        stripePriceId: data.stripe_price_id,
      };
    }

    // DB returned a row but no stripe_price_id — try cadence fallback before static
    if (!isOneTime && data === null) {
      const fallbackQuery = db
        .from("service_plans")
        .select("name, acreage_min, acreage_max, cadence_days, price_cents, stripe_price_id")
        .eq("active", true)
        .eq("program", "subscription")
        .lte("acreage_min", acreage)
        .gte("acreage_max", acreage)
        .eq("cadence_days", 30)
        .maybeSingle();
      const { data: fallback } = await fallbackQuery;
      if (fallback?.stripe_price_id) {
        return {
          id: fallback.name || `db_${fallback.acreage_min}_30d`,
          acreageMin: fallback.acreage_min,
          acreageMax: fallback.acreage_max,
          cadenceDays: 30,
          priceCents: fallback.price_cents,
          stripePriceId: fallback.stripe_price_id,
        };
      }
    }
  } catch {
    // DB unavailable — fall through to static
  }

  // Static fallback: hardcoded STRIPE_PLANS map
  return findStripePrice(acreage, cadenceDays, isOneTime);
}
