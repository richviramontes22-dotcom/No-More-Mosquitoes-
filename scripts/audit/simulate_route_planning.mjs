// Route planning load simulation — creates real technicians/properties/
// appointments (flagged is_test where possible) and calls the actual
// generateDayPlan endpoint, measuring timing and correctness at three scales.
import { readFileSync } from "fs";

const env = {};
for (const line of readFileSync(".env", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const SUPABASE_URL = env.VITE_SUPABASE_URL;
const ANON_KEY = env.VITE_SUPABASE_ANON_KEY;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const BASE = "http://localhost:8080";

async function rest(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...opts,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: opts.prefer || "return=representation",
      ...opts.headers,
    },
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  if (!res.ok) throw new Error(`REST ${path} -> ${res.status}: ${text.slice(0, 300)}`);
  return json;
}

async function signInAdmin() {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email: "qa-contact-test@test.com", password: "TestPass1234" }),
  });
  const json = await res.json();
  return json.access_token;
}

async function promoteRole(userId, role) {
  await rest(`/profiles?id=eq.${userId}`, { method: "PATCH", body: JSON.stringify({ role }), prefer: "return=minimal" });
}

// Real active ZIPs to spread synthetic properties across (varied, not all the same).
async function getActiveZips(limit) {
  const rows = await rest(`/service_areas?select=zip&is_active=eq.true&limit=${limit}`);
  return rows.map((r) => r.zip);
}

let techCounter = 0;
async function createTechnician(suffix) {
  techCounter++;
  const email = `qa-route-tech-${suffix}-${techCounter}@test.com`;
  const res = await fetch(`${BASE}/api/dev/create-test-account`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ firstName: "RouteSim", lastName: `Tech${techCounter}`, email, password: "TestPass1234" }),
  });
  const json = await res.json();
  if (!json.userId) throw new Error(`create technician failed: ${JSON.stringify(json)}`);
  const [emp] = await rest("/employees", {
    method: "POST",
    body: JSON.stringify({ user_id: json.userId, role: "technician", status: "active", is_test: true }),
  });
  return { userId: json.userId, employeeId: emp.id };
}

async function createPropertyAndAppointment(zip, date, hourOffset) {
  const [prop] = await rest("/properties", {
    method: "POST",
    body: JSON.stringify({
      user_id: "c4654bd9-c020-4fc2-a9f1-92d16656b31e", // reused QA customer — routing doesn't care about customer uniqueness
      address: `${100 + hourOffset} Simulated St`,
      zip,
      acreage: 0.2,
    }),
  });
  const scheduledAt = `${date}T${String(8 + (hourOffset % 8)).padStart(2, "0")}:00:00Z`;
  const [appt] = await rest("/appointments", {
    method: "POST",
    body: JSON.stringify({
      user_id: "c4654bd9-c020-4fc2-a9f1-92d16656b31e",
      property_id: prop.id,
      status: "scheduled",
      scheduled_at: scheduledAt,
      scheduled_date: date,
      service_type: "Mosquito Service",
    }),
  });
  return { propertyId: prop.id, appointmentId: appt.id };
}

async function runScenario(label, techCount, apptCount, date, token) {
  console.log(`\n=== Scenario: ${label} (${techCount} technicians, ${apptCount} appointments, date=${date}) ===`);
  const zips = await getActiveZips(Math.min(apptCount, 50));

  const t0 = Date.now();
  const techs = [];
  for (let i = 0; i < techCount; i++) techs.push(await createTechnician(label));
  const techSetupMs = Date.now() - t0;

  const t1 = Date.now();
  const created = [];
  for (let i = 0; i < apptCount; i++) {
    const zip = zips[i % zips.length];
    created.push(await createPropertyAndAppointment(zip, date, i));
  }
  const apptSetupMs = Date.now() - t1;

  const t2 = Date.now();
  const genRes = await fetch(`${BASE}/api/admin/routes/day/generate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ date, max_stops_per_tech: 8 }),
  });
  const genJson = await genRes.json();
  const genMs = Date.now() - t2;

  console.log(`  Setup: ${techCount} techs in ${techSetupMs}ms, ${apptCount} appts in ${apptSetupMs}ms`);
  console.log(`  Generate: ${genRes.status} in ${genMs}ms`);
  console.log(`  success=${genJson.success} routes=${genJson.routes?.length} unassigned=${genJson.unassigned_appointments?.length} excluded_technicians=${genJson.excluded_technicians}`);
  if (genJson.workforce_notes?.length) console.log(`  workforce_notes (first 5): ${JSON.stringify(genJson.workforce_notes.slice(0, 5))}`);
  if (genJson.routes?.length) {
    const stopCounts = genJson.routes.map((r) => r.stop_count ?? r.stops?.length ?? "?");
    console.log(`  stop counts per route: ${JSON.stringify(stopCounts)}`);
  }

  return {
    label, techCount, apptCount, techSetupMs, apptSetupMs, genMs,
    status: genRes.status, success: genJson.success,
    routeCount: genJson.routes?.length ?? 0,
    unassignedCount: genJson.unassigned_appointments?.length ?? 0,
    excludedTechnicians: genJson.excluded_technicians ?? 0,
    techIds: techs.map((t) => t.employeeId),
    propertyIds: created.map((c) => c.propertyId),
    appointmentIds: created.map((c) => c.appointmentId),
    userIds: techs.map((t) => t.userId),
  };
}

const main = async () => {
  await promoteRole("c4654bd9-c020-4fc2-a9f1-92d16656b31e", "admin");
  const token = await signInAdmin();
  if (!token) throw new Error("admin sign-in failed");

  const results = [];
  results.push(await runScenario("5x25", 5, 25, "2026-07-06", token));
  results.push(await runScenario("10x50", 10, 50, "2026-07-07", token));
  results.push(await runScenario("25x150", 25, 150, "2026-07-08", token));

  console.log("\n=== SUMMARY ===");
  console.table(results.map((r) => ({
    scenario: r.label, status: r.status, success: r.success,
    routes: r.routeCount, unassigned: r.unassignedCount,
    excludedTechs: r.excludedTechnicians,
    setupMs: r.techSetupMs + r.apptSetupMs, genMs: r.genMs,
  })));

  await promoteRole("c4654bd9-c020-4fc2-a9f1-92d16656b31e", "customer");

  // Print cleanup IDs for a follow-up pass rather than deleting inline —
  // keeps this script's primary job (measurement) separate from cleanup.
  console.log("\n=== CLEANUP DATA (save for teardown) ===");
  console.log(JSON.stringify(results.map((r) => ({
    label: r.label, techIds: r.techIds, propertyIds: r.propertyIds,
    appointmentIds: r.appointmentIds, userIds: r.userIds,
  }))));
};

main().catch((err) => { console.error("SIMULATION FAILED:", err); process.exit(1); });
