# Admin Field Ops Alerts Report

**Date:** 2026-05-30  
**File:** `server/routes/employeeAssignments.ts`  
**Status:** IMPLEMENTED

## Implemented Field Ops Alerts

### Service Completed (`field_ops.service_completed`)
- **Severity:** info
- **Trigger:** Employee marks assignment status = `completed`
- **Email:** Yes (owner gets a log of completed jobs)
- **SMS:** No (info severity — volume would be too high in season)
- **Metadata:** employee_id, appointment_id, assignment_id
- **Action required:** None (informational) — review completed jobs in admin dashboard

## Implementation Note

The alert fires inside the `PATCH /api/employee/assignments/:id/status` handler immediately after the status update succeeds. It is fire-and-forget so it does not delay the employee's API response.

## Deduplication

- Dedup window: 60 minutes per assignment ID
- Assignment IDs are unique per visit, so false duplicates are unlikely — dedup primarily guards against webhook/network retries

## Future Field Ops Alerts (not yet implemented)

| Event | Severity | Trigger |
|-------|---------|---------|
| Technician clocked in | info | Shift start |
| No-show recorded | warning | Assignment → no_show |
| Assignment overdue | warning | Scheduled start + 2h with no status update |
| Job photo uploaded | info | Media upload to job |
