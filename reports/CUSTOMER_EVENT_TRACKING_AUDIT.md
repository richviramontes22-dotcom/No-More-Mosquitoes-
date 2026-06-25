# CUSTOMER EVENT TRACKING AUDIT
## Generated: 2026-05-29
## Scope: How each customer lifecycle event is stored and visible to admin

---

## Event 1: Account Creation (Supabase Auth Signup)

| Field | Value |
|-------|-------|
| **Stored?** | Yes |
| **Table** | `auth.users` (Supabase managed) + `profiles` (application table) |
| **Admin Visible?** | Yes |
| **Admin Location** | `/admin/customers` — "Joined" column shows `profiles.created_at` |
| **Searchable?** | Yes — by name, email, phone |
| **Exportable?** | Yes — "Export customers" in `/admin/reports` |
| **Actionable?** | No — admin cannot delete account, change email, or reset password from admin panel |
| **Gap** | No audit log of signup method (organic vs invited). No visibility into email verification status. Admin cannot force password reset from the UI. |

---

## Event 2: User Login

| Field | Value |
|-------|-------|
| **Stored?** | No |
| **Table** | Supabase Auth tracks sessions internally but `last_sign_in_at` is only in `auth.users` (not surfaced in `profiles`) |
| **Admin Visible?** | No |
| **Admin Location** | Nowhere |
| **Searchable?** | No |
| **Exportable?** | No |
| **Actionable?** | No |
| **Gap** | No login event visible to admin. Cannot determine if a customer has ever logged in after signup. Cannot see last active date. This is a significant CRM blind spot for identifying dormant accounts. |

---

## Event 3: Address/Quote Lookup (Parcel Quote Tool)

| Field | Value |
|-------|-------|
| **Stored?** | Partially — `parcel_lookup_cache` stores the parcel data but NOT who looked it up |
| **Table** | `parcel_lookup_cache` (address → acreage cache), `parcel_lookup_attempts` (provider attempt log) |
| **Admin Visible?** | No |
| **Admin Location** | Nowhere |
| **Searchable?** | No |
| **Exportable?** | No |
| **Actionable?** | No |
| **Gap** | The quote tool does NOT capture the visitor's identity. When a user enters an address at `/pricing` or the home page quote widget, no user ID, email, session ID, or cookie is stored. `parcel_lookup_cache` is keyed by `address_hash` — no link to any user. `parcel_lookup_attempts` stores provider failures only. Admin has zero visibility into quote activity. |

---

## Event 4: Property Creation

| Field | Value |
|-------|-------|
| **Stored?** | Yes |
| **Table** | `properties` |
| **Admin Visible?** | Yes |
| **Admin Location** | `/admin/properties` (full list) + `/admin/customers` customer detail sheet (Properties tab) |
| **Searchable?** | Yes — by address in `/admin/properties` |
| **Exportable?** | Yes — "Export properties" in `/admin/reports` |
| **Actionable?** | Partially — admin can delete properties from `/admin/properties`. Cannot edit existing property details (no edit button found in Properties page). |
| **Gap** | No timestamp of when a specific property was created is shown in admin view. Properties list shows `created_at` but customer detail sheet does not. No log of property edits. |

---

## Event 5: Service Selection During Onboarding

| Field | Value |
|-------|-------|
| **Stored?** | Partially — plan/cadence are stored on `properties` table (columns: `plan`, `cadence`, `program`) |
| **Table** | `properties` (plan, cadence, program columns), `subscriptions` (after payment) |
| **Admin Visible?** | Partially |
| **Admin Location** | Not prominently shown. Properties list in `/admin/properties` does not display plan/cadence columns. Subscription status is shown on customer list. |
| **Searchable?** | No |
| **Exportable?** | Yes — "Export properties" includes plan/cadence/program columns |
| **Actionable?** | No — admin cannot change a customer's plan from admin panel |
| **Gap** | No admin view shows "Customer chose X plan on Y date." Plan selection is stored on properties but not surfaced in any admin table or customer detail sheet. |

---

## Event 6: Subscription Checkout (Recurring Plan)

| Field | Value |
|-------|-------|
| **Stored?** | Yes |
| **Table** | `subscriptions` (via Stripe webhook `checkout.session.completed` → `createSubscriptionServiceOrder`), `payments` (via `invoice.paid` webhook) |
| **Admin Visible?** | Partially |
| **Admin Location** | `/admin/billing` shows payments list. `/admin/customers` shows subscription status badge (active/paused/canceled). No dedicated subscriptions list page. |
| **Searchable?** | Partially — can search payments by customer name in `/admin/billing` |
| **Exportable?** | Yes — "Export subscriptions" in `/admin/reports` |
| **Actionable?** | No — admin cannot cancel, pause, or modify a subscription from admin panel. Must go to Stripe dashboard. |
| **Gap** | No admin-facing subscriptions management page. No view of renewal dates, next billing date, plan name, or cadence per subscription. No cancel/pause action in admin. |

