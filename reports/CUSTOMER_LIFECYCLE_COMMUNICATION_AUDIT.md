# Customer Lifecycle Communication Audit
**No More Mosquitoes Platform — Lifecycle Stage Analysis**
**Date: 2026-05-30**

---

## Overview

This audit maps every customer lifecycle stage to the communications that currently exist, what is missing, and what should exist to deliver a professional, low-anxiety customer experience. The business objective is: customers should always know their status, next step, and what to expect — without having to call or email support.

---

## Stage 1: Lead / Pre-Purchase

### What Exists

| Communication | Status |
|---|---|
| Schedule request acknowledgment (no email sent) | **Missing** |
| Account invitation email (Supabase Auth) — via `POST /api/admin/customers/invite` → `supabaseAdmin.auth.admin.inviteUserByEmail()` | Delegated to Supabase |
| Waitlist confirmation (no email sent) | **Missing** |

### What Is Missing (High Priority)

- **Lead capture acknowledgment**: When a visitor submits the public `/api/schedule` form, a `schedule_request` row is inserted in the DB but NO confirmation email is sent to the lead. The lead has no idea their request was received. This is a direct revenue risk — leads go cold.
- **Welcome email after account creation**: When a customer is invited or signs up, no custom welcome email is sent (relies entirely on Supabase's default invite email which has no brand styling).
- **Subscription purchase confirmation**: After `checkout.session.completed`, no "Thank you for subscribing" email is sent. The first email the customer receives is the appointment confirmation (which covers the appointment, not the subscription itself).
- **Waitlist join confirmation**: No email when a customer joins the waitlist.
- **Service area not available notification**: When a customer requests service for a ZIP outside the service area, no email is sent.

### What Should Exist

1. Lead acknowledgment email within 5 minutes of form submission
2. Branded welcome email on first account activation
3. Subscription/purchase confirmation email (separate from appointment confirmation)
4. Waitlist confirmation + expected timeline email

---

## Stage 2: Account / Onboarding

### What Exists

| Communication | Status |
|---|---|
| Account invite email (Supabase default) | Delegated to Supabase Auth |
| Password reset email (Supabase default) | Delegated to Supabase Auth |
| Email change confirmation (Supabase) | Delegated to Supabase Auth |

### What Is Missing

- **Onboarding sequence**: No email series walks new customers through what to expect (what the service covers, how scheduling works, how to access the dashboard).
- **Account setup completion email**: After `invoice.paid` marks `profiles.is_onboarded = true`, no congratulatory/orientation email is sent.
- **Profile completion nudge**: No email if the customer hasn't added a phone number (needed for SMS reminders) or hasn't scheduled their first appointment.

### What Should Exist

1. Day-0 welcome email with platform orientation
2. Day-3 "Set up your profile" nudge if phone is missing
3. Day-7 "Schedule your first treatment" nudge if no appointment exists

---

## Stage 3: Subscription

### What Exists

| Communication | Status |
|---|---|
| None — subscription activation is silent | **Missing** |
| Annual plan expiration → admin ticket (no customer email) | Internal only |

### What Is Missing (Critical)

- **Subscription activated email**: No email when a subscription goes active after `invoice.paid`.
- **Subscription renewal reminder**: No email 7 or 14 days before renewal to reduce card decline surprise.
- **Subscription renewal success**: No email confirming "Your subscription has been renewed."
- **Payment failed email**: `invoice.payment_failed` webhook handler in `webhooksStripe.ts` (lines 527–541) updates `subscriptions.status = 'past_due'` but sends **zero customer notifications**. Customer has no idea their subscription is at risk.
- **Subscription cancellation email**: `customer.subscription.deleted` webhook cancels appointments in the DB (lines 596–634) but sends **zero customer notifications**. Customer will be confused when their appointments disappear.
- **Annual plan expiring soon (30 days)**: No customer-facing email. Only an internal admin ticket.
- **Annual plan expired**: No customer-facing email. Only an internal admin ticket.
- **Renewal quote / renewal offer**: No annual plan renewal email with repurchase link.

### What Should Exist

1. Subscription activated email (same day as first payment)
2. Renewal reminder (14 days before, 7 days before)
3. Renewal confirmed email (on each successful `invoice.paid`)
4. Payment failed alert with retry/update payment link
5. Subscription canceled confirmation with resubscribe offer
6. Annual plan expiring email (30 days before, 7 days before)
7. Annual plan expired email with renewal offer

---

## Stage 4: Appointment Lifecycle

### What Exists

| Communication | Status |
|---|---|
| Appointment confirmation email | Fully Implemented |
| 24-hour reminder email + SMS | Fully Implemented |
| Same-day reminder email + SMS | Fully Implemented |
| Technician en-route SMS | Fully Implemented |
| Appointment rescheduled email (customer-initiated) | Fully Implemented |
| Appointment canceled email (admin-initiated only) | Partially Implemented |
| Service completion email (plain HTML) | Partially Implemented |

### What Is Missing

- **Technician en-route EMAIL**: En-route notification is SMS-only. Customers without a phone number get nothing when their technician is on the way. A fallback email would solve this.
- **Technician arrived notification**: No notification when technician marks `arrived_at` (transitions to `in_progress`). The customer has no real-time awareness.
- **Customer-initiated cancellation email**: No email when a customer cancels (there is no customer cancellation route yet).
- **Subscription-cascade cancellation emails**: When a subscription is canceled via Stripe and future appointments are canceled (`customer.subscription.deleted` cascade), no individual cancellation emails are sent per appointment.
- **No-show notification**: If technician marks `no_show`, customer gets no communication — no apology, no reschedule offer.
- **Service completion email is low quality**: Uses raw `<p>` tags, no brand template, no service summary, no photos visible in email.
- **Next appointment scheduled notification**: After recurring appointment generation (`generate-appointments` Netlify function), no email is sent to the customer to say "Your next appointment has been scheduled."

### What Should Exist

1. En-route email (fallback when no phone, or supplement to SMS)
2. "Technician arrived" notification (optional premium feature)
3. Service completion email using the branded `layout()` template
4. No-show + reschedule offer email
5. Customer self-cancel confirmation email
6. Subscription-cascade cancel notification
7. "Next appointment scheduled" notification from recurring generation

---

## Stage 5: Billing

### What Exists

| Communication | Status |
|---|---|
| Stripe-managed payment receipts (if enabled in Stripe Dashboard) | Delegated to Stripe |
| Nothing else | — |

### What Is Missing (Critical)

- **Invoice/payment receipt email**: No custom branded payment receipt email. Relies on Stripe default receipts (if configured in the Stripe Dashboard, which is not confirmed).
- **Payment failed email**: `invoice.payment_failed` handler only updates DB status. Zero customer notification.
- **Payment recovered email**: No "payment issue resolved, you're back on track" email after a previously-failed payment succeeds.
- **Billing update confirmation**: When a customer updates their card, no confirmation email is sent.
- **Refund confirmation**: `charge.refunded` webhook updates DB but sends no customer email.

### What Should Exist

1. Payment successful email/receipt (branded, not Stripe default)
2. Payment failed email with "Update Payment Method" CTA linking to billing portal
3. Payment recovered email
4. Refund confirmation email

---

## Stage 6: Support

### What Exists

| Communication | Status |
|---|---|
| Support ticket creation — no email confirmation to customer | **Missing** |
| Account deletion request acknowledgment — handled via toast only, no email | **Missing** |

### What Is Missing

- **Support ticket confirmation email**: When a ticket is created (including via the account deletion flow in `Profile.tsx`), no email confirms receipt to the customer.
- **Ticket status update email**: No email when admin changes ticket status (open → in-progress → resolved).
- **Ticket resolution email**: No email when a support issue is marked resolved.
- **Contact form acknowledgment**: No email when the public contact/inquiry form is submitted.

### What Should Exist

1. Support ticket opened confirmation
2. Ticket status update notifications
3. Ticket resolved + satisfaction survey

---

## Stage 7: Marketing

### What Exists

| Communication | Status |
|---|---|
| None — no marketing emails exist | — |

### What Is Missing (All Missing)

- **Seasonal mosquito alert emails**: No mechanism to send batch emails about mosquito season (April/May start), peak season warnings, or end-of-season summary.
- **Inactive customer win-back**: No email to customers who haven't booked in 90+ days.
- **Annual plan renewal campaign**: No automated email sequence for annual customers approaching renewal.
- **Product recommendations / marketplace upsell**: No email promoting add-on products to existing customers.
- **NPS / satisfaction survey**: No post-service survey email.
- **Referral program invitation**: No referral email system.
- **Holiday/promotional offers**: No way to send promotional campaigns.

### What Should Exist (Priority Order)

1. Annual renewal campaign (highest ROI — existing high-LTV customers)
2. Seasonal treatment reminders ("Mosquito season is here")
3. Post-service NPS survey (improves reviews and retention)
4. Inactive customer win-back (90-day lapse)
5. Marketplace upsell recommendations
6. Referral program

---

## Lifecycle Gap Summary

| Stage | Has Adequate Comms | Critical Gaps |
|---|---|---|
| Lead | No | Lead acknowledgment, welcome email |
| Account / Onboarding | No | Welcome email, onboarding sequence |
| Subscription | No | Activated, failed, canceled, expiring |
| Appointment | Mostly | En-route email, no-show, cascade cancel |
| Billing | No | Payment failed, receipt, refund |
| Support | No | Ticket confirmation, resolution |
| Marketing | No | Seasonal, renewal, win-back (all missing) |

**Overall Lifecycle Communication Grade: 3/10**

The appointment reminder pipeline is strong (the best-implemented part). Everything before and after the appointment, including billing events, subscription events, and all marketing touchpoints, is absent.
