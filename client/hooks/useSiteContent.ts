import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { testimonials, services, benefits } from "@/data/site";

// ── Static fallbacks ──────────────────────────────────────────────────────────
// Used when the DB table is empty or unreachable. Site never breaks.
export const CONTENT_DEFAULTS: Record<string, string> = {
  hero_title:          "Enjoy the comfort of your yard all season",
  hero_subtitle:       "Premium mosquito and insect control for those who expect more from their outdoor space. Precision treatments, proven results, and a 100% satisfaction guarantee.",
  hero_cta_text:       "Schedule Service",
  hero_cta_secondary:  "Check Pricing by Address",
  services_intro:      "Premium protection that is family- and pet-safe — California-approved, non-toxic insecticides that eliminate mosquitoes while keeping your home protected.",
  about_tagline:       "A California Employee/Community Based Company",
  guarantee_text:      "100% satisfaction guarantee — so you can enjoy your yard in total comfort.",
  footer_tagline:      "Premium Insect Control Services",
};

export const IMAGE_DEFAULTS: Record<string, { url: string | null; focal_x: number; focal_y: number; alt: string }> = {
  hero_image:      { url: null, focal_x: 50, focal_y: 50, alt: "No More Mosquitoes service hero" },
  services_banner: { url: null, focal_x: 50, focal_y: 30, alt: "Mosquito control services" },
  about_image:     { url: null, focal_x: 50, focal_y: 50, alt: "No More Mosquitoes team" },
  safety_image:    { url: null, focal_x: 50, focal_y: 50, alt: "Safe treatment products" },
};

// ── Predefined slots (the only keys admins can manage) ────────────────────────
export const CONTENT_SLOTS = [
  { key: "hero_title",         label: "Hero Title",                maxLength: 80 },
  { key: "hero_subtitle",      label: "Hero Subtitle",             maxLength: 220 },
  { key: "hero_cta_text",      label: "Hero Primary Button Text",  maxLength: 40 },
  { key: "hero_cta_secondary", label: "Hero Secondary Button",     maxLength: 40 },
  { key: "services_intro",     label: "Services Introduction",     maxLength: 300 },
  { key: "about_tagline",      label: "About / Our Story Tagline", maxLength: 120 },
  { key: "guarantee_text",     label: "Guarantee Description",     maxLength: 220 },
  { key: "footer_tagline",     label: "Footer Tagline",            maxLength: 60 },
] as const;

// ── List content slot registry ────────────────────────────────────────────────
// JSON arrays stored in site_content with content_type='json_list'
export const LIST_SLOTS = [
  {
    key: "testimonials_list",
    label: "Customer Testimonials",
    description: "Reviews shown on homepage and Reviews page",
    itemSchema: { name: "string", location: "string", rating: "number", body: "string" },
  },
  {
    key: "services_list",
    label: "Services Catalog",
    description: "Service cards shown on homepage and Services page",
    itemSchema: { name: "string", description: "string" },
  },
  {
    key: "benefits_list",
    label: "Why Choose Us (Benefits)",
    description: "Benefit cards shown on homepage",
    itemSchema: { title: "string", description: "string" },
  },
] as const;

// ── Static fallbacks for list content ────────────────────────────────────────
export const LIST_DEFAULTS: Record<string, unknown[]> = {
  testimonials_list: testimonials,
  services_list: services,
  benefits_list: benefits,
};

export const IMAGE_SLOTS = [
  { key: "hero_image",      label: "Hero Background Image",   hint: "Recommended: 1920×1080px (16:9)" },
  { key: "services_banner", label: "Services Page Banner",    hint: "Recommended: 1600×600px" },
  { key: "about_image",     label: "Our Story Image",         hint: "Recommended: 800×600px (4:3)" },
  { key: "safety_image",    label: "Safety & Chemicals Image",hint: "Recommended: 800×600px" },
] as const;

// ── Content resolver ──────────────────────────────────────────────────────────

interface SiteContentRow {
  key: string;
  value: string | null;
  draft_value: string | null;
  status: string;
}