---

## Event 7: Annual Plan Checkout

| Field | Value |
|-------|-------|
| **Stored?** | Yes |
| **Table** | `subscriptions` with `program='annual'` and `stripe_subscription_id` set to the Stripe PaymentIntent ID (`pi_...`) |
| **Admin Visible?** | Partially — same as recurring subscriptions. No separate annual plan view. |
| **Admin Location** | `/admin/billing` (payment entry), `/admin/customers` (subscription status) |
| **Searchable?** | Partially |
| **Exportable?** | Yes — via subscriptions export (program column distinguishes annual) |
| **Actionable?** | No |
| **Gap** | No distinction between annual and recurring customers visible in admin UI. Cannot easily identify all annual plan customers. |

---

## Event 8: One-Time Booking Checkout

| Field | Value |
|-------|-------|
| **Stored?** | Yes |
| **Table** | `appointments` (service_type=one_time or inspection), `payments` |
| **Admin Visible?** | Yes |
| **Admin Location** | `/admin/appointments` (appointment shows in list with type badge), `/admin/billing` (payment shows) |
| **Searchable?** | Yes — appointments can be filtered by plan type "One-time" in `/admin/appointments` |
| **Exportable?** | Yes — via appointments export and payments export |
| **Actionable?** | Yes — can modify, dispatch, cancel |
| **Gap** | No direct link from the payment record in Billing to the appointment. No refund capability from admin panel. |

---

## Event 9: Appointment Scheduling (After Checkout)

| Field | Value |
|-------|-------|
| **Stored?** | Yes |
| **Table** | `appointments` — `scheduled_date`, `window`, `window_label`, `scheduled_at`, `status=scheduled` |
| **Admin Visible?** | Yes |
| **Admin Location** | `/admin/appointments` |
| **Searchable?** | Yes — by customer, address, date range, technician |
| **Exportable?** | Yes — via appointments export |
| **Actionable?** | Yes — modify, dispatch, cancel, assign technician |
| **Gap** | No customer-initiated scheduling timestamp vs admin-scheduled timestamp distinction. No log of who scheduled the appointment (customer self-service vs admin). |

---

## Event 10: Appointment Reschedule

| Field | Value |
|-------|-------|
| **Stored?** | Partially |
| **Table** | `appointments` — `scheduled_date` and `scheduled_at` are updated. Status may change. Notes are overwritten with "Slot: X | Updated via Admin". |
| **Admin Visible?** | Partially — current state is visible but NOT the history |
| **Admin Location** | `/admin/appointments` (current state only) |
| **Searchable?** | No |
| **Exportable?** | Current state only |
| **Actionable?** | Yes — admin can reschedule again |
| **Gap** | No reschedule history. No audit trail of what the original date was before a reschedule. Admins overwrite notes with "Updated via Admin" — any original customer notes are destroyed. Customer is not notified of admin reschedule (no email/SMS sent from the modify dialog — only the dispatch action sends a notification). |

---

## Event 11: Appointment Cancellation

| Field | Value |
|-------|-------|
| **Stored?** | Yes |
| **Table** | `appointments.status = 'canceled'`, `notification_log` (cancellation email logged) |
| **Admin Visible?** | Yes |
| **Admin Location** | `/admin/appointments` — canceled appointments show in the list with "canceled" status badge |
| **Searchable?** | Yes |
| **Exportable?** | Yes |
| **Actionable?** | No — no un-cancel or re-schedule directly from canceled row |
| **Gap** | No record of WHO canceled (customer vs admin). No reason for cancellation stored. Canceled appointments do not auto-remove assignments (employee still has the assignment record with status=scheduled). |

---

## Event 12: Marketplace Purchase

| Field | Value |
|-------|-------|
| **Stored?** | Yes |
| **Table** | `marketplace_orders`, `marketplace_order_items`, `payments` |
| **Admin Visible?** | Yes |
| **Admin Location** | `/admin/billing` — Marketplace Orders section and unified timeline |
| **Searchable?** | Yes — by customer name/email/confirmation ID in billing timeline |
| **Exportable?** | No — no "Export marketplace orders" button in `/admin/reports` |
| **Actionable?** | Yes — can view order detail, update fulfillment status |
| **Gap** | No marketplace orders export. No ability to refund from admin panel. No tracking of whether items were delivered at a specific appointment. |

---

## Event 13: Payment Method Update

