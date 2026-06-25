# GPS Consent Gate Report
**Date:** 2026-05-31

## Design Decision

GPS tracking is consent-based. No location data is stored unless the employee has explicitly enabled tracking. Manual status updates (en route, arrived, completed) work regardless of GPS consent.

## Consent Storage

Field: `employees.gps_consent_at` (timestamptz, nullable)
- `NULL` = no consent — GPS not tracked
- Non-null = consent given — GPS snapshots stored during status transitions

When the field is set, the timestamp records when the employee consented. This provides a basic audit trail.

## Employee-Facing Consent Flow (Profile.tsx)

### GPS Status Card (new section in profile)

**When GPS disabled:**
- Gray card with lock icon
- Text: "Enable to allow the system to capture your location during active assignments only. No off-duty tracking."
- Disclosure box (amber): "Location data is captured only during active work assignments. Data is retained for 90 days and visible to management only. You may withdraw consent at any time from this page."
- **IMPORTANT NOTE displayed:** "Disclosure (review required by attorney before production use)"
- Button: "Enable GPS Tracking"

**When GPS enabled:**
- Green card showing enabled date
- Text: "Location will be captured when you update assignment status (en route, arrived, completed)."
- Retention disclosure
- Button: "Disable GPS Tracking" (outline style)

### Toggle behavior:
- Enable: sets `gps_consent_at = now()` on `employees` table via Supabase direct write
- Disable: sets `gps_consent_at = null`
- Both invalidate the `useEmployee` query cache (UI updates immediately)
- Checks browser supports geolocation before enabling (non-blocking failure)

## Server-Side Consent Check

In `employeeAssignments.ts`, GPS snapshot code:
```typescript
const { data: empData } = await db.from("employees")
  .select("gps_consent_at, is_test")
  .eq("id", actor.employeeId)
  .maybeSingle();

if (!empData?.gps_consent_at) return; // no consent — skip GPS
```

The consent check is **server-side**. Client cannot bypass it by manipulating the request. Even if the client sends latitude/longitude in the request body, the server ignores it if `gps_consent_at IS NULL`.

## Dashboard Banner

When `!employee.gps_consent_at`:
- Blue banner: "GPS Tracking Not Enabled — Enable location tracking in your profile to improve route accuracy."
- Link to Profile page

When `employee.gps_consent_at` is set:
- Green banner: "GPS tracking active — location captured during active assignments only."

## Admin Visibility

`GET /api/admin/employees` now returns `gps_consent_at` per employee. Admin can see which employees have consented and when.

## Legal Status

**The consent disclosure text displayed to employees is a placeholder and has NOT been reviewed by an attorney.** The system has been designed to support proper legal text once attorney review is complete. The amber warning box in the employee Profile explicitly states "review required by attorney before production use."

Before GPS tracking is used with real employees in production:
1. Attorney must review and approve the disclosure text
2. The text should be updated to reflect the specific company policy
3. Consider moving consent to the formal onboarding form system (Phase 3 sprint) for proper IP/timestamp audit trail

## Off-Duty Tracking

Off-duty tracking is **disabled by default** and no mechanism exists to enable it. GPS snapshots are only captured when the employee triggers a status update on an assignment. There is no background tracking, no geofence monitoring, and no periodic location collection.

## Withdrawal of Consent

Employee can disable GPS at any time from Profile.tsx. Setting `gps_consent_at = null` immediately stops all future GPS captures. Historical pings are retained per retention policy (not deleted on withdrawal in this implementation — can be added if required).
