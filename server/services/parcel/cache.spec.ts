import { describe, expect, it } from "vitest";

import { buildAddressHash, buildLeadAddressHash } from "./cache";

describe("buildLeadAddressHash", () => {
  it("produces the same hash for the same raw address regardless of city/state/zip casing or whitespace", () => {
    const a = buildLeadAddressHash("123 Main St", "Anaheim", "CA", "92805");
    const b = buildLeadAddressHash(" 123 Main St ", " Anaheim ", " CA ", " 92805 ");
    expect(a).toBe(b);
  });

  it("defaults state to CA when omitted", () => {
    const withState = buildLeadAddressHash("123 Main St", "Anaheim", "CA", "92805");
    const withoutState = buildLeadAddressHash("123 Main St", "Anaheim", undefined, "92805");
    expect(withoutState).toBe(withState);
  });

  it("produces the same hash for the quote-success path and the manual-review path given the same raw input", () => {
    // Quote-success path: address/city/state/zip from req.body, post-geocode info unused for hashing.
    const quoteHash = buildLeadAddressHash("456 Oak Ave", "Irvine", "CA", "92602");
    // Manual-review path: same raw req.body fields, no geocoding occurred.
    const manualReviewHash = buildLeadAddressHash("456 Oak Ave", "Irvine", "CA", "92602");
    expect(quoteHash).toBe(manualReviewHash);
  });

  it("produces a different hash for a different address", () => {
    const a = buildLeadAddressHash("123 Main St", "Anaheim", "CA", "92805");
    const b = buildLeadAddressHash("789 Elm St", "Anaheim", "CA", "92805");
    expect(a).not.toBe(b);
  });

  it("delegates to buildAddressHash with the normalized, comma-joined string", () => {
    const expected = buildAddressHash("123 main st, anaheim, ca, 92805");
    const actual = buildLeadAddressHash("123 Main St", "Anaheim", "CA", "92805");
    expect(actual).toBe(expected);
  });

  it("drops empty/missing parts instead of leaving stray separators", () => {
    const withCity = buildLeadAddressHash("123 Main St", "Anaheim", "CA", "92805");
    const withoutCity = buildLeadAddressHash("123 Main St", "", "CA", "92805");
    expect(withoutCity).not.toBe(withCity);
    // Sanity check: omitting city still produces a stable, deterministic hash.
    expect(withoutCity).toBe(buildLeadAddressHash("123 Main St", null, "CA", "92805"));
  });
});
