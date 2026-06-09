import type { PricingQuote, PricingCadenceOption } from "./types";

// Mirrors the CADENCE_TIERS and ANNUAL_TIERS in QuoteWidgetSection and ScheduleFlow.
// Single source of truth on the server so pricing is always authoritative.

const CADENCE_TIERS: Record<number, { min: number; max: number; cents: number }[]> = {
  14: [
    { min: 0.01, max: 0.13, cents:  5000 },
    { min: 0.14, max: 0.20, cents:  7500 },
    { min: 0.21, max: 0.30, cents:  8500 },
    { min: 0.31, max: 0.40, cents:  9500 },
    { min: 0.41, max: 0.50, cents: 10500 },
    { min: 0.51, max: 0.60, cents: 12500 },
    { min: 0.61, max: 0.70, cents: 13500 },
    { min: 0.71, max: 0.80, cents: 15000 },
    { min: 0.81, max: 1.15, cents: 16500 },
    { min: 1.16, max: 1.29, cents: 18000 },
    { min: 1.30, max: 1.50, cents: 19500 },
    { min: 1.51, max: 2.00, cents: 22500 },
  ],
  21: [
    { min: 0.01, max: 0.13, cents:  8000 },
    { min: 0.14, max: 0.20, cents: 10000 },
    { min: 0.21, max: 0.30, cents: 11000 },
    { min: 0.31, max: 0.40, cents: 11900 },
    { min: 0.41, max: 0.50, cents: 12900 },
    { min: 0.51, max: 0.60, cents: 14900 },
    { min: 0.61, max: 0.70, cents: 15900 },
    { min: 0.71, max: 0.80, cents: 17900 },
    { min: 0.81, max: 1.15, cents: 19500 },
    { min: 1.16, max: 1.29, cents: 20900 },
    { min: 1.30, max: 1.50, cents: 22900 },
    { min: 1.51, max: 2.00, cents: 24900 },
  ],
  30: [
    { min: 0.01, max: 0.13, cents:  9500 },
    { min: 0.14, max: 0.20, cents: 11000 },
    { min: 0.21, max: 0.30, cents: 12500 },
    { min: 0.31, max: 0.40, cents: 13500 },
    { min: 0.41, max: 0.50, cents: 14500 },
    { min: 0.51, max: 0.60, cents: 16500 },
    { min: 0.61, max: 0.70, cents: 17500 },
    { min: 0.71, max: 0.80, cents: 19500 },
    { min: 0.81, max: 1.15, cents: 21500 },
    { min: 1.16, max: 1.29, cents: 23000 },
    { min: 1.30, max: 1.50, cents: 25000 },
    { min: 1.51, max: 2.00, cents: 27000 },
  ],
  42: [
    { min: 0.01, max: 0.13, cents: 12500 },
    { min: 0.14, max: 0.20, cents: 14500 },
    { min: 0.21, max: 0.30, cents: 15500 },
    { min: 0.31, max: 0.40, cents: 16500 },
    { min: 0.41, max: 0.50, cents: 17500 },
    { min: 0.51, max: 0.60, cents: 19500 },
    { min: 0.61, max: 0.70, cents: 20500 },
    { min: 0.71, max: 0.80, cents: 22500 },
    { min: 0.81, max: 1.15, cents: 24500 },
    { min: 1.16, max: 1.29, cents: 26000 },
    { min: 1.30, max: 1.50, cents: 28000 },
    { min: 1.51, max: 2.00, cents: 30000 },
  ],
};

const ANNUAL_TIERS = [
  { min: 0.01, max: 0.13, cents:  99900 },
  { min: 0.14, max: 0.20, cents: 120000 },
  { min: 0.21, max: 0.30, cents: 135000 },
  { min: 0.31, max: 0.40, cents: 145000 },
  { min: 0.41, max: 0.50, cents: 160000 },
  { min: 0.51, max: 0.60, cents: 180000 },
  { min: 0.61, max: 0.70, cents: 190000 },
  { min: 0.71, max: 0.80, cents: 210000 },
  { min: 0.81, max: 1.15, cents: 230000 },
  { min: 1.16, max: 1.29, cents: 250000 },
  { min: 1.30, max: 1.50, cents: 270000 },
  { min: 1.51, max: 2.00, cents: 290000 },
];

const ONE_TIME_CENTS = 17500;

const CADENCE_LABELS: Record<number, string> = {
  14: "Every 2 weeks",
  21: "Every 3 weeks",
  30: "Monthly",
  42: "Every 6 weeks",
};

function lookupCadenceCents(acreage: number, cadence: number): number | null {
  const tiers = CADENCE_TIERS[cadence];
  if (!tiers) return null;
  return tiers.find(t => acreage >= t.min && acreage <= t.max)?.cents ?? null;
}

export function buildPricingQuote(acreage: number): PricingQuote {
  const cadenceOptions: PricingCadenceOption[] = [14, 21, 30, 42].flatMap(days => {
    const cents = lookupCadenceCents(acreage, days);
    if (cents == null) return [];
    return [{ cadenceDays: days, label: CADENCE_LABELS[days], cents }];
  });

  const annualCents =
    ANNUAL_TIERS.find(t => acreage >= t.min && acreage <= t.max)?.cents ?? null;

  return {
    programs: {
      subscription: {
        cadenceOptions,
        defaultCadenceDays: 21,
      },
      one_time: {
        cents: ONE_TIME_CENTS,
      },
      annual: {
        cents: annualCents,
      },
    },
  };
}
