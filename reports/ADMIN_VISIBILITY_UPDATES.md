# ADMIN VISIBILITY UPDATES
## Generated: 2026-05-29
## Phase 9 of the Final Operational Integrity Sprint

---

## Scope

Verified current admin visibility for:
1. Canceled appointments
2. Skipped assignments
3. Past-due customers

Files reviewed:
- `client/pages/admin/Appointments.tsx`
- `client/pages/admin/Customers.tsx`

---

## 1. Canceled Appointments — Admin Appointments Page

**Query used (Appointments.tsx lines 359-363):**
```typescript
const { data, error } = await supabase
  .from("appointments")
  .select("id, user_id, property_id, scheduled_at, scheduled_date, window, window_label, service_area_id, notes, service_type, status, created_at")
  .order("scheduled_at", { ascending: true, nullsFirst: false });
```

**Finding:** The query fetches ALL appointments with NO status filter. Canceled appointments ARE returned by the query.

**Filtering in the UI (lines 443-465):** The `visibleAppointments` memo filters by:
- Date range (`from`, `to`)
- Plan type (`plan`)
- Technician (`techFilter`)
- Free-text search

**No status filter exists.** Canceled appointments are shown alongside active ones. The admin can see them.

**Gap identified:** There is no way to filter the appointment list BY status. Admins cannot easily view ONLY canceled appointments or ONLY active ones. All statuses are mixed together. This is a UX gap, not a data visibility gap.

**Status badges** are rendered via `<StatusBadge>` component (line 742), which presumably shows the status visually. The appointments page does not hide canceled appointments.

---

## 2. Skipped Assignments — Visibility

The admin Appointments page loads assignments to build a technician map (lines 409-417):
```typescript
const { data: assignData } = await supabase
  .from("assignments")
  .select("appointment_id, employee_id")
  .in("appointment_id", appointmentIds);
```

**Finding:** The assignment query has no status filter — it fetches ALL assignments (including `skipped`). However, the map only stores `employee_id` (for technician name display). There is no separate "assignments" view in the admin Appointments page.

**Gap:** There is no dedicated view of assignment statuses for the admin. The admin can see which appointments have assigned technicians, but cannot see which assignments are `skipped` vs. `scheduled`. A dedicated Assignment History view does not exist in the current UI.

---

## 3. Past-Due Customers — Admin Customers Page

**Query in Customers.tsx** fetches subscriptions and resolves customer status:

```typescript
// Lines 88-101:
const priority: Record<string, number> = { active: 3, past_due: 2, canceled: 1 };
// ...
if (s === "past_due") return "paused";  // displayed as "paused" to admin
```

**Filter options available (Customers.tsx line 201):**
```html
<option value="canceled">Canceled</option>
```

**Finding:** The Customers page shows customers with `past_due` subscriptions. They appear with status "paused" (mapped from `past_due`). The page has filter options for `active`, `canceled`, and other statuses.

**Gap:** The filter option shown is `"canceled"`, not `"past_due"`. The mapping `past_due → paused` means admins see "Paused" as the label but `paused` may not be a recognized filter value. Additionally, the filter for `past_due` customers specifically does not appear to be present as a distinct filter option — admins may not be able to easily isolate past-due customers.

---

## Summary of Gaps (No Code Changes Made)

| Visibility Item | Currently Visible? | Filter Available? | Gap |
|----------------|-------------------|-------------------|-----|
| Canceled appointments | YES (mixed with all appointments) | NO status filter | UX gap — no way to filter by status |
| Skipped assignments | Partial (via technician map only) | NO | No dedicated assignment status view |
| Past-due customers | YES (shown as "Paused") | Partial | No explicit "past_due" filter option |

---

## Recommendation (Not Implemented — Out of Scope)

1. Add a status dropdown filter to the admin Appointments page.
2. Add a `"past_due"` filter option to the Customers page (or ensure the "paused" filter matches `past_due` customers).
3. Consider a dedicated Assignments panel showing assignment status per appointment.
