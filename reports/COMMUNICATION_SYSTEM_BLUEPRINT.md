# Communication System Blueprint
**No More Mosquitoes Platform — Production-Grade Architecture**
**Date: 2026-05-30**

---

## Vision

Design a communication system that: (1) automates every customer touchpoint without developer intervention, (2) gives the owner full control over templates and campaigns, (3) is CAN-SPAM and TCPA compliant, (4) logs all activity for accountability, and (5) integrates cleanly with the existing Supabase + Resend + Twilio + Stripe stack.

---

## Database Schema Additions

### Table: `email_templates`

Owner-managed templates for all transactional and campaign emails.

```sql
CREATE TABLE public.email_templates (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  slug           TEXT         NOT NULL UNIQUE, -- e.g. 'appointment_confirmation'
  name           TEXT         NOT NULL,        -- human label e.g. "Appointment Confirmation"
  subject        TEXT         NOT NULL,
  preheader      TEXT,
  body_html      TEXT         NOT NULL,        -- mustache/handlebars template string
  body_text      TEXT,                         -- plain text version
  category       TEXT         NOT NULL CHECK (category IN ('transactional', 'marketing', 'billing', 'support')),
  is_active      BOOLEAN      NOT NULL DEFAULT true,
  last_edited_by UUID         REFERENCES public.profiles(id),
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);
```

Template variables use `{{variable_name}}` syntax. Server renders via a simple substitution function. Example for `appointment_confirmation`:
- `{{customer_name}}`, `{{service_date}}`, `{{arrival_window}}`, `{{property_address}}`, `{{dashboard_url}}`

### Table: `sms_templates`

```sql
CREATE TABLE public.sms_templates (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  slug           TEXT         NOT NULL UNIQUE,
  name           TEXT         NOT NULL,
  body           TEXT         NOT NULL,  -- {{variable}} syntax
  is_active      BOOLEAN      NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);
```

### Table: `communication_campaigns`

For batch email/SMS campaigns (seasonal, promotional, renewal).

```sql
CREATE TABLE public.communication_campaigns (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT         NOT NULL,
  subject          TEXT         NOT NULL,
  body_html        TEXT,
  body_text        TEXT,
  channel          TEXT         NOT NULL CHECK (channel IN ('email', 'sms', 'both')),
  audience_filter  JSONB,       -- {subscription_status: ['active'], min_days_since_service: 90}
  status           TEXT         NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'canceled')),
  scheduled_at     TIMESTAMPTZ,
  sent_at          TIMESTAMPTZ,
  total_recipients INTEGER,
  sent_count       INTEGER      DEFAULT 0,
  failed_count     INTEGER      DEFAULT 0,
  created_by       UUID         REFERENCES public.profiles(id),
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);
```

### Table: `communication_preferences_log`

Tracks preference changes for audit/compliance.

```sql
CREATE TABLE public.communication_preferences_log (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id     UUID         NOT NULL REFERENCES public.profiles(id),
  channel        TEXT         NOT NULL,
  preference_key TEXT         NOT NULL,
  old_value      BOOLEAN,
  new_value      BOOLEAN,
  source         TEXT         NOT NULL CHECK (source IN ('customer_portal', 'admin', 'sms_stop', 'email_unsubscribe', 'api')),
  ip_address     TEXT,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);
```

### Table: `unsubscribe_tokens`

For email unsubscribe links (one-click, no login required).

```sql
CREATE TABLE public.unsubscribe_tokens (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id     UUID         NOT NULL REFERENCES public.profiles(id),
  token          TEXT         NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  preference_key TEXT         NOT NULL DEFAULT 'all',
  used_at        TIMESTAMPTZ,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);
```

### Extend: `notification_log`

Add columns for campaign tracking and open/click tracking:

```sql
ALTER TABLE public.notification_log
  ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES public.communication_campaigns(id),
  ADD COLUMN IF NOT EXISTS opened_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS clicked_at  TIMESTAMPTZ;
```

---

## New Server Routes

### Template Management (`server/routes/adminCommunications.ts`)

