import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../../lib/supabaseAdmin", async () => {
  const { createFakeSupabase } = await import("./fakeSupabase");
  return { supabaseAdmin: createFakeSupabase() };
});
vi.mock("../../lib/supabase", () => ({ supabase: null }));

import { supabaseAdmin } from "../../lib/supabaseAdmin";
import type { FakeSupabase } from "./fakeSupabase";
import {
  upsertLeadFromQuote,
  upsertLeadFromManualReview,
  upsertLeadFromScheduleRequest,
  getLead,
  listLeads,
  normalizeEmail,
  normalizePhone,
} from "./leadService";
import { buildLeadAddressHash } from "../parcel/cache";

const fakeDb = supabaseAdmin as unknown as FakeSupabase;

beforeEach(() => {
  for (const table of Object.keys(fakeDb.tables)) {
    fakeDb.tables[table] = [];
  }
});

const ADDRESS_A = { address: "123 Main St", city: "Anaheim", state: "CA", zip: "92805" };
const ADDRESS_B = { address: "789 Elm Ave", city: "Irvine", state: "CA", zip: "92602" };

describe("upsertLeadFromQuote", () => {
  it("creates a new lead with source=quote, status=new, and a created activity", async () => {
    const lead = await upsertLeadFromQuote({ ...ADDRESS_A, acreage: 1.5, county: "orange" });

    expect(lead).not.toBeNull();
    expect(lead!.source).toBe("quote");
    expect(lead!.status).toBe("new");
    expect(lead!.acreage).toBe(1.5);
    expect(lead!.address_hash).toBe(buildLeadAddressHash(ADDRESS_A.address, ADDRESS_A.city, ADDRESS_A.state, ADDRESS_A.zip));

    expect(fakeDb.tables.leads).toHaveLength(1);
    const activities = fakeDb.tables.lead_activities.filter((a) => a.lead_id === lead!.id);
    expect(activities).toHaveLength(1);
    expect(activities[0].activity_type).toBe("created");
  });

  it("dedups repeat quotes for the same address into a single lead", async () => {
    const first = await upsertLeadFromQuote({ ...ADDRESS_A, acreage: 1.5, county: "orange" });
    const second = await upsertLeadFromQuote({ ...ADDRESS_A, acreage: 1.5, county: "orange" });

    expect(second!.id).toBe(first!.id);
    expect(fakeDb.tables.leads).toHaveLength(1);

    const activities = fakeDb.tables.lead_activities.filter((a) => a.lead_id === first!.id);
    expect(activities.map((a) => a.activity_type)).toEqual(["created", "quote_requested"]);
  });
});

describe("upsertLeadFromManualReview", () => {
  it("creates a new lead with source=manual_review, status=manual_review, and manual_review_reason set", async () => {
    const lead = await upsertLeadFromManualReview({
      ...ADDRESS_A,
      manualReviewReason: "No GIS parcel match found",
    });

    expect(lead).not.toBeNull();
    expect(lead!.source).toBe("manual_review");
    expect(lead!.status).toBe("manual_review");
    expect(lead!.manual_review_reason).toBe("No GIS parcel match found");
    expect(fakeDb.tables.leads).toHaveLength(1);
  });

  it("merges into an existing quote lead for the same address (address hash consistency)", async () => {
    const quoteLead = await upsertLeadFromQuote({ ...ADDRESS_A, acreage: 1.5, county: "orange" });

    const reviewLead = await upsertLeadFromManualReview({
      ...ADDRESS_A,
      manualReviewReason: "No GIS parcel match found",
    });

    expect(reviewLead!.id).toBe(quoteLead!.id);
    expect(fakeDb.tables.leads).toHaveLength(1);
    expect(reviewLead!.status).toBe("manual_review");
    expect(reviewLead!.manual_review_reason).toBe("No GIS parcel match found");
    // acreage captured by the original quote is preserved
    expect(reviewLead!.acreage).toBe(1.5);

    const activities = fakeDb.tables.lead_activities.filter((a) => a.lead_id === quoteLead!.id);
    expect(activities.map((a) => a.activity_type)).toEqual(["created", "manual_review"]);
  });
});

