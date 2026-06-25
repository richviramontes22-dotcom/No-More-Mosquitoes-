# SMS Compliance Report

**Date:** 2026-05-30

## TCPA Compliance

### Opt-Out Footer
All outbound SMS messages now end with:
```
\nReply STOP to opt out | HELP for help
```

Added to all templates via the `OPT_OUT_FOOTER` constant in `smsTemplates.ts`.

### Affected Templates

| Function | Footer Added |
|----------|-------------|
| buildEnRouteSms | Yes |
| buildReminderSms | Yes |
| buildCancellationSms | Yes |
| buildArrivalSms | Yes (new) |
| buildServiceCompleteSms | Yes (new) |

### Inbound Keyword Handler
**File:** `server/routes/webhooks.sms.ts`

| Keyword | Action |
|---------|--------|
| STOP, STOPALL, UNSUBSCRIBE, CANCEL, END, QUIT | Sets `notification_preferences.smsOptedOut = true` in profile, logs `sms_opt_out` |
| START, YES, UNSTOP | Sets `notification_preferences.smsOptedOut = false`, logs `sms_opt_in` |
| HELP, INFO | Replies with support phone and email |
| All others | Returns empty TwiML 200 |

### Opt-Out Storage
No dedicated `sms_opted_out` column exists in the profiles schema. Opt-out preference is stored in `profiles.notification_preferences` JSONB as `{ smsOptedOut: true }`. This is the same JSONB field used by the existing `smsReminders` preference in `reminderScheduler.ts`.

The webhook handler checks for a profile match by phone number. If no profile is found, the opt-out is logged to `notification_log` only (with no profile_id).

### Twilio Auto-Handling
Twilio automatically handles STOP keywords at the carrier level (unsubscribes the number). Our webhook provides an additional explicit acknowledgment message and DB record for audit purposes.
