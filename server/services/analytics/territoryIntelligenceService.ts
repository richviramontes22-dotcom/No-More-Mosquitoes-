import { supabase } from "../../lib/supabase";
import { supabaseAdmin } from "../../lib/supabaseAdmin";

const db = supabaseAdmin ?? supabase;

export type ServiceStatus = "active" | "inactive" | "unmapped";
export type TerritoryRecommendation =
  | "activate_zip"
  | "add_technician_capacity"
  | "watchlist"
  | "expansion_candidate"
  | "low_priority"
  | "review_manually";

export interface ZipScoreBreakdown {
  demand_component: number;
  out_of_area_component: number;
  customer_component: number;
  appointment_component: number;
  subscription_component: number;
  penalty: number;
  penalty_reason: string | null;
}

export interface ZipOpportunityRow {
  zip: string;
  city: string | null;
  county: string | null;
  state: string | null;
  service_status: ServiceStatus;
  capacity: number | null;
  demand_count: number;
  out_of_area_count: number;
  customer_count: number;
  appointment_count: number;
  subscription_count: number;
  estimated_revenue_cents: number;
  conversion_rate: number | null; // null = not enough data to be meaningful
  opportunity_score: number;
  score_breakdown: ZipScoreBreakdown;
  recommendation: TerritoryRecommendation;
  recommendation_reason: string;
}

export interface CountyOpportunityRow {
  county: string; // "Unknown" for demand signals from ZIPs we have no service_areas record for
  active_zip_count: number;
  total_zip_count: number;
  demand_count: number;
  out_of_area_count: number;
  customer_count: number;
  appointment_count: number;
  estimated_revenue_cents: number;
  opportunity_score: number;
  recommendation: TerritoryRecommendation;
  recommendation_reason: string;
}

export interface TerritoryIntelligenceFilters {
  state?: string;
  county?: string;
  serviceStatus?: ServiceStatus;
  areaFilter?: "in_area" | "out_of_area";
  dateFrom?: string; // ISO date (YYYY-MM-DD) — applies to demand/out-of-area/appointment signals only
  dateTo?: string;
}

export interface TerritoryIntelligenceResult {
  zips: ZipOpportunityRow[];
  counties: CountyOpportunityRow[];
  generated_at: string;
  data_window_note: string;
}

function normalizeZip(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = String(raw).trim().slice(0, 5);
  return digits.length === 5 ? digits : null;
}

function inDateRange(iso: string | null | undefined, from?: string, to?: string): boolean {
  if (!iso) return !from && !to;
  if (from && iso < from) return false;
  if (to && iso > `${to}T23:59:59`) return false;
  return true;
}

interface ServiceAreaInfo {
  city: string | null;
  county: string | null;
  state: string | null;
  is_active: boolean;
  capacity: number | null;
}

/**
 * Read-only territory opportunity scoring. Joins every signal back to a ZIP
 * via the service_areas lookup (1 row per ZIP) — this is the only table with
 * city/county/state, so every other table's raw zip field is normalized and
 * matched against it. ZIPs with real signal but no service_areas row at all
 * are still surfaced (service_status: "unmapped") rather than dropped,
 * since a high-demand unmapped ZIP is exactly what "expansion_candidate"
 * exists to catch.
 */
