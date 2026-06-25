# LEAD GENERATION AUDIT
## Generated: 2026-05-29
## Scope: Quote tool as a lead generation asset vs. a price calculator

---

## Evidence Base

Files examined:
- `client/components/sections/QuoteWidgetSection.tsx`
- `server/routes/regrid.ts`
- `db/migrations/2026-05-26_parcel_lookup_cache.sql`
- `db/migrations/2025-02-23_initial_schema.sql` (schedule_requests table)
- `client/lib/pendingOnboarding.ts` (referenced in QuoteWidgetSection)
- `server/routes/schedule.ts`

---

## Question 1: Quote Persistence

**When a visitor enters an address and gets a quote, is ANY data stored? What table? What fields?**

**Answer: Partially — parcel data is cached but the visitor is NOT identified.**

When a visitor enters their address in `QuoteWidgetSection.tsx`, the flow is:
1. `usePropertyLookup` hook is called → makes a request to `/api/regrid/parcel`
2. Server checks `parcel_lookup_cache` for a match by `address_hash`
3. If cache miss, calls Regrid API and stores result in `parcel_lookup_cache`
4. Returns acreage to client

What is stored in `parcel_lookup_cache`:
- `normalized_address`, `address_hash`, `place_id`, `county`, `state`
- `latitude`, `longitude`, `apn`, `acreage`, `acreage_source`, `confidence`
- `lookup_status`, `created_at`, `last_accessed_at`, `hit_count`

**Critically missing:** No `user_id`, no `session_id`, no `ip_address`, no `email` — there is NO link between a parcel cache entry and any human visitor.

`parcel_lookup_attempts` stores API call metadata (provider, status, latency) but again, no user identity.

The quote display (price calculation) is entirely client-side in `QuoteWidgetSection.tsx` — it does not make any server call that stores quote results. The pricing tiers (`CADENCE_TIERS`, `ANNUAL_TIERS`) are hardcoded in the component.

**Verdict: The quote tool persists property geometry data (for performance) but ZERO lead data.**

---

## Question 2: Lead Identification

**Is the visitor identified at all (email capture, session ID, cookie)?**

**Answer: No.**

The `QuoteWidgetSection.tsx` component:
- Does NOT show any email capture field
- Does NOT use any form of session tracking beyond React state
- Does NOT set any cookies via JavaScript
- Does NOT call any server-side endpoint that records visitor activity

The address, ZIP, city, and state fields are collected but only used client-side to calculate a price. When the visitor navigates away, ALL data is lost.

The component checks `const { user } = useAuth()` — if the user is already logged in, it knows their identity. But the quote tool is targeted at visitors who are NOT logged in.

---

## Question 3: UTM / Referral Tracking

**Are UTM parameters or referral sources captured?**

**Answer: No.**

No UTM parameter capture code found in:
- `QuoteWidgetSection.tsx`
- `server/routes/regrid.ts`
- Any admin or scheduling route

The `savePendingOnboarding()` call in `handleSchedule()` (called when visitor clicks "Schedule Service") saves:
```javascript
savePendingOnboarding({
  address, city, state, zip, acreage, program, cadenceDays,
  estimatedPrice, source: "pricing-page",
})
```

The `source` field is hardcoded as `"pricing-page"` — not a dynamic UTM `utm_source`. No `utm_campaign`, `utm_medium`, `utm_term`, or referrer URL is captured.

`pendingOnboarding` is saved to `localStorage` — it is local browser storage, not persisted to the database. It is only used to pre-fill the onboarding flow when the visitor logs in, and is cleared after use.

---

## Question 4: Lead-to-Customer Conversion

**When a visitor converts to a customer, is the quote linked to their account?**

**Answer: No.**

When a visitor gets a quote and then clicks "Schedule Service", the flow is:
1. `savePendingOnboarding()` writes address/price/plan to `localStorage`
2. If not logged in → redirected to `/login` with `state: { mode: 'signup', preset }` 
3. User signs up → onboarding pre-fills from `localStorage`
4. After completing onboarding and payment, `localStorage` is cleared

The `preset` state includes the property details and selected plan, which gets stored in `properties` and `subscriptions` tables. However:
- No `quote_id` column exists on `properties` or `subscriptions`
- The original quote session (address lookup timestamp, price seen, plan considered) is not linked to the final subscription
- If a user took 2 weeks to decide, admin cannot see "they first looked at our pricing 2 weeks ago"

