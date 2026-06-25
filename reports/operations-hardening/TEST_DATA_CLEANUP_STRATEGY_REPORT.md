# Test Data Cleanup Strategy Report

## The script: `scripts/admin/cleanup-test-data.mjs`

```
node scripts/admin/cleanup-test-data.mjs              # dry run (default) — prints counts, deletes nothing
node scripts/admin/cleanup-test-data.mjs --confirm     # actually deletes
```

Every requirement from this sprint's brief, and how it's met:

| Requirement | How it's met |
|---|---|
| Dry-run by default | `CONFIRM` only becomes true with the literal `--confirm` flag; without it, the script computes and prints every count, writes the same report it would on a live run, and returns before any `DELETE` call |
| Prints counts | Every table's count is printed before any deletion, in both modes |
| Requires `--confirm` to delete | Checked via `process.argv.includes("--confirm")` — no env var, no implicit default |
| Deletes in FK-safe order | Explicit ordering, children before parents (see below) — not relying solely on `ON DELETE CASCADE`, since cascade behavior across 13 migration files is verified-by-reading but not something I'd trust blindly for a destructive script |
| Only deletes records clearly flagged as test data or linked to known test accounts | Two anchors only: `profiles.email LIKE '%@test.com'` and `employees.is_test = true`; everything else is FK-correlated to those, never content-guessed |
| Never deletes real customer data | Verified directly: total vs. test-scoped counts leave exactly 1 real appointment, 3 real properties, 4 real profiles, 0 real employees untouched (see `TEST_DATA_CLEANUP_AUDIT.md`) |
| Produces cleanup report | Writes `reports/operations-hardening/cleanup-runs/cleanup-<timestamp>.md` every run, dry or live, with the full scope and counts |
| Do not run destructive cleanup automatically | This sprint's work ran the script in dry-run mode only, to verify it; **`--confirm` was never invoked** — that's a decision for whoever runs this script deliberately, not something automated here |

## Deletion order

```
employee_location_pings        (employee_id -> test employees)
route_stops                     (route_id -> test routes)
job_media / job_checklists /
  chemicals_logs / signatures   (assignment_id -> test assignments)
assignments                     (id -> test assignments: employee_id OR appointment_id match)
route_audit_log                 (route_id -> test routes)
routes                          (id -> test routes)
shifts                          (employee_id -> test employees)        [time_events cascades]
appointments                    (id -> test appointments)
properties                      (user_id -> test profiles)
```

Children are deleted before parents explicitly, rather than relying purely on the schema's
`ON DELETE CASCADE` constraints (confirmed present on most of these relationships by reading
`db/migrations/2025-11-10_employee_portal.sql` and others — but a destructive script shouldn't bet
correctness on cascade behavior that could drift from the migration files over time without anyone
noticing).

## Deliberate decision: accounts are preserved, not deleted

The script does **not** delete the 43 `is_test=true` employee rows or the 53 `@test.com` profile rows —
only the data those accounts generated (appointments, routes, shifts, pings, etc.).

**Why**: these accounts are reusable fixtures. This session alone reused the same 42 route-generation test
technicians across two separate sprints' worth of benchmarking, and reused the same QA admin account
(`qa-contact-test@test.com`) for verifying every admin-facing feature built this sprint. Deleting and
recreating 40+ employee accounts on every cleanup run would be pure waste, and recreating them risks
re-introducing exactly the kind of subtle setup bug this session already hit twice (a test account
defaulting to the wrong `profiles.role` and landing on the wrong portal on login — see
`GPS_TRACKING_IMPLEMENTATION_REPORT.md`).

If the accounts themselves genuinely need to go (e.g., before a security review, or because the `@test.com`
convention itself is being retired), that's a separate, smaller, and more sensitive operation — delete them
directly via the Supabase dashboard. Deliberately not building that into this script keeps "delete the
fixtures everyone's tests depend on" a manual, separate action, not a flag someone could pass by habit.

## Recommended cadence

Run a dry run after any benchmark/load-test sprint to see how much has accumulated; run `--confirm` when
the counts get large enough that they're cluttering admin list views (the Operations Command Center,
Employee Tracking, ticket/lead lists) — not on a fixed schedule, since how fast test data accumulates
depends entirely on how much benchmarking happens between cleanups, not on calendar time.
