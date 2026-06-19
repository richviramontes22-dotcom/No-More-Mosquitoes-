-- ============================================================
-- Customer Service / Ticketing Hardening
--
-- Extends the EXISTING `tickets` table (live in production, already used by
-- client/pages/dashboard/Help.tsx and client/pages/admin/Tickets.tsx) rather
-- than creating a parallel support_tickets table. Adds the two missing
-- pieces a real ticket thread needs: customer-visible replies and
-- staff-only internal notes — both new child tables, FK'd to tickets.id.
--
-- Note on schema drift: the live `tickets` table already has `property_id`,
-- `assigned_to`, and `due_at` columns that were never captured in the
-- original 2025-11-25_tickets_table.sql migration. This migration adds to
-- that live shape, not the original tracked one — verified directly against
-- production before writing this file.
-- ============================================================

-- ─── 1. Extend tickets: category + widened status ────────────────────────────

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'general'
    CHECK (category IN ('billing', 'scheduling', 'service_quality', 'retreatment_request', 'property_access', 'pesticide_question', 'general'));

-- Widen status to a superset that includes the existing live values
-- (open, in_progress, resolved, closed) plus the new ones — additive, so no
-- existing row's status ever becomes invalid.
ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_status_check;
ALTER TABLE public.tickets ADD CONSTRAINT tickets_status_check
  CHECK (status IN ('open', 'in_progress', 'pending_customer', 'pending_staff', 'escalated', 'resolved', 'closed'));

-- priority already supports low/medium/high/urgent per the original
-- migration — no change needed. ("medium" is kept rather than renamed to
-- "normal" to avoid a data migration and touching every existing UI
-- reference for zero behavioral benefit; documented in the implementation
-- report.)

CREATE INDEX IF NOT EXISTS tickets_category_idx ON public.tickets (category);
CREATE INDEX IF NOT EXISTS tickets_assigned_to_idx ON public.tickets (assigned_to);

-- ─── 2. ticket_messages — customer-visible reply thread ───────────────────────

CREATE TABLE IF NOT EXISTS public.ticket_messages (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   UUID        NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  sender_id   UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  sender_role TEXT        NOT NULL CHECK (sender_role IN ('customer', 'staff')),
  body        TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ticket_messages_ticket_id_idx ON public.ticket_messages (ticket_id, created_at);

ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ticket_messages_customer_select ON public.ticket_messages;
CREATE POLICY ticket_messages_customer_select ON public.ticket_messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.tickets WHERE tickets.id = ticket_messages.ticket_id AND tickets.user_id = auth.uid())
  );

DROP POLICY IF EXISTS ticket_messages_customer_insert ON public.ticket_messages;
CREATE POLICY ticket_messages_customer_insert ON public.ticket_messages
  FOR INSERT WITH CHECK (
    sender_role = 'customer'
    AND sender_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.tickets WHERE tickets.id = ticket_messages.ticket_id AND tickets.user_id = auth.uid())
  );

DROP POLICY IF EXISTS ticket_messages_staff_all ON public.ticket_messages;
CREATE POLICY ticket_messages_staff_all ON public.ticket_messages
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'customer_service'))
  );

-- ─── 3. ticket_internal_notes — staff-only, NEVER customer-visible ────────────

CREATE TABLE IF NOT EXISTS public.ticket_internal_notes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id  UUID        NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  author_id  UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  body       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ticket_internal_notes_ticket_id_idx ON public.ticket_internal_notes (ticket_id, created_at);

ALTER TABLE public.ticket_internal_notes ENABLE ROW LEVEL SECURITY;

-- Deliberately no customer-facing policy of any kind exists on this table —
-- a customer querying it gets zero rows under RLS, full stop.
DROP POLICY IF EXISTS ticket_internal_notes_staff_only ON public.ticket_internal_notes;
CREATE POLICY ticket_internal_notes_staff_only ON public.ticket_internal_notes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'customer_service'))
  );

-- ─── 4. Allow staff (admin + customer_service) to update tickets ─────────────
-- The existing "Admins can manage all tickets" policy already covers admin.
-- Add the equivalent for customer_service so assignment/status/escalation
-- changes work once that role exists (Phase 6 of this sprint).

DROP POLICY IF EXISTS tickets_customer_service_manage ON public.tickets;
CREATE POLICY tickets_customer_service_manage ON public.tickets
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'customer_service')
  );
