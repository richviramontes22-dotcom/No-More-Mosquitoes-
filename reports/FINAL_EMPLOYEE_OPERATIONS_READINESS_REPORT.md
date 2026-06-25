# Final Employee Operations Readiness Report
**Date:** 2026-05-31
**Sprint:** Employee Operations, Onboarding, Compliance, GPS, and Routing Audit

---

## The 12 Required Answers

### 1. Does an employee dashboard already exist?
**YES — and it is substantially functional.**

The employee portal exists at `/employee/*` with 7 pages: Dashboard, Assignments, Assignment Detail, Messages, Timesheets, Profile, and Messages. Employees can log in, see their assignments, update status (en route → arrived → completed), upload job photos/videos, message customers in-app, clock in/out, view timesheets, and navigate to job sites via deep links to Google Maps or Apple Maps.

**What does NOT work correctly:**
- Shift data (clock in/out) is split between a Supabase write in Dashboard.tsx and an in-memory server route — data inconsistency
- Messages route uses in-memory db; AssignmentDetail.tsx writes directly to Supabase — inconsistency
- GPS is captured on clock-in but discarded — not stored anywhere
- Pre-service checklist is client-side only — resets on navigation

---

### 2. Is it complete enough for beta?
**Conditionally YES — after Sprint 0 fixes.**

The core field operations loop (receive assignment → navigate → arrive → complete → upload photo → notify customer) is fully functional and would support a real beta. But three bugs must be fixed first:

1. Shift data inconsistency (in-memory vs Supabase) — data loss risk
2. GPS captured but not stored — misleading to admin/employee
3. Checklist not saved — operational gap

Fix these three issues (Sprint 0, ~1-2 days of work) and the employee dashboard is beta-ready for field operations.

---

### 3. What employee onboarding exists?
**Nothing.** The onboarding system does not exist.

Employees receive a Supabase magic link email, click it, set their password, and land directly on the dashboard. There are no forms to complete, no acknowledgments to sign, no documents to upload, no checklist, and no admin approval step before an employee can access their assignments.

---

### 4. What legal/compliance gaps exist?

| Gap | Risk Level |
|-----|-----------|
| GPS tracking captured without consent | CRITICAL — CA Labor Code violation |
| No chemical/pesticide handling acknowledgment | HIGH — CA DPR requirement |
| No workers' compensation notice | HIGH — CA employer requirement |
| No worker classification on record | HIGH — AB5 misclassification risk |
| No safety training acknowledgment | HIGH — OSHA relevance |
| No handbook acknowledgment | MEDIUM |
| No emergency contact | MEDIUM — operational and safety |
| No GPS tracking consent disclosure | CRITICAL |
| No document/signature audit trail | HIGH |
| No attorney review of any policy text | CRITICAL before any document goes live |

**Do not run GPS tracking on employees in production until GPS consent form is in place and attorney-reviewed.**

---

### 5. What forms/disclaimers should be supported?

| Document | Worker Type | Priority |
|----------|-------------|----------|
| GPS/Location Tracking Consent | All | CRITICAL |
| Chemical/Pesticide Handling Acknowledgment | Technicians | CRITICAL |
| Workers' Compensation Notice | W2 employees | HIGH |
| Safety Training Acknowledgment | All field staff | HIGH |
| Vehicle and Driving Policy | Drivers | HIGH |
| Employee Handbook Acknowledgment | W2 employees | HIGH |
| Equipment Policy | All field staff | MEDIUM |
| Photo/Video/Media Policy | All employees | MEDIUM |
| Background Check Authorization | If used | HIGH |
| Independent Contractor Agreement | Contractors only | ATTORNEY REVIEW REQUIRED |
| Arbitration Agreement | If used | ATTORNEY REVIEW REQUIRED |
| NDA / Confidentiality | As applicable | RECOMMENDED |

The platform should not hardcode these documents. Admin uploads PDFs and manages acknowledgment text via the onboarding form management system designed in Phase 4.

---

### 6. How should signatures and timestamps be stored?

Server-captured only. Never trust client-supplied timestamp or IP.

