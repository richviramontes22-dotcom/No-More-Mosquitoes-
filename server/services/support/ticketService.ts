import { supabase } from "../../lib/supabase";
import { supabaseAdmin } from "../../lib/supabaseAdmin";

const db = supabaseAdmin ?? supabase;

export type TicketCategory = "billing" | "scheduling" | "service_quality" | "retreatment_request" | "property_access" | "pesticide_question" | "general";
export type TicketStatus = "open" | "in_progress" | "pending_customer" | "pending_staff" | "escalated" | "resolved" | "closed";
export type TicketPriority = "low" | "medium" | "high" | "urgent";

export interface Ticket {
  id: string;
  user_id: string;
  subject: string;
  description: string | null;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
}

export interface TicketMessage {
  id: string;
  ticket_id: string;
  sender_id: string | null;
  sender_role: "customer" | "staff";
  body: string;
  created_at: string;
}

export interface TicketInternalNote {
  id: string;
  ticket_id: string;
  author_id: string | null;
  body: string;
  created_at: string;
}

/**
 * Application-layer codification of the same rules the RLS policies in
 * 2026-06-19_ticketing_hardening.sql enforce in production (the
 * customer-facing UI talks directly to Supabase + RLS, per the existing
 * pattern for this feature — see CUSTOMER_SERVICE_TICKETING_IMPLEMENTATION_REPORT.md).
 * This service exists so the safety-critical rules have something
 * unit-testable with a fake DB, as a second, independent check on top of
 * RLS (defense in depth) — not a replacement for it.
 */

export async function createTicket(params: {
  userId: string;
  subject: string;
  description?: string | null;
  category?: TicketCategory;
  priority?: TicketPriority;
}): Promise<Ticket | null> {
  const { data, error } = await db
    .from("tickets")
    .insert({
      user_id: params.userId,
      subject: params.subject,
      description: params.description ?? null,
      category: params.category ?? "general",
      priority: params.priority ?? "medium",
      status: "open",
    })
    .select("*")
    .single();
  if (error) return null;
  return data as Ticket;
}

export async function replyToTicket(
  ticketId: string,
  senderRole: "customer" | "staff",
  senderId: string | null,
  body: string,
): Promise<TicketMessage | null> {
  const { data: message, error } = await db
    .from("ticket_messages")
    .insert({ ticket_id: ticketId, sender_role: senderRole, sender_id: senderId, body })
    .select("*")
    .single();
  if (error) return null;

  // A staff reply means the ball is in the customer's court — mirrors the
  // same auto-transition the admin Tickets.tsx detail dialog performs.
  if (senderRole === "staff") {
    const { data: ticket } = await db.from("tickets").select("status").eq("id", ticketId).maybeSingle();
    if (ticket && !["closed", "resolved"].includes(ticket.status)) {
      await db.from("tickets").update({ status: "pending_customer" }).eq("id", ticketId);
    }
  }

  return message as TicketMessage;
}

export async function addInternalNote(ticketId: string, authorId: string | null, body: string): Promise<TicketInternalNote | null> {
  const { data, error } = await db
    .from("ticket_internal_notes")
    .insert({ ticket_id: ticketId, author_id: authorId, body })
    .select("*")
    .single();
  if (error) return null;
  return data as TicketInternalNote;
}

export async function assignTicket(ticketId: string, assigneeId: string | null): Promise<Ticket | null> {
  const { data, error } = await db.from("tickets").update({ assigned_to: assigneeId }).eq("id", ticketId).select("*").single();
  if (error) return null;
  return data as Ticket;
}

export async function setTicketStatus(ticketId: string, status: TicketStatus): Promise<Ticket | null> {
  const { data, error } = await db.from("tickets").update({ status }).eq("id", ticketId).select("*").single();
  if (error) return null;
  return data as Ticket;
}

export interface TicketView {
  ticket: Ticket;
  messages: TicketMessage[];
  internal_notes: TicketInternalNote[];
}

/**
 * The actual safety property under test: when isStaff is false, internal
 * notes are never included in the result, regardless of what's in the
 * table — independent of whatever RLS does or doesn't enforce.
 */
export async function getTicketView(ticketId: string, isStaff: boolean): Promise<TicketView | null> {
  const { data: ticket } = await db.from("tickets").select("*").eq("id", ticketId).maybeSingle();
  if (!ticket) return null;

  const { data: messages } = await db.from("ticket_messages").select("*").eq("ticket_id", ticketId).order("created_at");

  let internalNotes: TicketInternalNote[] = [];
  if (isStaff) {
    const { data: notes } = await db.from("ticket_internal_notes").select("*").eq("ticket_id", ticketId).order("created_at");
    internalNotes = (notes ?? []) as TicketInternalNote[];
  }

  return { ticket: ticket as Ticket, messages: (messages ?? []) as TicketMessage[], internal_notes: internalNotes };
}
