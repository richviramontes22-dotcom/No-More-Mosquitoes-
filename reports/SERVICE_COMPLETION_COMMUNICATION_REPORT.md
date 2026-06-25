# Service Completion Communication Report

**Date:** 2026-05-30

## Problem
`server/routes/employeeAssignments.ts` built the service completion email body with raw inline HTML inside the route handler. This bypassed the brand design system and produced unstyled, plain HTML.

## Fix
Replaced the inline HTML with `buildServiceCompletionEmail()` from the centralized template system.

### Before
```typescript
const html = `<p>Hi ${customerName},</p>
<p>Your mosquito treatment service...</p>`;
resend.emails.send({ from, to, subject, html });
```

### After
```typescript
const { subject, html, text } = buildServiceCompletionEmail({
  customerName,
  scheduledDate: apptData.scheduled_date ?? null,
  hasMedia,
  dashboardUrl,
});
const emailProvider = getEmailProvider();
await emailProvider.send({ to: profile.email, from: getFromEmail(), subject, html, text });
```

## Improvements
1. Full branded layout (green header, footer with address/unsubscribe)
2. Plain text fallback included
3. Proper logging via `logNotification()` with status tracking (sent/failed)
4. Uses `getEmailProvider()` abstraction — no direct Resend import in route
5. Both success and failure paths logged to `notification_log`