describe("upsertLeadFromScheduleRequest", () => {
  it("creates a new lead with source=schedule_request, status=scheduled, and contact info populated", async () => {
    const lead = await upsertLeadFromScheduleRequest({
      scheduleRequestId: "sched-1",
      name: "Jane Doe",
      email: "Jane@Example.com",
      phone: "(714) 555-1234",
      ...ADDRESS_A,
      acreage: 2,
      cadence: "monthly",
    });

    expect(lead).not.toBeNull();
    expect(lead!.source).toBe("schedule_request");
    expect(lead!.status).toBe("scheduled");
    expect(lead!.name).toBe("Jane Doe");
    expect(lead!.email).toBe(normalizeEmail("Jane@Example.com"));
    expect(lead!.phone).toBe(normalizePhone("(714) 555-1234"));
    expect(lead!.schedule_request_id).toBe("sched-1");
    expect(fakeDb.tables.leads).toHaveLength(1);

    const activities = fakeDb.tables.lead_activities.filter((a) => a.lead_id === lead!.id);
    expect(activities.map((a) => a.activity_type)).toEqual(["created"]);
  });

  it("merges into an existing quote lead for the same property via address_hash", async () => {
    const quoteLead = await upsertLeadFromQuote({ ...ADDRESS_A, acreage: 1.5, county: "orange" });

    const scheduleLead = await upsertLeadFromScheduleRequest({
      scheduleRequestId: "sched-2",
      name: "Jane Doe",
      email: "jane@example.com",
      phone: "7145551234",
      ...ADDRESS_A,
      acreage: 1.5,
      cadence: "monthly",
    });

    expect(scheduleLead!.id).toBe(quoteLead!.id);
    expect(fakeDb.tables.leads).toHaveLength(1);
    expect(scheduleLead!.status).toBe("scheduled");
    expect(scheduleLead!.name).toBe("Jane Doe");
    expect(scheduleLead!.email).toBe("jane@example.com");
    expect(scheduleLead!.schedule_request_id).toBe("sched-2");

    const activities = fakeDb.tables.lead_activities.filter((a) => a.lead_id === quoteLead!.id);
    expect(activities.map((a) => a.activity_type)).toEqual(["created", "schedule_request_received"]);
    expect(activities[1].payload).toMatchObject({ matched_on: "address_hash" });
  });

  it("merges into an existing lead with the same email even when the address differs", async () => {
    const firstLead = await upsertLeadFromScheduleRequest({
      scheduleRequestId: "sched-3",
      name: "Jane Doe",
      email: "jane@example.com",
      phone: "7145551234",
      ...ADDRESS_A,
    });

    const secondLead = await upsertLeadFromScheduleRequest({
      scheduleRequestId: "sched-4",
      name: "Jane Doe",
      email: "JANE@example.com",
      phone: "7145551234",
      ...ADDRESS_B,
    });

    expect(secondLead!.id).toBe(firstLead!.id);
    expect(fakeDb.tables.leads).toHaveLength(1);
    // address_hash from the first request is preserved (not overwritten)
    expect(secondLead!.address_hash).toBe(
      buildLeadAddressHash(ADDRESS_A.address, ADDRESS_A.city, ADDRESS_A.state, ADDRESS_A.zip),
    );

    const activities = fakeDb.tables.lead_activities.filter((a) => a.lead_id === firstLead!.id);
    expect(activities.map((a) => a.activity_type)).toEqual(["created", "merged"]);
    expect(activities[1].payload).toMatchObject({ matched_on: "email" });
  });

  it("never downgrades a scheduled lead's status on a later manual-review hit for the same address", async () => {
    const scheduled = await upsertLeadFromScheduleRequest({
      scheduleRequestId: "sched-5",
      name: "Jane Doe",
      email: "jane@example.com",
      phone: "7145551234",
      ...ADDRESS_A,
    });
    expect(scheduled!.status).toBe("scheduled");

    const afterReview = await upsertLeadFromManualReview({
      ...ADDRESS_A,
      manualReviewReason: "Needs manual quote",
    });

    expect(afterReview!.id).toBe(scheduled!.id);
    expect(afterReview!.status).toBe("scheduled");
    expect(afterReview!.manual_review_reason).toBe("Needs manual quote");
  });
});

describe("listLeads (admin leads list)", () => {
  beforeEach(async () => {
    await upsertLeadFromQuote({ ...ADDRESS_A, acreage: 1.5, county: "orange" });
    await upsertLeadFromManualReview({ ...ADDRESS_B, manualReviewReason: "No parcel match" });
    await upsertLeadFromScheduleRequest({
      scheduleRequestId: "sched-list-1",
      name: "Jane Doe",
      email: "jane@example.com",
      phone: "7145551234",
      address: "555 Oak Dr",
      city: "Tustin",
      state: "CA",
      zip: "92780",
    });
  });

  it("returns all leads with activity counts when unfiltered", async () => {
    const result = await listLeads({});
    expect(result.total).toBe(3);
    expect(result.leads).toHaveLength(3);
    for (const lead of result.leads) {
      expect(lead.activity_count).toBeGreaterThanOrEqual(1);
    }
  });

  it("filters by status", async () => {
    const result = await listLeads({ status: "manual_review" });
    expect(result.total).toBe(1);
    expect(result.leads[0].source).toBe("manual_review");
  });

  it("filters by source", async () => {
    const result = await listLeads({ source: "schedule_request" });
    expect(result.total).toBe(1);
    expect(result.leads[0].name).toBe("Jane Doe");
  });

  it("searches across name/email/phone/address", async () => {
    const result = await listLeads({ search: "Jane" });
    expect(result.total).toBe(1);
    expect(result.leads[0].email).toBe("jane@example.com");
  });

  it("paginates results", async () => {
    const page1 = await listLeads({ pageSize: 2, page: 1 });
    expect(page1.leads).toHaveLength(2);
    expect(page1.total).toBe(3);

    const page2 = await listLeads({ pageSize: 2, page: 2 });
    expect(page2.leads).toHaveLength(1);
    expect(page2.total).toBe(3);
  });
});

describe("getLead (admin lead detail)", () => {
  it("returns the lead, its activity timeline, and null linked records when none are set", async () => {
    const created = await upsertLeadFromQuote({ ...ADDRESS_A, acreage: 1.5, county: "orange" });
    await upsertLeadFromManualReview({ ...ADDRESS_A, manualReviewReason: "Follow up needed" });

    const detail = await getLead(created!.id);

    expect(detail).not.toBeNull();
    expect(detail!.lead.id).toBe(created!.id);
    expect(detail!.activities.map((a) => a.activity_type)).toEqual(["created", "manual_review"]);
    expect(detail!.linked).toEqual({
      profile: null,
      property: null,
      scheduleRequest: null,
      subscription: null,
    });
  });

  it("returns null for an unknown lead id", async () => {
    const detail = await getLead("does-not-exist");
    expect(detail).toBeNull();
  });
});
