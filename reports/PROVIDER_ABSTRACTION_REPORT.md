# Provider Abstraction Report

**Date:** 2026-05-30

## Implementation
**File:** `server/services/notifications/providers/index.ts`

## Interfaces

### EmailProvider
```typescript
interface EmailProvider {
  send(opts: { to, from, subject, html, text? }): Promise<void>
}
```

### SmsProvider
```typescript
interface SmsProvider {
  send(opts: { to, from, body }): Promise<void>
}
```

## Implementations

| Class | When Used |
|-------|-----------|
| `NullEmailProvider` | RESEND_API_KEY not set — logs intent |
| `NullSmsProvider` | Twilio not configured — logs intent |
| `ResendEmailProvider` | RESEND_API_KEY is set |
| `TwilioSmsProvider` | All three Twilio vars set |

## Factory Functions
- `getEmailProvider()` — returns ResendEmailProvider or NullEmailProvider
- `getSmsProvider()` — returns TwilioSmsProvider or NullSmsProvider

## Twilio Implementation
`TwilioSmsProvider` uses `fetch()` to POST to the Twilio REST API with Basic auth (Base64 SID:token). No Twilio npm package — the new provider is purely fetch-based. This is separate from the existing `twilioClient.ts` which still uses the Twilio npm SDK for backward compatibility with existing `sendEnRouteSMS.ts` and `reminderScheduler.ts`.

## Routes Updated to Use Provider Abstraction
- `server/routes/webhooksStripe.ts`
- `server/routes/employeeAssignments.ts`
- `server/routes/schedule.ts`

## Routes NOT Yet Migrated (Pre-existing)
- `server/routes/adminAppointments.ts` — still uses getResendClient directly
- `server/routes/customerAppointments.ts` — still uses getResendClient directly
- `server/services/notifications/sendAppointmentConfirmation.ts` — still uses getResendClient
- `server/services/notifications/sendAppointmentReminder.ts` — still uses getResendClient

These existing callers continue to function. Migration of legacy callers is a future enhancement.
