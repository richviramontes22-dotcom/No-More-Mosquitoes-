# Test Data Cleanup Audit

## How much test data actually exists right now

Accumulated across this sprint's route-generation benchmark (Phase 2: 225 properties/appointments across
three dates) and the prior Operations Validation sprint (42 test technicians plus ~217 properties/
appointments and 100+ routes), plus this sprint's one disposable GPS test technician:

| Table | Test rows | Total rows | Real rows |
|---|---|---|---|
| `profiles` | 53 (`@test.com`) | 57 | 4 |
| `employees` | 43 (`is_test=true`) | 43 | 0 |
| `properties` | 462 | 465 | 3 |
| `appointments` | 462 | 463 | 1 |
| `routes` | 218 | — | — |
| `assignments` | 456 | — | — |
| `route_stops` | 449 | — | — |
| `route_audit_log` | 75 | — | — |
| `shifts` | 3 | — | — |
| `employee_location_pings` | 2 | — | — |
| `job_media` | 5 | — | — |
| `job_checklists` / `chemicals_logs` / `signatures` | 0 each | — | — |

Test data is the overwhelming majority of rows in every customer/scheduling table — there are currently
**zero real employees** in the system at all (consistent with this being a pre-launch/early platform; every
employee row that exists was created as a QA fixture across this session's sprints). `routes` /
`assignments` / `route_stops` / `route_audit_log` have no real rows to compare against since route
generation never produced a single real row until this sprint's FK fix.

## How test data is identified — strictly, not heuristically

- **`profiles.email LIKE '%@test.com'`** — the same convention the dev-only
  `/api/dev/create-test-account` endpoint enforces at creation time. Every test account created across
  every sprint in this project has used this convention; nothing else does.
- **`employees.is_test = true`** — an explicit boolean column that already existed in the schema for
  exactly this purpose, set at creation time for every QA technician fixture.
- Everything else (`properties`, `appointments`, `routes`, `assignments`, `route_stops`,
  `route_audit_log`, `shifts`, `employee_location_pings`, `job_media`, `job_checklists`,
  `chemicals_logs`, `signatures`) is scoped by **foreign-key correlation** to one of the two anchors
  above — never by guessing from content (e.g., never "addresses containing 'Test'" or "low acreage
  values"), which is what keeps real data categorically out of scope rather than merely unlikely to match.

## What's confirmed safe vs. what would need judgment

**Safe (this audit + the dry run confirm it)**: deleting everything FK-correlated to the 53 test profiles
and 43 test employees. The dry run's counts (462/463 appointments, 462/465 properties) leave exactly the
real rows — 1 real appointment, 3 real properties, 4 real profiles, 0 real employees — completely untouched
by every `.in()` filter the script builds, because none of their IDs appear in the test-profile/
test-employee ID lists.

**A judgment call, not just a query**: whether to delete the test *accounts* (the 43 employee rows, 53
profile rows) themselves, not just the data they generated. See `TEST_DATA_CLEANUP_STRATEGY_REPORT.md` for
the reasoning — the script deliberately does not do this.
