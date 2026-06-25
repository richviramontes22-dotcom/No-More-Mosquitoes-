# Test Employee Creation Report
**Date:** 2026-05-31

## Admin Invite Flow — Updates

### Two creation paths now supported:

**Path A: Email invite (default)**
- Admin fills invite form → does NOT check "Generate temp password"
- Server calls `supabaseAdmin.auth.admin.inviteUserByEmail()`
- Supabase sends a magic link email to the employee
- Employee clicks link, sets password, lands at `/employee`
- Works for real employees and test employees alike

**Path B: Temp password (test only)**
- Admin checks "Mark as test account" + "Generate temp password (no email sent)"
- Server generates 14-character random password (no ambiguous chars: no O, 0, I, l)
- Server calls `supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true })`
- No email is sent
- `temp_password` field returned in API response (one-time only — not stored in DB)
- Admin dialog shows temp password to admin; closes when admin clicks "I've saved this password"
- Employee uses email + temp password at `/employee/login`

### New invite form fields:
- **Worker Type** select: Employee (W2) / Contractor (1099) / Vendor / Test Account
- **Mark as test account** checkbox
- **Generate temp password** checkbox (only visible when is_test is checked)

### Server: `POST /api/admin/employees/invite`

New accepted fields:
```typescript
{
  worker_type?: "employee" | "contractor" | "vendor" | "test",
  is_test?: boolean,
  generate_temp_password?: boolean,
}
```

`generate_temp_password` only acts when `is_test = true`. For real employees, email invite is always used.

### Admin employee list changes:
- **TEST badge** (amber) shown next to name for `is_test = true` employees
- **Worker type** secondary badge shown under role badge when not "employee"
- **Delete button** (red) shown only for `is_test = true` employees

### `DELETE /api/admin/employees/:id` (new route)

Safety rules:
1. Requires admin JWT auth
2. Requires `supabaseAdmin` (SUPABASE_SERVICE_ROLE_KEY)
3. **Enforces `is_test = true`** — returns 403 with message "Real employees cannot be hard deleted. Use deactivation instead." if not test
4. Nullifies `employee_id` on any assignments (prevents FK violation)
5. Deletes `employees` row (cascades: shifts, time_events, location_pings)
6. Deletes `profiles` row
7. Deletes Supabase auth user via `supabaseAdmin.auth.admin.deleteUser()`

Real employees: deactivate only via `PATCH /api/admin/employees/:id { status: "inactive" }`.

## Files Changed
- `server/routes/adminEmployees.ts` — full rewrite with new fields and DELETE endpoint
- `client/pages/admin/Employees.tsx` — new fields in invite form, badges, delete button, temp password dialog
