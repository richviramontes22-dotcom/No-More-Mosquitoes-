import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../../lib/supabaseAdmin", async () => {
  const { createFakeSupabase } = await import("../../testUtils/fakeSupabase");
  return { supabaseAdmin: createFakeSupabase() };
});
vi.mock("../../lib/supabase", () => ({ supabase: null }));

import { supabaseAdmin } from "../../lib/supabaseAdmin";
import type { FakeSupabase } from "../../testUtils/fakeSupabase";
import {
  createTicket,
  replyToTicket,
  addInternalNote,
  assignTicket,
  setTicketStatus,
  getTicketView,
} from "./ticketService";

const fakeDb = supabaseAdmin as unknown as FakeSupabase;

beforeEach(() => {
  for (const table of Object.keys(fakeDb.tables)) fakeDb.tables[table] = [];
});

describe("createTicket — customer creates a ticket", () => {
  it("creates a ticket with status open and the given category/priority", async () => {
    const ticket = await createTicket({ userId: "cust-1", subject: "Billing question", category: "billing", priority: "low" });
    expect(ticket).not.toBeNull();
    expect(ticket!.status).toBe("open");
    expect(ticket!.category).toBe("billing");
    expect(ticket!.priority).toBe("low");
    expect(ticket!.user_id).toBe("cust-1");
  });

  it("defaults to category general and priority medium when not specified", async () => {
    const ticket = await createTicket({ userId: "cust-1", subject: "Help" });
    expect(ticket!.category).toBe("general");
    expect(ticket!.priority).toBe("medium");
  });
});

describe("getTicketView — customer sees own ticket", () => {
  it("returns the ticket and its customer-visible messages", async () => {
    const ticket = await createTicket({ userId: "cust-1", subject: "Test" });
    await replyToTicket(ticket!.id, "customer", "cust-1", "Any update?");

    const view = await getTicketView(ticket!.id, false);
    expect(view).not.toBeNull();
    expect(view!.ticket.id).toBe(ticket!.id);
    expect(view!.messages).toHaveLength(1);
    expect(view!.messages[0].body).toBe("Any update?");
  });
});

describe("replyToTicket — staff replies", () => {
  it("records a staff reply and auto-transitions the ticket to pending_customer", async () => {
    const ticket = await createTicket({ userId: "cust-1", subject: "Test" });
    const message = await replyToTicket(ticket!.id, "staff", "staff-1", "We're looking into it.");

    expect(message).not.toBeNull();
    expect(message!.sender_role).toBe("staff");

    const view = await getTicketView(ticket!.id, true);
    expect(view!.ticket.status).toBe("pending_customer");
  });

  it("does not reopen a closed ticket via a staff reply", async () => {
    const ticket = await createTicket({ userId: "cust-1", subject: "Test" });
    await setTicketStatus(ticket!.id, "closed");
    await replyToTicket(ticket!.id, "staff", "staff-1", "Following up after close");

    const view = await getTicketView(ticket!.id, true);
    expect(view!.ticket.status).toBe("closed");
  });
});

describe("addInternalNote — staff internal note hidden from customer", () => {
  it("is included in the staff view but never in the customer view", async () => {
    const ticket = await createTicket({ userId: "cust-1", subject: "Test" });
    await addInternalNote(ticket!.id, "staff-1", "Customer seems upset, escalate if no response in 24h");

    const staffView = await getTicketView(ticket!.id, true);
    const customerView = await getTicketView(ticket!.id, false);

    expect(staffView!.internal_notes).toHaveLength(1);
    expect(staffView!.internal_notes[0].body).toMatch(/escalate/);
    expect(customerView!.internal_notes).toHaveLength(0);
  });
});

describe("assignTicket — ticket assignment", () => {
  it("sets assigned_to to the given staff profile id", async () => {
    const ticket = await createTicket({ userId: "cust-1", subject: "Test" });
    const updated = await assignTicket(ticket!.id, "staff-42");
    expect(updated!.assigned_to).toBe("staff-42");
  });

  it("can unassign by passing null", async () => {
    const ticket = await createTicket({ userId: "cust-1", subject: "Test" });
    await assignTicket(ticket!.id, "staff-42");
    const updated = await assignTicket(ticket!.id, null);
    expect(updated!.assigned_to).toBeNull();
  });
});

describe("setTicketStatus — escalate, close, reopen", () => {
  it("escalates a ticket", async () => {
    const ticket = await createTicket({ userId: "cust-1", subject: "Test" });
    const updated = await setTicketStatus(ticket!.id, "escalated");
    expect(updated!.status).toBe("escalated");
  });

  it("closes and then reopens a ticket", async () => {
    const ticket = await createTicket({ userId: "cust-1", subject: "Test" });
    const closed = await setTicketStatus(ticket!.id, "closed");
    expect(closed!.status).toBe("closed");

    const reopened = await setTicketStatus(ticket!.id, "open");
    expect(reopened!.status).toBe("open");
  });
});
