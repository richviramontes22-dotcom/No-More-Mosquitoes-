# ADMIN CONTROL COVERAGE AUDIT
## Generated: 2026-05-29
## Scope: For every lifecycle state, can admin view, modify, override, recover, and audit it?

---

## Key: Coverage Definitions

- **Can View?** — Is the state visible in any admin UI page?
- **Can Modify?** — Can admin change the value via admin UI or API?
- **Can Override?** — Can admin force a state change that bypasses normal transition rules?
- **Can Recover?** — Can admin undo or reverse an erroneous state change?
- **Can Audit?** — Is there a timestamped history of when this state changed and who changed it?

Gap Severity: **Critical** = operational failure; **High** = significant friction; **Medium** = inconvenience; **Low** = polish.

---

## Appointments

| State | Admin Can View? | Admin Can Modify? | Admin Can Override? | Admin Can Recover? | Admin Can Audit? | Gap |
|-------|----------------|-------------------|--------------------|--------------------|-----------------|-----|
| `scheduled` | YES — `/admin/appointments` list | YES — reschedule, reassign | YES — change date, window | YES — can recreate if accidentally deleted | Partial — `created_at` exists; no change log | — |
| `en_route` | YES — `/admin/appointments` dispatch status | YES — dispatch triggers this | YES — admin sets `en_route` via dispatch | NO — no "un-dispatch" route found | NO — no state change log | Medium: cannot undo dispatch |
| `in_progress` | NO — `in_progress` not shown distinctly in admin list (shown as `scheduled` or general active) | NO — no admin route sets `in_progress` | NO | NO | NO | High: in_progress is opaque to admin |
| `completed` | YES — `/admin/visits` page shows completed appointments | Partial — no "mark completed" admin action; only via employee cascade | NO — cannot override to un-complete | NO — no "reopen" completed appointment | NO — no state change log | Medium: admin cannot mark completed manually |
| `canceled` | YES — appears in appointment list with canceled status | NO — cannot un-cancel via admin UI | NO | NO | NO — no audit of who canceled, when | High: no cancel history; cannot undo cancellation |

---

## Assignments

| State | Admin Can View? | Admin Can Modify? | Admin Can Override? | Admin Can Recover? | Admin Can Audit? | Gap |
|-------|----------------|-------------------|--------------------|--------------------|-----------------|-----|
| `scheduled` | YES — technician column in appointments list | YES — reassign to different tech | YES — re-upsert with different employee | YES — reassign | NO — no assignment change log | Medium: no reassignment history |
| `en_route` | YES — employee tracking page | Partial — dispatch sets this | YES — admin dispatch | NO — no "cancel en_route" | NO | Medium |
| `in_progress` | Partial — employee tracking, but no distinct admin view for assignments in this state | NO | NO | NO | NO | High |
| `completed` | YES — implied by visit completion; no dedicated assignment-completed list | NO — admin cannot mark assignment complete | NO | NO | NO | Medium |
| `no_show` | NO — no admin page filters assignments by `no_show` | NO | NO | NO | NO | High: no admin visibility into no-shows |
| `skipped` | NO — no admin view of skipped assignments | NO | NO | NO | NO | Medium |

---

## Subscriptions

| State | Admin Can View? | Admin Can Modify? | Admin Can Override? | Admin Can Recover? | Admin Can Audit? | Gap |
|-------|----------------|-------------------|--------------------|--------------------|-----------------|-----|
| `active` | Partial — customer badge shows active; no dedicated subscriptions page | NO — no admin subscription management page | NO | N/A | NO | **Critical**: no subscriptions page |
| `past_due` | YES — past-due count KPI on Overview; list shows customer + period_end | NO — cannot clear past_due from admin; must update payment in Stripe | NO | NO | NO | **Critical**: admin cannot help customer fix payment |
| `canceled` | Partial — customer badge shows canceled | NO | NO | NO | NO | High |
| `expired` (annual) | NO — no admin view of expired annual plans | NO | NO | NO | NO | **Critical**: annual plan expiry is invisible |
| `incomplete` | NO | NO | NO | NO | NO | High |

---

## Employees

| State | Admin Can View? | Admin Can Modify? | Admin Can Override? | Admin Can Recover? | Admin Can Audit? | Gap |
|-------|----------------|-------------------|--------------------|--------------------|-----------------|-----|
| `active` | YES — `/admin/employees` list | YES — can edit employee details | YES — can deactivate | YES — can reactivate | NO — no activity log | Low |
| `inactive` | YES — appears in employee list with inactive badge | YES — can reactivate | YES | YES | NO | Low |

---

## Marketplace Orders

| `fulfillment_status` | Admin Can View? | Admin Can Modify? | Admin Can Override? | Admin Can Recover? | Admin Can Audit? | Gap |
|---------------------|----------------|-------------------|--------------------|--------------------|-----------------|-----|
| `pending` | YES — `/admin/billing` marketplace section | YES — `PATCH /marketplace/orders/:id/fulfillment` | YES | YES | NO — no fulfillment change log | Low |
| `processing` | YES | YES | YES | YES | NO | Low |
| `scheduled` | YES | YES | YES | YES | NO | Low |
| `fulfilled` | YES | YES (can reverse) | YES | YES | NO | Low |
| `cancelled` | YES | Partial | YES | YES | NO | Low |