export async function getTerritoryIntelligence(
  filters: TerritoryIntelligenceFilters = {},
): Promise<TerritoryIntelligenceResult> {
  const [
    { data: serviceAreas },
    { data: leads },
    { data: demandEvents },
    { data: properties },
    { data: appointments },
    { data: subscriptions },
  ] = await Promise.all([
    db.from("service_areas").select("zip, city, county, state, is_active, capacity"),
    db.from("leads").select("id, zip, created_at, converted_customer_id, subscription_id"),
    db.from("service_area_demand_events").select("zip, event_type, created_at"),
    db.from("properties").select("id, zip"),
    db.from("appointments").select("id, property_id, scheduled_at"),
    db.from("subscriptions").select("id, property_id, status, amount_cents"),
  ]);

  const serviceAreaMap = new Map<string, ServiceAreaInfo>();
  (serviceAreas ?? []).forEach((row: any) => {
    const zip = normalizeZip(row.zip);
    if (!zip) return;
    serviceAreaMap.set(zip, {
      city: row.city ?? null,
      county: row.county ?? null,
      state: row.state ?? null,
      is_active: row.is_active !== false,
      capacity: row.capacity ?? null,
    });
  });

  const propertyZipMap = new Map<string, string>();
  (properties ?? []).forEach((p: any) => {
    const zip = normalizeZip(p.zip);
    if (zip) propertyZipMap.set(p.id, zip);
  });

  const allZips = new Set<string>(serviceAreaMap.keys());

  const demandByZip = new Map<string, number>();
  (leads ?? []).forEach((lead: any) => {
    if (!inDateRange(lead.created_at, filters.dateFrom, filters.dateTo)) return;
    const zip = normalizeZip(lead.zip);
    if (!zip) return;
    allZips.add(zip);
    demandByZip.set(zip, (demandByZip.get(zip) ?? 0) + 1);
  });

  const outOfAreaByZip = new Map<string, number>();
  (demandEvents ?? []).forEach((event: any) => {
    if (!inDateRange(event.created_at, filters.dateFrom, filters.dateTo)) return;
    const zip = normalizeZip(event.zip);
    if (!zip) return;
    allZips.add(zip);
    outOfAreaByZip.set(zip, (outOfAreaByZip.get(zip) ?? 0) + 1);
  });

  const appointmentByZip = new Map<string, number>();
  (appointments ?? []).forEach((appt: any) => {
    if (!inDateRange(appt.scheduled_at, filters.dateFrom, filters.dateTo)) return;
    const zip = propertyZipMap.get(appt.property_id);
    if (!zip) return;
    allZips.add(zip);
    appointmentByZip.set(zip, (appointmentByZip.get(zip) ?? 0) + 1);
  });

  const subscriptionCountByZip = new Map<string, number>();
  const activeCustomerPropertiesByZip = new Map<string, Set<string>>();
  const revenueByZip = new Map<string, number>();
  (subscriptions ?? []).forEach((sub: any) => {
    const zip = propertyZipMap.get(sub.property_id);
    if (!zip) return;
    allZips.add(zip);
    subscriptionCountByZip.set(zip, (subscriptionCountByZip.get(zip) ?? 0) + 1);
    if (sub.status === "active") {
      revenueByZip.set(zip, (revenueByZip.get(zip) ?? 0) + (sub.amount_cents ?? 0));
      if (!activeCustomerPropertiesByZip.has(zip)) activeCustomerPropertiesByZip.set(zip, new Set());
      activeCustomerPropertiesByZip.get(zip)!.add(sub.property_id);
    }
  });

  // Conversion: how many leads in this ZIP became a paying customer
  // (subscription_id or converted_customer_id set), out of total leads in this ZIP.
  const convertedLeadsByZip = new Map<string, number>();
  (leads ?? []).forEach((lead: any) => {
    const zip = normalizeZip(lead.zip);
    if (!zip) return;
    if (lead.converted_customer_id || lead.subscription_id) {
      convertedLeadsByZip.set(zip, (convertedLeadsByZip.get(zip) ?? 0) + 1);
    }
  });

  const zipRows: ZipOpportunityRow[] = [];
  for (const zip of allZips) {
    const areaInfo = serviceAreaMap.get(zip);
    const serviceStatus: ServiceStatus = !areaInfo ? "unmapped" : areaInfo.is_active ? "active" : "inactive";

    const demandCount = demandByZip.get(zip) ?? 0;
    const outOfAreaCount = outOfAreaByZip.get(zip) ?? 0;
    const customerCount = activeCustomerPropertiesByZip.get(zip)?.size ?? 0;
    const appointmentCount = appointmentByZip.get(zip) ?? 0;
    const subscriptionCount = subscriptionCountByZip.get(zip) ?? 0;
    const revenueCents = revenueByZip.get(zip) ?? 0;
    const capacity = areaInfo?.capacity ?? null;

    const totalLeadsForZip = demandCount;
    const convertedLeads = convertedLeadsByZip.get(zip) ?? 0;
    const conversionRate = totalLeadsForZip >= 3 ? convertedLeads / totalLeadsForZip : null;

    let penalty = 0;
    let penaltyReason: string | null = null;
    if (serviceStatus === "active" && capacity != null && capacity > 0 && customerCount >= capacity) {
      penalty = 10;
      penaltyReason = `At or over stated capacity (${customerCount}/${capacity} active customers)`;
    } else if (serviceStatus === "inactive" && demandCount === 0 && outOfAreaCount === 0) {
      penalty = 5;
      penaltyReason = "Inactive with no recorded demand signal";
    } else if (serviceStatus === "unmapped" && demandCount === 0 && outOfAreaCount === 0) {
      penalty = 5;
      penaltyReason = "No service area record and no recorded demand signal";
    }

    const breakdown: ZipScoreBreakdown = {
      demand_component: demandCount * 3,
      out_of_area_component: outOfAreaCount * 4,
      customer_component: customerCount * 5,
      appointment_component: appointmentCount * 2,
      subscription_component: subscriptionCount * 8,
      penalty,
      penalty_reason: penaltyReason,
    };

    const opportunityScore =
      breakdown.demand_component +
      breakdown.out_of_area_component +
      breakdown.customer_component +
      breakdown.appointment_component +
      breakdown.subscription_component -
      breakdown.penalty;

    let recommendation: TerritoryRecommendation;
    let recommendationReason: string;

    if (serviceStatus !== "active") {
      const signal = demandCount + outOfAreaCount;
      if (signal >= 3) {
        recommendation = "expansion_candidate";
        recommendationReason = `${serviceStatus === "unmapped" ? "Unmapped" : "Inactive"} ZIP with strong demand signal (${demandCount} lead(s) + ${outOfAreaCount} out-of-area quote/waitlist event(s))`;
      } else if (signal >= 1) {
        recommendation = "activate_zip";
        recommendationReason = `${serviceStatus === "unmapped" ? "Unmapped" : "Inactive"} ZIP with some demand (${demandCount} lead(s) + ${outOfAreaCount} out-of-area event(s)) — worth turning on`;
      } else {
        recommendation = "low_priority";
        recommendationReason = `${serviceStatus === "unmapped" ? "Unmapped" : "Inactive"} ZIP with no recorded demand`;
      }
    } else if (capacity != null && capacity > 0 && customerCount >= capacity) {
      recommendation = "add_technician_capacity";
      recommendationReason = `Active ZIP at or over stated capacity (${customerCount}/${capacity} active customers)`;
    } else if (capacity != null && capacity > 0 && customerCount >= capacity * 0.75) {
      recommendation = "watchlist";
      recommendationReason = `Active ZIP approaching capacity (${customerCount}/${capacity} active customers)`;
    } else if (demandCount === 0 && customerCount === 0 && appointmentCount === 0 && subscriptionCount === 0) {
      recommendation = "review_manually";
      recommendationReason = "Active service area with zero recorded activity of any kind — worth a manual look";
    } else {
      recommendation = "watchlist";
      recommendationReason = "Active ZIP with normal activity — monitor for growth";
    }

    zipRows.push({
      zip,
      city: areaInfo?.city ?? null,
      county: areaInfo?.county ?? null,
      state: areaInfo?.state ?? null,
      service_status: serviceStatus,
      capacity,
      demand_count: demandCount,
      out_of_area_count: outOfAreaCount,
      customer_count: customerCount,
      appointment_count: appointmentCount,
      subscription_count: subscriptionCount,
      estimated_revenue_cents: revenueCents,
      conversion_rate: conversionRate,
      opportunity_score: opportunityScore,
      score_breakdown: breakdown,
      recommendation,
      recommendation_reason: recommendationReason,
    });
  }

  const filtered = zipRows.filter((row) => {
    if (filters.state && row.state !== filters.state) return false;
    if (filters.county && row.county !== filters.county) return false;
    if (filters.serviceStatus && row.service_status !== filters.serviceStatus) return false;
    if (filters.areaFilter === "in_area" && row.service_status !== "active") return false;
    if (filters.areaFilter === "out_of_area" && row.service_status === "active") return false;
    return true;
  });

  filtered.sort((a, b) => b.opportunity_score - a.opportunity_score);

  // ─── County rollup ──────────────────────────────────────────────────────
  const countyBuckets = new Map<string, ZipOpportunityRow[]>();
  for (const row of filtered) {
    const key = row.county ?? "Unknown";
    if (!countyBuckets.has(key)) countyBuckets.set(key, []);
    countyBuckets.get(key)!.push(row);
  }

  const counties: CountyOpportunityRow[] = [];
  for (const [county, rows] of countyBuckets) {
    const activeZipCount = rows.filter((r) => r.service_status === "active").length;
    const demandCount = rows.reduce((s, r) => s + r.demand_count, 0);
    const outOfAreaCount = rows.reduce((s, r) => s + r.out_of_area_count, 0);
    const customerCount = rows.reduce((s, r) => s + r.customer_count, 0);
    const appointmentCount = rows.reduce((s, r) => s + r.appointment_count, 0);
    const revenueCents = rows.reduce((s, r) => s + r.estimated_revenue_cents, 0);
    const opportunityScore = rows.reduce((s, r) => s + r.opportunity_score, 0);

    const inactiveOrUnmappedWithDemand = rows.filter((r) => r.service_status !== "active" && (r.demand_count > 0 || r.out_of_area_count > 0));
    const overloadedActive = rows.filter((r) => r.recommendation === "add_technician_capacity");

    let recommendation: TerritoryRecommendation;
    let recommendationReason: string;
    if (overloadedActive.length > 0) {
      recommendation = "add_technician_capacity";
      recommendationReason = `${overloadedActive.length} ZIP(s) in this county at or over capacity`;
    } else if (inactiveOrUnmappedWithDemand.length >= 2) {
      recommendation = "expansion_candidate";
      recommendationReason = `${inactiveOrUnmappedWithDemand.length} inactive/unmapped ZIPs in this county show demand`;
    } else if (inactiveOrUnmappedWithDemand.length === 1) {
      recommendation = "activate_zip";
      recommendationReason = "1 inactive/unmapped ZIP in this county shows demand";
    } else if (activeZipCount > 0 && demandCount === 0 && customerCount === 0 && appointmentCount === 0) {
      recommendation = "review_manually";
      recommendationReason = "Active ZIPs in this county show zero recorded activity";
    } else if (activeZipCount === 0) {
      recommendation = "low_priority";
      recommendationReason = "No active ZIPs and no demand signal in this county";
    } else {
      recommendation = "watchlist";
      recommendationReason = "Normal activity — monitor for growth";
    }

    counties.push({
      county,
      active_zip_count: activeZipCount,
      total_zip_count: rows.length,
      demand_count: demandCount,
      out_of_area_count: outOfAreaCount,
      customer_count: customerCount,
      appointment_count: appointmentCount,
      estimated_revenue_cents: revenueCents,
      opportunity_score: opportunityScore,
      recommendation,
      recommendation_reason: recommendationReason,
    });
  }

  counties.sort((a, b) => b.opportunity_score - a.opportunity_score);

  return {
    zips: filtered,
    counties,
    generated_at: new Date().toISOString(),
    data_window_note:
      "Demand, out-of-area, and appointment counts respect the date filter. Customer/subscription/revenue figures reflect current state (not date-filtered).",
  };
}
