# ADMIN ACTION AUDIT
## Generated: 2026-05-29
## Scope: Every clickable action in the admin interface

---

## Overview Page (`client/pages/admin/Overview.tsx`)

| Action Name | Location | What It Does | Client Implementation | Server Route | DB Effect | Success State | Error Handling | Status |
|-------------|----------|-------------|----------------------|--------------|-----------|---------------|----------------|--------|
| "Go to Appointments →" badge link | Needs-Scheduling alert | Navigates to /admin/appointments | React Router `<Link>` | None | None | Navigation | None | Working |
| "Schedule" button (per subscription row) | Needs-Scheduling alert | Opens schedule dialog for that subscription | Opens `schedulingTarget` state dialog | None | None | Dialog opens | None | Working |
| "Go to Billing →" badge link | Past-Due alert | Navigates to /admin/billing | React Router `<Link>` | None | None | Navigation | None | Working |
| "Create Appointment" button (dialog) | Schedule dialog | Creates appointment for subscription customer | `adminApi("/api/admin/appointments", "POST", {...})` | `POST /api/admin/appointments` | Inserts into `appointments` | Toast: "Appointment created" | Toast: destructive variant | Working |
| "Cancel" button (dialog) | Schedule dialog | Closes the dialog | Sets `schedulingTarget(null)` | None | None | Dialog closes | None | Working |

---

## Customers Page (`client/pages/admin/Customers.tsx`)

| Action Name | Location | What It Does | Client Implementation | Server Route | DB Effect | Success State | Error Handling | Status |
|-------------|----------|-------------|----------------------|--------------|-----------|---------------|----------------|--------|
| Search input | Customer list | Filters by name/email/phone | Client-side filter on `customers` state | None | None | List filters | None | Working |
| Status dropdown filter | Customer list | Filters by active/paused/canceled | Client-side filter | None | None | List filters | None | Working |
| "Add Customer" button | Header | Opens new customer dialog | Opens `<Dialog>` | None | None | Dialog opens | None | Working |
| "Initialize Account" button (dialog) | New Customer dialog | Invites customer via email | `fetch("/api/admin/customers/invite", POST)` | `POST /api/admin/customers/invite` | Supabase auth invite + `profiles` upsert | Toast: "Invite Sent" | Toast: destructive, "Invite Failed" | Working |
| "View Details →" button | Customer table row | Opens customer detail sheet | Opens `<Sheet>` with `CustomerDetailsSheet` | None | None | Sheet opens | None | Working |
| "View Appointments" button (activity tab) | Customer detail sheet | Navigates to /admin/appointments | `<a href="/admin/appointments">` | None | None | Navigation | None | Working (nav only, no filter) |
| "View Messages" button (activity tab) | Customer detail sheet | Navigates to /admin/messages | `<a href="/admin/messages">` | None | None | Navigation | None | Working (nav only) |
| "View Tickets" button (activity tab) | Customer detail sheet | Navigates to /admin/tickets | `<a href="/admin/tickets">` | None | None | Navigation | None | Working (nav only) |
| "View Billing & Orders" button (finance tab) | Customer detail sheet | Navigates to /admin/billing | `<a href="/admin/billing">` | None | None | Navigation | None | Working (nav only) |
| "View Revenue Analytics" button (finance tab) | Customer detail sheet | Navigates to /admin/revenue | `<a href="/admin/revenue">` | None | None | Navigation | None | Working (nav only) |

**FLAG:** The Activity and Finance tabs in CustomerDetailsSheet show `AdminEmptyState` — they do NOT filter to the specific customer. A developer clicking "View Appointments" gets the full appointments list, not just that customer's appointments.

---

## Properties Page (`client/pages/admin/Properties.tsx`)

| Action Name | Location | What It Does | Client Implementation | Server Route | DB Effect | Success State | Error Handling | Status |
|-------------|----------|-------------|----------------------|--------------|-----------|---------------|----------------|--------|
| Search input | Property list | Filters by address/customer name | Client-side filter | None | None | List filters | None | Working |
| "Add Property" button | Header | Opens new property dialog | Opens `<Dialog>` | None | None | Dialog opens | None | Working |
| "Add Property" submit (dialog) | Add Property dialog | Creates property record | Direct Supabase insert to `properties` | None | Inserts `properties` row | Toast success | Toast error | Working |
| "Delete" trash button | Property row | Deletes property | Direct Supabase delete from `properties` | None | Deletes `properties` row | Row removed | Toast error | Working |

