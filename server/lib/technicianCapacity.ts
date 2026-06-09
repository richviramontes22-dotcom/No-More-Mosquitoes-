import { supabase } from "./supabase";
import { supabaseAdmin } from "./supabaseAdmin";

const db = supabaseAdmin ?? supabase;

const GLOBAL_DEFAULT_MAX_STOPS = 8;

export interface CapacityResult {
  max_stops: number;
  max_service_minutes?: number;
  max_drive_minutes?: number;
  allowed_service_types: string[];
  skill_level: string;
  is_licensed_applicator: boolean;
  preferred_service_area_ids: string[];
  home_base_lat?: number;
  home_base_lng?: number;
  source: string;
}

/**
 * Resolves the effective daily capacity for a technician on a given date.
 *
 * Resolution priority (most specific → least specific):
 * 1. technician_date_overrides.max_stops_override (for that specific date)
 * 2. technician_schedule_templates.max_stops (for that day-of-week)
 * 3. technician_capacity_profiles.max_stops_per_day
 * 4. employees.default_max_stops
 * 5. Global fallback: 8
 *
 * Non-stop capacity fields (service types, skill level, etc.) come from
 * technician_capacity_profiles only — no per-date override for these.
 */
export async function getEffectiveDailyCapacity(
  techId: string,
  date: string // YYYY-MM-DD
): Promise<CapacityResult> {
  // Fetch all data in parallel
  const dayOfWeek = new Date(date + "T00:00:00").getDay();

  const [empRes, overrideRes, templateRes, profileRes] = await Promise.all([
    db.from("employees").select("default_max_stops").eq("id", techId).maybeSingle(),
    db.from("technician_date_overrides")
      .select("max_stops_override")
      .eq("employee_id", techId)
      .eq("override_date", date)
      .maybeSingle(),
    db.from("technician_schedule_templates")
      .select("max_stops")
      .eq("employee_id", techId)
      .eq("day_of_week", dayOfWeek)
      .lte("effective_from", date)
      .or("effective_until.is.null,effective_until.gte." + date)
      .order("effective_from", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db.from("technician_capacity_profiles")
      .select("max_stops_per_day, max_service_minutes_per_day, max_drive_minutes_per_day, allowed_service_types, skill_level, is_licensed_applicator, preferred_service_area_ids, home_base_lat, home_base_lng")
      .eq("employee_id", techId)
      .maybeSingle(),
  ]);

  const profile = profileRes.data;
  const override = overrideRes.data;
  const template = templateRes.data;
  const emp = empRes.data;

  // Resolve max_stops with priority chain
  let max_stops: number = GLOBAL_DEFAULT_MAX_STOPS;
  let source = "global_default";

  if (emp?.default_max_stops != null) {
    max_stops = emp.default_max_stops;
    source = "employee_default";
  }
  if (profile?.max_stops_per_day != null) {
    max_stops = profile.max_stops_per_day;
    source = "capacity_profile";
  }
  if (template?.max_stops != null) {
    max_stops = template.max_stops;
    source = "schedule_template";
  }
  if (override?.max_stops_override != null) {
    max_stops = override.max_stops_override;
    source = "date_override";
  }

  return {
    max_stops,
    max_service_minutes: profile?.max_service_minutes_per_day ?? undefined,
    max_drive_minutes: profile?.max_drive_minutes_per_day ?? undefined,
    allowed_service_types: profile?.allowed_service_types ?? [],
    skill_level: profile?.skill_level ?? "standard",
    is_licensed_applicator: profile?.is_licensed_applicator ?? false,
    preferred_service_area_ids: profile?.preferred_service_area_ids ?? [],
    home_base_lat: profile?.home_base_lat ?? undefined,
    home_base_lng: profile?.home_base_lng ?? undefined,
    source,
  };
}
