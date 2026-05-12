import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { fetchDashboardData } from "@/lib/dataFetch";

/**
 * Catalog item types - represents products and services available in the marketplace
 */
export type CatalogItemCategory = "add_on" | "product" | "consultation" | "service";
export type PriceType = "fixed" | "free" | "range" | "consultation";
export type FulfillmentType = "appointment" | "shipped" | "consultation" | "digital";

export interface CatalogItem {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: CatalogItemCategory;
  fulfillmentType: FulfillmentType;
  priceType: PriceType;
  priceCents: number | null; // for 'fixed' type
  minPriceCents: number | null; // for 'range' type
  maxPriceCents: number | null; // for 'range' type
  currency: string;
  imageUrl: string | null; // URL to product image from database
  requiresProperty: boolean;
  requiresSchedule: boolean;
  requiresConsultation: boolean;
  active: boolean;
  sortOrder: number;
}

/**
 * Minimal seed data (fallback only if Supabase is completely unavailable)
 * SOURCE OF TRUTH: Supabase public.catalog_items
 * This should NOT display in normal operation when DB is available
 */
const SEED_CATALOG_ITEMS: CatalogItem[] = [
  {
    id: "fallback-1",
    slug: "fallback-ants",
    name: "Ants Treatment Add-On",
    description: null,
    category: "service",
    fulfillmentType: "appointment",
    priceType: "fixed",
    priceCents: 4500, // $45.00
    minPriceCents: null,
    maxPriceCents: null,
    currency: "USD",
    imageUrl: null,
    requiresProperty: true,
    requiresSchedule: true,
    requiresConsultation: false,
    active: true,
    sortOrder: 1,
  },
];

/**
 * Transform database row to CatalogItem
 * Maps snake_case Supabase columns to camelCase client interface
 */
const transformCatalogRow = (row: any): CatalogItem => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  description: row.description ?? null,
  category: row.category,
  fulfillmentType: row.fulfillment_type,
  priceType: row.price_type,
  priceCents: row.price_cents,
  minPriceCents: row.min_price_cents,
  maxPriceCents: row.max_price_cents,
  currency: row.currency,
  imageUrl: row.image_url,
  requiresProperty: row.requires_property,
  requiresSchedule: row.requires_schedule,
  requiresConsultation: row.requires_consultation,
  active: row.active,
  sortOrder: row.sort_order,
});

/**
 * Fetch catalog items from Supabase
 * Uses real database as primary source of truth
 * Falls back to seed data ONLY if Supabase is completely unavailable
 */
const fetchCatalogItems = async (): Promise<CatalogItem[]> => {
  const { data, error, isEmpty } = await fetchDashboardData(
    () =>
      supabase
        .from("catalog_items")
        .select(
          "id, slug, name, description, category, fulfillment_type, price_type, price_cents, min_price_cents, max_price_cents, currency, image_url, requires_property, requires_schedule, requires_consultation, active, sort_order"
        )
        .eq("active", true)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
    "CatalogItems"
  );

  // If query fails, log and use seed fallback
  if (error) {
    console.warn("[useCatalogItems] Database query failed, using seed fallback:", error.message);
    return SEED_CATALOG_ITEMS;
  }

  // If no data returned, log and use seed fallback
  if (isEmpty || !data) {
    console.warn("[useCatalogItems] No catalog items in database, using seed fallback");
    return SEED_CATALOG_ITEMS;
  }

  // Transform database results
  const items = (data as any[]).map(transformCatalogRow);

  if (items.length === 0) {
    console.warn("[useCatalogItems] No active items found, using seed fallback");
    return SEED_CATALOG_ITEMS;
  }

  console.log(`[useCatalogItems] Loaded ${items.length} items from Supabase database`);
  return items;
};

/**
 * Hook to fetch and cache catalog items
 * Returns all active marketplace products and services
 */
export const useCatalogItems = () => {
  return useQuery({
    queryKey: ["catalogItems"],
    queryFn: fetchCatalogItems,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    retry: 1, // Retry once on failure
    refetchOnWindowFocus: false,
    refetchInterval: false,
  });
};

/**
 * Convenience hook for getting items by category
 */
export const useCatalogItemsByCategory = (category: CatalogItemCategory) => {
  const { data = [], ...rest } = useCatalogItems();

  const filteredItems = data.filter((item) => item.category === category);

  return {
    data: filteredItems,
    ...rest,
  };
};

/**
 * Format price in cents to currency string
 */
export const formatPrice = (cents: number | null): string => {
  if (cents === null || cents === undefined) return "$0.00";
  return `$${(cents / 100).toFixed(2)}`;
};

/**
 * Format price display based on item's price type
 * - fixed: "$45.00"
 * - free: "Free"
 * - range: "$75–$300"
 * - consultation: "Custom quote"
 */
export const formatItemPrice = (item: CatalogItem): string => {
  switch (item.priceType) {
    case "fixed":
      return formatPrice(item.priceCents);
    case "free":
      return "Free";
    case "range":
      if (item.minPriceCents !== null && item.maxPriceCents !== null) {
        return `${formatPrice(item.minPriceCents)}–${formatPrice(item.maxPriceCents)}`;
      }
      return "Custom pricing";
    case "consultation":
      return "Custom quote";
    default:
      return "Contact for pricing";
  }
};