---

## Appointments Page (`client/pages/admin/Appointments.tsx`)

| Action Name | Location | What It Does | Client Implementation | Server Route | DB Effect | Success State | Error Handling | Status |
|-------------|----------|-------------|----------------------|--------------|-----------|---------------|----------------|--------|
| Search input | Filter bar | Filters by customer name/address | Client-side filter | None | None | Table filters | None | Working |
| Plan type dropdown | Filter bar | Filters by subscription/one_time | Client-side filter | None | None | Table filters | None | Working |
| Technician dropdown filter | Filter bar | Filters by technician name | Client-side filter | None | None | Table filters | None | Working |
| City/ZIP input | Filter bar | Filters by property city or ZIP | Client-side filter | None | None | Table filters | None | Working |
| Date-from input | Filter bar | Filters by start date | Client-side filter | None | None | Table filters | None | Working |
| Date-to input | Filter bar | Filters by end date | Client-side filter | None | None | Table filters | None | Working |
| "Clear" filter button | Filter bar | Resets all filters | Sets all filter states to defaults | None | None | Filters reset | None | Working |
| Select-all checkbox | Table header | Selects/deselects all visible rows | Updates `selectedIds` Set | None | None | Checkboxes toggle | None | Working |
| Row checkbox | Table row | Selects/deselects individual row | Updates `selectedIds` Set | None | None | Checkbox toggles | None | Working |
| Technician assign dropdown | Bulk action bar | Selects technician for bulk assign | Updates `assignTech` state | None | None | Dropdown updates | None | Working |
| "Apply" (assign) button | Bulk action bar | Assigns selected appointments to technician | `adminApi("/api/admin/assignments", "POST", {...})` | `POST /api/admin/assignments` | Upserts `assignments` rows, emails employee | Toast: "Assigned" | Toast: "Assignment Failed" | Working |
| "Modify" (context menu) | Per-row action menu | Opens reschedule dialog | Sets `editing` state | None | None | Dialog opens | None | Working |
| "Dispatch" (context menu) | Per-row action menu | Marks en_route, sends SMS | `adminApi("/api/admin/appointments/:id/dispatch", "POST")` | `POST /api/admin/appointments/:id/dispatch` | Updates `appointments.status`, upserts `assignments` | Toast with SMS status | Toast: "Dispatch Failed" | Working |
| "Cancel" (context menu) | Per-row action menu | Shows cancel confirm dialog | Sets `cancelConfirmId` state | None | None | Dialog opens | None | Working |
| "Yes, Cancel" button (dialog) | Cancel dialog | Cancels appointment, emails customer | `adminApi("/api/admin/appointments/:id/cancel", "PATCH")` | `PATCH /api/admin/appointments/:id/cancel` | Updates `appointments.status` to canceled | Toast: "Appointment Canceled" | Toast: "Cancel Failed" | Working |
| "Keep" button (dialog) | Cancel dialog | Dismisses without canceling | Sets `cancelConfirmId(null)` | None | None | Dialog closes | None | Working |
| "Update Appointment" (reschedule dialog) | Reschedule dialog | Updates date/time | Direct Supabase update to `appointments` | None | Updates `appointments.scheduled_date`, `scheduled_at`, `notes` | Toast: "Appointment Updated" | Toast: "Update Failed" | Working |
| Refresh button (scheduling queue) | Scheduling Queue Panel | Reloads queue | Re-calls adminApi | `GET /api/admin/subscriptions/needs-scheduling` | None | Queue reloads | Error state shown | Working |
| "Schedule" link (queue row) | Scheduling Queue Panel | Links to /admin/appointments?userId=... | React Router `<Link>` | None | None | Navigation | None | Working |
| "Add" button (blackout dates) | Blackout Dates Panel | Opens add-date form | Toggles `isAdding` state | None | None | Form appears | None | Working |
| "Block Date" button | Blackout Dates Panel | Creates blackout date | `adminApi("/api/admin/blackout-dates", "POST", {...})` | `POST /api/admin/blackout-dates` | Inserts `blackout_dates` row | Toast with affected appointment count | Toast: destructive | Working |
| Delete (trash) button per blackout date | Blackout Dates Panel | Removes blackout date | `adminApi("/api/admin/blackout-dates/:id", "DELETE")` | `DELETE /api/admin/blackout-dates/:id` | Deletes `blackout_dates` row | Row removed, toast | Toast: destructive | Working |

