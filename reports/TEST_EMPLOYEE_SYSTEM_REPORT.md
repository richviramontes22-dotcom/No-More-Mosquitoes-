# Phase 5 — Test Employee System Report
**Date:** 2026-05-31
**Project:** No More Mosquitoes — Employee Operations Sprint

---

## Current State

No test employee system exists. The `employees` table has no `is_test` flag. Admins must use real email addresses to send invites, which triggers Supabase auth emails. There is no way to create a test employee without receiving a real invite email.

---

## Required Additions

### Database
```sql
ALTER TABLE employees
  ADD COLUMN is_test boolean NOT NULL DEFAULT false,
  ADD COLUMN worker_type text NOT NULL DEFAULT 'employee'
    CHECK (worker_type IN ('employee', 'contractor', 'vendor', 'test'));
```

When `is_test = true` OR `worker_type = 'test'`:
- Block sending real customer PII in notifications
- Block sending real customer phone/email to the employee
- Show "TEST ACCOUNT" banner on employee dashboard
- Allow deletion (real employee accounts cannot be deleted — only deactivated)

---

## Admin Workflow for Test Employees

### Create Test Employee
1. Admin opens Employees page → "Invite Employee"
2. Checks "Test Account" toggle (hidden unless admin role)
3. Enters name, email (can be owner's own email for self-testing)
4. Selects role: technician, dispatcher
5. Sets worker_type: test
6. Submits

**Server behavior when `is_test = true`:**
- Still uses `supabaseAdmin.auth.admin.inviteUserByEmail()` — email goes to a real address
- Creates `employees` row with `is_test = true`, `worker_type = 'test'`
- Creates `profiles` row with `role = 'employee'`
- Optionally skips invite email if admin passes `skip_invite: true` and provides a temp password via Supabase admin setPassword

### Assign Test Appointments
- Admin creates a test appointment in the system (can use a test property address like office address)
- Dispatches to test employee via normal assignment flow
- Test appointments should be filterable in admin views

### Generate Temp Password (Alternative to Email Invite)
For purely local testing, admin can:
```
POST /api/admin/employees/invite
{ "email": "test@domain.com", "is_test": true, "generate_temp_password": true }
```
Server calls `supabaseAdmin.auth.admin.createUser({ email, password: generatedPassword, email_confirm: true })`
Returns temp password to admin (one-time display only, then discarded).

### Delete Test Employee
- Real employees: deactivate only (preserve records)
- Test employees with `is_test = true`: allow hard delete via admin API
- Cleans up: employees row, profile row, assignments rows (if test-flagged), auth user

---

## Test Employee Dashboard Behavior

### Banner
Persistent banner at top of employee dashboard:
```
⚠ TEST ACCOUNT — This account is for testing only. Real customer data is masked.
```

### Data Masking
When `is_test = true`, the assignments endpoint masks:
- `customer_phone` → `(555) 000-0000`
- `customer_name` → `Test Customer`
- `address` → `123 Test Street, Test City, CA 00000`
- `notes` → `Test service notes`

Masking is server-side only. Client cannot override.

### Notifications
When `is_test = true`:
- `notifyAdmin()` calls are skipped or tagged `[TEST]` in the subject
- Customer notification calls (service_completed emails) are suppressed
- All notification_log entries marked with metadata: `{ test: true }`

### GPS Simulation
Test employees can use the real browser geolocation API, or the system can provide a mock location:
- Mock lat/lng passed as query param: `?mock_lat=33.7&mock_lng=-117.9`
- Server accepts mock coordinates for test accounts only
- Real employees cannot use mock coordinates

---

## Server Route Changes

### `POST /api/admin/employees/invite`
Add fields:
```typescript
is_test?: boolean
worker_type?: 'employee' | 'contractor' | 'vendor' | 'test'
generate_temp_password?: boolean
```

### `DELETE /api/admin/employees/:id` (new)
Only permitted when `employee.is_test = true`.
Steps:
1. Verify `is_test = true`
2. Delete `employee_onboarding_assignments` for employee
3. Delete `employee_form_signatures` for employee
4. Delete `assignments` where `employee_id = id` AND `is_test = true` (if tracked)
5. Delete `employees` row
6. Delete `profiles` row
7. Delete Supabase auth user via `supabaseAdmin.auth.admin.deleteUser()`

### `GET /api/employee/assignments`
If `employee.is_test = true`, mask customer fields server-side.

---

## Testing Scenarios Enabled

| Scenario | How to Test |
|----------|-------------|
| Employee login | Use test account email + temp password |
| See today's assignments | Create test appointment, assign to test employee |
| Update assignment status | Use status buttons in assignment detail |
| Upload job media | Take/select photo from device |
| Test navigation deep link | Tap "Navigate" — opens Maps app |
| Test checklist | Check boxes in pre-service checklist |
| Test GPS capture on clock-in | Allow location permission on device |
| Test messaging flow | Send message in assignment detail |
| Test timesheet | Clock in/out, view weekly summary |
| Test route view (when built) | Assign 3+ test appointments to test employee |
| Test onboarding flow (when built) | Assign test form to test employee |

---

## Admin Test Panel (Recommended UI Addition)

In the Employees admin page, add a "Test Accounts" filter tab showing only `is_test = true` employees. Actions for test accounts only:
- "Generate Temp Password" button
- "Delete Account" button (hard delete, only for test)
- "Reset Assignments" button (clear all assignments)
- "Simulate Appointment" button (create and assign a test appointment in one click)

---

## Security Considerations

1. `is_test` flag is set server-side — client cannot self-grant test status
2. Test account masking is enforced server-side — client cannot bypass
3. Test password generation returns password only once in API response — not stored in DB
4. Test employees still go through Supabase auth — they have real JWT tokens
5. `worker_type = 'test'` can optionally restrict access to certain admin views
