# Staging Database Validation Report
**Date:** 2026-06-03
**Method:** Migration file audit + code cross-reference

---

## All Required Migrations

| # | Migration File | Purpose | Status |
|---|---------------|---------|--------|
| 1 | `2025-02-23_initial_schema.sql` | Core schema (profiles, appointments, properties, subscriptions) | Must be applied |
| 2 | `2025-05-20_admin_features_support.sql` | Admin features | Must be applied |
| 3 | `2025-11-10_employee_portal.sql` | employees, shifts, assignments, routes, job_media, job_checklists | Must be applied |
| 4 | `2025-11-15_rls_security_update.sql` | RLS policies | Must be applied |
| 5 | `2025-11-21_add_phone_to_profiles.sql` | profiles.phone | Must be applied |
| 6 | `2025-11-25_tickets_table.sql` | Support tickets | Must be applied |
| 7 | `2025-11-26_contact_inquiries.sql` | Contact form | Must be applied |
| 8 | `2025-11-28_missing_tables.sql` | Missing tables backfill | Must be applied |
| 9 | `2026-05-16_phase1_reliable_availability.sql` | Availability/scheduling | Must be applied |
| 10 | `2026-05-16_phase2_notification_infrastructure.sql` | notification_log table | Must be applied |
| 11 | `2026-05-16_stripe_dual_mode.sql` | Stripe dual mode | Must be applied |
| 12 | `2026-05-17_phase3a_employee_persistence.sql` | assignments lifecycle timestamps | Must be applied |
| 13 | `2026-05-18_phase6b_service_preferences.sql` | service_preferences, first/last name on profiles | Must be applied |
| 14 | `2026-05-23_add_is_onboarded_flag.sql` | **profiles.is_onboarded** | Must be applied |
| 15 | `2026-05-26_parcel_lookup_cache.sql` | **parcel_lookup_cache** | Must be applied |
| 16 | `2026-05-27_add_onboarding_progress.sql` | profiles.onboarding_progress | Must be applied |
| 17 | `2026-05-28_annual_plan_tracking.sql` | Annual plan subscription tracking | Must be applied |
| 18 | `2026-05-28_job_media_storage.sql` | job_media table | Must be applied |
| 19 | `2026-05-28_profiles_card_fields.sql` | profiles card fields | Must be applied |
| 20 | `2026-05-28_property_coordinates.sql` | properties.lat/lng | Must be applied |
| 21 | `2026-05-29_assignment_appointment_uniqueness.sql` | Uniqueness constraint | Must be applied |
| 22 | `2026-05-29_ensure_profile_trigger.sql` | Profile auto-creation trigger | Must be applied |
| 23 | `2026-05-29_notification_type_service_completed.sql` | notification_log types | Must be applied |
| 24 | `2026-05-30_admin_alerts.sql` | **admin_alerts table** | Must be applied |
| 25 | `2026-05-30_notification_phase2_types.sql` | Additional notification types | Must be applied |
| 26 | `2026-05-30_notification_types_communication_sprint.sql` | Communication sprint types | Must be applied |
| 27 | `2026-05-31_employee_location_pings.sql` | **employee_location_pings** + RLS | Must be applied |
| 28 | `2026-05-31_extend_routes.sql` | routes + route_stops schema alignment | Must be applied |
| 29 | `2026-05-31_onboarding_tables.sql` | **onboarding_forms** + 5 related tables | Must be applied |
| 30 | `2026-05-31_route_stops_en_route.sql` | route_stops.status includes en_route | Must be applied |
| 31 | `2026-05-31_worker_type_test_employee.sql` | employees.worker_type, is_test, emergency contacts, gps_consent_at | Must be applied |
| 32 | `2026-06-01_workforce_sprint_a.sql` | **technician_schedule_templates**, **technician_date_overrides**, **technician_capacity_profiles** | Must be applied |

---

## Critical Table Checklist

| Table | Migration | Required For |
|-------|-----------|-------------|
| `profiles` (with `is_onboarded`) | #14 | Onboarding flow, RequireCustomer guard |
| `subscriptions` | #1 | Customer dashboard, active customer count |
| `appointments` | #1 | Scheduling, reminders |
| `properties` (with `lat`, `lng`) | #20 | Parcel lookup, route optimization |
| `notification_log` | #10 | Reminder dedup, notification audit |
| `parcel_lookup_cache` | #15 | Parcel caching |
| `admin_alerts` | #24 | Admin notification system |
| `employee_location_pings` | #27 | GPS tracking |
| `onboarding_forms` + 5 tables | #29 | Employee onboarding system |
| `technician_schedule_templates` | #32 | Workforce scheduling |
| `technician_capacity_profiles` | #32 | Route planner capacity |
| `route_audit_log` | #28 | Route audit trail |
| `employees` (with `worker_type`, `is_test`) | #31 | Employee classification |

---

## Verification Query (Run in Supabase SQL Editor)

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
  'profiles', 'subscriptions', 'appointments', 'properties',
  'notification_log', 'parcel_lookup_cache', 'admin_alerts',
  'employee_location_pings', 'onboarding_forms', 'route_audit_log',
  'technician_schedule_templates', 'technician_date_overrides',
  'technician_capacity_profiles', 'employees', 'assignments', 'routes'
)
ORDER BY table_name;
-- Expected: 16 rows
```

---

## Status

All 32 migrations are idempotent. Run them in numerical order in Supabase SQL Editor. User confirmed several have already been applied in prior sessions.
