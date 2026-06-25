# Observability Audit
**Date:** 2026-06-08
**Basis:** Source code inspection — logger.ts, checkpoint.ts, sentry.ts, health.ts, featureFlags.ts, adminDebug.ts, adminMetrics.ts, netlify.toml, notification_log table

---

## Logging Infrastructure

### Structured Logger (server/lib/logger.ts)

| Feature | Status |
|---------|--------|
| JSON-lines output (stdout) | ✅ |
| Log levels: info / warn / error / debug | ✅ |
| Sensitive key redaction (SENSITIVE_KEYS set) | ✅ |
| Secret patterns stripped (sk_, service_role, etc.) | ✅ |
| Stack traces suppressed in production | ✅ (included only in dev) |
| Netlify log drain compatible | ✅ (JSON to stdout) |

**Events logged at info level:**
- `billing.payment_intent.created`, `billing.customer.created`
- `parcel.lookup.*` (cache hit/miss, county detection, fallback used)
- `route.day.generate.*` (start, technicians filtered, created, failed)
- `route.publish.*` (validation, blocked, success)
- `reminder.batch.*` (start, found, sent, failed, complete)

---

## Request ID Tracing

| Feature | Status |
|---------|--------|
| UUID assigned per request via middleware | ✅ |
| x-request-id response header returned | ✅ |
| requestId propagated to all structured log events | ✅ |
| requestId included in all error responses | ✅ |
| requestId flows through billing checkpoints | ✅ |
| requestId flows through routing checkpoints | ✅ |

---

## Checkpoint System (server/lib/checkpoint.ts)

Checkpoints record progress at named steps in multi-step flows.

| Flow | Checkpoints |
|------|------------|
| Billing / booking | billing.start → customer.created → payment_intent.created → payment.verified → appointment.created → subscription.created → profile.onboarded → billing.complete |
| Parcel lookup | parcel.lookup.start → cache.checked → county.detected → county.lookup.start → county.lookup.success/failed → geometry.calculated → scag/regrid fallback → manual_review |
| Route day generation | route.day.generate.start → blackout.checked → technicians.filtered → capacity.applied → route.created → route.generate.failed |
| Route publish | route.publish.validation.start → publish.blocked → publish.success |
| Reminder batch | reminder.batch.start → appointments.found → duplicate.skipped → sent → failed → batch.complete |
| Employee onboarding | onboarding.start → form.assigned → signed → complete |

**Verbose mode:** All checkpoints log at debug level by default. Set `ENABLE_VERBOSE_CHECKPOINTS=true` to promote to info level in Netlify logs.

---

## Health Check Endpoints

All public — no auth required.

| Endpoint | What It Checks |
|----------|---------------|
| GET /api/health | App alive, environment, version, requestId |
| GET /api/health/database | Supabase connectivity + latency |
| GET /api/health/stripe | Key presence, mode (test/live), webhook configured |
| GET /api/health/email | RESEND_API_KEY present, reminder flags |
| GET /api/health/parcel | County lookup enabled, Regrid enabled, Google key present, test county detection |
| GET /api/health/workforce | Active technicians count, missing schedules/capacity profiles |

Health endpoint design: all are safe (no secrets exposed), lightweight, and uptime-monitor compatible.

---

## Admin Debug Panel (server/routes/adminDebug.ts)

| Feature | Status |
|---------|--------|
| GET /api/admin/debug/status | ✅ Returns system state snapshot |
| Feature flag values exposed | ✅ getAllFlags() |
| Stripe mode + key presence | ✅ |
| Resend configuration | ✅ |
| Parcel service state | ✅ |
| Workforce readiness | ✅ |
| Gated by ENABLE_ADMIN_DEBUG_PANEL=false | ✅ Off by default in production |
| Admin auth required | ✅ requireAdmin middleware |

---

## Admin Metrics (server/routes/adminMetrics.ts)