```
employee_form_signatures table (immutable after insert):
  employee_id        — from authenticated JWT (never client-provided)
  form_version_id    — exact version signed (snapshot of content at signing)
  signed_at          — server-side: new Date().toISOString()
  ip_address         — req.ip or x-forwarded-for (server-captured)
  user_agent         — req.headers['user-agent'] (server-captured)
  signature_text     — employee typed full name: "I, [name], acknowledge..."
  checkbox_acknowledged — boolean must be true
  acknowledgment_statement — snapshot copy of the exact statement text
```

Rows are never updated. New signing = new row. Old rows preserved for audit.

---

### 7. How should test employees be created?

Two paths:

**Path A (Email invite, is_test = true):** Admin uses normal invite flow with "Test Account" toggle. Employee receives magic link email and sets their own password.

**Path B (No email, temp password):** Admin sets `generate_temp_password: true` in invite payload. Server calls `supabaseAdmin.auth.admin.createUser()` with a generated password. API response returns the temp password once (never stored). Admin shares it securely.

In both cases:
- `employees.is_test = true`
- Customer PII is masked server-side in assignment responses
- "⚠ TEST ACCOUNT" banner shows on employee dashboard
- Test employees can be hard-deleted (real employees: deactivate only)
- Admin notifications from test employees are tagged `[TEST]` or suppressed

---

### 8. How should GPS tracking be implemented safely?

**Phase 1 (Beta): Arrival snapshot only.**
- GPS consent form required before any capture
- One location ping when employee clicks "En Route", "Arrive", and "Complete"
- Stored in `employee_location_pings` table with consent_version_id reference
- `assignments.geo_arrive` and `geo_complete` populated
- If consent not given: employee updates status manually, no location captured
- If browser GPS denied: status update proceeds normally (log discrepancy only)

**Phase 2 (Post-beta): Continuous session tracking.**
- `navigator.geolocation.watchPosition()` during active assignment only
- 30-second ping rate limit server-enforced
- Off-duty tracking default = off, separate opt-in required
- Admin live map view (last ping within 30 min)

**Legal checkpoint before any GPS goes live:** attorney reviews the GPS consent disclosure text.

---

### 9. How should route optimization work?

MVP algorithm — no AI, no external APIs required:

1. Filter unassigned appointments for the selected date
2. Group by ZIP code cluster
3. Sort by priority (overdue → VIP → normal) then by scheduled time window
4. Assign to available technicians respecting capacity (default 8 stops/tech/day)
5. Estimate travel between consecutive stops using Haversine distance (30 mph average)
6. Detect conflicts: overlapping ETAs, over-capacity, missing coordinates
7. Return a `RouteProposal` object for admin review

No routing happens automatically. Admin must review and approve before assignments are created and employees are notified.

---

### 10. Should routing be proposal-first or auto-routing?

**Proposal-first for the foreseeable future.**

Auto-routing without human review carries operational and customer-relationship risk:
- A misconfigured route could send a technician to the wrong area
- Capacity misjudgments could overload one technician and underload another
- Customer time windows might be violated

The MVP algorithm is intentionally simple — it doesn't know traffic, technician skill levels, equipment requirements, or customer preferences beyond ZIP grouping. Auto-routing should only be considered after:
1. The proposal mode has been validated with real operational data for at least 2 months
2. The algorithm's recommendations have proven accurate enough to trust
3. An override mechanism is easily accessible to admins

---

### 11. What should be built first?

**Priority order:**

| Sprint | Work | Why |
|--------|------|-----|
| Sprint 0 | Fix data inconsistencies (shifts, messages, GPS storage) | Existing bugs corrupt data — must fix before beta |
| Sprint 1 | Worker type + test employee | Low risk, high operational value for testing |
| Sprint 2 | GPS consent gate + snapshot tracking | Required before GPS touches production |
| Sprint 3 | Onboarding form management (infrastructure) | Legal gap is critical; build system first, populate documents after attorney review |
| Sprint 4 | Checklist persistence + photo labeling | Small, completes the field ops loop |
| Sprint 5 | Route management (admin proposal + employee view) | Operationally significant for multi-tech routing |
| Sprint 6 | Map integration (replace MiniMap placeholder) | High-value UX; depends on Sprint 5 for route data |
| Sprint 7 | Upcoming assignments view + dashboard improvements | Polish |

---

### 12. What should wait until after beta?

