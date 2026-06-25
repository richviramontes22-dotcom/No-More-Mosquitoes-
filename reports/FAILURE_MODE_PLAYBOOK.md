# Failure Mode Playbook
**Date:** 2026-06-02
**Project:** No More Mosquitoes

---

> This playbook documents known failure modes for each critical flow. Keep it updated as new failure modes are discovered in production.

---

## 1. Payment / Booking (`POST /api/billing/confirm-booking`)

### Failure: PaymentIntent not `succeeded`
- **User message:** "Payment has not been confirmed yet"
- **HTTP status:** 402
- **Log event:** `billing.payment.not_succeeded` (warn)
- **Checkpoint:** Between `billing.start` and `billing.payment.verified`
- **Admin action:** Check Stripe dashboard → PaymentIntents for the PI ID. May be processing or failed.
- **Recovery:** Client retries automatically if Stripe returns `requires_action`.

### Failure: Stripe API unreachable / timeout
- **User message:** "Failed to confirm booking"
- **HTTP status:** 504 / 502
- **Log event:** `billing.confirm_booking.failed` (error)
- **Admin action:** Check Stripe status page. Retry after outage resolves.
- **Recovery:** Client can re-submit the confirm-booking call — it's idempotent (appointment deduped by date).

### Failure: Appointment insert fails
- **User message:** Booking succeeds (appointment error is non-fatal)
- **Log event:** `billing.appointment.insert_failed` (error)
- **Admin action:** Check `/admin/appointments` — appointment may need to be created manually.
- **Recovery:** Admin creates appointment from the Customers page.

### Failure: Profile not marked onboarded
- **User message:** Customer may see onboarding again
- **Log event:** Not explicitly logged (supabase upsert error is silently swallowed)
- **Admin action:** Run `UPDATE profiles SET is_onboarded=true WHERE id='<user-id>'` in Supabase.

---

## 2. Parcel Acreage Lookup (`POST /api/parcel/quote`)

### Failure: County GIS unavailable
- **Error code:** `PARCEL_LOOKUP_FAILED`
- **HTTP status:** 503
- **User message:** "Unable to look up parcel data. Please try again."
- **Checkpoint:** `parcel.county.lookup.start` → no `parcel.county.lookup.success`
- **Admin action:** Check county GIS endpoint health. Enable `ENABLE_REGRID_FALLBACK=true` temporarily.

### Failure: Address not found / no parcel match
- **Error code:** `MANUAL_REVIEW_REQUIRED`
- **HTTP status:** 422
- **User message:** "We couldn't find parcel data for this address. Our team will review it manually."
- **Checkpoint:** `parcel.manual_review`
- **Admin action:** Contact customer to verify address. Provide a custom quote.

### Failure: Rate limit exceeded
- **Error code:** `RATE_LIMITED`
- **HTTP status:** 429
- **User message:** "Too many requests. Please wait a moment before trying again."
- **Admin action:** Monitor for abuse. In-memory rate limit resets on server restart.

---

## 3. Workforce Route Generation (`POST /api/admin/routes/day/generate`)

### Failure: Company blackout date
- **Error code:** (inline HTTP 400)
- **User message:** "Cannot generate routes — this date is a company blackout: [reason]"
- **Admin action:** Remove the blackout date or choose a different date.

### Failure: All technicians unavailable
- **Admin alert:** `workforce.no_technicians_available` (critical)
- **User message:** Response includes `{ conflict_notes: [...] }` explaining why each tech was excluded
- **Admin action:** Check workforce schedules at `/admin/workforce/schedules`. Add date overrides if needed.

### Failure: Route generation DB error
- **Log event:** `[adminRoutes] day generate error:` (console.error)
- **HTTP status:** 500
- **Admin action:** Check Supabase logs. May be a schema mismatch after migration.

---

## 4. Route Publishing (`POST /api/admin/routes/day/publish`)

### Failure: Workforce validation blocked (critical)
- **Error code:** `WORKFORCE_BLOCKED`
- **HTTP status:** 400
- **Checkpoint:** `route.publish.blocked`
- **Response includes:** `validation` object with specific blockers
- **Admin action:** Fix blockers (add schedule templates, fix capacity, resolve unavailability) then retry.
- **Override:** Pass `{ force: true }` in body — logged to `route_audit_log` as `day_published_force_override`.

### Failure: Route publish gate disabled
- **Feature flag:** `ENABLE_ROUTE_PUBLISH_GATE=false`
- **Effect:** Validation is skipped — routes publish without any workforce checks.
- **Admin action:** Re-enable the flag unless deliberately bypassed.

---

## 5. Reminder Automation (`send-reminders` Netlify function)

### Failure: Reminder emails disabled by flag
- **Log event:** `reminder.batch.emails_disabled` (warn)
- **Effect:** Batch runs, finds appointments, but sends nothing. Counts as `sent` (dry-run behavior).
- **Admin action:** Check `ENABLE_REMINDER_EMAILS=true` in Netlify env vars.

### Failure: Dry-run mode active in production
- **Flag:** `REMINDER_DRY_RUN=true`
- **Log event:** `reminder.batch.dry_run_mode` (info)
- **Effect:** Same as emails disabled — no sends.
- **Admin action:** Set `REMINDER_DRY_RUN=false` in Netlify Dashboard.

### Failure: Resend API key missing
- **Effect:** `sendAppointmentReminder()` uses NullEmailProvider — logs intent but doesn't send.
- **Log:** `[NullEmail] Would send reminder to: customer@email.com`
- **Admin action:** Set `RESEND_API_KEY` in Netlify Dashboard.

### Failure: Batch crashes entirely
- **Log event:** `reminder.batch.crashed` (error)
- **Checkpoint:** `reminder.batch.start` logged but no `reminder.batch.complete`
- **Admin action:** Check Netlify function logs for the crash reason. Common causes: DB connectivity, missing env vars.

---

## 6. Onboarding Persistence

### Failure: Profile trigger creates duplicate row
- **Symptom:** New user gets `role='customer'` instead of `'employee'`
- **Cause:** Auth trigger fires before explicit INSERT, causing 23505 conflict
- **Fix applied:** All profile inserts now use `upsert` with `onConflict: 'id'`
- **Admin action:** If user has wrong role: `UPDATE profiles SET role='employee' WHERE email='...'`

### Failure: Employee account routes to customer dashboard
- **Symptom:** Employee logs in → sees customer onboarding/dashboard
- **Cause:** Profile has `role='customer'` (see above)
- **Fix:** `UPDATE profiles SET role='employee' WHERE email='...'` in Supabase SQL Editor

---

## Log Searching

All critical log events are structured JSON with `requestId`. To trace a specific request:

**Netlify function logs:**
```
grep '"requestId":"a1b2c3d4-..."' /var/log/...
```

**Supabase logs:**
Check Dashboard → Logs → API for 4xx/5xx errors on specific endpoints.

**Key events to watch:**
- `billing.confirm_booking.failed` — payment booking crashes
- `reminder.batch.crashed` — reminder automation down
- `route.publish.blocked` — routes can't be published
- `workforce.no_technicians_available` — dispatch blocked