```
GET    /api/admin/communications/templates         — List all templates
GET    /api/admin/communications/templates/:slug   — Get single template
PUT    /api/admin/communications/templates/:slug   — Update template (owner edits)
POST   /api/admin/communications/templates/:slug/preview  — Render HTML preview with sample data
POST   /api/admin/communications/templates/:slug/test-send — Send test to specified email
```

### Campaign Management

```
GET    /api/admin/campaigns                  — List campaigns
POST   /api/admin/campaigns                  — Create campaign
GET    /api/admin/campaigns/:id              — Get campaign + stats
PUT    /api/admin/campaigns/:id              — Update draft campaign
POST   /api/admin/campaigns/:id/schedule     — Schedule campaign for future date
POST   /api/admin/campaigns/:id/send-now     — Send immediately
DELETE /api/admin/campaigns/:id              — Cancel/delete draft
GET    /api/admin/campaigns/:id/audience-preview — Count/preview recipients before send
```

### Notification Actions

```
POST   /api/admin/notifications/:id/resend   — Resend a failed notification
GET    /api/admin/notifications              — List (paginated + searchable)
GET    /api/admin/notifications/stats        — Aggregate stats (sent/failed/open rates)
```

### Compliance Routes

```
GET    /api/unsubscribe/:token               — Process one-click email unsubscribe
POST   /api/webhooks/sms                     — Twilio inbound STOP handler
```

---

## Enhanced Notification Service Architecture

### Template Renderer (`server/services/notifications/templateRenderer.ts`)

```typescript
interface RenderOptions {
  templateSlug: string;
  variables: Record<string, string>;
  fallbackHardcoded?: () => { subject: string; html: string };
}

async function renderEmailTemplate(options: RenderOptions): Promise<{ subject: string; html: string }>
// 1. Try loading from email_templates table
// 2. Fall back to hardcoded function if DB template not found
// 3. Substitute {{variable}} placeholders
// 4. Inject unsubscribe link + physical address into layout footer
```

### Communication Bus (`server/services/notifications/communicationBus.ts`)

Central dispatch function that:
1. Resolves the right template (DB or hardcoded fallback)
2. Checks the customer's notification preferences
3. Sends via Resend (email) or Twilio (SMS)
4. Logs to `notification_log` with proper status
5. Handles errors without throwing (fire-and-forget)
6. Checks `isDuplicateNotification()` before send

All individual send functions (`sendAppointmentConfirmation`, `sendEnRouteSMS`, `sendAppointmentReminder`) become thin wrappers over `communicationBus.dispatch()`.

### New Send Functions Needed

```typescript
// server/services/notifications/sendPaymentFailed.ts
sendPaymentFailedEmail(userId, subscriptionId, updateCardUrl)

// server/services/notifications/sendSubscriptionCanceled.ts
sendSubscriptionCanceledEmail(userId, effectiveDate)

// server/services/notifications/sendSubscriptionActivated.ts
sendSubscriptionActivatedEmail(userId, planName, nextAppointmentDate)

// server/services/notifications/sendAnnualPlanExpiring.ts
sendAnnualPlanExpiringEmail(userId, daysRemaining, renewUrl)

// server/services/notifications/sendAnnualPlanExpired.ts
sendAnnualPlanExpiredEmail(userId, renewUrl)

// server/services/notifications/sendRecurringAppointmentCreated.ts
sendRecurringAppointmentCreatedEmail(appointmentId)

// server/services/notifications/sendRefundConfirmation.ts
sendRefundConfirmationEmail(userId, amountCents, appointmentId)

// server/services/notifications/sendLeadAcknowledgment.ts
sendLeadAcknowledgmentEmail(email, name)
```

---

## Webhook Wire-Up Plan

Extend `server/routes/webhooksStripe.ts` to trigger notifications on billing events:

| Stripe Event | New Communication |
|---|---|
| `invoice.payment_failed` | `sendPaymentFailedEmail()` — "Your payment failed, update card" |
| `invoice.paid` (renewal) | `sendSubscriptionActivatedEmail()` (if not first payment) |
| `customer.subscription.deleted` | `sendSubscriptionCanceledEmail()` |
| `charge.refunded` | `sendRefundConfirmationEmail()` |
| `checkout.session.completed` (subscription) | `sendAppointmentConfirmation()` for the created appointment |

