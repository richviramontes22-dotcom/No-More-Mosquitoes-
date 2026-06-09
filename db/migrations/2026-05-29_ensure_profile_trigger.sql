-- ─── Ensure Profile Auto-Creation Trigger ─────────────────────────────────────
-- Creates a DB trigger that automatically inserts a profiles row whenever
-- a new auth.users row is created (i.e., every new user signup).
--
-- Audit finding: No trigger exists in any prior migration. If this trigger
-- is not deployed, users can authenticate but have no profiles row, breaking:
--   - Billing (no stripe_customer_id to look up)
--   - Admin customer list (profile not visible)
--   - Email notifications (no email on profile)
--
-- Safe to re-run: CREATE OR REPLACE for the function, DROP IF EXISTS for the
-- trigger, then CREATE again.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    name,
    email,
    role,
    created_at
  )
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'full_name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.email,
    'customer',
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop the old trigger if it exists so CREATE doesn't fail on duplicate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ─── Verify ───────────────────────────────────────────────────────────────────
-- SELECT trigger_name FROM information_schema.triggers
-- WHERE event_object_schema = 'auth' AND event_object_table = 'users';
-- Expected: on_auth_user_created