---

## Visits Page (`client/pages/admin/Visits.tsx`)

| Action Name | Location | What It Does | Client Implementation | Server Route | DB Effect | Success State | Error Handling | Status |
|-------------|----------|-------------|----------------------|--------------|-----------|---------------|----------------|--------|
| Date range inputs | Filter bar | Filters visits by date range | Client-side filter | None | None | List filters | None | Working |
| Technician dropdown | Filter bar | Filters by technician name | Client-side filter | None | None | List filters | None | Working |
| Play button (video) | Visit row | Opens video URL in new tab | `window.open(video_url)` | None | None | New tab | None | Working (if video_url exists) |

---

## Tickets Page (`client/pages/admin/Tickets.tsx`)

| Action Name | Location | What It Does | Client Implementation | Server Route | DB Effect | Success State | Error Handling | Status |
|-------------|----------|-------------|----------------------|--------------|-----------|---------------|----------------|--------|
| Status column move (Kanban) | Ticket card | Updates ticket status | Direct Supabase update to `tickets` | None | Updates `tickets.status` | Card moves column | Console.error only | Working |
| Priority badge | Ticket card | Visual indicator only | Display only | None | None | None | None | Display only |

**FLAG:** Tickets page has no:
- Create ticket from admin button
- Reply to customer button
- Assign ticket to staff member button
- Filter/search across all tickets
- Any error toast for failed status updates (only console.error)

---

## Employees Page (`client/pages/admin/Employees.tsx`)

| Action Name | Location | What It Does | Client Implementation | Server Route | DB Effect | Success State | Error Handling | Status |
|-------------|----------|-------------|----------------------|--------------|-----------|---------------|----------------|--------|
| "Invite Employee" button | Header | Opens invite dialog | Opens invite dialog state | None | None | Dialog opens | None | Working |
| "Send Invite" button (dialog) | Invite dialog | Invites employee via email | `adminApi("/api/admin/employees/invite", "POST", {...})` | `POST /api/admin/employees/invite` | Supabase auth invite + `profiles` + `employees` inserts | Toast: success message | Toast: destructive | Working |
| Edit (pencil) button | Employee row | Opens edit dialog | Sets `editTarget` state | None | None | Dialog opens | None | Working |
| "Save Changes" button (edit dialog) | Edit dialog | Updates employee record | `adminApi("/api/admin/employees/:id", "PATCH", {...})` | `PATCH /api/admin/employees/:id` | Updates `employees` row | Toast: success | Toast: destructive | Working |
| Activate/Deactivate toggle button | Employee row | Toggles employee status | `adminApi("/api/admin/employees/:id", "PATCH", {status})` | `PATCH /api/admin/employees/:id` | Updates `employees.status` | Toast + UI update | Toast: destructive | Working |

---

## Billing Page (`client/pages/admin/Billing.tsx`)

| Action Name | Location | What It Does | Client Implementation | Server Route | DB Effect | Success State | Error Handling | Status |
|-------------|----------|-------------|----------------------|--------------|-----------|---------------|----------------|--------|
| "Stripe Dashboard" button | Header | Opens Stripe in new tab | `<a href="https://dashboard.stripe.com" target="_blank">` | None | None | New tab | None | Working |
| Status filter (payments) | Payment filter bar | Filters payments by status | Client-side filter | None | None | List filters | None | Working |
| Search query (payments) | Payment filter bar | Filters by customer name/email | Client-side filter | None | None | List filters | None | Working |
| Timeline source filter | Timeline filter | Filters by subscription/marketplace | Client-side filter | None | None | List filters | None | Working |
| Timeline search | Timeline filter | Searches by name/email/confirmation | Client-side filter | None | None | List filters | None | Working |
| "View" eye button (marketplace order) | Billing timeline/orders table | Opens order detail dialog | `adminApi("/api/admin/marketplace/orders/:id")` | `GET /api/admin/marketplace/orders/:id` | None (read) | Dialog with order+items | Toast: destructive | Working |
| Fulfillment status dropdown (order detail) | Order detail dialog | Changes fulfillment status | `adminApi("/api/admin/marketplace/orders/:id/fulfillment", "PATCH")` | `PATCH /api/admin/marketplace/orders/:id/fulfillment` | Updates `marketplace_orders.fulfillment_status` | Toast: "Fulfillment status updated" | Toast: "Update failed" | Working |

