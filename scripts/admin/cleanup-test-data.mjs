#!/usr/bin/env node
/**
 * Test data cleanup script.
 *
 * Deletes test data accumulated by QA/benchmark runs — never real customer
 * data. "Test data" is scoped strictly to:
 *   - appointments/properties owned by a profile whose email ends in
 *     "@test.com" (the same convention the dev-only
 *     /api/dev/create-test-account endpoint enforces at creation time)
 *   - shifts/assignments/routes/route_stops/location pings tied to an
 *     employee row flagged is_test = true
 *
 * Deliberately does NOT delete the test employees/profiles themselves
 * (the account fixtures) — only the data those accounts generated. The
 * accounts are reusable fixtures for future QA runs; recreating 40+ of them
 * from scratch every cleanup would be wasteful and risks recreating the
 * exact role/constraint bugs already found and fixed once this session. If
 * you genuinely want the accounts gone too, delete them directly via the
 * Supabase dashboard — this script intentionally does not offer that as a
 * flag, to keep "the dangerous part" a deliberate, separate, manual action.
 *
 * Usage:
 *   node scripts/admin/cleanup-test-data.mjs              # dry run (default)
 *   node scripts/admin/cleanup-test-data.mjs --confirm    # actually deletes
 */
import "dotenv/config";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CONFIRM = process.argv.includes("--confirm");

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.");
  process.exit(1);
}

async function rest(path, init = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path} -> ${res.status} ${await res.text()}`);
  if (res.status === 204) return null;
  return res.json();
}

async function countRows(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Prefer: "count=exact", Range: "0-0" },
  });
  const range = res.headers.get("content-range");
  return range ? parseInt(range.split("/")[1], 10) || 0 : 0;
}

// Chunked .in() filters — defensive against URL-length limits at the
// few-hundred-row scale this codebase's test data currently reaches.
function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
function inList(ids) {
  return `(${ids.map((id) => `"${id}"`).join(",")})`;
}
async function countWhereIn(table, column, ids) {
  if (ids.length === 0) return 0;
  let total = 0;
  for (const part of chunk(ids, 150)) {
    total += await countRows(`${table}?select=id&${column}=in.${inList(part)}`);
  }
  return total;
}
async function deleteWhereIn(table, column, ids) {
  if (ids.length === 0) return 0;
  let total = 0;
  for (const part of chunk(ids, 150)) {
    const before = await countRows(`${table}?select=id&${column}=in.${inList(part)}`);
    if (before === 0) continue;
    await rest(`${table}?${column}=in.${inList(part)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
    total += before;
  }
  return total;
}

