/**
 * Pricing source of truth — shared between client and server.
 *
 * All tier tables below are transcribed directly from
 * No_More_Mosquitoes_Pricing.xlsx ("Pricing Sheet", A1:I14). Do not hand-edit
 * a value here without updating the spreadsheet (or vice versa) — the two
 * must stay in sync.
 *
 * Acreage tiers (12 total, matching the spreadsheet rows):
 *   .01-.13, .14-.20, .21-.30, .31-.40, .41-.50, .51-.60,
 *   .61-.70, .71-.80, .81-1.15, 1.16-1.29, 1.30-1.50, 1.51-2.00
 * Anything above 2.00 acres is "Custom" for every program (row 14 of the sheet).
 */

export type ProgramType = "subscription" | "annual" | "one_time";

export const CADENCE_DAYS_OPTIONS = [14, 21, 30, 42] as const;
export type CadenceDays = (typeof CADENCE_DAYS_OPTIONS)[number];

/** Acreage above this value has no tiered pricing — "2+ = Custom" in the sheet. */
export const CUSTOM_ACREAGE_THRESHOLD = 2;

export type TierRange = { min: number; max: number; cents: number };

/** Subscription per-visit price (cents), by cadence then acreage tier. Sheet columns "14 Day" / "21 Day" / "30 Day" / "42 Day". */
export const CADENCE_TIERS: Record<CadenceDays, TierRange[]> = {
  14: [
    { min: 0.01, max: 0.13, cents: 5000 },
    { min: 0.14, max: 0.20, cents: 7500 },
    { min: 0.21, max: 0.30, cents: 8500 },
    { min: 0.31, max: 0.40, cents: 9500 },
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
    { min: 0.01, max: 0.13, cents: 8000 },
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
    { min: 0.01, max: 0.13, cents: 9500 },
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

export const CADENCE_LABELS: Record<CadenceDays, string> = {
  14: "Every 2 weeks",
  21: "Every 3 weeks",
  30: "Monthly",
  42: "Every 6 weeks",
};

/** Prepaid annual total price (cents), by acreage tier. Sheet column "Annually". */
export const ANNUAL_TIERS: TierRange[] = [
  { min: 0.01, max: 0.13, cents: 99900 },
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

/** One-time treatment price (cents), by acreage tier. Sheet column "1 Time". */
export const ONE_TIME_TIERS: TierRange[] = [
  { min: 0.01, max: 0.13, cents: 17500 },
  { min: 0.14, max: 0.20, cents: 22000 },
  { min: 0.21, max: 0.30, cents: 24500 },
  { min: 0.31, max: 0.40, cents: 27000 },
  { min: 0.41, max: 0.50, cents: 29500 },
  { min: 0.51, max: 0.60, cents: 33500 },
  { min: 0.61, max: 0.70, cents: 35000 },
  { min: 0.71, max: 0.80, cents: 38500 },
  { min: 0.81, max: 1.15, cents: 42000 },
  { min: 1.16, max: 1.29, cents: 45000 },
  { min: 1.30, max: 1.50, cents: 48500 },
  { min: 1.51, max: 2.00, cents: 52000 },
];

/** Subscription per-visit price (cents) for a given acreage + cadence. Null if out of range. */
export function lookupCadenceCents(acreage: number, cadenceDays: number): number | null {
  const tiers = CADENCE_TIERS[cadenceDays as CadenceDays];
  if (!tiers) return null;
  return tiers.find((t) => acreage >= t.min && acreage <= t.max)?.cents ?? null;
}

/** Prepaid annual total price (cents) for a given acreage. Null if out of range (>2 acres = Custom). */
export function lookupAnnualCents(acreage: number): number | null {
  return ANNUAL_TIERS.find((t) => acreage >= t.min && acreage <= t.max)?.cents ?? null;
}

/** One-time treatment price (cents) for a given acreage. Null if out of range (>2 acres = Custom). */
export function lookupOneTimeCents(acreage: number): number | null {
  return ONE_TIME_TIERS.find((t) => acreage >= t.min && acreage <= t.max)?.cents ?? null;
}
