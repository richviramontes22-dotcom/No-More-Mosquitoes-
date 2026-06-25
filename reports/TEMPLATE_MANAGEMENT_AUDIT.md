# Template Management Audit
**No More Mosquitoes Platform — Template Editability Analysis**
**Date: 2026-05-30**

---

## Executive Summary

**The owner cannot edit any communication templates without a developer.** All email templates are hardcoded TypeScript functions in source files. SMS templates are hardcoded strings. There is no CMS, admin template editor, preview capability, test-send feature, or branding configuration UI for communications.

---

## Template Architecture

### Email Templates

**File**: `server/services/notifications/emailTemplates.ts`

All email templates are TypeScript functions that return `{ subject: string; html: string }`. The HTML is constructed by string interpolation inside the function bodies. Key design tokens are hardcoded constants at the top of the file:

```typescript
const BRAND_GREEN  = "#2d6a4f";
const BRAND_LIGHT  = "#f0faf4";
const TEXT_DARK    = "#1a1a1a";
const TEXT_MUTED   = "#6b7280";
const BORDER       = "#e5e7eb";
const FONT         = "Georgia, 'Times New Roman', serif";
const BODY_FONT    = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
```

#### Templates Defined

| Function | Subject Line | Customizable By Owner? |
|---|---|---|
| `buildConfirmationEmail()` | "Appointment Confirmed — {date}" | No — requires code change |
| `buildReminder24hEmail()` | "Reminder: Your appointment is tomorrow — {date}" | No — requires code change |
| `buildReminderSameDayEmail()` | "Today's your service day — {window} arrival window" | No — requires code change |
| `buildCancellationEmail()` | "Appointment canceled — {date}" | No — requires code change |
| `buildRescheduleEmail()` | "Appointment rescheduled — new date: {date}" | No — requires code change |

Two additional emails are hardcoded **inline** in route files (not in `emailTemplates.ts`):

- **Service completion email**: Inline in `server/routes/employeeAssignments.ts` lines 269–273. Raw `<p>` tags only — no brand template applied. This is the worst template in the system.
- **Employee assignment email**: Inline in `server/routes/adminAppointments.ts` lines 276–279. Not customer-facing but equally inaccessible.

### SMS Templates

**File**: `server/services/notifications/smsTemplates.ts`

All SMS messages are hardcoded string-building functions:

| Function | Content |
|---|---|
| `buildEnRouteSms()` | "No More Mosquitoes: Your technician is on the way! Arrival window: {window} at {address}. Questions? Call {SUPPORT_PHONE}" |
| `buildReminderSms()` | "No More Mosquitoes: Reminder — your service is scheduled {tomorrow/today}, {window} at {address}. Questions? Call {SUPPORT_PHONE}" |
| `buildCancellationSms()` | "No More Mosquitoes: Your appointment on {date} has been canceled. To rebook, visit {APP_URL} or call {SUPPORT_PHONE}" |

The `SUPPORT_PHONE` and `APP_URL` values come from environment variables (`SUPPORT_PHONE`, `APP_BASE_URL`), making them changeable via env — but that still requires developer/DevOps access.

---

## What the Owner CAN and CANNOT Do

### Cannot Do (Requires Developer)

| Action | Why |
|---|---|
| Edit email subject lines | Hardcoded in TypeScript functions |
| Edit email body copy | Hardcoded HTML strings |
| Change brand colors | Constants in `emailTemplates.ts` |
| Change brand logo | Emoji `🦟` in HTML header — no real logo image |
| Change the "from" name | `RESEND_FROM_EMAIL` env var — DevOps/infra access needed |
| Change support phone number in SMS | `SUPPORT_PHONE` env var |
| Edit SMS messages | Hardcoded in `smsTemplates.ts` |
| Preview an email before sending | No preview route or endpoint exists |
| Send a test email | No test-send button or endpoint exists |
| Add or remove sections to email | Requires code change |
| Create a new email template | Requires code change |
| Create a promotional email | No promotional email system exists |
| Schedule a campaign email | No campaign system exists |
| Disable a specific notification type | No per-type disable switch |

### CAN Do (Without Developer)

| Action | Where |
|---|---|
| Toggle SMS Reminders globally | `client/pages/admin/Settings.tsx` → Feature Flags → "SMS Reminders" switch. **Note**: This flag is saved to `admin_settings` JSONB but the `reminderScheduler.ts` reads `profiles.notification_preferences.smsReminders` per-customer, NOT the admin flag. The admin flag has no actual effect on reminder sending. |
| None — that is the only communication-related admin control | — |

---

## Template Quality Assessment

| Template | Has Brand Styling | Has Header | Has CTA Button | Has Preheader | Production Ready |
|---|---|---|---|---|---|
| Appointment Confirmation | Yes | Yes | Yes | Yes | Yes |
| 24h Reminder | Yes | Yes | Yes | Yes | Yes |
| Same-Day Reminder | Yes | Yes | Yes | Yes | Yes |
| Cancellation | Yes | Yes | Yes | Yes | Yes |
| Rescheduled | Yes | Yes | Yes | Yes | Yes |
| Service Completion | **No** | **No** | **No** | **No** | **No** |
| Employee Assignment | **No** | **No** | **No** | **No** | N/A |

The service completion email is the only customer-facing email that bypasses the shared `layout()` template wrapper. It renders as plain unstyled HTML in most email clients.

---

## Logo and Branding

The email header contains:
```html
<p style="...">🦟 No More Mosquitoes</p>
<p style="...">Professional Mosquito Control</p>
```

There is **no real logo image** in any email. The business name is rendered as text with an emoji. Professional email design standards call for an actual image logo with alt text. An image logo requires:
1. A logo image hosted at a stable public URL
2. Updating `emailTemplates.ts` `layout()` function to use `<img>` instead of text

---

## Resend Configuration

- **From address**: Controlled by `RESEND_FROM_EMAIL` env var, defaults to `No More Mosquitoes <hello@nomoremosquitoes.us>`.
- **Reply-to**: Not set — replies go to the from address.
- **Domain authentication**: Assumed to be configured in Resend dashboard (not auditable from code).
- **Unsubscribe link**: **Not present in any email** — CAN-SPAM violation risk (see compliance report).

---

## Recommendations for Template Management

### Minimum Viable (Low Dev Effort)

1. Move template copy to a `templates` object in a dedicated config file so the owner can edit strings without touching HTML.
2. Add the service completion email to `emailTemplates.ts` using the existing `layout()` function.
3. Add a `GET /api/admin/notifications/preview?type=confirmation` endpoint to render and return an HTML preview.
4. Add a `POST /api/admin/notifications/test-send` endpoint to send a test email to a specified address.

### Full Solution (Medium Dev Effort)

1. Store template variables (subject prefix, body paragraphs, CTA text) in a `email_templates` Supabase table with an admin editor UI.
2. Build a template editor component in the admin dashboard under `/admin/communications/templates`.
3. Add per-template preview and test-send UI.
4. Store the brand logo URL in a `branding` settings table editable from the admin.

### Enterprise Solution

Move to a template-as-a-service system (Resend template API, Sendgrid Dynamic Templates, or Brevo) where templates are stored and versioned in the provider's dashboard, accessible without code deployment.