| Field | Value |
|-------|-------|
| **Stored?** | Yes |
| **Table** | `profiles.card_last4`, `profiles.card_brand`, `profiles.card_expiry` — synced via Stripe webhook `customer.updated` or `payment_method.attached` |
| **Admin Visible?** | No |
| **Admin Location** | Nowhere — the customer profile in admin shows basic info but not card details |
| **Searchable?** | No |
| **Exportable?** | No |
| **Actionable?** | No |
| **Gap** | Admin has no visibility into a customer's current payment method. Cannot tell if a customer has a card on file without going to Stripe dashboard. This affects troubleshooting failed payment scenarios. |

---

## Event 14: Profile Update (Name, Phone, Email Preferences)

| Field | Value |
|-------|-------|
| **Stored?** | Partially — name/phone updates write to `profiles`. Email preference columns not confirmed in schema. |
| **Table** | `profiles` |
| **Admin Visible?** | Yes (current state only) |
| **Admin Location** | `/admin/customers` customer list and detail sheet |
| **Searchable?** | Yes — by current name/email/phone |
| **Exportable?** | Yes — via customers export |
| **Actionable?** | No — admin cannot edit profile fields from admin panel |
| **Gap** | No history of profile changes. Admin cannot see what the previous name/phone was. Admin cannot update a customer's profile from the admin panel (no edit capability in CustomerDetailsSheet). |

---

## Event 15: Notification Preferences Update

| Field | Value |
|-------|-------|
| **Stored?** | Unknown — no `notification_preferences` table found in migrations |
| **Table** | Possibly in `profiles` as JSONB column or separate table not yet created |
| **Admin Visible?** | No |
| **Admin Location** | Nowhere |
| **Searchable?** | No |
| **Exportable?** | No |
| **Actionable?** | No |
| **Gap** | If customers can opt out of SMS/email reminders, admin has no visibility into this. Could lead to missed service communication and customer complaints. |

---

## Event 16: Support Ticket Creation

| Field | Value |
|-------|-------|
| **Stored?** | Yes |
| **Table** | `tickets` |
| **Admin Visible?** | Yes |
| **Admin Location** | `/admin/tickets` Kanban board (new tickets appear in "open" column) + `/admin` overview (recent tickets widget) |
| **Searchable?** | No — no search input in Tickets page |
| **Exportable?** | Yes — "Export tickets" in `/admin/reports` |
| **Actionable?** | Partially — admin can move ticket between status columns. Cannot reply to customer. Cannot assign to staff member from UI. |
| **Gap** | No reply-to-customer capability. No search/filter on tickets page. No ticket assignment. No SLA tracking or due dates shown in admin. No email notification to admin when new ticket is created. |

---

## Event 17: Delete Account Request

| Field | Value |
|-------|-------|
| **Stored?** | No |
| **Table** | None |
| **Admin Visible?** | No |
| **Admin Location** | Nowhere |
| **Searchable?** | No |
| **Exportable?** | No |
| **Actionable?** | No |
| **Gap** | There is no delete account flow in the customer dashboard and no admin mechanism for GDPR/CCPA delete requests. If a customer requests deletion, admin has no in-app process to handle it. |

---

## Summary Table

| Event | Stored | Admin Visible | Searchable | Exportable | Actionable |
|-------|--------|--------------|------------|------------|------------|
| Account creation | Yes | Yes | Yes | Yes | No |
| User login | No | No | No | No | No |
| Address/quote lookup | Partial | No | No | No | No |
| Property creation | Yes | Yes | Yes | Yes | Partial |
| Service selection | Partial | Partial | No | Yes | No |
| Subscription checkout | Yes | Partial | Partial | Yes | No |
| Annual plan checkout | Yes | Partial | Partial | Yes | No |
| One-time booking | Yes | Yes | Yes | Yes | Yes |
| Appointment scheduling | Yes | Yes | Yes | Yes | Yes |
| Appointment reschedule | Partial | Partial | No | Partial | Yes |
| Appointment cancellation | Yes | Yes | Yes | Yes | No |
| Marketplace purchase | Yes | Yes | Yes | No | Partial |
| Payment method update | Yes (profiles) | No | No | No | No |
| Profile update | Partial | Partial | Yes | Yes | No |
| Notification prefs update | Unknown | No | No | No | No |
| Support ticket creation | Yes | Yes | No | Yes | Partial |
| Delete account request | No | No | No | No | No |

---

## Critical Gaps Summary

1. **No login event tracking** — admin cannot identify dormant customers
2. **Quote tool captures zero lead data** — every visitor who gets a price quote is completely invisible to admin
3. **No appointment reschedule history** — original date lost when admin modifies
4. **No per-customer action from ticket/appointment views** — navigation links do not filter to customer
5. **No payment method visibility** — admin cannot see if a customer has a valid card
6. **No delete account process** — GDPR/CCPA compliance gap
7. **No notification preference visibility** — cannot troubleshoot "I didn't get my reminder" complaints
