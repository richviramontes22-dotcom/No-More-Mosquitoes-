// Benchmarks the optimized generateDayPlan against fresh appointment dates,
// reusing the 42 real technicians already created in the prior sprint.
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
      apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json", Prefer: opts.prefer || "return=representation",
      ...opts.headers,
    },
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  if (!res.ok) throw new Error(`REST ${path} -> ${res.status}: ${text.slice(0, 300)}`);
  return json;
}

async function signInAdmin() {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email: "qa-contact-test@test.com", password: "TestPass1234" }),
  });
  return (await res.json()).access_token;
}

async function getActiveZips(limit) {
  const rows = await rest(`/service_areas?select=zip&is_active=eq.true&limit=${limit}`);
  return rows.map((r) => r.zip);
}

async function createAppointment(zip, date, hourOffset) {
  const [prop] = await rest("/properties", {
    method: "POST",
    body: JSON.stringify({ user_id: "c4654bd9-c020-4fc2-a9f1-92d16656b31e", address: `${200 + hourOffset} Bench St`, zip, acreage: 0.2 }),
  });
  const scheduledAt = `${date}T${String(8 + (hourOffset % 8)).padStart(2, "0")}:00:00Z`;
  const [appt] = await rest("/appointments", {
    method: "POST",
    body: JSON.stringify({ user_id: "c4654bd9-c020-4fc2-a9f1-92d16656b31e", property_id: prop.id, status: "scheduled", scheduled_at: scheduledAt, scheduled_date: date, service_type: "Mosquito Service" }),
  });
  return { propertyId: prop.id, appointmentId: appt.id };
}

async function runScenario(label, apptCount, date, token) {
  console.log(`\n=== ${label} (${apptCount} appointments, date=${date}) ===`);
  const zips = await getActiveZips(Math.min(apptCount, 50));

  const t0 = Date.now();
  const created = [];
  for (let i = 0; i < apptCount; i++) created.push(await createAppointment(zips[i % zips.length], date, i));
  const setupMs = Date.now() - t0;

  const t1 = Date.now();
  const genRes = await fetch(`${BASE}/api/admin/routes/day/generate`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ date, max_stops_per_tech: 8 }),
  });
  const genJson = await genRes.json();
  const genMs = Date.now() - t1;

  console.log(`  Setup: ${apptCount} appts in ${setupMs}ms`);
  console.log(`  Generate: ${genRes.status} in ${genMs}ms`);
  console.log(`  success=${genJson.success} routes=${genJson.routes?.length} unassigned=${genJson.unassigned_appointments?.length} excluded_technicians=${genJson.excluded_technicians}`);
  console.log(`  message: ${genJson.message}`);

  return { label, apptCount, date, setupMs, genMs, status: genRes.status, routeCount: genJson.routes?.length ?? 0, unassignedCount: genJson.unassigned_appointments?.length ?? 0, propertyIds: created.map(c => c.propertyId), appointmentIds: created.map(c => c.appointmentId) };
}

const main = async () => {
  await rest("/profiles?id=eq.c4654bd9-c020-4fc2-a9f1-92d16656b31e", { method: "PATCH", body: JSON.stringify({ role: "admin" }), prefer: "return=minimal" });
  const token = await signInAdmin();
  if (!token) throw new Error("admin sign-in failed");

  const results = [];
  results.push(await runScenario("5x25-equivalent", 25, "2026-08-03", token));
  results.push(await runScenario("10x50-equivalent", 50, "2026-08-04", token));
  results.push(await runScenario("25x150-equivalent", 150, "2026-08-05", token));

  console.log("\n=== SUMMARY ===");
  console.table(results.map(r => ({ scenario: r.label, status: r.status, routes: r.routeCount, unassigned: r.unassignedCount, genMs: r.genMs })));

  await rest("/profiles?id=eq.c4654bd9-c020-4fc2-a9f1-92d16656b31e", { method: "PATCH", body: JSON.stringify({ role: "customer" }), prefer: "return=minimal" });

  console.log("\n=== CLEANUP DATA ===");
  console.log(JSON.stringify(results.map(r => ({ date: r.date, propertyIds: r.propertyIds, appointmentIds: r.appointmentIds }))));
};

main().catch((err) => { console.error("BENCHMARK FAILED:", err); process.exit(1); });