---

## Netlify Scheduled Function Enhancements

### Extended `send-reminders.ts`

Add pre-expiration subscription reminder logic:

```typescript
// Query subscriptions expiring in 30 days and 7 days
// Send sendAnnualPlanExpiringEmail() for each
// Deduplicate using notification_log
```

### New `send-campaigns.ts`

```typescript
// Schedule: every 15 minutes (0/15 * * * *)
// Query communication_campaigns WHERE status='scheduled' AND scheduled_at <= now()
// Process audience_filter to get recipient list
// Send batch emails via Resend batch API
// Update campaign status and counts
```

---

## Admin Dashboard UI Components

### Template Editor (`client/pages/admin/CommunicationTemplates.tsx`)

- List all templates with last-edited date and status
- Rich text editor (TipTap or similar) for body HTML
- Variable reference panel showing available `{{variables}}`
- Live HTML preview pane
- Test-send modal (enter test email, populate with sample data)
- "Last sent" stats (how many times each template was used this month)

### Campaign Builder (`client/pages/admin/Campaigns.tsx`)

- Campaign name and channel selector (email / SMS / both)
- Subject line and body editor
- Audience filter builder:
  - Filter by: subscription status, plan type, last service date, service area, no active subscription
  - "Preview audience" shows estimated recipient count before send
- Schedule picker or "Send Now" button
- Campaign history with sent/opened/failed stats

### Enhanced Notification Log (`client/pages/admin/Notifications.tsx` — extended)

- Pagination (beyond current 200-row limit)
- Search by recipient email
- Date range filter
- "Resend" button on failed rows
- Per-row "linked appointment" quick-view
- SMS delivery status (once SMS logging is fixed)
- Export to CSV

---

## Customer-Facing Preferences Center

### Preferences Page Enhancement (`client/pages/dashboard/Profile.tsx`)

Add to the "Communication Preferences" card:

| Preference | Type |
|---|---|
| SMS Visit Reminders | Toggle (currently exists) |
| Email Visit Reminders | Toggle (new) |
| Video Recap Alerts | Toggle (currently exists but non-functional) |
| Marketing & Seasonal Tips | Toggle (currently exists but non-functional) |
| Annual Renewal Reminders | Toggle (new) |

### Unsubscribe Landing Page (`client/pages/Unsubscribe.tsx`)

- Public route `/unsubscribe/:token`
- Reads token from URL param
- Calls `GET /api/unsubscribe/:token` to process
- Shows success message
- Optionally shows "manage all preferences" link to dashboard

---

## Communication Analytics Dashboard

`client/pages/admin/CommunicationAnalytics.tsx` — new page

Metrics to display:
- Total emails sent this month / last month
- Delivery rate (sent / total attempts)
- Open rate (requires Resend webhook tracking)
- Click-through rate
- Failed delivery rate + top error reasons
- SMS delivery rate
- Campaign performance comparison
- Notification type breakdown chart
- Customer opt-out trend over time

---

## Integration Summary

| System | Integration Point | Communication Triggered |
|---|---|---|
| Scheduling (schedule.ts) | POST /api/schedule | Appointment confirmation |
| Scheduling (Stripe webhook) | checkout.session.completed | Appointment confirmation (gap to fix) |
| Billing (webhooksStripe.ts) | invoice.paid, payment_failed, subscription.deleted | Renewal confirmed, payment failed, subscription canceled (all to add) |
| Operations (adminAppointments.ts) | /dispatch, /cancel | En-route SMS, cancellation email |
| Employee Portal (employeeAssignments.ts) | status=en_route, status=completed | En-route SMS (to add), completion email |
| Scheduler (Netlify) | send-reminders.ts daily | 24h + same-day reminders |
| Scheduler (Netlify) | generate-appointments.ts daily | Next appointment notification (to add) |
| Scheduler (Netlify) | expire-annual-plans.ts daily | Expiration email (to add), pre-expiration reminders (to add) |
| Campaigns (new) | send-campaigns.ts scheduled | All batch/marketing campaigns |
