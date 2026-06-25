# Employee Onboarding Implementation Plan
**Date:** 2026-05-31

## Files Affected

### Migrations (new)
| File | Purpose |
|------|---------|
| `db/migrations/2026-05-31_onboarding_tables.sql` | 6 new tables + 5 employee columns |

### Server (new)
| File | Purpose |
|------|---------|
| `server/routes/adminOnboarding.ts` | 12 admin API routes for form management |
| `server/routes/employeeOnboarding.ts` | 4 employee routes + consent withdrawal |

### Server (modified)
| File | Change |
|------|--------|
| `server/index.ts` | Register adminOnboarding + employeeOnboarding routers |
| `server/routes/adminEmployees.ts` | Auto-assign forms on employee invite |
| `server/routes/employeeAssignments.ts` | Test notification suppression + blocking form check |

### Client (new)
| File | Purpose |
|------|---------|
| `client/pages/admin/LegalCompliance.tsx` | Admin legal settings UI at /admin/legal-compliance |
| `client/pages/employee/Onboarding.tsx` | Employee onboarding page at /employee/onboarding |

### Client (modified)
| File | Change |
|------|--------|
| `client/App.tsx` | Add /admin/legal-compliance and /employee/onboarding routes |
| `client/pages/admin/AdminLayout.tsx` | Add Legal & Compliance nav item to Workforce group |
| `client/pages/employee/EmployeeLayout.tsx` | Add Onboarding nav item |
| `client/pages/employee/Dashboard.tsx` | Onboarding pending banner |
| `client/pages/employee/Profile.tsx` | GPS withdrawal uses audit-logged endpoint |
| `client/hooks/employee/useEmployee.ts` | Add onboarding_status, onboarding_completed_at |

## Routes Affected

### New admin routes
- `GET /api/admin/onboarding/forms`
- `POST /api/admin/onboarding/forms`
- `GET /api/admin/onboarding/forms/:id`
- `PATCH /api/admin/onboarding/forms/:id`
- `POST /api/admin/onboarding/forms/:id/versions`
- `POST /api/admin/onboarding/forms/:id/activate-version`
- `POST /api/admin/onboarding/forms/:id/deactivate`
- `GET /api/admin/onboarding/employees`
- `GET /api/admin/onboarding/employees/:employeeId`
- `POST /api/admin/onboarding/employees/:employeeId/assign`
- `POST /api/admin/onboarding/documents/:uploadId/review`
- `GET /api/admin/onboarding/export/signatures`

### New employee routes
- `GET /api/employee/onboarding`
- `GET /api/employee/onboarding/:assignmentId`
- `POST /api/employee/onboarding/:assignmentId/sign`
- `POST /api/employee/onboarding/:assignmentId/upload`
- `POST /api/employee/onboarding/consent/withdraw`

## Risk Assessment

| Risk | Level | Mitigation |
|------|-------|------------|
| Signatures overwritten | NONE | Unique constraint on (employee_id, form_version_id); server returns 409 on duplicate |
| Old form versions deleted | NONE | No DELETE endpoint for versions; deactivate only |
| GPS consent captured without consent | NONE | Server checks gps_consent_at before any ping |
| Real customer emails from test employees | ELIMINATED | is_test check added to all notification blocks |
| Blocking forms preventing all work | LOW | Admin controls blocks_assignments per form; test employees bypass |
| Auto-assignment failures | LOW | Fire-and-forget; failures are logged but don't break invite |
| IP address spoofing | NONE | IP captured server-side from x-forwarded-for / req.ip |

## Rollback Plan

All new tables use CREATE TABLE IF NOT EXISTS. If migration fails partway:
- Re-run the migration (idempotent)
- No existing tables are modified destructively

If new routes break something:
- Remove adminOnboarding and employeeOnboarding imports from server/index.ts
- Existing functionality unchanged

## Test Plan

1. Apply migration to Supabase
2. Admin creates form → add version → activate version → verify it appears in list
3. Invite new employee → verify forms auto-assigned matching worker_type
4. Employee opens /employee/onboarding → pending forms visible
5. Employee signs acknowledgment → signature row in employee_form_signatures with IP/timestamp
6. GPS consent form signed → employees.gps_consent_at set automatically
7. GPS withdrawal → gps_consent_at cleared + audit log entry
8. Test employee completes assignment → NO customer email sent
9. Real employee completes assignment → customer email sent (unchanged)
10. Admin marks form as blocks_assignments → test employee can bypass; real employee blocked until signed
11. TypeScript: zero errors
12. Build: passes
