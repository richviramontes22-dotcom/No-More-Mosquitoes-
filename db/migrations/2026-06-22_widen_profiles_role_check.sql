-- ============================================================
-- Widen profiles.role CHECK constraint to allow the full set of
-- roles the application already routes/guards for.
--
-- Confirmed live (production REST API, empirical test against each value):
-- currently allowed: 'admin', 'support', 'customer', 'employee'
-- currently REJECTED with 23514 profiles_role_check violation:
--   'technician', 'dispatcher', 'sales', 'customer_service'
--
-- The employee portal (RequireEmployee.tsx, EmployeeLayout.tsx) and the
-- customer_service/sales routing already added earlier this project assume
-- these four roles are assignable — they currently are not, in production.
-- ============================================================

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN (
    'admin',
    'support',
    'customer',
    'employee',
    'technician',
    'dispatcher',
    'sales',
    'customer_service'
  ));
