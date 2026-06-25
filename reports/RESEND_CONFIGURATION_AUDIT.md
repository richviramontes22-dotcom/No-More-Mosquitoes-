# Resend Configuration Audit
**Date:** 2026-06-03
**Method:** Direct source code inspection

---

## Resend Client Initialization

**File:** `server/services/notifications/resendClient.ts`

```typescript
import { Resend } from "resend";

let _client: Resend | null = null;

export function getResendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!_client) _client = new Resend(process.env.RESEND_API_KEY);
  return _client;
}

export function getFromEmail(): string {
  return process.env.RESEND_FROM_EMAIL || "No More Mosquitoes <hello@nomoremosquitoes.us>";
}

export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}
```

---

## Environment Variables

| Variable | Required? | Fallback | Local .env |
|----------|----------|---------|-----------|
| `RESEND_API_KEY` | For actual sends | NullEmailProvider (no crash) | NOT SET |
| `RESEND_FROM_EMAIL` | No | `"No More Mosquitoes <hello@nomoremosquitoes.us>"` | NOT SET |

---

## Provider Abstraction

**File:** `server/services/notifications/providers/index.ts`

```typescript
export function getEmailProvider(): EmailProvider {
  const client = getResendClient();
  if (!client) return new NullEmailProvider();
  return new ResendEmailProvider();
}
```

**NullEmailProvider behavior:**
```typescript
async send(opts: EmailSendOptions): Promise<void> {
  console.log(`[NullEmailProvider] Would send email to ${opts.to} — subject: "${opts.subject}" (RESEND_API_KEY not set)`);
}
```

✅ **Application never crashes when RESEND_API_KEY is missing.** All emails log intent and continue.

---

## Dry-Run Mode

**File:** `server/services/notifications/reminderScheduler.ts`

```typescript
const DRY_RUN = () => flags.reminderDryRun();
const EMAILS_ENABLED = () => flags.reminderEmails();
```

When `REMINDER_DRY_RUN=true`:
- Batch runs
- Appointments found and processed
- `logger.info("reminder.dry_run_or_disabled", ...)` logged
- No emails sent
- Counted as "sent" in dry-run result for monitoring

When `ENABLE_REMINDER_EMAILS=false`:
- Same behavior as dry-run

---

## Email Types Sent via Resend

| Email Type | Triggered By | Template File |
|-----------|-------------|--------------|
| appointment_confirmation | confirm-booking, webhook | sendAppointmentConfirmation.ts |
| reminder_24h | send-reminders function | sendAppointmentReminder.ts |
| reminder_same_day | send-reminders function | sendAppointmentReminder.ts |
| payment_failed | invoice.payment_failed webhook | emailTemplates.ts |
| subscription_activated | invoice.paid webhook | emailTemplates.ts |
| subscription_canceled | subscription.deleted webhook | emailTemplates.ts |
| subscription_renewed | invoice.paid (renewal) | emailTemplates.ts |
| service_completed | employee assignment complete | billingStripe.ts |
| technician_en_route | en_route status | employeeAssignments.ts |

---

## Resend Configuration for Production

**What to set in Netlify:**
1. `RESEND_API_KEY=re_...` (from resend.com → API Keys)
2. Domain verification: Add DNS records for `nomoremosquitoes.us` in Resend dashboard
3. `RESEND_FROM_EMAIL=No More Mosquitoes <hello@nomoremosquitoes.us>` (optional — this exact string is the default)

**Without RESEND_API_KEY:** The platform runs correctly — all emails are logged as NullEmailProvider would send them. No customer receives emails. This is the current local state.

---

## Summary

| Check | Status |
|-------|--------|
| Resend SDK imported | ✅ |
| Lazy initialization (no crash if missing) | ✅ |
| NullEmailProvider fallback | ✅ |
| `RESEND_API_KEY` used correctly | ✅ |
| `RESEND_FROM_EMAIL` has safe default | ✅ |
| Dry-run mode works | ✅ |
| Email kill switch works | ✅ |
| RESEND_API_KEY set locally | ❌ Not set (NullProvider active) |
| RESEND_API_KEY needed for production | YES |
