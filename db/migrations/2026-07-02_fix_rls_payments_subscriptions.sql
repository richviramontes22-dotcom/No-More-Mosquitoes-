-- ============================================================
-- Fix: Overly-broad RLS policies on payments, subscriptions,
--      job_checklists, chemicals_logs, and signatures.
--
-- Root cause: 2025-05-20_admin_features_support.sql and
-- 2025-11-28_missing_tables.sql created policies named
-- "Admins can do everything on ..." that use USING (true) —
-- this grants all authenticated users full read/write access,
-- not just admins.
--
-- Impact: Any logged-in customer could read billing data for
-- all other customers, and read job service records at other
-- customer properties.
--
-- Applied: 2026-07-02
-- ============================================================

-- ─── payments ──────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Admins can do everything on payments" ON public.payments;

-- Customers can only see their own payments
CREATE POLICY "Customers can view own payments" ON public.payments
  FOR SELECT
  USING (user_id = auth.uid());

-- Admins can manage all payments
CREATE POLICY "Admins can manage all payments" ON public.payments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ─── subscriptions ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Admins can do everything on subscriptions" ON public.subscriptions;

-- Customers can view their own subscriptions
CREATE POLICY "Customers can view own subscriptions" ON public.subscriptions
  FOR SELECT
  USING (user_id = auth.uid());

-- Admins can manage all subscriptions
CREATE POLICY "Admins can manage all subscriptions" ON public.subscriptions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ─── job_checklists ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Authenticated access to job checklists" ON public.job_checklists;

-- Employees can access checklists for their own assignments only
CREATE POLICY "Employees can access own job checklists" ON public.job_checklists
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.assignments a
        JOIN public.employees e ON e.id = a.employee_id
      WHERE a.id = job_checklists.assignment_id
        AND e.user_id = auth.uid()
    )
  );

-- Admins can manage all checklists
CREATE POLICY "Admins can manage all job checklists" ON public.job_checklists
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ─── chemicals_logs ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Authenticated access to chemicals logs" ON public.chemicals_logs;

-- Employees can access logs for their own assignments only
CREATE POLICY "Employees can access own chemicals logs" ON public.chemicals_logs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.assignments a
        JOIN public.employees e ON e.id = a.employee_id
      WHERE a.id = chemicals_logs.assignment_id
        AND e.user_id = auth.uid()
    )
  );

-- Admins can manage all logs
CREATE POLICY "Admins can manage all chemicals logs" ON public.chemicals_logs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ─── signatures ────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Authenticated access to signatures" ON public.signatures;

-- Employees can access signatures for their own assignments only
CREATE POLICY "Employees can access own signatures" ON public.signatures
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.assignments a
        JOIN public.employees e ON e.id = a.employee_id
      WHERE a.id = signatures.assignment_id
        AND e.user_id = auth.uid()
    )
  );

-- Admins can manage all signatures
CREATE POLICY "Admins can manage all signatures" ON public.signatures
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
