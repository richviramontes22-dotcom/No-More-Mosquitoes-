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
  upsertLeadFromOutOfArea,
  upsertLeadFromWaitlist,
  updateLeadStatus,
  addLeadNote,
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
  it("returns the lead, its activity timeline, empty notes, and null linked records", async () => {
    const created = await upsertLeadFromQuote({ ...ADDRESS_A, acreage: 1.5, county: "orange" });
    await upsertLeadFromManualReview({ ...ADDRESS_A, manualReviewReason: "Follow up needed" });

    const detail = await getLead(created!.id);

    expect(detail).not.toBeNull();
    expect(detail!.lead.id).toBe(created!.id);
    expect(detail!.activities.map((a) => a.activity_type)).toEqual(["created", "manual_review"]);
    expect(detail!.notes).toEqual([]);
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

  it("includes notes from addLeadNote in the detail response", async () => {
    const lead = await upsertLeadFromQuote({ ...ADDRESS_A, acreage: 1.5, county: "orange" });
    await addLeadNote(lead!.id, "First note", null);
    await addLeadNote(lead!.id, "Second note", null);

    const detail = await getLead(lead!.id);
    expect(detail!.notes).toHaveLength(2);
    const bodies = detail!.notes.map((n) => n.body).sort();
    expect(bodies).toEqual(["First note", "Second note"]);
  });
});

describe("updateLeadStatus (admin status mutation)", () => {
  it("changes status and writes a status_changed activity", async () => {
    const lead = await upsertLeadFromQuote({ ...ADDRESS_A, acreage: 1.5, county: "orange" });
    expect(lead!.status).toBe("new");

    const updated = await updateLeadStatus(lead!.id, "contacted", null, null);

    expect(updated).not.toBeNull();
    expect(updated!.status).toBe("contacted");
    expect(fakeDb.tables.leads[0].status).toBe("contacted");

    const activities = fakeDb.tables.lead_activities.filter(
      (a) => a.lead_id === lead!.id && a.activity_type === "status_changed",
    );
    expect(activities).toHaveLength(1);
    expect(activities[0].payload).toMatchObject({ from: "new", to: "contacted" });
  });

  it("requires lost_reason when setting status to lost", async () => {
    const lead = await upsertLeadFromQuote({ ...ADDRESS_A, acreage: 1.5, county: "orange" });
    await expect(updateLeadStatus(lead!.id, "lost", null, null)).rejects.toThrow("lost_reason is required");
    await expect(updateLeadStatus(lead!.id, "lost", "  ", null)).rejects.toThrow("lost_reason is required");
  });

  it("sets lost_reason on the lead when status is lost", async () => {
    const lead = await upsertLeadFromQuote({ ...ADDRESS_A, acreage: 1.5, county: "orange" });
    const updated = await updateLeadStatus(lead!.id, "lost", "Not interested", null);

    expect(updated!.status).toBe("lost");
    expect(updated!.lost_reason).toBe("Not interested");
    const activity = fakeDb.tables.lead_activities.find(
      (a) => a.lead_id === lead!.id && a.activity_type === "status_changed",
    );
    expect(activity!.payload).toMatchObject({ from: "new", to: "lost", lost_reason: "Not interested" });
  });

  it("rejects invalid status values", async () => {
    const lead = await upsertLeadFromQuote({ ...ADDRESS_A, acreage: 1.5, county: "orange" });
    await expect(updateLeadStatus(lead!.id, "converted", null, null)).rejects.toThrow("Invalid status");
    await expect(updateLeadStatus(lead!.id, "unknown_status", null, null)).rejects.toThrow("Invalid status");
  });

  it("prevents rank downgrade (e.g. scheduled → contacted)", async () => {
    const lead = await upsertLeadFromScheduleRequest({
      scheduleRequestId: "sched-status-1",
      name: "Jane",
      email: "jane@test.com",
      phone: "7145550000",
      ...ADDRESS_A,
    });
    expect(lead!.status).toBe("scheduled");

    await expect(updateLeadStatus(lead!.id, "contacted", null, null)).rejects.toThrow("would decrease rank");
  });

  it("always allows setting status to new (admin reset) regardless of current rank", async () => {
    const lead = await upsertLeadFromScheduleRequest({
      scheduleRequestId: "sched-status-2",
      name: "Jane",
      email: "jane2@test.com",
      phone: "7145550001",
      ...ADDRESS_A,
    });
    expect(lead!.status).toBe("scheduled");

    const reset = await updateLeadStatus(lead!.id, "new", null, null);
    expect(reset!.status).toBe("new");
  });

  it("always allows setting status to lost regardless of current rank", async () => {
    const lead = await upsertLeadFromScheduleRequest({
      scheduleRequestId: "sched-status-3",
      name: "Jane",
      email: "jane3@test.com",
      phone: "7145550002",
      ...ADDRESS_B,
    });
    expect(lead!.status).toBe("scheduled");

    const lost = await updateLeadStatus(lead!.id, "lost", "No response after 3 attempts", null);
    expect(lost!.status).toBe("lost");
  });

  it("returns null for a non-existent lead id", async () => {
    const result = await updateLeadStatus("does-not-exist", "contacted", null, null);
    expect(result).toBeNull();
  });
});

