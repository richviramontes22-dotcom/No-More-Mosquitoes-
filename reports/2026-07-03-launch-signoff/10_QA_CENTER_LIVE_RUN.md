# Phase 10 — QA Center Live Run

**Date:** 2026-07-13  
**Sprint:** Production Launch Verification

---

## Status: BLOCKED — Requires Live Admin Browser Session

The QA Center (`/admin/qa-center`) requires a logged-in admin session. Browser automation is
not available in this environment.

---

## Code-Level Verification (Completed)

| Check | Status |
|---|---|
| `/admin/qa-center` route exists in `App.tsx` | ✅ |
| Route protected by `RequireAdmin` + `AdminLayout` | ✅ |
| Nav entry: "QA Center" with `FlaskConical` icon in System group | ✅ |
| 10 tabs: Overview, Customer, Employee, CS, Workflow, Marketplace, Responsive, Security, Test Data, Reports | ✅ |
| Customer Smoke Test calls `/api/health/database`, `/api/health/stripe`, `/api/health/email` | ✅ |
| Employee Smoke Test expects 401 from employee endpoints without auth | ✅ |
| Marketplace Smoke Test expects 401 from `POST /api/marketplace/create-payment-intent` | ✅ |
| Security Checklist (7 items) uses API calls + local checks | ✅ |

---

## Manual Steps to Run the QA Center

1. Log in as admin at `https://nomoremosquitoes.us/admin/login`
2. Navigate to `/admin/qa-center`
3. **Overview tab** — confirm summary cards show system status
4. **Workflow tab → Run All Suites**
   - Confirm all 4 suites run (Customer, Employee, Marketplace, Security)
   - Confirm pass/fail results render per check
   - Confirm no 500 errors
5. **Customer tab** — click "Launch Customer App" → confirm opens in new tab at `/dashboard`
6. **Employee tab** — click "Launch Employee App" → confirm opens in new tab at `/employee`
7. **Marketplace tab** — click "Launch Marketplace" → confirm opens in new tab at `/dashboard/marketplace`
8. **Security tab** — review checklist items, confirm no red flags
9. **Test Data tab** — review QA account spec (for reference with Phase 04)
10. **Reports tab** — review available reports

---

## Health Endpoint Snapshot (API-verifiable without browser)

These can be verified directly:

```bash
curl https://nomoremosquitoes.us/api/health
curl https://nomoremosquitoes.us/api/health/stripe
curl https://nomoremosquitoes.us/api/health/email
curl https://nomoremosquitoes.us/api/health/database
```

Expected:
- `/api/health`: `{"status":"ok",...}`
- `/api/health/stripe`: `{"mode":"live","configured":true}`
- `/api/health/email`: `{"provider":"resend","configured":true,...}`
- `/api/health/database`: `{"status":"connected"}`

---

## Pass Criteria

- All 4 smoke suites complete without fatal errors
- Health endpoints return expected status
- No console errors in admin session

---

## Verdict

| Check | Status |
|---|---|
| Code-level: route, tabs, suite logic | ✅ All verified |
| Live: suite run, result display, health endpoints | ⏳ BLOCKED — requires admin browser session |

**Phase 10: BLOCKED — requires live admin browser session.**