| `status` | Admin Can View? | Admin Can Modify? | Admin Can Override? | Admin Can Recover? | Admin Can Audit? | Gap |
|----------|----------------|-------------------|--------------------|--------------------|-----------------|-----|
| `completed` | YES | NO (payment status from Stripe) | NO | NO | YES — Stripe Dashboard | Low |
| `refunded` | YES | NO | NO | NO | YES — Stripe Dashboard | Low |
| `failed` | YES | NO | NO | NO | YES — Stripe | Low |
| `expired` | YES | NO | NO | NO | YES — Stripe | Low |

---

## Support Tickets

| State | Admin Can View? | Admin Can Modify? | Admin Can Override? | Admin Can Recover? | Admin Can Audit? | Gap |
|-------|----------------|-------------------|--------------------|--------------------|-----------------|-----|
| `open` | YES — `/admin/tickets` | YES — can change status | YES | YES | `updated_at` trigger only (no who-changed audit) | Low |
| `in_progress` | YES | YES | YES | YES | Partial | Low |
| `resolved` | YES | YES | YES | YES | Partial | Low |
| `closed` | YES | YES | YES | YES | Partial | Low |

---

## Notification Log

| State | Admin Can View? | Admin Can Modify? | Admin Can Override? | Admin Can Recover? | Admin Can Audit? | Gap |
|-------|----------------|-------------------|--------------------|--------------------|-----------------|-----|
| `pending` | NO — no admin notification history page | NO | NO | NO | NO | Medium: pending notifications not visible |
| `sent` | NO | NO | NO | N/A | NO | **High**: sent notifications not auditable from admin |
| `failed` | NO | NO | NO | NO | NO | **High**: failed notifications invisible to admin |
| `skipped` | NO | NO | NO | NO | NO | Medium |

---

## Contact Inquiries (`contact_inquiries.status`)

| State | Admin Can View? | Admin Can Modify? | Admin Can Override? | Admin Can Recover? | Admin Can Audit? | Gap |
|-------|----------------|-------------------|--------------------|--------------------|-----------------|-----|
| `new` | NO — no admin contact inquiries UI | NO | NO | NO | NO | **Critical**: contact form submissions invisible |
| `read` | NO | NO | NO | NO | NO | **Critical** |
| `replied` | NO | NO | NO | NO | NO | **Critical** |
| `closed` | NO | NO | NO | NO | NO | **Critical** |

---

## Gaps Ranked by Severity

### Critical Gaps

| Gap | Entity | State | Business Impact |
|-----|--------|-------|----------------|
| No subscriptions management page | Subscriptions | All | Cannot manage recurring revenue, cancel subscriptions, or view renewal dates |
| Annual plan expiry invisible | Subscriptions | `active` past `current_period_end` | Service delivered after expiry with no revenue |
| Cannot clear past_due or help customer fix payment | Subscriptions | `past_due` | Payment deadlock — customer locked out, admin cannot help |
| Contact form submissions invisible | Contact Inquiries | All | Warm leads lost with no follow-up |
| Assignment `skipped` not triggered on cancellation | Assignments | `scheduled` | Technicians drive to canceled jobs |
| No admin page for notification failures | Notification Log | `failed` | Customers may not receive critical emails with no visibility |

### High Gaps

| Gap | Entity | State | Business Impact |
|-----|--------|-------|----------------|
| Cannot undo appointment cancellation | Appointments | `canceled` | Mistakes require manual DB intervention |
| `in_progress` state invisible to admin | Appointments / Assignments | `in_progress` | Cannot see jobs currently happening |
| `no_show` assignments not surfaced | Assignments | `no_show` | No visibility into service delivery failures |
| Sent notifications not auditable from admin | Notification Log | `sent` | Cannot verify customer received confirmation emails |
| No audit trail for state changes | All entities | All | Cannot reconstruct what happened for disputes |

### Medium Gaps

| Gap | Entity | State | Business Impact |
|-----|--------|-------|----------------|
| Cannot mark appointment completed from admin | Appointments | `scheduled` | Admin must wait for employee to complete |
| No admin "mark complete" override | Appointments | `scheduled` | If employee forgets to complete, admin cannot fix |
| Skipped assignments not shown | Assignments | `skipped` | No operational view of which slots were skipped |
| Past-due subscriptions visible but not actionable | Subscriptions | `past_due` | Admin can see the problem but not solve it |
| No reassignment history | Assignments | All | Cannot track how many times an appointment was reassigned |

---

## Admin Control Coverage Score by Entity

| Entity | View Coverage | Modify Coverage | Override Coverage | Recovery Coverage | Audit Coverage | Overall |
|--------|-------------|-----------------|-------------------|-------------------|----------------|---------|
| Appointments | 80% | 60% | 40% | 20% | 10% | 42% |
| Assignments | 50% | 40% | 30% | 20% | 0% | 28% |
| Subscriptions | 30% | 5% | 5% | 5% | 0% | 9% |
| Employees | 90% | 80% | 80% | 80% | 0% | 66% |
| Marketplace Orders | 90% | 70% | 70% | 70% | 20% | 64% |
| Support Tickets | 90% | 80% | 80% | 80% | 20% | 70% |
| Notification Log | 0% | 0% | 0% | 0% | 0% | 0% |
| Contact Inquiries | 0% | 0% | 0% | 0% | 0% | 0% |

**Platform Admin Control Average: ~35%**

The two lowest-scoring entities — Notification Log (0%) and Contact Inquiries (0%) — represent important operational visibility gaps. Subscriptions at 9% is the most business-critical gap given it's the core revenue model.
