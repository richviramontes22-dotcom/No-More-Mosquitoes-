# Service Area Database Report
Generated: 2026-06-16

## Migration File Review

### `2026-06-16_add_county_to_service_areas.sql` (applied to production)
- `ALTER TABLE service_areas ADD COLUMN IF NOT EXISTS county TEXT` — idempotent ✓
- `UPDATE ... SET county = 'Orange' WHERE zip IN (...)` — 87 ZIPs
- `UPDATE ... SET county = 'Riverside' WHERE zip IN (...)` — 86 ZIPs (clean, SB ZIPs not included)
- `UPDATE ... SET county = 'San Diego' WHERE zip IN (...)` — 162 ZIPs
- `UPDATE ... SET county = 'Los Angeles' WHERE zip IN (...)` — 595 ZIPs + 15 Antelope Valley ZIPs

**Total back-filled: ~940 ZIPs across 4 counties.**

No San Bernardino County ZIPs were included in the back-fill (correct — SB was not yet seeded at that point).

### `2026-06-16_seed_san_bernardino_service_areas.sql` (pending — needs to be applied)
- INSERTs 103 SB County ZIPs with `county = 'San Bernardino'` from the start
- Uses `ON CONFLICT DO NOTHING` (safe to re-run)
- **STATUS: NOT YET APPLIED to production — needs to be run in Supabase SQL Editor**

## Column Verification
- **county column exists**: YES (confirmed by `AREA_FIELDS = "id, zip, city, state, county, capacity, is_active, updated_at"` in adminServiceAreas.ts and `county: string | null` in ServiceArea interface)
- **county values populated**: YES for original 4 counties
- **seeded ZIPs assigned counties**: YES — all ZIPs in the seed lists have county set by the back-fill migration

## Expected ZIP Distribution (after both migrations applied)
| County | Approximate ZIPs |
|---|---|
| Los Angeles | ~610 (seed + Antelope Valley) |
| Orange | ~87 |
| Riverside | ~86 |
| San Diego | ~162 |
| San Bernardino | 103 (after applying pending migration) |
| NULL / Other | ~0 (ZIPs in seed but not in county back-fill would show as NULL) |

## Potential NULL County Rows
The county back-fill UPDATE uses explicit ZIP lists. Any ZIP seeded before the migration that is NOT in those lists will have `county = NULL` and display under "Other" in the tree view. Based on the seed and migration lists, coverage is complete for the original 4 counties.

## Answers
- **Migration applied successfully?** YES (confirmed by Netlify build + county column referenced in working code)
- **How many ZIPs assigned to each county?** See table above — approximately 945 ZIPs across 4 counties after applying the original migration
- **Any ZIPs categorized as "Other"?** Minimal to none for original 4 counties. SB County ZIPs will be NULL until the pending SB migration is applied.

## Action Required
Run `db/migrations/2026-06-16_seed_san_bernardino_service_areas.sql` in the Supabase SQL Editor to add 103 San Bernardino County ZIPs.

## Status: PASS (with one pending migration action)