**FLAG:** No refund capability. No subscription cancellation. No payment retry. No invoice download.

---

## Revenue Page (`client/pages/admin/Revenue.tsx`)

| Action Name | Location | What It Does | Client Implementation | Server Route | DB Effect | Success State | Error Handling | Status |
|-------------|----------|-------------|----------------------|--------------|-----------|---------------|----------------|--------|
| "Stripe Dashboard" button | Header | Opens Stripe dashboard | `<a>` external link | None | None | New tab | None | Working |
| Revenue chart | Main content | Visual display only | Recharts `<AreaChart>` | None | None | Chart renders | Falls back to empty | Display only |
| Invoice table | Main content | Read-only invoice list with link | External Stripe `hosted_invoice_url` links | None | None | New tab to Stripe | None | Display only |

**FLAG:** All trend percentages (+8.4%, +12.1%) are hardcoded strings in JSX, not calculated values.

---

## Service Areas Page (`client/pages/admin/ServiceAreas.tsx`)

| Action Name | Location | What It Does | Client Implementation | Server Route | DB Effect | Success State | Error Handling | Status |
|-------------|----------|-------------|----------------------|--------------|-----------|---------------|----------------|--------|
| "Add ZIP" button | Header form | Adds service ZIP code | `adminApi("/api/admin/service-areas", "POST", {...})` | `POST /api/admin/service-areas` | Inserts `service_areas` row | Toast + list refresh | Toast: destructive | Working |
| Active/Inactive toggle | Per-ZIP row | Toggles service area availability | `adminApi("/api/admin/service-areas/:id", "PATCH", {...})` | `PATCH /api/admin/service-areas/:id` | Updates `service_areas.is_active` | Toast + UI update | Toast: destructive | Working |
| Delete (trash) button | Per-ZIP row | Removes service area (if API supports) | TBD | `DELETE /api/admin/service-areas/:id` (if exists) | Deletes `service_areas` row | TBD | TBD | Unknown |

---

## Promos Page (`client/pages/admin/Promos.tsx`)

| Action Name | Location | What It Does | Client Implementation | Server Route | DB Effect | Success State | Error Handling | Status |
|-------------|----------|-------------|----------------------|--------------|-----------|---------------|----------------|--------|
| "New Code" button (codes tab) | Promo codes tab | Opens create code dialog | Opens dialog | None | None | Dialog opens | None | Working |
| "Create Code" button (dialog) | Create code dialog | Creates promo code | `adminFetch("/api/admin/promos/codes", "POST", {...})` | `POST /api/admin/promos/codes` | Inserts `promo_codes` row | Toast + list refresh | Toast: destructive | Working |
| Active toggle per code | Code row | Toggles code active/inactive | `adminFetch("/api/admin/promos/codes/:id", "PATCH", {...})` | `PATCH /api/admin/promos/codes/:id` | Updates `promo_codes.active` | Row updates | Toast: destructive | Working |
| Delete per code | Code row | Deletes code | `adminFetch("/api/admin/promos/codes/:id", "DELETE")` | `DELETE /api/admin/promos/codes/:id` | Deletes `promo_codes` row | Row removed | Toast: destructive | Working |
| "New Campaign" button | Campaigns tab | Opens create campaign dialog | Opens dialog | None | None | Dialog opens | None | Working |
| "Create Campaign" button | Campaign dialog | Creates campaign | `adminFetch("/api/admin/promos/campaigns", "POST", {...})` | `POST /api/admin/promos/campaigns` | Inserts `campaigns` row | Toast + refresh | Toast: destructive | Working |
| Campaign active toggle | Campaign row | Toggles campaign active | `adminFetch` PATCH | `PATCH /api/admin/promos/campaigns/:id` | Updates `campaigns.active` | Row updates | Toast: destructive | Working |

---

## Reports Page (`client/pages/admin/Reports.tsx`)

