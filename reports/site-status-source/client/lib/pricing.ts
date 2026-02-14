import { frequencyOptions, pricingTiers } from "@/data/site";

export type ProgramType = "subscription" | "annual" | "one_time";

export type PricingInput = {
  acreage: number;
  program: ProgramType;
  frequencyDays: (typeof frequencyOptions)[number];
};

export type PricingComputation = {
  perVisit: number | null;
  perMonth: number | null;
  annualTotal: number | null;
  visitsPerYear: number | null;
  tierLabel: string | null;
  isCustom: boolean;
  message?: string;
};

const ONE_TIME_APPLICATION_PRICE = 179;
const CUSTOM_THRESHOLD = 2;

const roundCurrency = (value: number | null) => {
  if (value === null) return null;
  return Math.round(value * 100) / 100;
};

export const getTierForAcreage = (acreage: number) => {
  return pricingTiers.find((tier) => acreage >= tier.min && acreage <= tier.max) ?? null;
};

const visitsPerYearFromFrequency = (frequencyDays: number) => Math.round((365 / frequencyDays) * 100) / 100;

export const calculatePricing = ({ acreage, program, frequencyDays }: PricingInput): PricingComputation => {
  if (acreage <= 0) {
    return {
      perVisit: null,
      perMonth: null,
      annualTotal: null,
      visitsPerYear: null,
      tierLabel: null,
      isCustom: true,
      message: "Enter a valid acreage to generate pricing.",
    };
  }

  if (acreage > CUSTOM_THRESHOLD) {
    return {
      perVisit: null,
      perMonth: null,
      annualTotal: null,
      visitsPerYear: null,
      tierLabel: "2+ acres",
      isCustom: true,
      message: "Acreage exceeds standard pricing tiers. Schedule a site walk for a custom quote.",
    };
  }

  const tier = getTierForAcreage(acreage);

  if (!tier || tier.subscription === "custom") {
    return {
      perVisit: null,
      perMonth: null,
      annualTotal: null,
      visitsPerYear: null,
      tierLabel: tier?.label ?? "Custom",
      isCustom: true,
      message: "This property requires a custom plan. Book a walkthrough for tailored pricing.",
    };
  }

  const visitsPerYear = visitsPerYearFromFrequency(frequencyDays);

  if (program === "one_time") {
    return {
      perVisit: ONE_TIME_APPLICATION_PRICE,
      perMonth: null,
      annualTotal: ONE_TIME_APPLICATION_PRICE,
      visitsPerYear: 1,
      tierLabel: tier.label,
      isCustom: false,
      message: "Includes knockdown + barrier treatment with completion video.",
    };
  }

  if (program === "subscription") {
    const perVisit = typeof tier.subscription === "number" ? tier.subscription : null;
    const perMonth = perVisit ? perVisit * (30 / frequencyDays) : null;
    const annualTotal = perVisit ? perVisit * visitsPerYear : null;

    return {
      perVisit,
      perMonth: roundCurrency(perMonth),
      annualTotal: roundCurrency(annualTotal),
      visitsPerYear: roundCurrency(visitsPerYear),
      tierLabel: tier.label,
      isCustom: false,
      message: `Showing ${frequencyDays}-day cadence. Adjust frequency to see other totals.`,
    };
  }

  if (program === "annual") {
    const annualTotal = typeof tier.annual === "number" ? tier.annual : null;
    const perMonth = annualTotal ? annualTotal / 12 : null;
    const perVisit = annualTotal ? annualTotal / visitsPerYear : null;

    return {
      perVisit: roundCurrency(perVisit),
      perMonth: roundCurrency(perMonth),
      annualTotal,
      visitsPerYear: roundCurrency(visitsPerYear),
      tierLabel: tier.label,
      isCustom: false,
      message: "Pay once for worry-free coverage with priority scheduling.",
    };
  }

  return {
    perVisit: null,
    perMonth: null,
    annualTotal: null,
    visitsPerYear: null,
    tierLabel: null,
    isCustom: true,
    message: "Select a program to view pricing.",
  };
};

export const formatCurrency = (value: number | null) => {
  if (value === null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
};
