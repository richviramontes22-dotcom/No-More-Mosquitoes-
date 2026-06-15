import { describe, expect, it } from "vitest";

import { calculatePricing } from "./pricing";

describe("calculatePricing", () => {
  it("returns subscription tier pricing for acreage within range", () => {
    const result = calculatePricing({ acreage: 0.12, program: "subscription", frequencyDays: 21 });
    expect(result.isCustom).toBe(false);
    expect(result.perVisit).toBe(95);
    expect(result.perMonth).toBeCloseTo(95 * (30 / 21), 2);
  });

  it("returns correct annual pricing for 1.40 acres", () => {
    const result = calculatePricing({ acreage: 1.4, program: "annual", frequencyDays: 21 });
    expect(result.isCustom).toBe(false);
    expect(result.annualTotal).toBe(2700);
    expect(result.perMonth).toBeCloseTo(2700 / 12, 2);
  });

  it("flags acreage over 2 acres as custom", () => {
    const result = calculatePricing({ acreage: 2.5, program: "subscription", frequencyDays: 21 });
    expect(result.isCustom).toBe(true);
    expect(result.perVisit).toBeNull();
    expect(result.message).toMatch(/custom quote/i);
  });

  it("handles invalid acreage gracefully", () => {
    const result = calculatePricing({ acreage: 0, program: "subscription", frequencyDays: 21 });
    expect(result.isCustom).toBe(true);
    expect(result.message).toMatch(/valid acreage/i);
  });

  it("returns acreage-based one-time pricing for the smallest tier", () => {
    const result = calculatePricing({ acreage: 0.01, program: "one_time", frequencyDays: 30 });
    expect(result.isCustom).toBe(false);
    expect(result.perVisit).toBe(175);
    expect(result.annualTotal).toBe(175);
    expect(result.visitsPerYear).toBe(1);
  });

  it("returns acreage-based one-time pricing for a mid-range tier", () => {
    const result = calculatePricing({ acreage: 0.25, program: "one_time", frequencyDays: 30 });
    expect(result.isCustom).toBe(false);
    expect(result.perVisit).toBe(245);
  });

  it("returns acreage-based one-time pricing for a high-end tier", () => {
    const result = calculatePricing({ acreage: 1.4, program: "one_time", frequencyDays: 30 });
    expect(result.isCustom).toBe(false);
    expect(result.perVisit).toBe(485);
  });

  it("flags one-time pricing as custom above 2 acres", () => {
    const result = calculatePricing({ acreage: 2.5, program: "one_time", frequencyDays: 30 });
    expect(result.isCustom).toBe(true);
    expect(result.perVisit).toBeNull();
    expect(result.message).toMatch(/custom quote/i);
  });
});