| Action Name | Location | What It Does | Client Implementation | Server Route | DB Effect | Success State | Error Handling | Status |
|-------------|----------|-------------|----------------------|--------------|-----------|---------------|----------------|--------|
| "Export customers" | Reports grid | Downloads customers CSV | Direct Supabase query → `downloadCsv()` | None | None | CSV file download | Toast: "Export failed" | Working |
| "Export properties" | Reports grid | Downloads properties CSV | Direct Supabase query → `downloadCsv()` | None | None | CSV file download | Toast: "Export failed" | Working |
| "Export appointments" | Reports grid | Downloads appointments CSV | Direct Supabase query → `downloadCsv()` | None | None | CSV file download | Toast: "Export failed" | Working |
| "Export tickets" | Reports grid | Downloads tickets CSV | Direct Supabase query → `downloadCsv()` | None | None | CSV file download | Toast: "Export failed" | Working |
| "Export subscriptions" | Reports grid | Downloads subscriptions CSV | Direct Supabase query → `downloadCsv()` | None | None | CSV file download | Toast: "Export failed" | Working |

---

## Business Hours Page (`client/pages/admin/BusinessHours.tsx`)

| Action Name | Location | What It Does | Client Implementation | Server Route | DB Effect | Success State | Error Handling | Status |
|-------------|----------|-------------|----------------------|--------------|-----------|---------------|----------------|--------|
| Operational toggle per day | Day row | Toggles day as operational/closed | `adminApi("/api/admin/business-hours/:id", "PATCH", {is_operational})` | `PATCH /api/admin/business-hours/:id` | Updates `business_hours.is_operational` | Toast + row updates | Toast: destructive | Working |
| Refresh button | Page header | Reloads business hours | Re-calls `fetchHours()` | `GET /api/admin/business-hours` | None | Table refreshes | Error shown | Working |

**FLAG:** No ability to edit window times (start/end), window labels, or max_jobs_per_tech from the UI. These values are locked at their seeded defaults.

---

## Notifications Page (`client/pages/admin/Notifications.tsx`)

| Action Name | Location | What It Does | Client Implementation | Server Route | DB Effect | Success State | Error Handling | Status |
|-------------|----------|-------------|----------------------|--------------|-----------|---------------|----------------|--------|
| Status filter dropdown | Filter bar | Filters log by status | Client-side filter | None | None | List filters | None | Working |
| Type filter dropdown | Filter bar | Filters by notification type | Client-side filter | None | None | List filters | None | Working |
| Refresh button | Page header | Reloads notification log | Re-calls `fetchLogs()` | `GET /api/admin/notifications` | None | Table refreshes | Error state | Working |

**FLAG:** No "Resend" action on failed notifications.

---

## Settings Page (`client/pages/admin/Settings.tsx`)

| Action Name | Location | What It Does | Client Implementation | Server Route | DB Effect | Success State | Error Handling | Status |
|-------------|----------|-------------|----------------------|--------------|-----------|---------------|----------------|--------|
| "Add Team Member" button | Team section | Adds admin/support user to team | Updates local state → calls `saveSettings` | `POST /api/admin/settings` | Saves to settings store | Toast success | Toast: destructive | Working |
| "Remove" button per team member | Team section | Removes team member | Updates local state → calls `saveSettings` | `POST /api/admin/settings` | Saves to settings store | Toast success | Toast: destructive | Working |
| Feature flag toggles | Flags section | Toggles operational behaviors | Updates local state | None until "Save" | None until saved | None (no save button visible?) | None | Unknown |
| "Save Settings" button | Settings footer | Persists all settings | `saveSettings(...)` | `POST /api/admin/settings` | Writes to settings store | Toast: "Settings Saved" | Toast: destructive | Working |

**FLAG:** Integration fields (Stripe secret key, SendGrid API key, Twilio tokens) appear as editable inputs. If these are written to the database, that is a critical security concern — secret keys must never be stored in the application database.

---

## Summary of Dead/Placeholder/Broken Buttons

| Button | Page | Issue |
|--------|------|-------|
| "View Appointments" (customer activity tab) | Customers | Links to all appointments, not customer-specific |
| "View Messages" (customer activity tab) | Customers | Links to all messages, not customer-specific |
| "View Tickets" (customer activity tab) | Customers | Links to all tickets, not customer-specific |
| Any cancel/reply in Tickets | Tickets | No reply or detailed action capability |
| Status update error feedback | Tickets | No toast on Supabase update error |
| Revenue trend percentages | Revenue | Hardcoded "+8.4%" and "+12.1%" |
| Business Hours window editing | Business Hours | Cannot edit times/labels from UI |
| "Resend" failed notification | Notifications | No resend capability |
| Employee map | Employee Tracking | Always shows null location (GPS not implemented) |
| Integration key fields | Settings | Security risk if keys stored in DB |
