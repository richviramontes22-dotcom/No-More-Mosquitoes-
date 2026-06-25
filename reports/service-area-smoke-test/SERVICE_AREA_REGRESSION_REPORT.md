# Service Area Regression Report
Generated: 2026-06-16

## Validation Run Results
| Command | Result |
|---|---|
| `pnpm typecheck` | **PASS** — 0 errors, 0 warnings |
| `pnpm test` | **PASS** — 7 files, 68 tests, 0 failures |
| `pnpm build` | **PASS** — client 28.98s, server 2.53s, 0 errors |

## Regression Targets

### Quote Widget
- `parcelQuote.ts` untouched ✓
- `countyDetector.ts` updated: SB ZIPs moved from Riverside → SB, fixing misrouting (improvement, not regression)
- Riverside-only ZIPs (Coachella, Moreno Valley, Temecula etc.) remain in Riverside section ✓
- `ADAPTER_MAP` now has 5 entries instead of 4 — no existing adapter removed or replaced ✓

### Address Checker (`/api/service-areas/check`)
- Endpoint code unchanged ✓
- Route still double-mounted (`/api/admin` + `/api`) ✓
- Filters by `is_active = true` — correct ✓

### Google Autocomplete
- `client/lib/googleMapsLoader.ts` untouched ✓
- `GoogleAddressAutocomplete` component untouched ✓
- `spec.ts` passes (5 tests) ✓

### Acreage Lookup (county adapters)
- `OrangeCountyAdapter` — untouched ✓
- `RiversideCountyAdapter` — untouched ✓
- `SanDiegoCountyAdapter` — untouched ✓
- `LosAngelesCountyAdapter` — untouched ✓
- `SanBernardinoCountyAdapter` — new, additive only ✓
- `parcelLookupService.ts` — only added one entry to `ADAPTER_MAP` ✓
- Cache and geocoding paths unchanged ✓

### Manual Acreage Flow
- `MANUAL_REVIEW_REQUIRED` error path in `parcelLookupService.ts` unchanged ✓
- `parcelQuote.ts` manual-review handler untouched ✓

### Schedule Requests
- `server/routes/schedule.ts` untouched ✓
- `shared/api.ts` untouched ✓

### Waitlist
- `server/routes/waitlist.ts` untouched ✓
- `leadService.upsertLeadFromWaitlist()` untouched ✓

### Admin Leads
- `server/routes/adminLeads.ts` untouched ✓
- `client/pages/admin/Leads.tsx` untouched ✓
- `client/pages/admin/LeadDetail.tsx` untouched ✓

### Lead Notes
- `leadService.addNote()` untouched ✓
- `POST /api/admin/leads/:id/notes` untouched ✓

### Lead Status Changes
- `leadService.changeStatus()` untouched ✓
- `ADMIN_VALID_STATUSES` list untouched ✓

### Service Area Demand Endpoint
- `adminServiceAreaDemand.ts` untouched ✓
- `service_area_demand_events` table access unchanged ✓

## Test Coverage
```
✓ server/services/parcel/reverseGeocodeCache.spec.ts  (6 tests)
✓ server/services/parcel/googleAddressService.spec.ts (7 tests)
✓ client/lib/utils.spec.ts                            (5 tests)
✓ client/lib/pricing.spec.ts                          (8 tests)
✓ server/services/leads/leadService.spec.ts           (31 tests)  ← CRM Phase 2 core
✓ client/components/common/GoogleAddressAutocomplete.spec.ts (5 tests)
✓ server/services/parcel/cache.spec.ts                (6 tests)
```
leadService.spec.ts (31 tests) covers dedup logic, out-of-area handling, status transitions — all pass ✓

## Build Warnings (pre-existing, not introduced by this change)
The Vite server build emits warnings about `server/lib/supabase.ts` being both dynamically and statically imported. These are pre-existing warnings unrelated to the service areas work and do not affect functionality.

## Regressions Found
**NONE**

## Status: PASS — No Regressions