| Metric | Status |
|--------|--------|
| GET /api/admin/metrics/appointments | ✅ Counts by status |
| GET /api/admin/metrics/subscriptions | ✅ Active/cancelled counts |
| Displayed on Admin Overview page | ✅ |

---

## Notification Log (notification_log table)

Every email/SMS attempt is recorded:

| Column | Value |
|--------|-------|
| profile_id | Customer or employee UUID |
| appointment_id | If relevant |
| channel | email / sms |
| notification_type | Template name (appointment_confirmation, etc.) |
| status | sent / failed / skipped |
| provider | resend / twilio / null |
| provider_message_id | Resend/Twilio message ID |
| error_message | If failed |
| created_at | Timestamp |

**Used for:** Duplicate prevention, delivery audit, troubleshooting.

---

## Admin Alerts (admin_alerts table)

| Feature | Status |
|---------|--------|
| admin_alerts table | ✅ (migration pending Supabase run) |
| 11 alert event types configured | ✅ |
| Dedup index (event_type, entity_type, entity_id) WHERE resolved_at IS NULL | ✅ |
| Email + SMS to owner on warning/critical | ✅ |
| Alert badge counts | ✅ GET /api/admin/alerts/counts |
| Acknowledge / resolve flow | ✅ POST /api/admin/alerts/:id/{acknowledge,resolve} |

---

## Error Monitoring (Sentry)

| Check | Status |
|-------|--------|
| @sentry/node integration exists | ✅ server/lib/sentry.ts |
| Optional — no-op when disabled | ✅ |
| ENABLE_SENTRY + SENTRY_DSN required | ✅ Safe defaults |
| Auth headers stripped before send | ✅ beforeSend() hook |
| Sentry NOT yet configured for production | ⚠ DSN not set in Netlify |

---

## Netlify Function Observability

Scheduled functions log structured output:

```
[send-reminders] Starting at 2026-06-08T07:00:00Z
[send-reminders] checked=45 sent=12 skipped=33 failed=0
[generate-appointments] checked=20 generated=3 skipped=17 failed=0
```

Netlify provides:
- Function invocation logs
- Scheduled function run history
- Email alert on function failure (configurable in Netlify dashboard)

---

## Route Audit Log

All admin route actions are recorded to `route_audit_log`:

| Field | Value |
|-------|-------|
| route_id | Route UUID |
| actor_id | Admin user UUID |
| actor_role | admin / employee |
| action | route_generated, route_approved, route_published, route_discarded, stop_reordered, route_forced_override |
| metadata | JSON context (stop_count, confidence, employee_id, etc.) |

---

## Gaps / Missing Observability

| Gap | Severity | Notes |
|-----|----------|-------|
| Sentry DSN not configured in Netlify | MEDIUM | Server exceptions not captured in error tracker; add SENTRY_DSN before beta |
| Employee assignment routes use console.log not structured logger | LOW | Loses structured JSON format; visible in Netlify logs but harder to query |
| Webhook routes use console.log not structured logger | LOW | Same issue |
| No alerting when Netlify scheduled functions fail | LOW | Netlify email alert covers this; no admin_alerts entry |
| Admin debug panel disabled by default | INTENTIONAL | Turn on with ENABLE_ADMIN_DEBUG_PANEL=true when debugging |
| Verbose checkpoints off by default | INTENTIONAL | Turn on with ENABLE_VERBOSE_CHECKPOINTS=true for tracing |
| No external uptime monitor configured | MEDIUM | /api/health endpoint exists; recommend setting up UptimeRobot or similar before launch |
| No Netlify log drain configured | LOW | JSON logs go to Netlify's built-in log viewer; drain to Datadog/Logtail optional |

---

## Launch Readiness

| Action | Priority |
|--------|----------|
| Configure Sentry DSN in Netlify | Recommended before beta |
| Set up uptime monitor on /api/health | Recommended before beta |
| Verify Netlify failure email alerts configured | Required before beta |
| Apply pending DB migrations (admin_alerts table) | REQUIRED — alerts won't persist without it |
