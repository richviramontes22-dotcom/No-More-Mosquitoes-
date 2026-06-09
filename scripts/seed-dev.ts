/**
 * seed-dev.ts — Development-only seed script for No More Mosquitoes.
 *
 * Creates deterministic test data (idempotent — safe to run repeatedly).
 * Includes test customers, properties, and appointments across various
 * dates, statuses, and windows so every admin page has data to display.
 *
 * Usage:
 *   npx tsx scripts/seed-dev.ts
 *
 * SAFETY GUARDS — will refuse to run if:
 *   - VITE_SUPABASE_URL contains the production project ID
 *   - NODE_ENV === "production"
 *   - SEED_ALLOW_PROD is not explicitly set to "yes_i_know"
 *
 * Credentials: store dev Supabase URL + service role key in .env.development.local
 * NEVER commit real credentials.
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { addDays, subDays, format } from "date-fns";

// ── Safety guards ─────────────────────────────────────────────────────────────

const PROD_PROJECT_ID = "qamfxqbtvwwlzlmqrqbh"; // production Supabase project

const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!supabaseUrl || !serviceRoleKey) {
  console.error("\n[seed-dev] VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  console.error("[seed-dev] Add them to .env.development.local (NOT .env)\n");
  process.exit(1);
}

if (supabaseUrl.includes(PROD_PROJECT_ID)) {
  if (process.env.SEED_ALLOW_PROD !== "yes_i_know") {
    console.error("\n[seed-dev] REFUSED: This script is pointing at the PRODUCTION Supabase project.");
    console.error("[seed-dev] Use a separate development Supabase project for seeding.");
    console.error("[seed-dev] If you really mean it, set SEED_ALLOW_PROD=yes_i_know\n");
    process.exit(1);
  }
  console.warn("\n[seed-dev] WARNING: Running against production — proceeding because SEED_ALLOW_PROD is set.\n");
}

if (process.env.NODE_ENV === "production") {
  console.error("\n[seed-dev] REFUSED: NODE_ENV=production. This script must not run in production.\n");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);
const today = new Date();
const d = (offset: number) => format(addDays(today, offset), "yyyy-MM-dd");
const dt = (offset: number, time = "08:00") => `${d(offset)}T${time}:00`;

// ── Deterministic seed IDs ─────────────────────────────────────────────────────
// Fixed UUIDs ensure ON CONFLICT works and the script is idempotent.

const IDS = {
  // Properties (no auth user needed — linked to real user after first login)
  prop1: "seed-prop-0000-0000-0000-000000000001",
  prop2: "seed-prop-0000-0000-0000-000000000002",
  prop3: "seed-prop-0000-0000-0000-000000000003",

  // Appointments
  appt1: "seed-appt-0000-0000-0000-000000000001", // upcoming / scheduled / morning
  appt2: "seed-appt-0000-0000-0000-000000000002", // upcoming / scheduled / afternoon
  appt3: "seed-appt-0000-0000-0000-000000000003", // upcoming / confirmed / no window
  appt4: "seed-appt-0000-0000-0000-000000000004", // past / completed
  appt5: "seed-appt-0000-0000-0000-000000000005", // past / completed
  appt6: "seed-appt-0000-0000-0000-000000000006", // future / requested
};

// ── Seed functions ─────────────────────────────────────────────────────────────

async function seedProperties(userId: string) {
  console.log("[seed-dev] Seeding properties...");

  const props = [
    {
      id: IDS.prop1,
      user_id: userId,
      address: "18 Ocean Vista",
      city: "Newport Beach",
      state: "CA",
      zip: "92657",
      acreage: 0.23,
      label: "Home",
      is_default: true,
    },
    {
      id: IDS.prop2,
      user_id: userId,
      address: "456 Maple Street",
      city: "Newport Beach",
      state: "CA",
      zip: "92660",
      acreage: 0.15,
      label: "Rental",
      is_default: false,
    },
    {
      id: IDS.prop3,
      user_id: userId,
      address: "123 Oak Ridge Drive",
      city: "Irvine",
      state: "CA",
      zip: "92614",
      acreage: 0.32,
      label: "Office",
      is_default: false,
    },
  ];

  const { error } = await supabase
    .from("properties")
    .upsert(props, { onConflict: "id" });

  if (error) console.error("  Properties error:", error.message);
  else console.log(`  ✓ ${props.length} properties`);
}

async function seedAppointments(userId: string) {
  console.log("[seed-dev] Seeding appointments...");

  const appointments = [
    // ── Upcoming ──────────────────────────────────────────────────────────────
    {
      id:             IDS.appt1,
      user_id:        userId,
      property_id:    IDS.prop1,
      status:         "scheduled",
      service_type:   "Mosquito Service",
      scheduled_at:   dt(1, "08:00"),
      scheduled_date: d(1),
      window:         "morning",
      window_label:   "Morning (8AM–12PM)",
      notes:          "First upcoming appointment — morning window",
    },
    {
      id:             IDS.appt2,
      user_id:        userId,
      property_id:    IDS.prop2,
      status:         "scheduled",
      service_type:   "Mosquito Service",
      scheduled_at:   dt(4, "12:00"),
      scheduled_date: d(4),
      window:         "afternoon",
      window_label:   "Afternoon (12PM–4PM)",
      notes:          "Afternoon window test",
    },
    {
      id:             IDS.appt3,
      user_id:        userId,
      property_id:    IDS.prop3,
      status:         "confirmed",
      service_type:   "Mosquito Service",
      scheduled_at:   dt(7, "09:00"),
      scheduled_date: d(7),
      window:         "morning",
      window_label:   "Morning (8AM–12PM)",
      notes:          "Confirmed appointment",
    },
    {
      id:             IDS.appt6,
      user_id:        userId,
      property_id:    IDS.prop1,
      status:         "requested",
      service_type:   "Mosquito Service",
      scheduled_at:   dt(14, "12:00"),
      scheduled_date: d(14),
      window:         "afternoon",
      window_label:   "Afternoon (12PM–4PM)",
      notes:          "Pending request — 2 weeks out",
    },
    // ── Past ─────────────────────────────────────────────────────────────────
    {
      id:             IDS.appt4,
      user_id:        userId,
      property_id:    IDS.prop1,
      status:         "completed",
      service_type:   "Mosquito Service",
      scheduled_at:   dt(-14, "09:00"),
      scheduled_date: d(-14),
      window:         "morning",
      window_label:   "Morning (8AM–12PM)",
      notes:          "Completed 2 weeks ago",
    },
    {
      id:             IDS.appt5,
      user_id:        userId,
      property_id:    IDS.prop2,
      status:         "completed",
      service_type:   "Mosquito Service",
      scheduled_at:   dt(-30, "13:00"),
      scheduled_date: d(-30),
      window:         "afternoon",
      window_label:   "Afternoon (12PM–4PM)",
      notes:          "Completed 30 days ago",
    },
  ];

  const { error } = await supabase
    .from("appointments")
    .upsert(appointments, { onConflict: "id" });

  if (error) console.error("  Appointments error:", error.message);
  else console.log(`  ✓ ${appointments.length} appointments (${d(-30)} through ${d(14)})`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n[seed-dev] Starting development seed...");
  console.log(`[seed-dev] Supabase: ${supabaseUrl.replace(/https:\/\/(\w+)\..*/, "https://$1.supabase.co")}`);
  console.log(`[seed-dev] Reference date: ${format(today, "yyyy-MM-dd")}\n`);

  // Seed data requires an existing user to attach properties/appointments to.
  // Find the first non-admin user, or prompt to create one.
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, name, email, role")
    .eq("role", "customer")
    .limit(1);

  let userId: string;

  if (profiles && profiles.length > 0) {
    userId = profiles[0].id;
    console.log(`[seed-dev] Attaching to existing customer: ${profiles[0].email} (${profiles[0].id})`);
  } else {
    console.error("[seed-dev] No customer profile found.");
    console.error("[seed-dev] Create a customer account first, then re-run this script.");
    process.exit(1);
  }

  await seedProperties(userId);
  await seedAppointments(userId);

  console.log("\n[seed-dev] Seed complete.");
  console.log("[seed-dev] Appointment dates:");
  console.log(`  Past:     ${d(-30)}, ${d(-14)}`);
  console.log(`  Upcoming: ${d(1)}, ${d(4)}, ${d(7)}, ${d(14)}`);
  console.log("\n[seed-dev] To reset: delete rows WHERE id LIKE 'seed-%' from properties and appointments.\n");
}

main().catch((err) => {
  console.error("\n[seed-dev] FATAL:", err.message);
  process.exit(1);
});
