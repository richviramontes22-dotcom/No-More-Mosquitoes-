# Recurring Appointment Generation Report
**Sprint 1A — No More Mosquitoes**
**Date:** 2026-05-28

---

## Problem

Recurring service appointments (mosquito treatment plans) were not being auto-generated. Customers on biweekly or custom-cadence plans had to be manually scheduled by admins, creating operational overhead and risk of missed treatments.

---

## Solution

A Netlify scheduled function runs daily at 08:00 UTC and calls the existing `runRecurringGeneration()` service to look ahead and create any appointments due in the generation window.

### New Files

**`netlify/functions/generate-appointments.ts`**
- Netlify scheduled function entry point
- Imports and calls `runRecurringGeneration()` from `server/services/appointments/generateRecurring`
- Returns structured JSON with `startedAt`, generation counts, and any errors
- Returns HTTP 500 on unexpected failures so Netlify marks the invocation as failed

**`netlify.toml` addition**
```toml
[functions.generate-appointments]
  schedule = "0 8 * * *"
```

### Existing Service (unchanged)

`server/services/appointments/generateRecurring.ts` — `runRecurringGeneration()` — already handles:
- Querying active subscriptions with `cadence_days` and `last_appointment_date`
- Respecting the lookahead window
- Preventing duplicate generation
- Writing new `appointments` rows

### Database Columns

`cadence_days` and `service_preferences` were confirmed already present on the `subscriptions` table from a prior migration — no additional columns needed for 1A.

---

## Schedule Logic

| Trigger | Time | Action |
|---------|------|--------|
| Netlify cron | 08:00 UTC daily | `runRecurringGeneration()` generates appointments in the lookahead window |

---

## Verification

- `pnpm typecheck` — no errors on new file
- `pnpm build:server` — `generate-appointments.ts` not in server bundle (correct — it's a Netlify function, not Express)
- Pattern mirrors existing `netlify/functions/send-reminders.ts` for consistency