**Verdict: Conversion path exists (localStorage → onboarding prefill → subscription) but no audit trail of the conversion is stored.**

---

## Question 5: Abandoned Quote Tracking

**If a visitor gets a quote but doesn't sign up, is there any record?**

**Answer: No.**

An abandoned quote visitor:
1. Enters address → gets acreage from Regrid (stored in `parcel_lookup_cache` as anonymous)
2. Sees price → selects plan
3. Navigates away

After step 3, there is ZERO record of this interaction in any database table. No anonymous lead record, no email capture, no cookie, no webhook.

The `parcel_lookup_cache` has the address data but not:
- Whether anyone saw a price
- What plan they considered
- Whether they were a potential customer

---

## Question 6: Admin Lead Visibility

**Can the admin see quote activity? Where?**

**Answer: No.**

There is no admin page that shows:
- How many quote lookups happened today
- Which addresses were looked up
- What prices were shown to visitors
- How many quotes converted to signups

The `parcel_lookup_cache` and `parcel_lookup_attempts` tables have no admin UI.

---

## Question 7: Lead Search

**Can admin search by address, zip, date range?**

**Answer: No.** No lead search capability exists.

---

## Question 8: Lead Export

**Is there CSV export of lead data?**

**Answer: No.** No lead data is stored, therefore no export exists.

---

## Question 9: Waitlist

**Is there a waitlist feature? What does it capture?**

**Answer: No.** No waitlist/waitlist_entries table found in any migration. No server route for waitlist. No client component referencing a waitlist API.

The initial schema has a `schedule_requests` table which captures:
- full_name, email, phone, address, zip, frequency, preferred_date, contact_method, acreage, notes, status

This table was created for the original "request a quote" contact form flow (before the real-time quote widget was built). However:
- There is no admin page that shows `schedule_requests` data
- There is no server route that populates `schedule_requests` in the current codebase
- The current quote widget does NOT write to `schedule_requests`

**Verdict: The schedule_requests table is a legacy artifact. It may have been used in an earlier flow. Currently it receives no data and has no admin visibility.**

---

## Question 10: Conversion Rate

**Does the system track quote-to-signup conversion rate?**

**Answer: No.** Since quote events are not stored, conversion rate is impossible to calculate.

---

## Verdict: Is the Quote Tool a Lead Gen Asset or a Calculator?

**The quote tool is currently a pure price calculator with zero lead generation capability.**

Evidence:
- Visitor address/quote data → NOT stored in any identifiable way
- No email capture at any point in the quote flow
- No UTM tracking
- No anonymous session tracking
- No lead table or lead concept in the database
- No admin page for lead data
- No conversion tracking
- `schedule_requests` table is abandoned (receives no data from current flows)
- `pendingOnboarding` localStorage is ephemeral — disappears when browser closes

---

## What Is Missing to Make It a True Lead Gen Engine

| Missing Feature | Impact | Effort |
|----------------|--------|--------|
| Email capture field on quote widget (before showing price) | Captures lead email before conversion | S (< 1 day) |
| `quote_leads` table: address, email, plan_selected, price_shown, created_at | Persists lead data | S |
| `utm_source`, `utm_campaign` capture from URL params | Attribution tracking | S |
| Admin `/admin/leads` page showing quote activity | Visibility | M (1-3 days) |
| Lead-to-customer linkage (`quote_lead_id` on subscriptions) | Conversion tracking | M |
| Abandoned quote follow-up trigger | Re-engagement | L (3-7 days) |
| Conversion rate calculation (quotes / signups) | Business metric | M |
| Lead search/filter by address, ZIP, date | Operational | M |
| Lead export CSV | Reporting | S |
| Contact inquiries admin page (table exists, no UI) | Lead visibility | S |

---

## Most Critical Finding

The homepage and pricing page quote widget is the business's primary customer acquisition tool. A visitor who enters their address, gets a real price quote, and selects a plan — and then decides not to sign up immediately — is completely invisible to the owner. There is no:
- Email to follow up with
- Record that they visited
- Knowledge of which plan they considered
- Ability to retarget

This is the single largest missed opportunity in the entire platform. The machinery to calculate prices works perfectly; the machinery to capture the lead data does not exist at all.
