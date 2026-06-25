# PROFILE CREATION VERIFICATION
## Generated: 2026-05-29
## Phase 5 of the Final Operational Integrity Sprint

---

## Investigation Results

### Step 1: Migration Audit

Searched all migration files for `handle_new_user`, `on_auth_user_created`, `INSERT INTO.*profiles`, and `profiles.*trigger`:

**Result: NO trigger found in any migration file.**

The initial schema (`2025-02-23_initial_schema.sql`) creates the `profiles` table but does not create any DB trigger to auto-populate it on user signup. No subsequent migration creates one either.

### Step 2: Server Code Audit

Searched `server/` for profile creation code:

- `billingStripe.ts` `confirm-booking`: Updates an existing profile (`is_onboarded: true`, `onboarding_progress: null`). Does NOT create a profile.
- `webhooksStripe.ts` `invoice.paid`: Updates profiles for card details. Does NOT create a profile.
- No server route creates a profiles row.

### Step 3: Client Code Audit

No client-side profile creation code found.

---

## Risk Confirmed

**IS-5 from INVALID_STATE_ANALYSIS.md is a real risk.** A user who signs up via Supabase Auth gets an `auth.users` row but NO `profiles` row. This breaks:
- Billing (no `stripe_customer_id`)
- Admin customer list (customer invisible)
- Email notifications (no email on profiles row)
- Onboarding flow (no profile to set `is_onboarded`)

---

## Fix Implemented

**Migration created:** `db/migrations/2026-05-29_ensure_profile_trigger.sql`

Creates:
1. `public.handle_new_user()` function — uses `SECURITY DEFINER` so it can write to `public.profiles` from the `auth` schema context.
2. `on_auth_user_created` trigger on `auth.users` — fires `AFTER INSERT`.
3. Uses `ON CONFLICT (id) DO NOTHING` — safe for existing users and for idempotent re-runs.
4. Uses `CREATE OR REPLACE` for the function and `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER` — fully idempotent.

### Trigger SQL

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (
    id, name, email, role, created_at, updated_at
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
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
```

---

## Deployment Note

**This migration MUST be run in the Supabase SQL Editor** (or via Supabase CLI migration). It is a database-level trigger on `auth.users` — it cannot be run via the application.

After running, verify:
```sql
SELECT trigger_name FROM information_schema.triggers
WHERE event_object_schema = 'auth' AND event_object_table = 'users';
-- Expected: on_auth_user_created
```

---

## Existing Users

Existing `auth.users` rows without profiles will NOT get a profiles row automatically from this trigger (it only fires on INSERT). To backfill existing users:

```sql
-- Backfill profiles for existing auth users who don't have one
INSERT INTO public.profiles (id, name, email, role, created_at, updated_at)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
  u.email,
  'customer',
  NOW(),
  NOW()
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;
```

This backfill is NOT included in the migration file — it should be run manually after verifying the environment.

---

## Rollback

```sql
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
```