describe("addLeadNote", () => {
  it("inserts a lead_notes row and a note_added activity", async () => {
    const lead = await upsertLeadFromQuote({ ...ADDRESS_A, acreage: 1.5, county: "orange" });

    const note = await addLeadNote(lead!.id, "Called and left voicemail", "admin-user-id");

    expect(note).not.toBeNull();
    expect(note!.lead_id).toBe(lead!.id);
    expect(note!.body).toBe("Called and left voicemail");
    expect(note!.author_id).toBe("admin-user-id");

    expect(fakeDb.tables.lead_notes).toHaveLength(1);

    const activity = fakeDb.tables.lead_activities.find(
      (a) => a.lead_id === lead!.id && a.activity_type === "note_added",
    );
    expect(activity).toBeTruthy();
    expect(activity!.payload).toMatchObject({ body: "Called and left voicemail" });
  });

  it("rejects empty note body", async () => {
    const lead = await upsertLeadFromQuote({ ...ADDRESS_A, acreage: 1.5, county: "orange" });
    await expect(addLeadNote(lead!.id, "", null)).rejects.toThrow("cannot be empty");
    await expect(addLeadNote(lead!.id, "  ", null)).rejects.toThrow("cannot be empty");
  });

  it("trims whitespace from the note body before storing", async () => {
    const lead = await upsertLeadFromQuote({ ...ADDRESS_A, acreage: 1.5, county: "orange" });
    const note = await addLeadNote(lead!.id, "  trimmed  ", null);
    expect(note!.body).toBe("trimmed");
  });
});

describe("upsertLeadFromOutOfArea", () => {
  it("creates a new lead with source=quote, status=out_of_area, and service area columns set", async () => {
    const lead = await upsertLeadFromOutOfArea({
      ...ADDRESS_A,
      acreage: 1.5,
      outOfAreaReason: "ZIP not in service area",
    });

    expect(lead).not.toBeNull();
    expect(lead!.status).toBe("out_of_area");
    expect(lead!.source).toBe("quote");
    expect(lead!.out_of_area_reason).toBe("ZIP not in service area");
    expect(lead!.service_area_status).toBe("not_covered");
    expect(lead!.service_zip).toBe(ADDRESS_A.zip);

    const activity = fakeDb.tables.lead_activities.find((a) => a.activity_type === "created");
    expect(activity).toBeTruthy();
    expect(activity!.payload).toMatchObject({ out_of_area: true });
  });

  it("merges into an existing lead without changing its status", async () => {
    const existing = await upsertLeadFromQuote({ ...ADDRESS_A, acreage: 1.5, county: "orange" });
    expect(existing!.status).toBe("new");

    const merged = await upsertLeadFromOutOfArea({
      ...ADDRESS_A,
      acreage: 1.5,
      outOfAreaReason: "ZIP not in service area",
    });

    expect(merged!.id).toBe(existing!.id);
    expect(merged!.status).toBe("new"); // does not downgrade
    expect(merged!.service_area_status).toBe("not_covered");
    expect(fakeDb.tables.leads).toHaveLength(1);
  });
});

describe("upsertLeadFromWaitlist", () => {
  it("creates a new lead with source=waitlist, status=out_of_area", async () => {
    const lead = await upsertLeadFromWaitlist({ email: "bob@example.com", name: "Bob", phone: null });

    expect(lead).not.toBeNull();
    expect(lead!.source).toBe("waitlist");
    expect(lead!.status).toBe("out_of_area");
    expect(lead!.email).toBe("bob@example.com");
    expect(lead!.name).toBe("Bob");

    const activity = fakeDb.tables.lead_activities.find((a) => a.activity_type === "created");
    expect(activity).toBeTruthy();
  });

  it("merges into an existing lead matched by email", async () => {
    const first = await upsertLeadFromScheduleRequest({
      scheduleRequestId: "sched-wl-1",
      name: "Bob",
      email: "BOB@example.com",
      phone: "7145550099",
      ...ADDRESS_A,
    });

    const merged = await upsertLeadFromWaitlist({ email: "bob@example.com", name: "Bob", phone: null });

    expect(merged!.id).toBe(first!.id);
    expect(fakeDb.tables.leads).toHaveLength(1);
  });
});
