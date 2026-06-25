# Operational Notification Fix Report
**Sprint:** Launch Blocker + High-Value Operational Fix Sprint  
**Date:** 2026-05-28

---

## Summary

All three P1 notification items were implemented. Employee assignment and customer completion notifications have a real email-send path (using the existing Resend infrastructure). Admin scheduling failure alerts create tickets in the `tickets` table. None of these are blocking operations — all fail safely.

---

## P1.1 — Employee Assignment Notification

### What Was Implemented

**Server route (`server/routes/adminAppointments.ts`):**  
A new `POST /api/admin/assignments` route was added. It:
1. Validates `appointment_ids` (array) and `employee_id` are present
2. Fetches the employee record (name, email)
3. Upserts all assignments via `db.from("assignments").upsert(...)` with `onConflict: "appointment_id"` and `status: "scheduled"` (matching the DB check constraint)
4. If the employee has an email and Resend is configured, sends a simple HTML notification email in a fire-and-forget `.then()/.catch()` pattern

**Client update (`client/pages/admin/Appointments.tsx`):**  
The `assignSelected()` function was updated to call `adminApi("/api/admin/assignments", "POST", { appointment_ids: ids, employee_id: assignTech })` instead of directly calling `supabase.from("assignments").upsert(...)`. All UI behavior is preserved — the local state update and toast notifications remain identical.

### What Changed vs Original
- Original: direct Supabase upsert from the client with `status: "pending"` (would have failed the DB check constraint — "pending" is not in the allowed statuses)
- New: server route that uses `status: "scheduled"` (valid) and notifies the employee

### Deferred Items
- Assignment notification email is a simple inline HTML message, not a templated email from `emailTemplates.ts`. A proper `buildAssignmentEmail` template was not added to keep the scope bounded. The email content is functional but not branded to the same standard as other emails.
- No `notification_log` entry is created for assignment notifications (the log is appointment-scoped; assignment notifications are employee-facing).

### What's Still Needed to Send Real Emails
- `RESEND_API_KEY` must be set in the environment
- `RESEND_FROM_EMAIL` should be set (defaults to `hello@nomoremosquitoes.us`)
- Employee records must have a valid `email` column populated

---

## P1.2 — Customer Completion Notification

### What Was Implemented

**Server route (`server/routes/employeeAssignments.ts`):**  
After the appointment status cascade update (setting appointment to `completed`), a fire-and-forget async block was added that:
1. Fetches the appointment's `user_id`, `scheduled_date`, and `service_type`
2. Fetches the customer's `email` and `name` from profiles
3. Checks if job media was attached to the assignment (for a richer notification message)
4. Logs the completion intent to the server console
5. Sends a completion email via Resend if `isEmailConfigured()` returns true
6. Logs to `notification_log` using `notification_type: "appointment_confirmation"` (closest matching type in the existing check constraint) — the insert is `.catch(() => {})` protected

### Deferred Items
- A dedicated `notification_type` value of `"service_completed"` does not exist in the `notification_log` check constraint. The `"appointment_confirmation"` type was used as the closest valid substitute. To properly classify this in the log, a migration adding `"service_completed"` to the enum would be needed.
- The email HTML is inline rather than a templated function in `emailTemplates.ts`. This works but doesn't match the branded template style exactly. Adding a `buildCompletionEmail()` template is a fast-follow.

### What's Still Needed to Send Real Emails
- `RESEND_API_KEY` must be set
- Customer profile must have a valid `email`

---

## P1.3 — Admin Alert for Recurring Generation Failures

### What Was Implemented

**Service (`server/services/appointments/generateRecurring.ts`):**  
When `findAvailableSlot()` returns null (no slot found for a subscription), a deduplication-guarded ticket insert was added:
1. Checks if a ticket with the same subject (`"Scheduling: no slot found for subscription {id}"`) already exists today (using a `gte("created_at", today + "T00:00:00Z")` filter)
2. If no existing ticket, inserts a new ticket with `status: "open"`, `priority: "high"`, and the subscription's `user_id` (required by the tickets table NOT NULL constraint)
3. The entire block is wrapped in try/catch — a ticket insert failure never aborts the generation run

### Tickets Table Constraint Adaptation
The `tickets` table requires `user_id NOT NULL`. The spec suggested inserting without a user_id, which would have failed the constraint. The implementation uses `sub.user_id` (the subscription owner) as the ticket user, making the ticket visible in both the admin view and (if RLS is checked) the customer's support view. This is intentional — the subscription owner is the impacted party.

### Notification Logging Behavior
- Tickets appear in the admin `tickets` table immediately
- Deduplication prevents ticket spam on repeated cron runs throughout the day
- Errors are logged to `console.error` — never thrown

---

## What's Still Needed to Send Real Emails

For both P1.1 and P1.2:

| Requirement | Status |
|---|---|
| `RESEND_API_KEY` env var set | Must be configured in Netlify/deployment |
| `RESEND_FROM_EMAIL` env var set | Defaults to `hello@nomoremosquitoes.us` |
| Employee email populated | Must exist in `employees.email` column |
| Customer email populated | Set at registration, typically present |
| `buildAssignmentEmail()` template | Not yet added — using inline HTML |
| `buildCompletionEmail()` template | Not yet added — using inline HTML |
| `"service_completed"` notification type | Needs migration to add to check constraint |
