import { supabase } from "../../lib/supabase";
import { supabaseAdmin } from "../../lib/supabaseAdmin";

const db = supabaseAdmin ?? supabase;

// A technician pings roughly every 60s while clocked in and consented
// (see server/routes/employeeShifts.ts's location-ping endpoint). No ping
// in 10x that window most likely means a dropped connection, a
// backgrounded/closed app, or a dead phone — not just normal jitter.
export const STALE_THRESHOLD_MINUTES = 10;

export function isStale(lastPingAt: string | null): boolean {
  if (!lastPingAt) return true;
  return Date.now() - new Date(lastPingAt).getTime() > STALE_THRESHOLD_MINUTES * 60_000;
}

/**
 * Fetches the most recent employee_location_pings row per employee_id, for
 * a given set of employee ids. PostgREST has no direct "latest per group"
 * query, so this fetches recent pings ordered newest-first and takes the
 * first occurrence per employee in JS — correct because of the descending
 * order, and bounded rather than scanning the whole table.
 */
export async function getLastPingsByEmployee(employeeIds: string[]): Promise<Map<string, any>> {
  const lastPings = new Map<string, any>();
  if (employeeIds.length === 0) return lastPings;

  const { data: pings } = await db
    .from("employee_location_pings")
    .select("employee_id, latitude, longitude, accuracy_meters, captured_at")
    .in("employee_id", employeeIds)
    .order("captured_at", { ascending: false })
    .limit(employeeIds.length * 20);

  (pings || []).forEach((p: any) => {
    if (!lastPings.has(p.employee_id)) lastPings.set(p.employee_id, p);
  });
  return lastPings;
}