/**
 * Resolves site content for a given key.
 * - preview=false (default): uses published value
 * - preview=true: uses draft_value if present, otherwise published value
 * - Falls back to CONTENT_DEFAULTS if DB row missing
 */
export const useSiteContent = (key: string, preview = false): string => {
  const { data } = useQuery<SiteContentRow | null>({
    queryKey: ["site_content", key],
    queryFn: async () => {
      // Public pages only fetch value — draft_value is never sent to browser
      const { data, error } = await supabase
        .from("site_content")
        .select("key, value")
        .eq("key", key)
        .maybeSingle();
      if (error) return null;
      return data as SiteContentRow | null;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 0,
    refetchOnWindowFocus: false,
  });

  if (!data) return CONTENT_DEFAULTS[key] ?? "";
  if (preview && data.draft_value) return data.draft_value;
  return data.value ?? CONTENT_DEFAULTS[key] ?? "";
};

/**
 * Fetches all published content slots in one query.
 * Returns a map of key → resolved value.
 */
export const useAllSiteContent = (preview = false): Record<string, string> => {
  const { data } = useQuery<SiteContentRow[]>({
    queryKey: ["site_content_all", preview],
    queryFn: async () => {
      // Public pages only fetch published values — draft never sent to browser
      const { data, error } = await supabase
        .from("site_content")
        .select("key, value");
      if (error) return [];
      return (data || []) as SiteContentRow[];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 0,
    refetchOnWindowFocus: false,
  });

  const result: Record<string, string> = { ...CONTENT_DEFAULTS };
  for (const row of data || []) {
    result[row.key] = (preview && row.draft_value) ? row.draft_value : (row.value ?? CONTENT_DEFAULTS[row.key] ?? "");
  }
  return result;
};

// ── Image resolver ────────────────────────────────────────────────────────────

interface SiteImageRow {
  key: string;
  image_url: string | null;
  focal_x: number;
  focal_y: number;
  alt_text: string;
}

export interface ResolvedImage {
  url: string | null;
  focal_x: number;
  focal_y: number;
  alt: string;
  objectPosition: string;
}

export const useSiteImage = (key: string): ResolvedImage => {
  const fallback = IMAGE_DEFAULTS[key] ?? { url: null, focal_x: 50, focal_y: 50, alt: "" };

  const { data } = useQuery<SiteImageRow | null>({
    queryKey: ["site_image", key],
    queryFn: async () => {
      // Public pages only fetch published values — draft_* fields never sent to browser
      const { data, error } = await supabase
        .from("site_images")
        .select("key, image_url, focal_x, focal_y, alt_text")
        .eq("key", key)
        .maybeSingle();
      if (error) return null;
      return data as SiteImageRow | null;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 0,
    refetchOnWindowFocus: false,
  });

  if (!data) return { ...fallback, objectPosition: `${fallback.focal_x}% ${fallback.focal_y}%` };

  // Public hook only receives published fields — draft fields are never queried here.
  // Admin preview uses the server-side /api/admin/cms/preview endpoint instead.
  const url = data.image_url ?? null;
  const fx = data.focal_x ?? 50;
  const fy = data.focal_y ?? 50;
  const alt = data.alt_text ?? "";

  return { url, focal_x: fx, focal_y: fy, alt, objectPosition: `${fx}% ${fy}%` };
};

// ── List content resolver ─────────────────────────────────────────────────────

/**
 * Fetches a JSON list stored in site_content.
 * Returns CMS value if published, otherwise returns the provided static fallback.
 * Never breaks rendering — fallback is always valid data.
 */
export const useSiteContentList = <T>(key: string, fallback: T[]): T[] => {
  const { data } = useQuery<string | null>({
    queryKey: ["site_content_list", key],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_content")
        .select("value")
        .eq("key", key)
        .maybeSingle();
      if (error || !data?.value) return null;
      return data.value;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 0,
    refetchOnWindowFocus: false,
  });

  if (!data) return fallback;
  try {
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) && parsed.length > 0 ? (parsed as T[]) : fallback;
  } catch {
    return fallback;
  }
};
