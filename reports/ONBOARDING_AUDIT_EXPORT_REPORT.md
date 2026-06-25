# Onboarding Audit & Export Report
**Date:** 2026-05-31

---

## Audit Log

### Table: `onboarding_audit_log`
Append-only. No UPDATE or DELETE endpoints exist for this table.

### Events Recorded

| Action | Recorded By | Entity |
|--------|-------------|--------|
| `form_created` | Admin creates form | onboarding_form |
| `form_updated` | Admin patches form metadata | onboarding_form |
| `version_created` | Admin adds version | onboarding_form_version |
| `version_activated` | Admin activates version | onboarding_form_version |
| `form_deactivated` | Admin deactivates form | onboarding_form |
| `form_assigned` | Admin manually assigns form | employee |
| `form_signed` | Employee signs form | employee_onboarding_assignment |
| `document_uploaded` | Employee uploads document | employee_document_upload |
| `document_approved` | Admin approves upload | employee_document_upload |
| `document_rejected` | Admin rejects upload | employee_document_upload |
| `consent_withdrawn` | Employee withdraws GPS consent | employee |

### Metadata Fields
Each entry has a JSONB `metadata` field with contextual details. Example for `form_signed`:
```json
{
  "form_id": "uuid",
  "is_gps_consent": true,
  "is_test": false
}
```

### Indexes
- `(actor_id, created_at DESC)` — query all actions by a specific user
- `(entity_type, entity_id)` — query all actions on a specific record

---

## Signature Export

### `GET /api/admin/onboarding/export/signatures`

Returns all signature records. Optional query filters: `form_id`, `employee_id`.

Response:
```json
{
  "signatures": [
    {
      "id": "uuid",
      "employee_id": "uuid",
      "form_id": "uuid",
      "form_version_id": "uuid",
      "signature_text": "Luis Martinez",
      "checkbox_acknowledged": true,
      "acknowledgment_statement": "I have read and understand...",
      "ip_address": "192.168.1.100",
      "user_agent": "Mozilla/5.0...",
      "signed_at": "2026-05-31T10:23:45.000Z"
    }
  ]
}
```

### Client-Side CSV Export (not yet implemented)
The admin can convert the JSON response to CSV using a utility. Recommended fields for compliance export:
```
employee_id, signature_text, form_version_id, acknowledgment_statement,
ip_address, user_agent, signed_at, checkbox_acknowledged
```

A "Export CSV" button on the Legal & Compliance admin page is a future enhancement (Phase 2 sprint).

---

## Per-Employee Signed Record Summary

`GET /api/admin/onboarding/employees/:employeeId`

Returns:
- All assignments with form + version + signature details
- Signature metadata per completed form (signed_at, signature_text)
- All document uploads with review status and admin notes

This provides a complete compliance record per employee. Admin can screenshot or export this view for legal records.

---

## What Is NOT Implemented (Deferred)

| Feature | Status | Notes |
|---------|--------|-------|
| CSV export button in admin UI | Deferred | JSON export available via API |
| PDF generation of signed records | Deferred | Print-to-PDF from browser is workaround |
| Bulk export (all employees) | Deferred | Export per form or per employee available |
| Scheduled retention expiry | Deferred | Signatures should be retained indefinitely |
| Audit log admin UI | Deferred | Available via SQL query in Supabase |
| Email notification when employee completes onboarding | Deferred | Admin checks progress dashboard |
