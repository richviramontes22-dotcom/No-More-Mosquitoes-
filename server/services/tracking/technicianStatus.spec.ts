import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../../lib/supabaseAdmin", async () => {
  const { createFakeSupabase } = await import("../../testUtils/fakeSupabase");
  return { supabaseAdmin: createFakeSupabase() };
});
vi.mock("../../lib/supabase", () => ({ supabase: null }));

import { supabaseAdmin } from "../../lib/supabaseAdmin";
import type { FakeSupabase } from "../../testUtils/fakeSupabase";
import { getTechnicianStatusList } from "./technicianStatus";

const fakeDb = supabaseAdmin as unknown as FakeSupabase;

beforeEach(() => {
  for (const table of Object.keys(fakeDb.tables)) fakeDb.tables[table] = [];
});

async function seedEmployee(opts: { id: string; userId: string; gpsConsentAt: string | null }) {
  await fakeDb.from("employees").insert({
    id: opts.id, user_id: opts.userId, role: "technician", phone: null, status: "active", gps_consent_at: opts.gpsConsentAt,
  });
  await fakeDb.from("profiles").insert({ id: opts.userId, name: "Test Tech" });
}

describe("getTechnicianStatusList — GPS consent is the only thing that gates location, anywhere in the result", () => {
  it("never returns coordinates for a technician without consent, even if a ping exists on file", async () => {
    await seedEmployee({ id: "emp-no-consent", userId: "user-no-consent", gpsConsentAt: null });
    await fakeDb.from("employee_location_pings").insert({
      employee_id: "emp-no-consent", latitude: 33.6, longitude: -117.8, captured_at: new Date().toISOString(),
    });

    const result = await getTechnicianStatusList();
    const tech = result.find((t) => t.id === "emp-no-consent");
    expect(tech?.has_gps_consent).toBe(false);
    expect(tech?.location).toBeNull();
    expect(tech?.location_label).toBe("unavailable");
  });

  it("returns coordinates for a technician with consent and a real ping", async () => {
    await seedEmployee({ id: "emp-consented", userId: "user-consented", gpsConsentAt: new Date().toISOString() });
    await fakeDb.from("employee_location_pings").insert({
      employee_id: "emp-consented", latitude: 33.7, longitude: -117.9, captured_at: new Date().toISOString(),
    });

    const result = await getTechnicianStatusList();
    const tech = result.find((t) => t.id === "emp-consented");
    expect(tech?.has_gps_consent).toBe(true);
    expect(tech?.location).toEqual({ lat: 33.7, lng: -117.9 });
  });

  it("returns null location for a consented technician with no ping at all", async () => {
    await seedEmployee({ id: "emp-no-ping", userId: "user-no-ping", gpsConsentAt: new Date().toISOString() });

    const result = await getTechnicianStatusList();
    const tech = result.find((t) => t.id === "emp-no-ping");
    expect(tech?.has_gps_consent).toBe(true);
    expect(tech?.location).toBeNull();
    expect(tech?.location_label).toBe("unavailable");
  });
});
