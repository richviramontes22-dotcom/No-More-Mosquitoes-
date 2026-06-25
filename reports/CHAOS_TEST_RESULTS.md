# Chaos Test Results
**Date:** 2026-06-02
**Method:** Code audit + architecture review (not live destructive testing)

---

## A1 — Onboarding Chaos Tests

| Scenario | Expected | Actual | Risk |
|----------|----------|--------|------|
| Browser refresh mid-onboarding | Flow progress saved to localStorage + Supabase `onboarding_progress` | Flow resumes from saved step | LOW — `loadFlowProgress()` hydrates from both sources |
| Browser close mid-onboarding | Progress saved on each step | User can resume from intro or saved step | LOW |
| Multiple tabs | Each tab loads its own saved progress | Last write wins (localStorage) | LOW — eventual consistency acceptable |
| Logout during onboarding | Redirect to /login | Auth context clears, navigate("/login") | LOW |
| "Skip for now" → profile cache stale | ~~Used to redirect back to /onboarding~~ | FIXED: `queryClient.invalidateQueries` before navigate | RESOLVED |
| Onboarding TTL expiration | No TTL on pending data | sessionStorage persists until tab close | LOW — acceptable |
| Stale onboarding data from sessionStorage | Old quote data shown | Cleared on `clearPendingOnboarding()` after confirm-booking | LOW |
| Annual plan via quote | Should redirect to /contact | `pending.program === "annual"` handled in `handleBeginSetup()` | LOW |

**Overall Onboarding Risk: LOW — skip redirect bug was fixed**

---

## A2 — Payment Chaos Tests

| Scenario | Expected | Actual | Risk |
|----------|----------|--------|------|
| Declined card | Stripe returns error to client | `stripe.confirmPayment()` returns error; client shows toast | LOW |
| Insufficient funds | Same as declined | Same | LOW |
| 3DS challenge | Stripe redirects to challenge page | `return_url` set correctly; PI awaits confirmation | MEDIUM — depends on correct `return_url` |
| Duplicate submit | Same PI confirmed twice | `confirm-booking` is idempotent — appointment deduped by date | LOW |
| Refresh during payment | PI may be in `requires_action` state | Client re-checks PI status on return | MEDIUM |
| Close browser during payment | PI may succeed without confirm-booking call | Stripe webhook (`checkout.session.completed`) handles this as fallback | MEDIUM — requires STRIPE_WEBHOOK_SECRET set |
| Successful payment, interrupted browser | PI succeeds, appointment not created | Stripe webhook creates subscription; appointment may be missing | MEDIUM — admin creates appointment manually |
| Failed subscription activation | Invoice payment fails | `invoice.payment_failed` webhook fires; customer notified | LOW |

**Recovery:** Admin can create appointments manually from Customers page. Stripe webhooks handle most async cases.

**Critical Prerequisite: `STRIPE_WEBHOOK_SECRET` must be set in production.**

---

## A3 — Parcel Lookup Chaos Tests

| Scenario | Expected | Actual | Risk |
|----------|----------|--------|------|
| County timeout (8s) | `MANUAL_REVIEW_REQUIRED` | `ADAPTER_TIMEOUT_MS = 8000` enforced | LOW |
| County GIS outage | `MANUAL_REVIEW_REQUIRED` | Adapter catch block returns null → manual review | LOW |
| Cache hit | Returns cached result instantly | `getCachedParcel()` checked first — verified in code | LOW |
| Cache miss, county lookup | Full GIS lookup | Normal flow — verified in code | LOW |
| Unsupported address | Manual review | `county === "unknown"` → returns `MANUAL_REVIEW_REQUIRED` | LOW |
| `ENABLE_PARCEL_COUNTY_LOOKUP=false` | Manual review (cache still works) | Feature flag gate in `runLookup()` — verified | LOW |
| `ENABLE_REGRID_FALLBACK=false` | Regrid never called | `flags.regridFallback()` check in adapter — verified | LOW |
| Regrid API error | Graceful null | Adapter try/catch returns null | LOW |
| Manual review path | 422 + user-friendly message | Correct status code and message | LOW |
| Concurrent same-address requests | De-duplicated | `inFlight` map prevents concurrent GIS calls | LOW |

**Checkpoints and logs verified in code. RequestId traced end-to-end.**

---

## A4 — Routing Chaos Tests

| Scenario | Expected | Actual | Risk |
|----------|----------|--------|------|
| No active technicians | Clear error + admin alert | `workforce.no_technicians_available` alert fires | LOW |
| Blackout date | 400 error with reason | Company blackout check at top of day/generate | LOW |
| All techs unavailable | Empty routes + alert | Availability filter excludes all | LOW |
| Capacity exceeded | Overflow in `unassigned_appointments` | Per-tech capacity enforcement | LOW |
| Missing schedule template | Warning in response | `workforce_notes` includes warning | LOW |
| Publish blocked by validation | 400 with blockers | Validation gate + checkpoint | LOW |
| Publish override (force: true) | Succeeds + audit log | `logRouteAudit("day_published_force_override")` | LOW |
| Route generation failure | 500 + Sentry capture | `logger.error` + `captureException` in catch | LOW |

---

## A5 — Reminder Automation Chaos Tests

| Scenario | Expected | Actual | Risk |
|----------|----------|--------|------|
| `REMINDER_DRY_RUN=true` | Logs but doesn't send | Flag gate in `runReminderBatch()` | LOW |
| `ENABLE_REMINDER_EMAILS=false` | All sends skipped | `isEmailsEnabled` check per appointment | LOW |
| Duplicate prevention | `isDuplicateReminder()` skips | Dedup check in `sendAppointmentReminder` | LOW |
| Missing email on profile | Appointment skipped | `if (!profile?.email)` check | LOW |
| Resend API failure | Error logged, batch continues | `sendAppointmentReminder` try/catch | LOW |
| Canceled appointment | Skipped | `SKIP_STATUSES` filter on query | LOW |
| Batch crash | Error logged + Sentry | `captureException` now wired | LOW |

**Overall Risk: LOW across all reminder scenarios**
