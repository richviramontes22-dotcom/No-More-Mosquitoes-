# Executive Dashboard Planning Report

**Planning only — nothing in this phase was built**, per the brief's explicit instruction. This is a survey
of what data already exists across the codebase for each requested metric category, what's missing, and a
recommended (not implemented) plan for a future executive dashboard.

## What data exists today

| Metric | Status | Where | Notes |
|---|---|---|---|
| Revenue (daily) | Exists | `server/routes/adminStripe.ts`, `client/pages/admin/Revenue.tsx` | Pulls real daily revenue from Stripe `payment_intents`; the 7-/30-day growth percentages shown in the UI are hardcoded placeholders, not computed — worth knowing before trusting that screen today |
| MRR / ARR | Missing | — | No subscription-level recurring-revenue aggregation anywhere; only raw daily payment totals exist |
| Appointment volume | Exists (basic) | `server/routes/adminMetrics.ts`, `server/routes/adminAppointments.ts` | Today's count, next-7-days forecast, counts by status — no historical week/month trend series |
| Lead funnel | Partial | `server/services/leads/leadService.ts` | Status states (`new`→`contacted`→`quoted`→`scheduled`) exist and are tracked per lead; no aggregate funnel view (counts at each stage, or stage-to-stage drop-off) anywhere yet |
| Conversion rates | Partial | `server/services/analytics/territoryIntelligenceService.ts` | Only computed per-ZIP (`convertedLeads / totalLeads`, null under 3 leads) — no account-wide conversion rate |
| Referral performance | Exists | `server/services/referrals/referralService.ts`, `server/services/analytics/platformAnalyticsService.ts` | Per-code and per-partner lead/conversion counts, pending reward value — solid; no ROI (reward cost vs. revenue generated) |
| Service area growth | Exists (strong) | `server/services/analytics/territoryIntelligenceService.ts` | ZIP-level opportunity scoring, county rollups, recommendations — the most complete analytics service in the codebase; no month-over-month growth velocity yet |
| NPS / satisfaction | Exists (snapshot only) | `server/services/satisfaction/satisfactionService.ts` | Real NPS formula, promoter/passive/detractor counts, detractor follow-up queue — but only ever a current snapshot; nothing stores or trends NPS over time |
| Technician utilization | Exists (detailed) | `server/services/analytics/workforceOptimizationService.ts` | Per-technician scheduled/completed/utilization %, route miles, 14-day capacity forecast — no historical trend, no revenue-per-hour |
| Route efficiency | Exists (partial) | `server/services/analytics/platformAnalyticsService.ts`, `smartRoutingOptimizer.ts` | Smart-optimize run counts, distance/time saved, route audit log — no planned-vs-actual comparison after a route is actually driven |
| Customer retention / churn | Partial | `server/routes/webhooksStripe.ts`, `client/pages/admin/Customers.tsx` | Subscription status (`active`/`paused`/`canceled`) synced from Stripe webhooks, cancellation cascades correctly — but no churn rate calculation, no cohort breakdown, no cancellation-reason aggregation |

## The pattern across almost everything above

Nearly every metric category has a real backend service computing a **correct current snapshot** — this
codebase is not starting from zero. What's consistently missing is **time-series storage and trending**:
nothing periodically snapshots these metrics into a table for later charting, so "NPS this month vs. last
month" or "MRR trend over the last 6 months" can't be answered today without either (a) adding a scheduled
job that snapshots key metrics daily/weekly, or (b) computing trends on the fly from raw historical rows
(`payment_intents`, `customer_satisfaction_surveys`, etc. — all timestamped, so this is possible without new
tables, just new aggregation queries).

## Recommended metrics for a v1 executive dashboard

Prioritized by how complete the underlying data already is (least new work first):

1. **Service area growth** — already the most complete service; surfacing it at the executive level is
   mostly a UI exercise.
2. **NPS** (current value, trend requires the snapshot-storage gap above).
3. **Technician utilization** — already detailed; would need light aggregation for an exec-level rollup
   (fleet-wide average, not per-technician).
4. **Referral performance** — already has the analytics; needs an ROI calculation layered on top.
5. **Lead funnel** — needs an actual aggregate funnel view built (counts per stage, conversion between
   consecutive stages) — the underlying lead-status data already supports this, it's just never been rolled
   up.
6. **Revenue / MRR / ARR** — needs real MRR/ARR computation from `subscriptions` (price × active count,
   bucketed by plan/cadence) — this is the single highest-value gap, since "how much recurring revenue do we
   have" is the most fundamental executive question and the dashboard currently can't answer it.
7. **Customer retention / churn** — needs a real churn-rate formula (canceled-this-period /
   active-start-of-period) computed from the Stripe webhook history already being logged.
8. **Route efficiency** — useful but lower priority for an *executive* (vs. operations) audience; the
   existing Operations Command Center already serves this better for its actual users.
9. **Appointment volume** — useful context metric, not a headline number on its own.

## Recommended dashboard layout (not built)

- **Top row** — the four numbers an executive checks first: current MRR, NPS (with trend arrow once
  history exists), active customer count, this month's lead-to-customer conversion rate.
- **Second row** — two charts: revenue trend (daily/weekly, from existing Stripe data) and lead funnel
  (new → contacted → quoted → scheduled → converted, as a simple stage-count bar or funnel chart).
- **Third row** — service area growth (reuse Territory Intelligence's existing ZIP/county data, summarized
  rather than the full operational detail that page already shows) and referral performance (codes/partners
  leaderboard).
- **Footer strip** — technician utilization (fleet average %) and route efficiency (time/distance saved this
  month) as smaller, secondary tiles — operationally important but not the primary executive narrative.

This intentionally reuses the Operations Command Center's established pattern (a small set of headline
numbers, then progressively more detail) rather than inventing a new dashboard paradigm.

## Implementation phases (recommended, not started)

1. **Metric snapshot infrastructure** — a scheduled job (reusing the existing Netlify scheduled-function
   pattern already used for reminders/appointment generation) that computes and stores daily snapshots of
   MRR, NPS, active customer count, and churn rate into a new lightweight table. This is the prerequisite
   for any trend line on the dashboard; without it, every "trend" would have to be approximated from raw
   historical rows on every page load, which gets slow and complicated fast.
2. **MRR/ARR and churn calculation** — the two genuinely missing computations (everything else above
   already has a real, correct snapshot calculation to build on).
3. **Lead funnel aggregation** — a roll-up query over existing `leads` status data; no new data collection
   needed.
4. **The dashboard page itself** — composing the above, following the layout proposed here, reusing existing
   chart components already used elsewhere in admin (Revenue.tsx, Territory Intelligence) rather than
   introducing a new charting library.
5. **Referral ROI and route planned-vs-actual** — lower-priority refinements once the core dashboard ships.
