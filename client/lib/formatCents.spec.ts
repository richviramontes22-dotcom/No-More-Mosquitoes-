import { describe, it, expect } from "vitest";
import { formatCents } from "./formatCents";

describe("formatCents", () => {
  it("shows cents for a 50-cent amount instead of rounding to $1", () => {
    expect(formatCents(50)).toBe("$0.50");
  });

  it("shows cents for any non-whole-dollar amount", () => {
    expect(formatCents(99)).toBe("$0.99");
    expect(formatCents(12550)).toBe("$125.50");
  });

  it("shows no decimals for whole-dollar amounts", () => {
    expect(formatCents(100)).toBe("$1");
    expect(formatCents(9500)).toBe("$95");
    expect(formatCents(17500)).toBe("$175");
  });

  it("uses locale grouping with no decimals at $1,000+", () => {
    expect(formatCents(150000)).toBe("$1,500");
  });
});
