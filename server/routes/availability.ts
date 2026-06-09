import { Router } from "express";
import { supabase } from "../lib/supabase";
import { supabaseAdmin } from "../lib/supabaseAdmin";

// Service role bypasses RLS for the appointment count query.
// blackout_dates and business_hours have open read policies — anon key is fine for those.
const db = supabaseAdmin ?? supabase;

const router = Router();

// Active appointment statuses that consume capacity
const ACTIVE_STATUSES = ["requested", "scheduled", "confirmed"];

// Cancelled variants to exclude — belt-and-suspenders
const CANCELLED_STATUSES = ["canceled", "cancelled", "canceled_by_admin", "canceled_by_customer"];

interface WindowDef {
  id: string;
  label: string;
  start: string;
  end: string;
  max_jobs_per_tech: number;
}

interface BusinessHoursRow {
  day_of_week: number;
  is_operational: boolean;
  windows: WindowDef[];
  service_area_id: string | null;
}

interface DayAvailability {
  date: string;
  is_operational: boolean;
  is_blackout: boolean;
  blackout_reason?: string;
  windows: WindowAvailability[];
}

interface WindowAvailability {
  id: string;
  label: string;
  start: string;
  end: string;
  available: boolean;
  capacity: number;
  booked: number;
  remaining: number;
}

/**
 * GET /api/availability
 *
 * Query params:
 *   date_from      YYYY-MM-DD  (default: today)
 *   date_to        YYYY-MM-DD  (default: date_from + 13 days)
 *   days           number      (alternative to date_to; max 60)
 *   service_area_id UUID       (optional — filters blackouts and selects area-specific hours)
 *
 * Returns an array of day objects covering the requested range,
 * each with their available appointment windows.
 */
router.get("/availability", async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Resolve date range
    const rawFrom = req.query.date_from as string | undefined;
    const rawTo   = req.query.date_to   as string | undefined;
    const rawDays = req.query.days      as string | undefined;
    const serviceAreaId = req.query.service_area_id as string | undefined;

    const dateFrom = rawFrom ? new Date(rawFrom + "T00:00:00") : new Date(today);
    if (isNaN(dateFrom.getTime())) {
      return res.status(400).json({ error: "Invalid date_from" });
    }

    let dateTo: Date;
    if (rawTo) {
      dateTo = new Date(rawTo + "T00:00:00");
      if (isNaN(dateTo.getTime())) return res.status(400).json({ error: "Invalid date_to" });
    } else {
      const numDays = Math.min(60, Math.max(1, parseInt(rawDays || "14", 10)));
      dateTo = new Date(dateFrom);
      dateTo.setDate(dateTo.getDate() + numDays - 1);
    }

    if (dateTo < dateFrom) return res.status(400).json({ error: "date_to must be >= date_from" });

    const fromStr = toDateStr(dateFrom);
    const toStr   = toDateStr(dateTo);

    // ── 1. Fetch blackout dates for this range ────────────────────────────────
    let blackoutQuery = supabase
      .from("blackout_dates")
      .select("date, reason, scope, service_area_id")
      .gte("date", fromStr)
      .lte("date", toStr);

    const { data: blackoutRows } = await blackoutQuery;

    // Build a set of blacked-out dates (and their reasons) for quick lookup
    const blackoutMap = new Map<string, string>(); // date → reason
    for (const row of blackoutRows || []) {
      if (row.scope === "all") {
        blackoutMap.set(row.date, row.reason || "Unavailable");
        continue;
      }
      if (row.scope === "service_area" && serviceAreaId && row.service_area_id === serviceAreaId) {
        blackoutMap.set(row.date, row.reason || "Unavailable");
      }
    }

    // ── 2. Fetch business_hours ───────────────────────────────────────────────
    // Prefer service-area-specific hours; fall back to global (service_area_id IS NULL)
    const { data: hoursRows } = await supabase
      .from("business_hours")
      .select("day_of_week, is_operational, windows, service_area_id");

    const globalHours = new Map<number, BusinessHoursRow>();
    const areaHours   = new Map<number, BusinessHoursRow>();

    for (const row of hoursRows || []) {
      const typedRow = row as BusinessHoursRow;
      if (!typedRow.service_area_id) {
        globalHours.set(typedRow.day_of_week, typedRow);
      } else if (serviceAreaId && typedRow.service_area_id === serviceAreaId) {
        areaHours.set(typedRow.day_of_week, typedRow);
      }
    }

    // ── 3. Count booked appointments per date+window in the range ─────────────
    // Uses db (supabaseAdmin) — anon key is blocked by RLS on appointments table.
    let apptQuery = db
      .from("appointments")
      .select("scheduled_date, window")
      .gte("scheduled_date", fromStr)
      .lte("scheduled_date", toStr)
      .in("status", ACTIVE_STATUSES)
      .not("window", "is", null);

    if (serviceAreaId) {
      // Count appointments in this service area only
      apptQuery = apptQuery.eq("service_area_id", serviceAreaId);
    }

    const { data: apptRows } = await apptQuery;

    // booked[date][windowId] = count
    const booked: Record<string, Record<string, number>> = {};
    for (const row of apptRows || []) {
      if (!row.scheduled_date || !row.window) continue;
      if (!booked[row.scheduled_date]) booked[row.scheduled_date] = {};
      booked[row.scheduled_date][row.window] = (booked[row.scheduled_date][row.window] || 0) + 1;
    }

    // ── 4. Dynamic technician capacity ───────────────────────────────────────
    // Count active employees from the employees table.
    // Falls back to 1 if the query fails or returns no results (safe MVP default).
    // capacity = activeTechCount × window.max_jobs_per_tech
    const { data: activeTechs } = await db
      .from("employees")
      .select("id")
      .eq("status", "active");
    const activeTechCount = activeTechs && activeTechs.length > 0 ? activeTechs.length : 1;

    // ── 5. Build response ─────────────────────────────────────────────────────
    const days: DayAvailability[] = [];
    const cursor = new Date(dateFrom);

    while (cursor <= dateTo) {
      const dateStr = toDateStr(cursor);
      const isPast  = cursor < today;
      const dayOfWeek = cursor.getDay(); // 0=Sun, 6=Sat

      const isBlackout = blackoutMap.has(dateStr);
      const blackoutReason = blackoutMap.get(dateStr);

      // Resolve hours: area-specific overrides global
      const hours = areaHours.get(dayOfWeek) ?? globalHours.get(dayOfWeek);

      const isOperational = !isPast && !isBlackout && (hours?.is_operational ?? false);

      let windows: WindowAvailability[] = [];

      if (isOperational && hours?.windows?.length) {
        windows = (hours.windows as WindowDef[]).map((win) => {
          const capacity = activeTechCount * win.max_jobs_per_tech;
          const bookedCount = booked[dateStr]?.[win.id] ?? 0;
          const remaining = Math.max(0, capacity - bookedCount);
          return {
            id:        win.id,
            label:     win.label,
            start:     win.start,
            end:       win.end,
            available: remaining > 0,
            capacity,
            booked:    bookedCount,
            remaining,
          };
        });
      }

      days.push({
        date:            dateStr,
        is_operational:  isOperational,
        is_blackout:     isBlackout,
        ...(blackoutReason ? { blackout_reason: blackoutReason } : {}),
        windows,
      });

      cursor.setDate(cursor.getDate() + 1);
    }

    return res.json({ days });
  } catch (err: any) {
    console.error("[Availability] Error:", err.message);
    return res.status(500).json({ error: "Failed to load availability" });
  }
});

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default router;