async function main() {
  console.log(`Test data cleanup — ${CONFIRM ? "LIVE RUN (will delete)" : "DRY RUN (no changes)"}\n`);

  // ── Scope discovery ──
  const testProfiles = await rest("profiles?select=id,email&email=like.*%40test.com");
  const testProfileIds = testProfiles.map((p) => p.id);

  const testEmployees = await rest("employees?select=id,user_id&is_test=eq.true");
  const testEmployeeIds = testEmployees.map((e) => e.id);

  const testAppointments = testProfileIds.length
    ? await rest(`appointments?select=id&user_id=in.${inList(testProfileIds)}`)
    : [];
  const testAppointmentIds = testAppointments.map((a) => a.id);

  const testRoutes = testEmployeeIds.length
    ? await rest(`routes?select=id&employee_id=in.${inList(testEmployeeIds)}`)
    : [];
  const testRouteIds = testRoutes.map((r) => r.id);

  // Assignments in scope: tied to a test employee OR a test-owned appointment.
  const assignByEmployee = testEmployeeIds.length
    ? await rest(`assignments?select=id&employee_id=in.${inList(testEmployeeIds)}`)
    : [];
  const assignByAppt = testAppointmentIds.length
    ? (await Promise.all(chunk(testAppointmentIds, 150).map((part) =>
        rest(`assignments?select=id&appointment_id=in.${inList(part)}`)
      ))).flat()
    : [];
  const testAssignmentIds = [...new Set([...assignByEmployee, ...assignByAppt].map((a) => a.id))];

  // ── Counts (always shown, dry-run or live) ──
  const counts = {
    test_profiles: testProfileIds.length,
    test_employees: testEmployeeIds.length,
    appointments: testAppointmentIds.length,
    properties: testProfileIds.length ? await countWhereIn("properties", "user_id", testProfileIds) : 0,
    routes: testRouteIds.length,
    assignments: testAssignmentIds.length,
    route_stops: testRouteIds.length ? await countWhereIn("route_stops", "route_id", testRouteIds) : 0,
    route_audit_log: testRouteIds.length ? await countWhereIn("route_audit_log", "route_id", testRouteIds) : 0,
    shifts: testEmployeeIds.length ? await countWhereIn("shifts", "employee_id", testEmployeeIds) : 0,
    employee_location_pings: testEmployeeIds.length ? await countWhereIn("employee_location_pings", "employee_id", testEmployeeIds) : 0,
    job_media: testAssignmentIds.length ? await countWhereIn("job_media", "assignment_id", testAssignmentIds) : 0,
    job_checklists: testAssignmentIds.length ? await countWhereIn("job_checklists", "assignment_id", testAssignmentIds) : 0,
    chemicals_logs: testAssignmentIds.length ? await countWhereIn("chemicals_logs", "assignment_id", testAssignmentIds) : 0,
    signatures: testAssignmentIds.length ? await countWhereIn("signatures", "assignment_id", testAssignmentIds) : 0,
  };

  console.log("Scope (NOT deleted — accounts are preserved as reusable fixtures):");
  console.log(`  Test profiles (@test.com): ${counts.test_profiles}`);
  console.log(`  Test employees (is_test=true): ${counts.test_employees}\n`);
  console.log("Rows to delete:");
  for (const [table, n] of Object.entries(counts)) {
    if (table === "test_profiles" || table === "test_employees") continue;
    console.log(`  ${table}: ${n}`);
  }
  console.log("");

  if (!CONFIRM) {
    console.log("Dry run only — no rows were deleted. Re-run with --confirm to delete.");
    writeReport(counts, false);
    return;
  }

  console.log("Deleting in FK-safe order (children before parents)...\n");

  const deleted = {};
  deleted.employee_location_pings = await deleteWhereIn("employee_location_pings", "employee_id", testEmployeeIds);
  deleted.route_stops = await deleteWhereIn("route_stops", "route_id", testRouteIds);
  deleted.job_media = await deleteWhereIn("job_media", "assignment_id", testAssignmentIds);
  deleted.job_checklists = await deleteWhereIn("job_checklists", "assignment_id", testAssignmentIds);
  deleted.chemicals_logs = await deleteWhereIn("chemicals_logs", "assignment_id", testAssignmentIds);
  deleted.signatures = await deleteWhereIn("signatures", "assignment_id", testAssignmentIds);
  deleted.assignments = await deleteWhereIn("assignments", "id", testAssignmentIds);
  deleted.route_audit_log = await deleteWhereIn("route_audit_log", "route_id", testRouteIds);
  deleted.routes = await deleteWhereIn("routes", "id", testRouteIds);
  deleted.shifts = await deleteWhereIn("shifts", "employee_id", testEmployeeIds);
  deleted.appointments = await deleteWhereIn("appointments", "id", testAppointmentIds);
  deleted.properties = testProfileIds.length
    ? await deleteWhereIn("properties", "user_id", testProfileIds)
    : 0;

  console.log("Deleted:");
  for (const [table, n] of Object.entries(deleted)) console.log(`  ${table}: ${n}`);

  writeReport(counts, true, deleted);
}

function writeReport(counts, confirmed, deleted) {
  const dir = join(process.cwd(), "reports", "operations-hardening", "cleanup-runs");
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const path = join(dir, `cleanup-${stamp}.md`);
  const lines = [
    `# Test Data Cleanup Run — ${new Date().toISOString()}`,
    "",
    `Mode: ${confirmed ? "LIVE (deleted)" : "DRY RUN (no changes made)"}`,
    "",
    "## Scope discovered",
    `- Test profiles (@test.com): ${counts.test_profiles}`,
    `- Test employees (is_test=true): ${counts.test_employees}`,
    "",
    confirmed ? "## Rows deleted" : "## Rows that would be deleted",
    ...Object.entries(confirmed ? deleted : counts)
      .filter(([table]) => table !== "test_profiles" && table !== "test_employees")
      .map(([table, n]) => `- ${table}: ${n}`),
    "",
    "Test employee and profile accounts were preserved (not deleted) — they are reusable fixtures.",
  ];
  writeFileSync(path, lines.join("\n") + "\n");
  console.log(`\nCleanup report written to ${path}`);
}

main().catch((err) => {
  console.error("Cleanup failed:", err.message);
  process.exit(1);
});
