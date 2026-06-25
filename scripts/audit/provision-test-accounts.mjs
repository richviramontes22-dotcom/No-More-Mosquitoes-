// One-time provisioning of @test.com accounts for the mobile UX audit.
// Uses the existing dev-only endpoint (server/routes/devAuth.ts, never mounted in
// production) for account creation, then elevates profiles.role directly via the
// Supabase service-role REST API (a data update, not a schema change) for roles the
// dev endpoint doesn't support natively. Every account is bounded to @test.com and
// listed in reports/mobile-audit/TEST_ACCOUNTS.json for cleanup/reference.
import { writeFileSync } from "fs";

const BASE = "http://localhost:8080";
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env");
  process.exit(1);
}

const PASSWORD = "AuditTest123!";

const accounts = [
  { email: "mobile-audit-customer@test.com", firstName: "Audit", lastName: "Customer", role: "customer" },
  { email: "mobile-audit-employee@test.com", firstName: "Audit", lastName: "Technician", role: "employee" },
  { email: "mobile-audit-cs@test.com", firstName: "Audit", lastName: "CustomerService", role: "customer_service" },
  { email: "mobile-audit-sales@test.com", firstName: "Audit", lastName: "Sales", role: "sales" },
  { email: "mobile-audit-admin@test.com", firstName: "Audit", lastName: "Admin", role: "admin" },
];

async function sbFetch(path, init = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...init.headers,
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${path} -> ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

const created = [];

for (const acc of accounts) {
  const res = await fetch(`${BASE}/api/dev/create-test-account`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ firstName: acc.firstName, lastName: acc.lastName, email: acc.email, password: PASSWORD }),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error(`FAILED creating ${acc.email}:`, data.error);
    continue;
  }
  console.log(`${acc.email} -> userId=${data.userId} reused=${!!data.reused}`);

  let roleBlocked = false;
  if (acc.role !== "customer") {
    try {
      await sbFetch(`/profiles?id=eq.${data.userId}`, {
        method: "PATCH",
        body: JSON.stringify({ role: acc.role }),
      });
      console.log(`  elevated profiles.role -> ${acc.role}`);
    } catch (err) {
      console.error(`  BLOCKED elevating to ${acc.role}: ${err.message.slice(0, 200)}`);
      roleBlocked = true;
    }
  }

  if (acc.role === "employee") {
    const existing = await sbFetch(`/employees?user_id=eq.${data.userId}&select=id`);
    if (!existing?.length) {
      await sbFetch(`/employees`, {
        method: "POST",
        body: JSON.stringify({
          user_id: data.userId,
          role: "technician",
          vehicle: "Audit Van #1",
          is_test: true,
          status: "active",
          onboarding_status: "completed",
          gps_consent_at: new Date().toISOString(),
        }),
      });
      console.log("  created employees row (is_test=true)");
    } else {
      console.log("  employees row already exists, skipped");
    }
  }

  created.push({ email: acc.email, password: PASSWORD, role: acc.role, userId: data.userId, roleBlocked });
}

writeFileSync("reports/mobile-audit/TEST_ACCOUNTS.json", JSON.stringify(created, null, 2));
console.log("\nWrote reports/mobile-audit/TEST_ACCOUNTS.json");
