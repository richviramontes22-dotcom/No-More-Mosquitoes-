# Customer Notification Preferences Audit
**No More Mosquitoes Platform — Customer Control & Compliance**
**Date: 2026-05-30**

---

## Executive Summary

Customers have a basic notification preference UI at `/dashboard/profile`. Three toggles exist: SMS Reminders, Video Recap Alerts, and Marketing. These preferences are partially respected by the reminder scheduler but have several gaps. No CAN-SPAM unsubscribe link exists in any email. TCPA SMS opt-out is not enforced. The platform has measurable compliance risk.

---

## Customer Preference UI

### Location
`client/pages/dashboard/Profile.tsx` — "Communication Preferences" card

### Available Controls

| Preference | Toggle | Stored | Respected |
|---|---|---|---|
| SMS Visit Reminders | Yes | `profiles.notification_preferences.smsReminders` | **Partially** — reminderScheduler.ts checks it; en-route SMS does NOT check it |
| Video Recap Alerts | Yes | `profiles.notification_preferences.videoAlerts` | **No** — no video alert notification exists to respect or ignore it |
| Marketing & Tips | Yes | `profiles.notification_preferences.marketing` | **No** — no marketing emails exist |

### How Preferences Are Stored

Preferences are stored in the `profiles.notification_preferences` JSONB column. The `useProfile` hook in `client/hooks/useProfile.ts` fetches this field from the DB. On toggle, `Profile.tsx` calls:

```javascript
await supabase.from("profiles")
  .update({ notification_preferences: next })
  .eq("id", user.id);
```

This is a direct client-side Supabase write — no API route, no validation. Because RLS is in place, the customer can only write their own row.

### Fallback Behavior

When `profiles.notification_preferences` is null (new accounts), the `reminderScheduler.ts` defaults:
```javascript
smsReminders: prefs.smsReminders !== false // default true if not explicitly disabled
```
This means new customers are opted IN to SMS by default, which is a TCPA concern (discussed below).

### localStorage Caching

Preferences are also written to `localStorage` under key `nmm_notif_prefs`. On page load, if the DB has not loaded yet, the localStorage value is used. This means a customer's stated preference could be served from stale local cache in an edge case.

---

## What Customers CAN Control

| Capability | Available |
|---|---|
| Disable SMS reminders | Yes — toggle in `/dashboard/profile` |
| Enable/disable video recap alerts | Toggle exists — but no video alert system is implemented, so it has no effect |
| Opt out of marketing emails | Toggle exists — but no marketing emails exist, so it has no effect |
| Opt out of appointment confirmation emails | No — no control |
| Opt out of cancellation emails | No — no control |
| Opt out of service completion emails | No — no control |
| Opt out of all communications | No one-click "unsubscribe all" option |
| Manage email frequency | No control |

---

## What Customers CANNOT Control (Gaps)

- No control over transactional emails (confirmation, cancellation, completion)
- No email-specific unsubscribe link in any email
- No "unsubscribe from all" mechanism
- No preference center linked from the email footer
- No way to opt into text message alerts for service completion (only reminder opt-out exists)
- No way to choose notification frequency
- No way to add additional notification contacts (e.g., a second household email)

---

## CAN-SPAM Compliance Assessment

### Requirements

CAN-SPAM Act (15 U.S.C. § 7701) applies to commercial email messages. The 2024 updated FTC guidance still requires:

1. Accurate "From," "To," and routing information
2. Non-deceptive subject lines
3. Physical postal address in the email
4. Clear identification as an advertisement (for commercial, non-transactional email)
5. **Unsubscribe mechanism**: every commercial email must include a clear way for recipients to opt out

### Current Status

| Requirement | Status |
|---|---|
| Accurate from address | Yes — `hello@nomoremosquitoes.us` |
| Non-deceptive subject lines | Yes |
| Physical postal address | **MISSING** — no address in email footer |
| Unsubscribe mechanism | **MISSING** — no unsubscribe link in any email |
| Opt-out honored within 10 days | **N/A** — no unsubscribe system to honor |

**All 5 templates in `emailTemplates.ts` are missing a physical address and unsubscribe link.**

The current footer is:
```html
<p>© 2026 No More Mosquitoes · All rights reserved</p>
<p>Questions? Reply to this email or visit nomoremosquitoes.us</p>
```

For transactional emails (appointment confirmation, reminders), CAN-SPAM requirements are somewhat lighter — but the service completion email and any marketing email must be fully compliant. Because the system does not distinguish transactional from commercial in the footer, the safest approach is to include the unsubscribe link and address in all emails.

**Risk Level: Medium-High.** Transactional emails (confirmation, reminder) are generally exempt from the unsubscribe requirement. However, once marketing emails are added, this becomes a direct violation.

---

## TCPA Compliance Assessment

### Requirements

The Telephone Consumer Protection Act (TCPA) requires:

1. Express written consent before sending promotional SMS
2. Clear opt-out mechanism (reply STOP)
3. Honor opt-out within 10 business days
4. Include business name and opt-out instructions in each message

### Current Status

| Requirement | Status |
|---|---|
| Opt-in consent before SMS | **Unclear** — customers default to SMS opted-in (`smsReminders !== false`). No explicit consent language during signup or scheduling. |
| Opt-out mechanism (STOP) | **Not enforced** — no Twilio webhook for inbound STOP messages in `server/routes/webhooks.sms.ts` (file exists but not audited) |
| Honor opt-out | No automated process |
| Business identification in SMS | Yes — messages start with "No More Mosquitoes:" |
| Opt-out instructions in SMS | **Missing** — SMS messages do not say "Reply STOP to opt out" |

### TCPA Risk

The en-route SMS `buildEnRouteSms()` in `smsTemplates.ts` does not include "Reply STOP to opt out." The reminder SMS `buildReminderSms()` also lacks this. This is required for marketing SMS and strongly recommended for transactional SMS.

The default opt-in behavior (SMS enabled unless explicitly disabled) is a risk for subscribers who never visited the profile page to configure preferences.

**Risk Level: Medium.** Appointment reminder and en-route SMS are considered transactional (event-triggered, not promotional), which has more lenient TCPA rules. However, the default opt-in and absence of a STOP handler create risk if any SMS is ever construed as promotional.

---

## Required Compliance Fixes

### Priority 1 — Legal Risk (Fix Before Any Marketing Email Sends)

1. Add a physical address to all email templates in the `layout()` footer in `emailTemplates.ts`
2. Add an unsubscribe link to all emails pointing to `{APP_BASE_URL}/dashboard/profile` or a dedicated preferences center
3. Add "Reply STOP to opt out" to all SMS templates in `smsTemplates.ts`
4. Implement `POST /api/webhooks/sms` STOP handler via Twilio — when a customer replies STOP, set `profiles.notification_preferences.smsReminders = false`

### Priority 2 — User Trust

5. Add explicit consent language during scheduling ("By providing your phone number, you consent to receive appointment SMS reminders. Reply STOP at any time.")
6. Change default opt-in behavior to opt-OUT for SMS (require explicit opt-in)
7. Add an unsubscribe confirmation page that updates preferences in DB

### Priority 3 — Completeness

8. Make `videoAlerts` preference functional when video recap alerts are implemented
9. Make `marketing` preference gate actual marketing email sends when marketing emails are built
10. Add "email reminders" toggle (currently all email reminders are always on)
