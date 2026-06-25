# Admin Communication Control Audit
**No More Mosquitoes Platform — Admin Control Capabilities**
**Date: 2026-05-30**

---

## Executive Summary

The admin has **read-only visibility** into outgoing communications via the notification log. No resend, disable, edit, or campaign functionality exists. The notification log UI is functional and shows delivery status, but it is passive — the admin can observe what was sent but cannot act on it.

---

## Admin Notification Log — What Exists

### UI Location
`client/pages/admin/Notifications.tsx` — accessible at `/admin/notifications`

### API
`GET /api/admin/notifications` in `server/routes/adminStripe.ts` (lines 120–134)

Returns the last 200 `notification_log` rows ordered by `created_at DESC`. Fields returned: `id`, `appointment_id`, `recipient_email`, `channel`, `notification_type`, `subject`, `status`, `provider`, `error_message`, `sent_at`, `created_at`.

### What the Admin CAN Do

| Capability | Status |
|---|---|
| View all outgoing emails | Yes — up to 200 most recent entries |
| Filter by status (sent/failed/pending/skipped) | Yes — client-side filter in Notifications.tsx |
| Filter by notification type | Yes — client-side filter |
| See recipient email address | Yes |
| See delivery status (sent/failed/skipped/pending) | Yes |
| See error message for failed deliveries | Yes — `error_message` column |
| See Resend/Twilio message ID | Not shown in UI (column exists in DB but not selected in API query) |
| Refresh the log | Yes — "Refresh" button |
| View stats (sent count, failed count, pending count) | Yes — summary cards at top |

### What the Admin CANNOT Do

| Capability | Status |
|---|---|
| Resend a failed notification | No — no resend endpoint exists |
| View delivery webhooks / open/click rates | No — Resend webhooks not implemented |
| Disable a specific notification type | No — no per-type toggle |
| Enable/disable SMS globally from admin | The "SMS Reminders" feature flag in Settings.tsx exists but has NO EFFECT on actual reminder sending (reminderScheduler.ts reads per-customer `notification_preferences`, not the admin flag) |
| View notification log beyond 200 entries | No — hard limit, no pagination |
| Export notification log | No |
| Search by recipient email | No — only type/status filters |
| View failed notifications per customer | No — no per-customer notification history |
| Create a manual email to a customer | No |
| Send a test email | No |
| Schedule a campaign | No — no campaign system |
| View SMS delivery status | SMS reminders are NOT logged to `notification_log` (gap in reminderScheduler.ts) |
| View employee assignment email log | Employee assignment emails are not logged to `notification_log` |

---

## Critical Gap: SMS Logging

The `reminderScheduler.ts` sends SMS reminders (lines 137–162) but calls `twilioClient.messages.create()` directly — bypassing `sendEnRouteSMS()` and the `logNotification()` function. As a result:

- SMS reminder successes and failures are only in server console logs (Netlify function log output)
- The admin notification log shows email reminders but NOT SMS reminders
- If a customer complains they didn't receive their SMS reminder, there is no log to check

Only the en-route SMS goes through `sendEnRouteSMS()` which calls `logNotification()` and is therefore visible in the admin log.

---

## Critical Gap: Admin Flag Disconnect

In `client/pages/admin/Settings.tsx`, there is a "SMS Reminders" feature flag:
```javascript
flags: { smsReminders: true }
```

This flag is saved to `admin_settings` in Supabase via `useAdminSettings`. However, `server/services/notifications/reminderScheduler.ts` reads `profiles.notification_preferences.smsReminders` (per-customer preference), not the admin settings. The admin flag has no technical effect on whether SMS reminders are sent.

---

## Notification Log Type Label Gap

In `Notifications.tsx`, `TYPE_LABELS` maps only 6 notification types:
```javascript
const TYPE_LABELS = {
  appointment_confirmation:  "Confirmation",
  reminder_24h:              "24h Reminder",
  reminder_same_day:         "Same-Day Reminder",
  appointment_canceled:      "Cancellation",
  appointment_rescheduled:   "Rescheduled",
  technician_enroute:        "Technician En Route",
};
```

`service_completed` is not in this map. When service completion notifications appear in the log, the admin sees the raw value `service_completed` instead of a human-readable label like "Service Completed".

---

## Promotion and Campaign Management

There is NO campaign management capability. The admin CANNOT:

- Create a batch email to all active customers
- Create a batch email to customers in a specific service area
- Schedule a seasonal campaign
- Create a promotional email with discount code
- Target annual-plan customers nearing renewal
- Target inactive customers (90+ days since last visit)
- Send a mosquito season alert to all subscribers
- A/B test email content

The only admin-level communication control is the notification log view (read-only) and the SMS Reminders feature flag (non-functional for its stated purpose).

---

## Comparison: What a Production Communication Dashboard Needs

| Feature | Has | Needs |
|---|---|---|
| Outgoing log view | Yes (200 rows) | Yes (paginated, searchable) |
| Delivery status | Yes | Yes |
| Error visibility | Yes | Yes |
| Resend failed | No | Yes |
| Open/click tracking | No | Yes |
| Per-customer history | No | Yes |
| Disable notification type | No | Yes |
| Test send | No | Yes |
| Template editor | No | Yes |
| Campaign creator | No | Yes |
| Audience segmentation | No | Yes |
| Scheduled campaigns | No | Yes |
| SMS log | No (gap) | Yes |
| Export | No | Yes |

**Score: 3/13 features present (23%)**

---

## Recommendations

### Immediate (No new routes needed)

1. Add `service_completed` to `TYPE_LABELS` in `Notifications.tsx` — 1-line fix
2. Add `provider_message_id` to the API response so the admin can cross-reference in Resend dashboard
3. Fix SMS logging in `reminderScheduler.ts` by calling `logNotification()` after each SMS send/fail

### Short-Term (New routes needed)

4. Add `POST /api/admin/notifications/:id/resend` endpoint to resend failed notifications
5. Add pagination to `GET /api/admin/notifications` (offset/limit params)
6. Add search by `recipient_email` to the notifications API
7. Fix the admin SMS Reminders flag to actually gate `reminderScheduler.ts` SMS sending

### Medium-Term (Campaign system)

8. Create `communication_campaigns` table
9. Build `POST /api/admin/campaigns` to create and queue batch sends
10. Build campaign audience query builder (by subscription status, last service date, service area)
11. Build campaign UI in `/admin/communications/campaigns`
