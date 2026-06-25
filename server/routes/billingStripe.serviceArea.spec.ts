import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../lib/supabaseAdmin", async () => {
  const { createFakeSupabase } = await import("../testUtils/fakeSupabase");
  return { supabaseAdmin: createFakeSupabase() };
});
vi.mock("../lib/supabase", () => ({ supabase: null }));

import { supabaseAdmin } from "../lib/supabaseAdmin";
import type { FakeSupabase } from "../testUtils/fakeSupabase";
import { assertPropertyInServiceArea } from "./billingStripe";

const fakeDb = supabaseAdmin as unknown as FakeSupabase;

beforeEach(() => {
  for (const table of Object.keys(fakeDb.tables)) fakeDb.tables[table] = [];
});

describe("assertPropertyInServiceArea — final checkout-time service-area gate", () => {
  it("allows checkout for a property in an active service area", async () => {
    await fakeDb.from("properties").insert({ id: "prop-in-area", zip: "92614" });
    await fakeDb.from("service_areas").insert({ zip: "92614", is_active: true });

    const result = await assertPropertyInServiceArea("prop-in-area");
    expect(result).toBeNull();
  });

  it("blocks checkout for a property whose ZIP has no service_areas row at all", async () => {
    await fakeDb.from("properties").insert({ id: "prop-out-of-area", zip: "10001" });

    const result = await assertPropertyInServiceArea("prop-out-of-area");
    expect(result).toBe("We're not currently servicing this area yet.");
  });

  it("blocks checkout for a property whose ZIP has an inactive service_areas row", async () => {
    await fakeDb.from("properties").insert({ id: "prop-inactive-area", zip: "90001" });
    await fakeDb.from("service_areas").insert({ zip: "90001", is_active: false });

    const result = await assertPropertyInServiceArea("prop-inactive-area");
    expect(result).toBe("We're not currently servicing this area yet.");
  });

  it("blocks checkout for a property with no valid ZIP on file", async () => {
    await fakeDb.from("properties").insert({ id: "prop-no-zip", zip: null });

    const result = await assertPropertyInServiceArea("prop-no-zip");
    expect(result).toMatch(/no valid ZIP code/);
  });

  it("normalizes a ZIP+4 to 5 digits before checking coverage", async () => {
    await fakeDb.from("properties").insert({ id: "prop-zip4", zip: "92653-1143" });
    await fakeDb.from("service_areas").insert({ zip: "92653", is_active: true });

    const result = await assertPropertyInServiceArea("prop-zip4");
    expect(result).toBeNull();
  });
});
