# Platform Growth Phase 1 — Pre-Build Audit
**Date:** 2026-06-17
**Scope:** Routing Automation Policies, Referral Program Foundation, CRM Phase 3 Foundation (lead assignment, follow-up tracking, referral attribution).

---

## What already supports routing automation?

| Piece | State |
|---|---|
| `routes` / `route_stops` / `route_audit_log` | Full lifecycle (`draft→approved→assigned→published→in_progress→completed→canceled`), confidence scoring, conflict notes, audit logging — all built in prior sprints |
| Smart Routing Optimizer | `server/services/routing/smartRoutingOptimizer.ts` — depot-aware, drive-cap-aware, mock-geo-flagging optimizer; preview-first via `optimize-preview` + `reorder-stops` |
| Publish safeguards | `POST /routes/:routeId/publish` blocks on low confidence / conflict notes unless `force: true` (added in the Route Review sprint); `POST /routes/day/publish` runs `validateDayPlanForWorkforce()`, gated by `flags.workforceValidation()` / `flags.routePublishGate()` |
| **What's missing** | No concept of *automation mode* — every publish today is a deliberate, single, human-initiated click. There is no scheduled/background process, no settings table for automation behavior, and no "auto-publish after N minutes" logic anywhere in the codebase. `featureFlags.ts` flags are binary on/off, not a 3-state mode with a timer. |

**Conclusion:** The safety primitives (confidence, conflict notes, drive-cap flag, audit log) already exist and are exactly what Phase 2's automation rules need to check — no new warning-detection logic is required, only a new decision layer that reads these existing signals.

---

## What already supports referrals/promo codes?

| Piece | State |
|---|---|
| `promo_codes` / `campaigns` | Full schema + admin UI (`/admin/promos`) + Stripe coupon/promotion-code sync + checkout integration (marketplace and, since the last sprint, the main onboarding checkout) |
| Referral-specific schema | **None.** No `referral_codes`, `referrals`, or `referral_rewards` table exists anywhere in `db/migrations/`. No referral capture logic exists in the quote widget, schedule-request flow, or signup flow. |
| Closest existing analog | `promo_codes` is the right structural template (code lookup, validation endpoint, admin management page) but is a *discount* mechanism, not an *attribution* mechanism — it has no concept of "who referred whom" or partner relationships. |

**Conclusion:** Referrals must be built from scratch as new tables, but the promo-code system's patterns (public validate endpoint, admin management page, Stripe-adjacent-but-not-Stripe-dependent design) transfer directly.

---

## What already supports lead assignment/follow-up?

| Piece | State |
|---|---|
| `leads` table | Rich record: source, status (`new/manual_review/scheduled/out_of_area/contacted/quoted/lost`), dedup keys, service-area columns, `converted_customer_id`, `admin_alert_id` |
| `lead_activities` | Append-only timeline (`created`, `quote_requested`, `manual_review`, `schedule_request_received`, `merged`, `status_changed`, `note_added`) |
| `lead_notes` | Staff-written notes per lead, admin-only RLS (added in CRM Phase 2) |
| `service_area_demand_events` | Demand tracking for uncovered ZIPs (CRM Phase 2) |
| Lead ownership | **None.** No column or table anywhere records who is responsible for a lead. |
| Follow-up / reminders | **None.** No due-date or task concept exists for leads. |
| Admin UI | `client/pages/admin/Leads.tsx` (list, filters, search) + `LeadDetail.tsx` (status editor, notes, activity timeline, linked profile/property/subscription) — no assignment or follow-up UI |

**Conclusion:** `lead_notes` already proved the "admin-authored, admin-only-RLS, FK to `leads` + `profiles`" pattern this sprint needs twice more (`lead_assignments`, `lead_followups`) — same shape, same conventions, no surprises.

---

## What already supports the rest of the audited surface?

| System | Relevant finding |
|---|---|
| `appointments` | `id, user_id, property_id, status (requested/scheduled/completed/canceled), scheduled_at` — referral conversion tracking can FK to this directly |
| `assignments` | Tech-to-appointment join table feeding the routing optimizer; unrelated to lead/referral assignment (different "assignment" concept — same English word, different table, will avoid naming collision by calling the new table `lead_assignments`) |
| `profiles` | `role IN ('admin','employee','customer')` is the actual enforced set (checked in `requireAdmin.ts` / `requireAdminOrEmployee.ts`), even though the original 2025-02-23 migration's CHECK constraint only listed `('admin','support','customer')` — the `employee` value was added in a later, untracked-in-this-audit migration. `lead_assignments.assigned_to` will FK to `profiles(id)` with no DB-level role constraint (matching the existing `lead_notes.author_id` precedent) — enforcement of "must be admin/employee" stays at the API layer, consistent with how every other admin table in this codebase does it. |
| `subscriptions` / `payments` | `subscriptions.user_id → auth.users`, `plan_id → plans`, `status`. `payments.amount_cents`, `stripe_payment_intent_id`. These are the natural targets for referral `conversion_value` once a referred lead becomes a paying subscription — no schema gap, just a FK from `referrals.subscription_id`. |
| Notifications/email | Resend (email) + Twilio (SMS, optional) wired via `server/services/notifications/`. Per this sprint's constraints, no SMS/call-tracking integration will be added — follow-up reminders are tracked as due-dated rows visible in the admin UI, not pushed via email/SMS. |
| Customer dashboard | `client/pages/dashboard/Profile.tsx` is the natural, lowest-risk home for a new "My Referral Code" card — it already renders account-level settings (notifications, security) in a card-per-concern layout; adding one more card doesn't touch routing, nav, or any other page. |
| Admin Lead Inbox / Route Planning | Both are existing, scoped pages (`Leads.tsx`/`LeadDetail.tsx`, `RoutePlanning.tsx`) that this sprint extends in place — no new nav restructuring beyond one new "Referrals" entry under the existing Billing nav group (where "Promotions" already lives). |

---

## What tables should be reused?

- `leads`, `lead_activities`, `lead_notes` — extended, not replaced, for assignment/follow-up.
- `profiles` — FK target for all new "who did this" / "who owns this" columns.
- `route_audit_log` — reused as-is for automation decision logging (no new audit table needed).
- `appointments`, `subscriptions` — FK targets for referral conversion tracking.

## What must be added?

| Area | New tables |
|---|---|
| Routing automation | `route_automation_settings` (singleton config) |
| Referrals | `referral_codes`, `referrals`, `referral_rewards` |
| CRM Phase 3 | `lead_assignments`, `lead_followups`; one denormalized column `leads.assigned_to` for fast list-view lookups |

No existing table is altered destructively; all additions are new tables or additive nullable columns, matching this sprint's "do not break existing production functionality" constraint.