| Feature | Reason |
|---------|--------|
| Continuous GPS tracking (watchPosition) | Battery/UX testing needed; Phase 1 snapshot is sufficient |
| Live admin map | Depends on continuous tracking |
| Auto-route mode | Need to validate proposal-mode algorithm first |
| Real drive time API (Google Distance Matrix) | Cost; Haversine estimates sufficient at this scale |
| Contractor onboarding path | Requires attorney review of AB5 classification analysis |
| Arbitration agreement | Attorney must review PAGA carve-out before adding |
| Offline support (service worker, sync queue) | Architecture complexity; `offlineQueue.ts` exists but unused |
| Document export as PDF | Nice-to-have; CSV export sufficient initially |
| Performance analytics / employee metrics | Phase 3+ feature |
| Employee in-app notification bell | Depends on broader notification infrastructure |

---

## Readiness Scores

| Domain | Score | Notes |
|--------|-------|-------|
| Employee dashboard (field ops) | 7/10 | Works; 3 bugs must fix |
| Employee authentication | 9/10 | Supabase auth works correctly |
| Assignment lifecycle | 9/10 | Complete end-to-end |
| Media upload | 8/10 | Works; photo labeling missing |
| Messaging | 7/10 | Works; in-memory route bug |
| Timesheet / clock-in | 6/10 | Works; data source split is a bug |
| GPS tracking | 2/10 | Captured, not stored; no consent |
| Route management | 0/10 | Tables exist; no code |
| Onboarding / legal | 0/10 | Nothing exists |
| Worker classification | 1/10 | No classification field |
| Test employee support | 0/10 | No test flag |
| Compliance | 1/10 | GPS tracking without consent is active risk |

**Overall Employee Operations Readiness: 4.5/10**

Core field operations are solid. Legal/compliance layer is completely absent. Route management is unbuilt despite DB tables existing. Data bugs exist that must be fixed before beta.

---

## Risk Score

| Risk | Level | Mitigation |
|------|-------|------------|
| GPS captured without consent | CRITICAL | Sprint 2 — consent gate before any capture |
| Chemical handling undocumented | HIGH | Sprint 3 — onboarding forms |
| Shift data loss (in-memory bug) | HIGH | Sprint 0 — fix immediately |
| Worker misclassification (AB5) | HIGH | Add worker_type; attorney review |
| No emergency contact on file | MEDIUM | Sprint 1 — add fields |
| Checklist data lost | MEDIUM | Sprint 4 — persist to DB |
| No route optimization | MEDIUM | Sprint 5 — proposal mode |

**Overall Risk Score: HIGH** — primarily due to GPS-without-consent and absence of any legal/onboarding infrastructure.

---

## Beta Go / No-Go Recommendation

### For Field Operations (Assignment Lifecycle): CONDITIONAL GO

**Conditions:**
1. Sprint 0 bugs fixed (shift data, GPS storage, message route)
2. GPS capture disabled in production until consent form is in place and attorney-reviewed
3. Owner acknowledges no legal acknowledgment system exists yet

### For Employee Onboarding: NO-GO

No onboarding system exists. Employees skip from invite email directly to full dashboard access with no acknowledgments, no forms, no admin approval. This must be addressed before scale.

### For Route Management: NO-GO

Route optimization tables exist but no code uses them. Admin cannot create, review, or publish routes. Employees see a flat unsorted assignment list. This is workable for a very small operation (1-2 technicians) but not scalable.

---

## Implementation Order (Summary)

```
WEEK 1:  Sprint 0 — Fix bugs (shifts, messages, GPS storage)
WEEK 1:  Sprint 1 — Worker type + test employee infrastructure
WEEK 2:  Sprint 2 — GPS consent + snapshot tracking (after attorney review of consent text)
WEEK 2-3: Sprint 3 — Onboarding form management system
WEEK 3:  Sprint 4 — Checklist persistence + photo labeling
WEEK 3-4: Sprint 5 — Route management (admin proposal + employee route view)
WEEK 4:  Sprint 6 — Map integration (Mapbox)
WEEK 4:  Sprint 7 — Dashboard UX improvements
```

**The employee portal can support a limited beta launch after Sprint 0 is complete, with the explicit understanding that legal/compliance infrastructure is pending and GPS tracking must be disabled until Sprint 2 consent gate is in place.**
