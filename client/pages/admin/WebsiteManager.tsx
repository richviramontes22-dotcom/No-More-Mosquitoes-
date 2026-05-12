import { useEffect, useMemo, useRef, useState } from "react";
import SectionHeading from "@/components/common/SectionHeading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import {
  Image as ImageIcon, FileText, ShoppingBag, Eye,
  Upload, Trash2, Plus, Save, Send, RotateCcw,
  Loader2, CheckCircle2, AlertCircle, Monitor, Smartphone,
  ChevronUp, ChevronDown, GripVertical, List, HelpCircle, Edit2, X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { AdminOwnershipBadge, AdminOwnershipNote } from "@/components/admin/AdminOwnershipBadge";
import { CONTENT_SLOTS, IMAGE_SLOTS, CONTENT_DEFAULTS, IMAGE_DEFAULTS, LIST_SLOTS, LIST_DEFAULTS } from "@/hooks/useSiteContent";
import { testimonials as staticTestimonials, services as staticServices, benefits as staticBenefits, serviceAreaZipCodes } from "@/data/site";
import { lifestyleImages, technicianImages } from "@/data/media";
import { blogPosts as staticBlogPosts } from "@/data/blog";

// ── API helper ────────────────────────────────────────────────────────────────
async function cmsApi(path: string, method = "GET", body?: unknown) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const res = await fetch(`/api/admin${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Request failed");
  return json;
}

const uploadSiteImage = async (file: File, folder: string) => {
  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/avif"];
  if (!allowedTypes.includes(file.type)) {
    throw new Error("JPG, PNG, WebP or AVIF only");
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Max 5 MB");
  }

  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const safeBase = file.name
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60) || "image";
  const path = `${folder}/${Date.now()}-${safeBase}.${extension}`;
  const { error: uploadError } = await supabase.storage.from("site-images").upload(path, file, { upsert: true });
  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage.from("site-images").getPublicUrl(path);
  return urlData.publicUrl;
};

// ── Types ─────────────────────────────────────────────────────────────────────
interface ContentSlot {
  key: string; value: string | null; draft_value: string | null;
  status: string; updated_at: string | null; published_at: string | null;
}

interface ImageSlot {
  key: string; label: string;
  image_url: string | null; draft_image_url: string | null;
  focal_x: number; focal_y: number;
  draft_focal_x: number | null; draft_focal_y: number | null;
  alt_text: string; draft_alt_text: string | null;
  status: string;
}

interface CatalogItem {
  id: string; slug: string; name: string; description: string | null;
  category: string; price_type: string; price_cents: number | null;
  image_url: string | null; active: boolean; is_featured: boolean; display_order: number;
}

interface FaqItem {
  id: string; question: string; answer: string;
  category: string | null; display_order: number; active: boolean;
}

type TestimonialItem = { name: string; location: string; rating: number; body: string };
type ServiceItem = { name: string; description: string };
type BenefitItem = { title: string; description: string };

interface ListContent {
  testimonials_list: TestimonialItem[];
  services_list: ServiceItem[];
  benefits_list: BenefitItem[];
}

// ── Main component ────────────────────────────────────────────────────────────
interface CarouselItem {
  id: string; image_url: string; alt_text: string;
  focal_x: number; focal_y: number; display_order: number; active: boolean;
}

const CAROUSEL_SLOTS = [
  { key: "hero_carousel", label: "Hero Carousel", hint: "Recommend 1920×1080px (16:9). Min 1 image required." },
] as const;

type VisibilityFilter = "all" | "content" | "images" | "carousel" | "marketplace" | "fallback" | "cms" | "needs_migration";

const FILTERS: Array<{ value: VisibilityFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "content", label: "Content" },
  { value: "images", label: "Images" },
  { value: "carousel", label: "Carousel" },
  { value: "marketplace", label: "Marketplace" },
  { value: "fallback", label: "Fallback" },
  { value: "cms", label: "CMS Managed" },
  { value: "needs_migration", label: "Needs Migration" },
];

const CONTENT_USAGE: Record<string, { whereUsed: string; source: string; note?: string; needsMigration?: boolean }> = {
  hero_title: { whereUsed: "Homepage Hero", source: "CMS Managed" },
  hero_subtitle: { whereUsed: "Homepage Hero", source: "CMS Managed" },
  hero_cta_text: { whereUsed: "Website Manager Preview only", source: "CMS Slot", note: "Public homepage currently uses translation text for this CTA.", needsMigration: true },
  hero_cta_secondary: { whereUsed: "Website Manager Preview only", source: "CMS Slot", note: "Public homepage currently uses translation text for this CTA.", needsMigration: true },
  services_intro: { whereUsed: "Homepage Services Section", source: "CMS Managed" },
  about_tagline: { whereUsed: "Our Story Page Hero", source: "CMS Managed" },
  guarantee_text: { whereUsed: "Guarantee Page Hero", source: "CMS Managed" },
  footer_tagline: { whereUsed: "Footer", source: "CMS Managed" },
};

const LIST_USAGE: Record<keyof ListContent, { label: string; whereUsed: string; source: string }> = {
  testimonials_list: { label: "Customer Testimonials", whereUsed: "Homepage Reviews Section and Reviews Page", source: "CMS Managed List" },
  services_list: { label: "Services Catalog", whereUsed: "Homepage Services Section", source: "CMS Managed List" },
  benefits_list: { label: "Why Choose Us (Benefits)", whereUsed: "Homepage Benefits Section", source: "CMS Managed List" },
};

const IMAGE_USAGE: Record<string, { whereUsed: string; source: string; note: string; notPublic?: boolean }> = {
  hero_image: { whereUsed: "Website Manager Preview only", source: "CMS Managed Image Slot", note: "Homepage uses the hero carousel instead of this single-image slot.", notPublic: true },
  services_banner: { whereUsed: "Not currently used publicly", source: "CMS Managed Image Slot", note: "Editable slot exists for future services-page wiring.", notPublic: true },
  about_image: { whereUsed: "Not currently used publicly", source: "CMS Managed Image Slot", note: "Our Story currently uses static lifestyle images.", notPublic: true },
  safety_image: { whereUsed: "Not currently used publicly", source: "CMS Managed Image Slot", note: "Safety/quality content currently uses static media assets.", notPublic: true },
};

const STATIC_VISIBILITY_ITEMS = [
  { title: "Hero CTA Labels", kind: "Content", source: "Translation-Based", whereUsed: "Homepage Hero buttons", note: "Visible public copy currently comes from translation keys, not the existing CTA CMS slots." },
  { title: "Hero Eyebrow / Header Banner", kind: "Content", source: "Translation-Based", whereUsed: "Homepage Hero banner", note: "Static translation text; not yet CMS controlled." },
  { title: "Services Page Core Treatment Cards", kind: "Content", source: "Static Fallback", whereUsed: "Services Page", note: `${staticServices.length} static service cards from client/data/site.ts.` },
  { title: "Static Blog Fallback Posts", kind: "Content", source: "Static Fallback", whereUsed: "Blog Page when blog_posts is empty or unreachable", note: `${staticBlogPosts.length} static posts from client/data/blog.ts.` },
  { title: "Static Service Area ZIP List", kind: "Content", source: "Static Fallback", whereUsed: "Service Area Page and address checker fallback", note: `${serviceAreaZipCodes.length} ZIP codes from client/data/site.ts.` },
  { title: "Static Service Images", kind: "Image", source: "Static Fallback", whereUsed: "Story, Schedule, Quality, and Video Proof sections", note: `${lifestyleImages.length + technicianImages.length} static media references remain code-backed.` },
  { title: "Marketplace Seed Fallback", kind: "Marketplace", source: "Static Fallback", whereUsed: "Customer Marketplace only when catalog_items is empty or unavailable", note: "Fallback item is code-backed in useCatalogItems.ts and is not a live catalog record." },
] as const;

const entryMatches = (
  search: string,
  filter: VisibilityFilter,
  entry: { text: string; kind: VisibilityFilter | "lists"; source?: string; needsMigration?: boolean; fallback?: boolean; cms?: boolean },
) => {
  const q = search.trim().toLowerCase();
  const source = (entry.source || "").toLowerCase();
  const textOk = !q || entry.text.toLowerCase().includes(q);
  const filterOk =
    filter === "all" ||
    filter === entry.kind ||
    (filter === "content" && entry.kind === "lists") ||
    (filter === "fallback" && (entry.fallback || source.includes("fallback"))) ||
    (filter === "cms" && (entry.cms || source.includes("cms"))) ||
    (filter === "needs_migration" && entry.needsMigration);
  return textOk && filterOk;
};

const WhereUsed = ({ value }: { value: string }) => (
  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
    <Badge variant="outline" className="text-[10px] bg-blue-500/5 text-blue-700 border-blue-400/20">Where Used</Badge>
    <span>{value}</span>
  </div>
);

const SourceBadges = ({
  source,
  needsMigration,
  readOnly,
  notPublic,
}: {
  source: string;
  needsMigration?: boolean;
  readOnly?: boolean;
  notPublic?: boolean;
}) => (
  <div className="flex flex-wrap items-center gap-1.5">
    <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-700 border-green-400/20">{source}</Badge>
    {readOnly && <Badge variant="outline" className="text-[10px] bg-muted/40 text-muted-foreground">Read Only</Badge>}
    {notPublic && <Badge variant="outline" className="text-[10px] bg-slate-500/10 text-slate-700 border-slate-400/20">Not Currently Used Publicly</Badge>}
    {needsMigration && <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 border-amber-400/30">Needs Migration</Badge>}
  </div>
);

const EmptyFilterState = () => (
  <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 p-8 text-center text-sm text-muted-foreground">
    No Website Manager entries match the current search and filter.
  </div>
);

const WebsiteManager = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [contentSlots, setContentSlots] = useState<ContentSlot[]>([]);
  const [imageSlots, setImageSlots] = useState<ImageSlot[]>([]);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [carouselItems, setCarouselItems] = useState<Record<string, CarouselItem[]>>({});
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [listContent, setListContent] = useState<ListContent>({
    testimonials_list: staticTestimonials,
    services_list: staticServices,
    benefits_list: staticBenefits,
  });
  const [previewData, setPreviewData] = useState<{ content: Record<string, string>; images: Record<string, any> } | null>(null);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [publishing, setPublishing] = useState(false);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<VisibilityFilter>("all");
  const [loadErrors, setLoadErrors] = useState<string[]>([]);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    setLoadErrors([]);
    try {
      const requests = [
        { key: "content", label: "Content slots", run: () => cmsApi("/cms/content") },
        { key: "images", label: "Image slots", run: () => cmsApi("/cms/images") },
        { key: "catalog", label: "Marketplace catalog", run: () => cmsApi("/cms/catalog") },
        { key: "lists", label: "CMS lists", run: () => cmsApi("/cms/lists") },
        { key: "faqs", label: "FAQs", run: () => cmsApi("/cms/faqs") },
        ...CAROUSEL_SLOTS.map(s => ({
          key: `carousel:${s.key}`,
          label: `${s.label}`,
          run: () => cmsApi(`/cms/carousel/${s.key}`),
        })),
      ];

      const results = await Promise.allSettled(requests.map(request => request.run()));
      const byKey: Record<string, any> = {};
      const errors: string[] = [];

      results.forEach((result, index) => {
        const request = requests[index];
        if (result.status === "fulfilled") {
          byKey[request.key] = result.value;
        } else {
          errors.push(`${request.label}: ${result.reason?.message || "Failed to load"}`);
        }
      });

      if (byKey.content) setContentSlots(byKey.content.slots || []);
      if (byKey.images) setImageSlots(byKey.images.images || []);
      if (byKey.catalog) setCatalogItems(byKey.catalog.items || []);
      if (byKey.faqs) setFaqs(byKey.faqs.faqs || []);

      // Merge DB list data with static fallbacks
      const listsMap: Record<string, unknown[]> = {};
      for (const row of (byKey.lists?.lists || [])) {
        try { listsMap[row.key] = JSON.parse(row.value); } catch { /* keep fallback */ }
      }
      setListContent({
        testimonials_list: (listsMap["testimonials_list"] as TestimonialItem[]) ?? staticTestimonials,
        services_list: (listsMap["services_list"] as ServiceItem[]) ?? staticServices,
        benefits_list: (listsMap["benefits_list"] as BenefitItem[]) ?? staticBenefits,
      });

      const carouselMap: Record<string, CarouselItem[]> = {};
      CAROUSEL_SLOTS.forEach((s) => { carouselMap[s.key] = byKey[`carousel:${s.key}`]?.items || []; });
      if (Object.keys(carouselMap).length > 0) setCarouselItems(carouselMap);

      setLoadErrors(errors);
      if (errors.length) {
        toast({
          title: "Some CMS data could not load",
          description: errors[0],
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({ title: "Failed to load CMS data", description: err.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  const fetchPreview = async () => {
    try {
      const res = await cmsApi("/cms/preview");
      setPreviewData(res);
    } catch (err: any) {
      toast({ title: "Preview failed", description: err.message, variant: "destructive" });
    }
  };

  const publishAll = async () => {
    setPublishing(true);
    try {
      const res = await cmsApi("/cms/publish-all", "POST");
      toast({ title: "Published", description: `${res.contentPublished} content + ${res.imagesPublished} image slot(s) published.` });
      fetchAll();
    } catch (err: any) {
      toast({ title: "Publish failed", description: err.message, variant: "destructive" });
    } finally { setPublishing(false); }
  };

  const hasDrafts =
    contentSlots.some(s => s.draft_value) ||
    imageSlots.some(s => s.draft_image_url || s.draft_focal_x != null || s.draft_alt_text);

  const filteredContentSlots = useMemo(() => CONTENT_SLOTS.filter((slot) => {
    const usage = CONTENT_USAGE[slot.key];
    return entryMatches(search, activeFilter, {
      text: `${slot.key} ${slot.label} ${usage?.whereUsed ?? ""} ${usage?.source ?? ""} ${usage?.note ?? ""}`,
      kind: "content",
      source: usage?.source,
      needsMigration: usage?.needsMigration,
      cms: true,
    });
  }), [search, activeFilter]);

  const filteredImageSlots = useMemo(() => IMAGE_SLOTS.filter((slot) => {
    const usage = IMAGE_USAGE[slot.key];
    return entryMatches(search, activeFilter, {
      text: `${slot.key} ${slot.label} ${usage?.whereUsed ?? ""} ${usage?.source ?? ""} ${usage?.note ?? ""}`,
      kind: "images",
      source: usage?.source,
      needsMigration: usage?.notPublic,
      cms: true,
    });
  }), [search, activeFilter]);

  const showLists = activeFilter === "all" || activeFilter === "content" || activeFilter === "cms" || activeFilter === "fallback" || activeFilter === "needs_migration";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
      </div>
    );
  }

  return (
    <div className="grid gap-8">
      <div className="flex items-start justify-between gap-4">
        <SectionHeading
          eyebrow="CMS"
          title="Website Manager"
          description="Primary public website presentation manager for CMS slots, images, carousel, visibility, and preview."
        />
        {hasDrafts && (
          <Button onClick={publishAll} disabled={publishing} className="rounded-xl shadow-brand shrink-0">
            {publishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Publish All Changes
          </Button>
        )}
      </div>

      <AdminOwnershipNote
        title="Primary public website manager"
        description="Use this page for website presentation, visibility, draft/publish, images, and public-facing CMS clarity. Legacy Content still exists for Blog and direct record management."
      >
        <AdminOwnershipBadge kind="primary" />
        <AdminOwnershipBadge kind="visibility" />
      </AdminOwnershipNote>

      {hasDrafts && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          You have unpublished draft changes. Use "Publish All Changes" to make them live, or publish each slot individually.
        </div>
      )}

      {loadErrors.length > 0 && (
        <div className="rounded-xl border border-red-400/30 bg-red-500/5 px-4 py-3 text-sm text-red-700">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Some live CMS data did not load.</p>
              <p className="mt-1">If you see "Forbidden: admin access required", the server does not see this Supabase profile as `admin`, even if the client route allowed the page.</p>
              <ul className="mt-2 list-disc pl-5 text-xs">
                {loadErrors.slice(0, 4).map((error) => <li key={error}>{error}</li>)}
              </ul>
            </div>
          </div>
        </div>
      )}

      <Card className="rounded-2xl border-border/60 bg-card/95">
        <CardContent className="p-4 space-y-3">
          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <Label htmlFor="visibility-search" className="text-xs text-muted-foreground">Search Website Manager visibility</Label>
              <Input
                id="visibility-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search slots, fallback assets, where-used labels..."
                className="mt-1 rounded-xl"
              />
            </div>
            <div className="flex flex-wrap gap-1.5 md:max-w-xl md:justify-end">
              {FILTERS.map((filter) => (
                <Button
                  key={filter.value}
                  type="button"
                  size="sm"
                  variant={activeFilter === filter.value ? "default" : "outline"}
                  className="h-8 rounded-xl px-3 text-xs"
                  onClick={() => setActiveFilter(filter.value)}
                >
                  {filter.label}
                </Button>
              ))}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            These controls affect Website Manager visibility only. They do not change public rendering, fallback order, or publish behavior.
          </p>
        </CardContent>
      </Card>

      <Tabs defaultValue="content">
        <TabsList className="flex w-full overflow-x-auto">
          <TabsTrigger value="content" className="flex-1 min-w-[100px]"><FileText className="mr-1.5 h-4 w-4" />Content</TabsTrigger>
          <TabsTrigger value="lists" className="flex-1 min-w-[100px]"><List className="mr-1.5 h-4 w-4" />Lists</TabsTrigger>
          <TabsTrigger value="faqs" className="flex-1 min-w-[100px]"><HelpCircle className="mr-1.5 h-4 w-4" />FAQs</TabsTrigger>
          <TabsTrigger value="images" className="flex-1 min-w-[100px]"><ImageIcon className="mr-1.5 h-4 w-4" />Images</TabsTrigger>
          <TabsTrigger value="marketplace" className="flex-1 min-w-[100px]"><ShoppingBag className="mr-1.5 h-4 w-4" />Marketplace</TabsTrigger>
          <TabsTrigger value="visibility" className="flex-1 min-w-[100px]"><Eye className="mr-1.5 h-4 w-4" />Visibility</TabsTrigger>
          <TabsTrigger value="preview" className="flex-1 min-w-[100px]" onClick={fetchPreview}><Eye className="mr-1.5 h-4 w-4" />Preview</TabsTrigger>
        </TabsList>

        {/* ── Content Tab ── */}
        <TabsContent value="content" className="mt-6 space-y-4">
          {filteredContentSlots.length === 0 && <EmptyFilterState />}
          {filteredContentSlots.map((slot) => {
            const row = contentSlots.find(s => s.key === slot.key);
            return (
              <ContentSlotEditor
                key={slot.key}
                slotDef={slot}
                row={row ?? null}
                onSaved={(updated) => setContentSlots(prev => {
                  const idx = prev.findIndex(s => s.key === slot.key);
                  if (idx >= 0) { const next = [...prev]; next[idx] = updated; return next; }
                  return [...prev, updated];
                })}
              />
            );
          })}
        </TabsContent>

        {/* ── Lists Tab ── */}
        <TabsContent value="lists" className="mt-6 space-y-6">
          <div className="rounded-xl border border-blue-400/20 bg-blue-500/5 px-4 py-3 text-sm text-blue-700 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>Changes to lists are published immediately and update the live site. The static built-in data is used as a fallback if the CMS list is empty.</span>
          </div>
          {showLists ? (
            <ListsManager
              listContent={listContent}
              search={search}
              activeFilter={activeFilter}
              onListChanged={(key, items) => setListContent(prev => ({ ...prev, [key]: items }))}
            />
          ) : <EmptyFilterState />}
        </TabsContent>

        {/* ── FAQs Tab ── */}
        <TabsContent value="faqs" className="mt-6">
          <div className="mb-4">
            <AdminOwnershipNote
              title="Public website FAQ visibility"
              description="This tab clarifies FAQs as public website content. Legacy FAQ record management remains available under Blog & FAQs until consolidation."
            >
              <AdminOwnershipBadge kind="visibility" />
            </AdminOwnershipNote>
          </div>
          <FAQManager faqs={faqs} onFaqsChange={setFaqs} />
        </TabsContent>

        {/* ── Images Tab ── */}
        <TabsContent value="images" className="mt-6 space-y-6">

          {/* Carousel Slots */}
          {CAROUSEL_SLOTS.map((slot) => (
            <CarouselSlotEditor
              key={slot.key}
              slotDef={slot}
              items={carouselItems[slot.key] || []}
              search={search}
              activeFilter={activeFilter}
              onItemsChange={(items) => setCarouselItems(prev => ({ ...prev, [slot.key]: items }))}
            />
          ))}

          {/* Divider */}
          <div className="flex items-center gap-3 py-2">
            <div className="flex-1 border-t border-border/40" />
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Single Image Slots</span>
            <div className="flex-1 border-t border-border/40" />
          </div>

          {/* Standalone Image Slots */}
          {filteredImageSlots.length === 0 && <EmptyFilterState />}
          {filteredImageSlots.map((slot) => {
            const row = imageSlots.find(s => s.key === slot.key) ?? null;
            return (
              <ImageSlotEditor
                key={slot.key}
                slotDef={slot}
                row={row}
                onSaved={(updated) => setImageSlots(prev => {
                  const idx = prev.findIndex(s => s.key === slot.key);
                  if (idx >= 0) { const next = [...prev]; next[idx] = updated; return next; }
                  return [...prev, updated];
                })}
              />
            );
          })}
        </TabsContent>

        {/* ── Marketplace Tab ── */}
        <TabsContent value="marketplace" className="mt-6">
          <div className="mb-4">
            <AdminOwnershipNote
              title="Marketplace visibility and website presentation"
              description="This tab shows marketplace records in the Website Manager context. Operational product record management remains available through the Marketplace Products legacy tool."
            >
              <AdminOwnershipBadge kind="visibility" />
            </AdminOwnershipNote>
          </div>
          <MarketplaceManager
            items={catalogItems}
            search={search}
            activeFilter={activeFilter}
            onItemsChange={setCatalogItems}
          />
        </TabsContent>

        <TabsContent value="visibility" className="mt-6">
          <VisibilityInventory search={search} activeFilter={activeFilter} />
        </TabsContent>

        {/* ── Preview Tab ── */}
        <TabsContent value="preview" className="mt-6">
          <PreviewPanel
            data={previewData}
            mode={previewMode}
            onModeChange={setPreviewMode}
            onRefresh={fetchPreview}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

// ── Content Slot Editor ───────────────────────────────────────────────────────
const ContentSlotEditor = ({
  slotDef, row, onSaved,
}: {
  slotDef: { key: string; label: string; maxLength: number };
  row: ContentSlot | null;
  onSaved: (updated: ContentSlot) => void;
}) => {
  const { toast } = useToast();
  const published = row?.value ?? CONTENT_DEFAULTS[slotDef.key] ?? "";
  const [draft, setDraft] = useState(row?.draft_value ?? "");
  const [saving, setSaving] = useState(false);
  const hasDraft = !!row?.draft_value;
  const isMultiline = slotDef.maxLength > 80;
  const usage = CONTENT_USAGE[slotDef.key];

  const saveDraft = async () => {
    const value = draft.trim();
    if (!value) { toast({ title: "Cannot save empty value", variant: "destructive" }); return; }
    if (value.length > slotDef.maxLength) { toast({ title: `Max ${slotDef.maxLength} characters`, variant: "destructive" }); return; }
    setSaving(true);
    try {
      const res = await cmsApi(`/cms/content/${slotDef.key}`, "PATCH", { value });
      onSaved(res.slot);
      toast({ title: "Draft saved" });
    } catch (err: any) { toast({ title: "Save failed", description: err.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const publish = async () => {
    setSaving(true);
    try {
      const res = await cmsApi(`/cms/content/${slotDef.key}/publish`, "POST");
      onSaved(res.slot);
      setDraft("");
      toast({ title: "Published" });
    } catch (err: any) { toast({ title: "Publish failed", description: err.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const discard = async () => {
    setSaving(true);
    try {
      const res = await cmsApi(`/cms/content/${slotDef.key}/discard`, "POST");
      onSaved(res.slot);
      setDraft("");
      toast({ title: "Draft discarded" });
    } catch (err: any) { toast({ title: "Discard failed", description: err.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };

  return (
    <Card className="rounded-2xl border-border/60 bg-card/95">
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <p className="font-semibold text-sm text-foreground">{slotDef.label}</p>
            <p className="text-xs text-muted-foreground font-mono">{slotDef.key}</p>
            {usage && <WhereUsed value={usage.whereUsed} />}
            {usage?.note && <p className="mt-2 text-xs text-muted-foreground">{usage.note}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {usage && <SourceBadges source={usage.source} needsMigration={usage.needsMigration} />}
            {hasDraft && <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-400/30 text-xs">Draft</Badge>}
            {!hasDraft && <Badge variant="outline" className="bg-green-500/10 text-green-700 text-xs">Published</Badge>}
          </div>
        </div>

        {/* Current published value */}
        <div className="mb-3 rounded-lg bg-muted/30 border border-border/40 px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Live</p>
          <p className="text-sm text-foreground">{published || <span className="italic text-muted-foreground">Empty</span>}</p>
        </div>

        {/* Draft editor */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Edit Draft</Label>
          {isMultiline ? (
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={published}
              rows={3}
              maxLength={slotDef.maxLength}
              className="resize-none rounded-xl text-sm"
            />
          ) : (
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={published}
              maxLength={slotDef.maxLength}
              className="rounded-xl text-sm"
            />
          )}
          <div className="flex items-center justify-between">
            <p className={`text-xs ${draft.length > slotDef.maxLength * 0.9 ? "text-amber-600" : "text-muted-foreground"}`}>
              {draft.length} / {slotDef.maxLength}
            </p>
            <div className="flex gap-2">
              {hasDraft && (
                <>
                  <Button size="sm" variant="ghost" className="h-8 px-3 text-xs rounded-xl" onClick={discard} disabled={saving}>
                    <RotateCcw className="mr-1 h-3 w-3" />Discard
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 px-3 text-xs rounded-xl" onClick={publish} disabled={saving}>
                    <Send className="mr-1 h-3 w-3" />Publish
                  </Button>
                </>
              )}
              <Button size="sm" className="h-8 px-3 text-xs rounded-xl shadow-brand" onClick={saveDraft} disabled={saving || !draft.trim()}>
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="mr-1 h-3 w-3" />}
                Save Draft
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// ── Image Slot Editor ─────────────────────────────────────────────────────────
const ImageSlotEditor = ({
  slotDef, row, onSaved,
}: {
  slotDef: { key: string; label: string; hint: string };
  row: ImageSlot | null;
  onSaved: (updated: ImageSlot) => void;
}) => {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [focalX, setFocalX] = useState(row?.draft_focal_x ?? row?.focal_x ?? 50);
  const [focalY, setFocalY] = useState(row?.draft_focal_y ?? row?.focal_y ?? 50);
  const [altText, setAltText] = useState(row?.draft_alt_text ?? row?.alt_text ?? "");

  const publishedUrl = row?.image_url ?? null;
  const draftUrl = row?.draft_image_url ?? null;
  const previewUrl = draftUrl ?? publishedUrl;
  const hasDraft = !!(row?.draft_image_url || row?.draft_focal_x != null || row?.draft_alt_text);
  const usage = IMAGE_USAGE[slotDef.key];

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type + size
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/avif"];
    if (!allowedTypes.includes(file.type)) {
      toast({ title: "Invalid file type", description: "Allowed: JPG, PNG, WebP, AVIF", variant: "destructive" }); return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum 5 MB", variant: "destructive" }); return;
    }

    setUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const ext = file.name.split(".").pop();
      const path = `${slotDef.key}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("site-images").upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("site-images").getPublicUrl(path);
      const publicUrl = urlData.publicUrl;

      // Save as draft
      const res = await cmsApi(`/cms/images/${slotDef.key}`, "PATCH", { draft_image_url: publicUrl });
      onSaved(res.image);
      toast({ title: "Image uploaded as draft" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  const saveFocalDraft = async () => {
    setSaving(true);
    try {
      const res = await cmsApi(`/cms/images/${slotDef.key}`, "PATCH", {
        draft_focal_x: focalX, draft_focal_y: focalY,
        draft_alt_text: altText.trim() || undefined,
      });
      onSaved(res.image);
      toast({ title: "Draft saved" });
    } catch (err: any) { toast({ title: "Save failed", description: err.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const publish = async () => {
    setSaving(true);
    try {
      const res = await cmsApi(`/cms/images/${slotDef.key}/publish`, "POST");
      onSaved(res.image);
      toast({ title: "Image published" });
    } catch (err: any) { toast({ title: "Publish failed", description: err.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const discard = async () => {
    setSaving(true);
    try {
      const res = await cmsApi(`/cms/images/${slotDef.key}/discard`, "POST");
      onSaved(res.image);
      setFocalX(res.image.focal_x); setFocalY(res.image.focal_y);
      setAltText(res.image.alt_text ?? "");
      toast({ title: "Draft discarded" });
    } catch (err: any) { toast({ title: "Discard failed", description: err.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };

  return (
    <Card className="rounded-2xl border-border/60 bg-card/95">
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <p className="font-semibold text-sm text-foreground">{slotDef.label}</p>
            <p className="text-xs text-muted-foreground font-mono">{slotDef.key} · {slotDef.hint}</p>
            {usage && <WhereUsed value={usage.whereUsed} />}
            {usage?.note && <p className="mt-2 text-xs text-muted-foreground">{usage.note}</p>}
          </div>
          <div className="flex items-center gap-2">
            {usage && <SourceBadges source={usage.source} notPublic={usage.notPublic} needsMigration={usage.notPublic} />}
            {hasDraft && <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-400/30 text-xs">Draft</Badge>}
            {!hasDraft && <Badge variant="outline" className="bg-green-500/10 text-green-700 text-xs">{publishedUrl ? "Published" : "No Image"}</Badge>}
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Live preview with focal point */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Preview (draft applied)</p>
            <div
              className="relative w-full aspect-video rounded-xl overflow-hidden bg-muted/30 border border-border/40"
            >
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt={altText || slotDef.label}
                  className="h-full w-full object-cover"
                  style={{ objectPosition: `${focalX}% ${focalY}%` }}
                />
              ) : (
                <div className="h-full flex flex-col items-center justify-center gap-2 text-muted-foreground/40">
                  <ImageIcon className="h-10 w-10" />
                  <span className="text-xs">No image set</span>
                </div>
              )}
              {/* Focal point crosshair */}
              {previewUrl && (
                <div
                  className="absolute h-4 w-4 rounded-full border-2 border-white shadow-lg -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ left: `${focalX}%`, top: `${focalY}%`, background: "rgba(255,255,255,0.6)" }}
                />
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="space-y-4">
            {/* Upload */}
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Replace Image</Label>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="hidden" onChange={handleFileUpload} />
              <Button variant="outline" size="sm" className="rounded-xl w-full" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                {uploading ? "Uploading…" : "Upload Image"}
              </Button>
            </div>

            {/* Focal X */}
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Focal Point X — {focalX}%</Label>
              <Slider min={0} max={100} step={1} value={[focalX]} onValueChange={([v]) => setFocalX(v)} className="w-full" />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1"><span>Left</span><span>Center</span><span>Right</span></div>
            </div>

            {/* Focal Y */}
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Focal Point Y — {focalY}%</Label>
              <Slider min={0} max={100} step={1} value={[focalY]} onValueChange={([v]) => setFocalY(v)} className="w-full" />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1"><span>Top</span><span>Center</span><span>Bottom</span></div>
            </div>

            {/* Alt text */}
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Alt Text</Label>
              <Input value={altText} onChange={(e) => setAltText(e.target.value)} maxLength={200} placeholder="Describe the image" className="rounded-xl text-sm" />
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              {hasDraft && (
                <>
                  <Button size="sm" variant="ghost" className="h-8 px-3 text-xs rounded-xl flex-1" onClick={discard} disabled={saving}>
                    <RotateCcw className="mr-1 h-3 w-3" />Discard
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 px-3 text-xs rounded-xl flex-1" onClick={publish} disabled={saving}>
                    <Send className="mr-1 h-3 w-3" />Publish
                  </Button>
                </>
              )}
              <Button size="sm" className="h-8 px-3 text-xs rounded-xl shadow-brand flex-1" onClick={saveFocalDraft} disabled={saving}>
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="mr-1 h-3 w-3" />}
                Save Draft
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// ── Marketplace Manager ───────────────────────────────────────────────────────
const MarketplaceManager = ({
  items, search, activeFilter, onItemsChange,
}: {
  items: CatalogItem[];
  search: string;
  activeFilter: VisibilityFilter;
  onItemsChange: (items: CatalogItem[]) => void;
}) => {
  const { toast } = useToast();
  const visibleItems = items.filter((item) => entryMatches(search, activeFilter, {
    text: `${item.name} ${item.slug} ${item.category} Customer Marketplace Live Customer Marketplace catalog_items`,
    kind: "marketplace",
    source: "CMS Managed",
    cms: true,
  }));
  const showFallbackNotice = entryMatches(search, activeFilter, {
    text: "Marketplace Seed Fallback Static Fallback Needs Migration Customer Marketplace useCatalogItems",
    kind: "marketplace",
    source: "Static Fallback",
    fallback: true,
    needsMigration: true,
  });

  const toggleActive = async (item: CatalogItem) => {
    try {
      const res = await cmsApi(`/cms/catalog/${item.id}`, "PATCH", { active: !item.active });
      onItemsChange(items.map(i => i.id === item.id ? res.item : i));
    } catch (err: any) { toast({ title: "Update failed", description: err.message, variant: "destructive" }); }
  };

  const toggleFeatured = async (item: CatalogItem) => {
    try {
      const res = await cmsApi(`/cms/catalog/${item.id}`, "PATCH", { is_featured: !item.is_featured });
      onItemsChange(items.map(i => i.id === item.id ? res.item : i));
    } catch (err: any) { toast({ title: "Update failed", description: err.message, variant: "destructive" }); }
  };

  const deleteItem = async (id: string) => {
    try {
      await cmsApi(`/cms/catalog/${id}`, "DELETE");
      onItemsChange(items.map(i => i.id === id ? { ...i, active: false } : i));
      toast({ title: "Item deactivated" });
    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-blue-400/20 bg-blue-500/5 px-4 py-3 text-sm text-blue-700 flex items-start gap-2">
        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
        <span>Active catalog records are used in the live customer marketplace. If the database is empty or unavailable, customer marketplace rendering falls back to a code-backed seed item.</span>
      </div>
      {showFallbackNotice && (
        <Card className="rounded-2xl border-amber-400/30 bg-amber-500/5">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Marketplace Seed Fallback</p>
                <WhereUsed value="Customer Marketplace fallback when catalog_items is empty or unavailable" />
                <p className="mt-2 text-xs text-muted-foreground">Read-only code fallback from useCatalogItems.ts. It is not a live catalog record and cannot be edited here.</p>
              </div>
              <SourceBadges source="Static Fallback" readOnly needsMigration />
            </div>
          </CardContent>
        </Card>
      )}
      <div className="flex justify-end">
        <NewCatalogItemDialog
          onCreated={(item) => { onItemsChange([item, ...items]); toast({ title: "Product added" }); }}
        />
      </div>

      {visibleItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 p-12 text-center text-muted-foreground">
          No marketplace products match the current search and filter.
        </div>
      ) : (
        <div className="grid gap-3">
          {visibleItems.map((item) => (
            <Card key={item.id} className={`rounded-2xl border-border/60 ${!item.active ? "opacity-50" : ""}`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  {/* Thumbnail */}
                  <div className="h-14 w-14 rounded-xl overflow-hidden bg-muted/30 border border-border/40 shrink-0">
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full flex items-center justify-center text-muted-foreground/30">
                        <ShoppingBag className="h-6 w-6" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm truncate">{item.name}</p>
                      <Badge variant="outline" className="text-[10px]">{item.category}</Badge>
                      {item.is_featured && <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20">Featured</Badge>}
                      <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-700 border-green-400/20">Live Customer Marketplace</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {item.price_cents != null ? `$${(item.price_cents / 100).toFixed(2)}` : "Variable pricing"}
                    </p>
                    <WhereUsed value="Customer Marketplace" />
                  </div>

                  {/* Controls */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-[10px] text-muted-foreground">Active</span>
                      <Switch checked={item.active} onCheckedChange={() => toggleActive(item)} />
                    </div>
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-[10px] text-muted-foreground">Featured</span>
                      <Switch checked={item.is_featured} onCheckedChange={() => toggleFeatured(item)} />
                    </div>
                    <EditCatalogItemDialog
                      item={item}
                      onSaved={(updated) => onItemsChange(items.map(i => i.id === updated.id ? updated : i))}
                    />
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={() => deleteItem(item.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Preview Panel ─────────────────────────────────────────────────────────────
const PreviewPanel = ({
  data, mode, onModeChange, onRefresh,
}: {
  data: { content: Record<string, string>; images: Record<string, any> } | null;
  mode: "desktop" | "mobile";
  onModeChange: (m: "desktop" | "mobile") => void;
  onRefresh: () => void;
}) => {
  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-muted-foreground">
        <Eye className="h-12 w-12 opacity-20" />
        <p className="text-sm">Click the Preview tab to load draft content preview.</p>
        <Button variant="outline" onClick={onRefresh} className="rounded-xl">Load Preview</Button>
      </div>
    );
  }

  const c = data.content;
  const img = data.images;
  const heroImg = img.hero_image;

  return (
    <div className="space-y-4">
      {/* Mode toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 rounded-xl border border-border/60 p-1 bg-muted/20">
          <Button size="sm" variant={mode === "desktop" ? "default" : "ghost"} className="h-8 rounded-lg px-3" onClick={() => onModeChange("desktop")}>
            <Monitor className="mr-2 h-4 w-4" />Desktop
          </Button>
          <Button size="sm" variant={mode === "mobile" ? "default" : "ghost"} className="h-8 rounded-lg px-3" onClick={() => onModeChange("mobile")}>
            <Smartphone className="mr-2 h-4 w-4" />Mobile
          </Button>
        </div>
        <Button variant="outline" size="sm" className="rounded-xl" onClick={onRefresh}>
          <RotateCcw className="mr-2 h-4 w-4" />Refresh Preview
        </Button>
      </div>

      <div className="flex justify-center">
        <div
          className="border border-border/60 rounded-2xl overflow-hidden shadow-soft transition-all"
          style={{ width: mode === "mobile" ? "390px" : "100%", maxWidth: "100%" }}
        >
          {/* Simulated header */}
          <div className="bg-background/80 border-b border-border/40 px-6 py-3 flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-primary/10" />
            <div className="space-y-1">
              <div className="h-2.5 w-28 rounded bg-foreground/20" />
              <div className="h-1.5 w-36 rounded bg-muted-foreground/20" />
            </div>
          </div>

          {/* Hero section preview */}
          <div
            className="relative min-h-[320px] flex items-center"
            style={{
              background: heroImg?.url
                ? `url(${heroImg.url}) center/cover`
                : "linear-gradient(135deg, #0f2027, #203a43, #2c5364)",
            }}
          >
            <div className="absolute inset-0 bg-black/40" />
            <div className="relative z-10 px-8 py-12 max-w-xl">
              <h1 className="text-white font-bold text-2xl leading-tight mb-3">
                {c.hero_title || "Hero Title"}
              </h1>
              <p className="text-white/80 text-sm mb-6">
                {c.hero_subtitle || "Hero subtitle text"}
              </p>
              <div className="flex gap-3 flex-wrap">
                <div className="rounded-full bg-primary px-4 py-2 text-white text-sm font-semibold">
                  {c.hero_cta_text || "Schedule Service"}
                </div>
                <div className="rounded-full border border-white/40 px-4 py-2 text-white text-sm font-semibold">
                  {c.hero_cta_secondary || "Check Pricing"}
                </div>
              </div>
            </div>
          </div>

          {/* Services intro */}
          <div className="bg-background px-8 py-8">
            <p className="text-muted-foreground text-sm">{c.services_intro || "Services intro"}</p>
          </div>

          {/* Draft badge */}
          <div className="bg-amber-500/5 border-t border-amber-400/20 px-8 py-3 flex items-center gap-2">
            <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
            <p className="text-xs text-amber-700 font-medium">DRAFT PREVIEW — Not visible to public</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── New / Edit Catalog Item Dialogs ───────────────────────────────────────────
const NewCatalogItemDialog = ({ onCreated }: { onCreated: (item: CatalogItem) => void }) => {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [name, setName] = useState(""); const [slug, setSlug] = useState("");
  const [description, setDescription] = useState(""); const [price, setPrice] = useState("");
  const [category, setCategory] = useState("product"); const [imageUrl, setImageUrl] = useState("");

  const autoSlug = (n: string) => n.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  const handleSubmit = async () => {
    if (!name.trim() || !slug.trim()) { toast({ title: "Name and slug required", variant: "destructive" }); return; }
    const price_cents = price ? Math.round(parseFloat(price) * 100) : null;
    setSaving(true);
    try {
      const res = await cmsApi("/cms/catalog", "POST", {
        name: name.trim(), slug: slug.trim() || autoSlug(name),
        description: description.trim() || null, price_cents,
        category, image_url: imageUrl.trim() || null,
        price_type: price_cents ? "fixed" : "consultation",
      });
      onCreated(res.item);
      setOpen(false); setName(""); setSlug(""); setDescription(""); setPrice(""); setImageUrl("");
    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const publicUrl = await uploadSiteImage(file, "marketplace");
      setImageUrl(publicUrl);
      toast({ title: "Product image uploaded", description: "Save the product to use this image on the marketplace." });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploadingImage(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-xl shadow-brand"><Plus className="mr-2 h-4 w-4" />Add Product</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Add Marketplace Product</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Name *</Label><Input value={name} onChange={(e) => { setName(e.target.value); setSlug(autoSlug(e.target.value)); }} /></div>
          <div><Label>Slug</Label><Input value={slug} onChange={(e) => setSlug(e.target.value)} className="font-mono text-sm" /></div>
          <div><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Price (USD)</Label><Input type="number" min="0" step="0.01" placeholder="0.00" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
            <div><Label>Category</Label>
              <select className="w-full h-10 rounded-xl border border-border/60 bg-background px-3 text-sm" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="add_on">Add-on</option>
                <option value="product">Product</option>
                <option value="service">Service</option>
                <option value="consultation">Consultation</option>
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Product Image</Label>
            <div className="flex gap-2">
              <Input placeholder="https://…" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="hidden" onChange={handleImageUpload} />
              <Button type="button" variant="outline" className="shrink-0 rounded-xl" onClick={() => fileRef.current?.click()} disabled={uploadingImage}>
                {uploadingImage ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                {uploadingImage ? "Uploading…" : "Upload"}
              </Button>
            </div>
            {imageUrl && (
              <div className="h-20 w-28 overflow-hidden rounded-lg border border-border/50 bg-muted/30">
                <img src={imageUrl} alt="Product preview" className="h-full w-full object-cover" />
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || saving}>{saving ? "Saving…" : "Add Product"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const EditCatalogItemDialog = ({ item, onSaved }: { item: CatalogItem; onSaved: (item: CatalogItem) => void }) => {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [name, setName] = useState(item.name);
  const [description, setDescription] = useState(item.description ?? "");
  const [price, setPrice] = useState(item.price_cents != null ? (item.price_cents / 100).toFixed(2) : "");
  const [imageUrl, setImageUrl] = useState(item.image_url ?? "");
  const [displayOrder, setDisplayOrder] = useState(String(item.display_order ?? 99));

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const price_cents = price ? Math.round(parseFloat(price) * 100) : null;
      const res = await cmsApi(`/cms/catalog/${item.id}`, "PATCH", {
        name: name.trim(), description: description.trim() || null,
        price_cents, image_url: imageUrl.trim() || null,
        display_order: parseInt(displayOrder, 10) || 99,
      });
      onSaved(res.item);
      setOpen(false);
      toast({ title: "Product updated" });
    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const publicUrl = await uploadSiteImage(file, "marketplace");
      setImageUrl(publicUrl);
      toast({ title: "Product image uploaded", description: "Save changes to use this image on the marketplace." });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploadingImage(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0"><FileText className="h-4 w-4" /></Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Edit: {item.name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Price (USD)</Label><Input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
            <div><Label>Display Order</Label><Input type="number" min="0" value={displayOrder} onChange={(e) => setDisplayOrder(e.target.value)} /></div>
          </div>
          <div className="space-y-2">
            <Label>Product Image</Label>
            <div className="flex gap-2">
              <Input placeholder="https://…" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="hidden" onChange={handleImageUpload} />
              <Button type="button" variant="outline" className="shrink-0 rounded-xl" onClick={() => fileRef.current?.click()} disabled={uploadingImage}>
                {uploadingImage ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                {uploadingImage ? "Uploading…" : "Upload"}
              </Button>
            </div>
            {imageUrl && (
              <div className="h-20 w-28 overflow-hidden rounded-lg border border-border/50 bg-muted/30">
                <img src={imageUrl} alt="Product preview" className="h-full w-full object-cover" />
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? "Saving…" : "Save Changes"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ── Lists Manager ─────────────────────────────────────────────────────────────
const ListsManager = ({
  listContent,
  search,
  activeFilter,
  onListChanged,
}: {
  listContent: ListContent;
  search: string;
  activeFilter: VisibilityFilter;
  onListChanged: (key: keyof ListContent, items: any[]) => void;
}) => {
  const showTestimonials = entryMatches(search, activeFilter, {
    text: `testimonials_list ${LIST_USAGE.testimonials_list.whereUsed} ${LIST_USAGE.testimonials_list.source}`,
    kind: "lists",
    source: LIST_USAGE.testimonials_list.source,
    cms: true,
    fallback: true,
  });
  const showServices = entryMatches(search, activeFilter, {
    text: `services_list ${LIST_USAGE.services_list.whereUsed} ${LIST_USAGE.services_list.source}`,
    kind: "lists",
    source: LIST_USAGE.services_list.source,
    cms: true,
    fallback: true,
  });
  const showBenefits = entryMatches(search, activeFilter, {
    text: `benefits_list ${LIST_USAGE.benefits_list.whereUsed} ${LIST_USAGE.benefits_list.source}`,
    kind: "lists",
    source: LIST_USAGE.benefits_list.source,
    cms: true,
    fallback: true,
  });
  return (
    <div className="space-y-8">
      {!showTestimonials && !showServices && !showBenefits && <EmptyFilterState />}
      {showTestimonials && (
        <TestimonialsEditor
          items={listContent.testimonials_list}
          onSaved={(items) => onListChanged("testimonials_list", items)}
        />
      )}
      {showServices && (
        <ServicesListEditor
          items={listContent.services_list}
          onSaved={(items) => onListChanged("services_list", items)}
        />
      )}
      {showBenefits && (
        <BenefitsEditor
          items={listContent.benefits_list}
          onSaved={(items) => onListChanged("benefits_list", items)}
        />
      )}
    </div>
  );
};

// Generic list save helper
async function saveList(key: string, items: unknown[], toast: ReturnType<typeof useToast>["toast"]): Promise<boolean> {
  try {
    await cmsApi(`/cms/lists/${key}`, "PUT", { value: JSON.stringify(items) });
    toast({ title: "List saved", description: "Changes are now live." });
    return true;
  } catch (err: any) {
    toast({ title: "Save failed", description: err.message, variant: "destructive" });
    return false;
  }
}

// ── Testimonials Editor ────────────────────────────────────────────────────────
const TestimonialsEditor = ({
  items: initialItems,
  onSaved,
}: {
  items: TestimonialItem[];
  onSaved: (items: TestimonialItem[]) => void;
}) => {
  const { toast } = useToast();
  const [items, setItems] = useState<TestimonialItem[]>(initialItems);
  const [saving, setSaving] = useState(false);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [draft, setDraft] = useState<TestimonialItem>({ name: "", location: "", rating: 5, body: "" });

  useEffect(() => { setItems(initialItems); }, [initialItems]);

  const openNew = () => {
    setDraft({ name: "", location: "", rating: 5, body: "" });
    setEditIdx(-1);
  };
  const openEdit = (i: number) => { setDraft({ ...items[i] }); setEditIdx(i); };
  const cancel = () => setEditIdx(null);

  const save = async () => {
    if (!draft.name.trim() || !draft.body.trim()) {
      toast({ title: "Name and review body required", variant: "destructive" }); return;
    }
    const next = editIdx === -1
      ? [...items, draft]
      : items.map((item, i) => i === editIdx ? draft : item);
    setSaving(true);
    const ok = await saveList("testimonials_list", next, toast);
    if (ok) { setItems(next); onSaved(next); setEditIdx(null); }
    setSaving(false);
  };

  const remove = async (i: number) => {
    const next = items.filter((_, idx) => idx !== i);
    setSaving(true);
    const ok = await saveList("testimonials_list", next, toast);
    if (ok) { setItems(next); onSaved(next); }
    setSaving(false);
  };

  return (
    <Card className="rounded-2xl border-border/60 bg-card/95">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Customer Testimonials</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Shown on homepage &amp; Reviews page · <span className="font-mono">testimonials_list</span></p>
            <WhereUsed value={LIST_USAGE.testimonials_list.whereUsed} />
            <div className="mt-2"><SourceBadges source={LIST_USAGE.testimonials_list.source} /></div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">{items.length} item{items.length !== 1 ? "s" : ""}</Badge>
            <Button size="sm" variant="outline" className="h-8 rounded-xl text-xs" onClick={openNew} disabled={saving}>
              <Plus className="mr-1 h-3 w-3" />Add
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {editIdx !== null && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
            <p className="text-xs font-semibold text-primary">{editIdx === -1 ? "New Testimonial" : "Edit Testimonial"}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label className="text-xs">Name</Label><Input value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} className="rounded-xl text-sm mt-1" placeholder="Sarah L." /></div>
              <div><Label className="text-xs">Location</Label><Input value={draft.location} onChange={e => setDraft(d => ({ ...d, location: e.target.value }))} className="rounded-xl text-sm mt-1" placeholder="Newport Beach" /></div>
            </div>
            <div>
              <Label className="text-xs">Rating (1–5)</Label>
              <Input type="number" min={1} max={5} value={draft.rating} onChange={e => setDraft(d => ({ ...d, rating: Math.min(5, Math.max(1, parseInt(e.target.value) || 5)) }))} className="rounded-xl text-sm mt-1 w-24" />
            </div>
            <div><Label className="text-xs">Review</Label><Textarea value={draft.body} onChange={e => setDraft(d => ({ ...d, body: e.target.value }))} rows={3} className="rounded-xl text-sm mt-1 resize-none" placeholder="What the customer said…" /></div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" className="h-8 rounded-xl text-xs" onClick={cancel}><X className="mr-1 h-3 w-3" />Cancel</Button>
              <Button size="sm" className="h-8 rounded-xl text-xs shadow-brand" onClick={save} disabled={saving}>
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="mr-1 h-3 w-3" />}Save
              </Button>
            </div>
          </div>
        )}
        {items.length === 0 && editIdx === null && (
          <div className="py-8 text-center text-sm text-muted-foreground">No testimonials. Add one above.</div>
        )}
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-3 rounded-xl border border-border/40 bg-muted/10 p-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">{item.name} <span className="font-normal text-muted-foreground">— {item.location}</span></p>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">"{item.body}"</p>
            </div>
            <div className="flex gap-1 shrink-0">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(i)} disabled={saving}><Edit2 className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(i)} disabled={saving}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

// ── Services List Editor ──────────────────────────────────────────────────────
const ServicesListEditor = ({
  items: initialItems,
  onSaved,
}: {
  items: ServiceItem[];
  onSaved: (items: ServiceItem[]) => void;
}) => {
  const { toast } = useToast();
  const [items, setItems] = useState<ServiceItem[]>(initialItems);
  const [saving, setSaving] = useState(false);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [draft, setDraft] = useState<ServiceItem>({ name: "", description: "" });

  useEffect(() => { setItems(initialItems); }, [initialItems]);

  const openNew = () => { setDraft({ name: "", description: "" }); setEditIdx(-1); };
  const openEdit = (i: number) => { setDraft({ ...items[i] }); setEditIdx(i); };
  const cancel = () => setEditIdx(null);

  const save = async () => {
    if (!draft.name.trim()) { toast({ title: "Service name required", variant: "destructive" }); return; }
    const next = editIdx === -1 ? [...items, draft] : items.map((item, i) => i === editIdx ? draft : item);
    setSaving(true);
    const ok = await saveList("services_list", next, toast);
    if (ok) { setItems(next); onSaved(next); setEditIdx(null); }
    setSaving(false);
  };

  const remove = async (i: number) => {
    const next = items.filter((_, idx) => idx !== i);
    setSaving(true);
    const ok = await saveList("services_list", next, toast);
    if (ok) { setItems(next); onSaved(next); }
    setSaving(false);
  };

  return (
    <Card className="rounded-2xl border-border/60 bg-card/95">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Services Catalog</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Service cards on homepage &amp; Services page · <span className="font-mono">services_list</span></p>
            <WhereUsed value={LIST_USAGE.services_list.whereUsed} />
            <div className="mt-2"><SourceBadges source={LIST_USAGE.services_list.source} /></div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">{items.length} item{items.length !== 1 ? "s" : ""}</Badge>
            <Button size="sm" variant="outline" className="h-8 rounded-xl text-xs" onClick={openNew} disabled={saving}><Plus className="mr-1 h-3 w-3" />Add</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {editIdx !== null && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
            <p className="text-xs font-semibold text-primary">{editIdx === -1 ? "New Service" : "Edit Service"}</p>
            <div><Label className="text-xs">Service Name</Label><Input value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} className="rounded-xl text-sm mt-1" placeholder="Mosquito perimeter treatment" /></div>
            <div><Label className="text-xs">Description</Label><Textarea value={draft.description} onChange={e => setDraft(d => ({ ...d, description: e.target.value }))} rows={2} className="rounded-xl text-sm mt-1 resize-none" /></div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" className="h-8 rounded-xl text-xs" onClick={cancel}><X className="mr-1 h-3 w-3" />Cancel</Button>
              <Button size="sm" className="h-8 rounded-xl text-xs shadow-brand" onClick={save} disabled={saving}>
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="mr-1 h-3 w-3" />}Save
              </Button>
            </div>
          </div>
        )}
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-3 rounded-xl border border-border/40 bg-muted/10 p-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">{item.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.description}</p>
            </div>
            <div className="flex gap-1 shrink-0">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(i)} disabled={saving}><Edit2 className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(i)} disabled={saving}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

// ── Benefits Editor ───────────────────────────────────────────────────────────
const BenefitsEditor = ({
  items: initialItems,
  onSaved,
}: {
  items: BenefitItem[];
  onSaved: (items: BenefitItem[]) => void;
}) => {
  const { toast } = useToast();
  const [items, setItems] = useState<BenefitItem[]>(initialItems);
  const [saving, setSaving] = useState(false);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [draft, setDraft] = useState<BenefitItem>({ title: "", description: "" });

  useEffect(() => { setItems(initialItems); }, [initialItems]);

  const openNew = () => { setDraft({ title: "", description: "" }); setEditIdx(-1); };
  const openEdit = (i: number) => { setDraft({ ...items[i] }); setEditIdx(i); };
  const cancel = () => setEditIdx(null);

  const save = async () => {
    if (!draft.title.trim()) { toast({ title: "Benefit title required", variant: "destructive" }); return; }
    const next = editIdx === -1 ? [...items, draft] : items.map((item, i) => i === editIdx ? draft : item);
    setSaving(true);
    const ok = await saveList("benefits_list", next, toast);
    if (ok) { setItems(next); onSaved(next); setEditIdx(null); }
    setSaving(false);
  };

  const remove = async (i: number) => {
    const next = items.filter((_, idx) => idx !== i);
    setSaving(true);
    const ok = await saveList("benefits_list", next, toast);
    if (ok) { setItems(next); onSaved(next); }
    setSaving(false);
  };

  return (
    <Card className="rounded-2xl border-border/60 bg-card/95">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Why Choose Us (Benefits)</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Benefit cards on homepage · <span className="font-mono">benefits_list</span></p>
            <WhereUsed value={LIST_USAGE.benefits_list.whereUsed} />
            <div className="mt-2"><SourceBadges source={LIST_USAGE.benefits_list.source} /></div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">{items.length} item{items.length !== 1 ? "s" : ""}</Badge>
            <Button size="sm" variant="outline" className="h-8 rounded-xl text-xs" onClick={openNew} disabled={saving}><Plus className="mr-1 h-3 w-3" />Add</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {editIdx !== null && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
            <p className="text-xs font-semibold text-primary">{editIdx === -1 ? "New Benefit" : "Edit Benefit"}</p>
            <div><Label className="text-xs">Title</Label><Input value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} className="rounded-xl text-sm mt-1" placeholder="Licensed & insured technicians" /></div>
            <div><Label className="text-xs">Description</Label><Textarea value={draft.description} onChange={e => setDraft(d => ({ ...d, description: e.target.value }))} rows={2} className="rounded-xl text-sm mt-1 resize-none" /></div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" className="h-8 rounded-xl text-xs" onClick={cancel}><X className="mr-1 h-3 w-3" />Cancel</Button>
              <Button size="sm" className="h-8 rounded-xl text-xs shadow-brand" onClick={save} disabled={saving}>
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="mr-1 h-3 w-3" />}Save
              </Button>
            </div>
          </div>
        )}
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-3 rounded-xl border border-border/40 bg-muted/10 p-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">{item.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.description}</p>
            </div>
            <div className="flex gap-1 shrink-0">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(i)} disabled={saving}><Edit2 className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(i)} disabled={saving}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

// ── FAQ Manager ───────────────────────────────────────────────────────────────
const FAQManager = ({
  faqs: initialFaqs,
  onFaqsChange,
}: {
  faqs: FaqItem[];
  onFaqsChange: (faqs: FaqItem[]) => void;
}) => {
  const { toast } = useToast();
  const [faqs, setFaqs] = useState<FaqItem[]>(initialFaqs);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [draft, setDraft] = useState({ question: "", answer: "", category: "" });

  useEffect(() => { setFaqs(initialFaqs); }, [initialFaqs]);

  const openNew = () => { setDraft({ question: "", answer: "", category: "" }); setIsNew(true); setEditId(null); };
  const openEdit = (faq: FaqItem) => { setDraft({ question: faq.question, answer: faq.answer, category: faq.category ?? "" }); setEditId(faq.id); setIsNew(false); };
  const cancel = () => { setEditId(null); setIsNew(false); };

  const saveNew = async () => {
    if (!draft.question.trim() || !draft.answer.trim()) {
      toast({ title: "Question and answer required", variant: "destructive" }); return;
    }
    setSaving(true);
    try {
      const res = await cmsApi("/cms/faqs", "POST", {
        question: draft.question.trim(), answer: draft.answer.trim(), category: draft.category.trim() || null,
      });
      const next = [...faqs, res.faq];
      setFaqs(next); onFaqsChange(next); setIsNew(false);
      toast({ title: "FAQ added" });
    } catch (err: any) { toast({ title: "Save failed", description: err.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const saveEdit = async () => {
    if (!editId || !draft.question.trim() || !draft.answer.trim()) return;
    setSaving(true);
    try {
      const res = await cmsApi(`/cms/faqs/${editId}`, "PATCH", {
        question: draft.question.trim(), answer: draft.answer.trim(), category: draft.category.trim() || null,
      });
      const next = faqs.map(f => f.id === editId ? res.faq : f);
      setFaqs(next); onFaqsChange(next); setEditId(null);
      toast({ title: "FAQ updated" });
    } catch (err: any) { toast({ title: "Update failed", description: err.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const toggleActive = async (faq: FaqItem) => {
    try {
      const res = await cmsApi(`/cms/faqs/${faq.id}`, "PATCH", { active: !faq.active });
      const next = faqs.map(f => f.id === faq.id ? res.faq : f);
      setFaqs(next); onFaqsChange(next);
    } catch (err: any) { toast({ title: "Update failed", description: err.message, variant: "destructive" }); }
  };

  const showEditor = isNew || editId !== null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">FAQ Management</p>
          <p className="text-xs text-muted-foreground">FAQs from the database override the built-in static FAQ list on the public site.</p>
        </div>
        <Button size="sm" variant="outline" className="h-8 rounded-xl text-xs" onClick={openNew} disabled={saving}>
          <Plus className="mr-1 h-3 w-3" />Add FAQ
        </Button>
      </div>

      {showEditor && (
        <Card className="rounded-2xl border-primary/30 bg-primary/5">
          <CardContent className="p-4 space-y-3">
            <p className="text-xs font-semibold text-primary">{isNew ? "New FAQ" : "Edit FAQ"}</p>
            <div><Label className="text-xs">Question</Label><Input value={draft.question} onChange={e => setDraft(d => ({ ...d, question: e.target.value }))} className="rounded-xl text-sm mt-1" placeholder="Is the treatment safe for kids and pets?" /></div>
            <div><Label className="text-xs">Answer</Label><Textarea value={draft.answer} onChange={e => setDraft(d => ({ ...d, answer: e.target.value }))} rows={4} className="rounded-xl text-sm mt-1 resize-none" /></div>
            <div><Label className="text-xs">Category (optional)</Label><Input value={draft.category} onChange={e => setDraft(d => ({ ...d, category: e.target.value }))} className="rounded-xl text-sm mt-1" placeholder="safety / pricing / scheduling" /></div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" className="h-8 rounded-xl text-xs" onClick={cancel}><X className="mr-1 h-3 w-3" />Cancel</Button>
              <Button size="sm" className="h-8 rounded-xl text-xs shadow-brand" onClick={isNew ? saveNew : saveEdit} disabled={saving}>
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="mr-1 h-3 w-3" />}Save
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {faqs.length === 0 && !showEditor && (
        <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 p-12 text-center">
          <HelpCircle className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No FAQs in database. The site uses built-in static FAQs as fallback.</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Add FAQs here to override the static list on the public FAQ page.</p>
        </div>
      )}

      <div className="space-y-3">
        {faqs.map((faq) => (
          <Card key={faq.id} className={`rounded-2xl border-border/60 ${!faq.active ? "opacity-50" : ""}`}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="text-sm font-semibold">{faq.question}</p>
                    {faq.category && <Badge variant="outline" className="text-[10px]">{faq.category}</Badge>}
                    {!faq.active && <Badge variant="outline" className="text-[10px] text-muted-foreground">Inactive</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{faq.answer}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-[10px] text-muted-foreground">Active</span>
                    <Switch checked={faq.active} onCheckedChange={() => toggleActive(faq)} />
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(faq)} disabled={saving}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

// ── Carousel Slot Editor ──────────────────────────────────────────────────────
const VisibilityInventory = ({ search, activeFilter }: { search: string; activeFilter: VisibilityFilter }) => {
  const visibleItems = STATIC_VISIBILITY_ITEMS.filter((item) => entryMatches(search, activeFilter, {
    text: `${item.title} ${item.kind} ${item.source} ${item.whereUsed} ${item.note}`,
    kind: item.kind === "Image" ? "images" : item.kind === "Marketplace" ? "marketplace" : "content",
    source: item.source,
    fallback: item.source.includes("Fallback"),
    needsMigration: true,
  }));

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-blue-400/20 bg-blue-500/5 px-4 py-3 text-sm text-blue-700 flex items-start gap-2">
        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
        <span>This inventory surfaces public static and fallback content for admin awareness only. Items here are read-only and are not automatically migrated into Supabase.</span>
      </div>
      {visibleItems.length === 0 ? (
        <EmptyFilterState />
      ) : (
        <div className="grid gap-3">
          {visibleItems.map((item) => (
            <Card key={item.title} className="rounded-2xl border-border/60 bg-card/95">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold">{item.title}</p>
                      <Badge variant="outline" className="text-[10px]">{item.kind}</Badge>
                    </div>
                    <WhereUsed value={item.whereUsed} />
                    <p className="mt-2 text-xs text-muted-foreground">{item.note}</p>
                  </div>
                  <SourceBadges source={item.source} readOnly needsMigration />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

const CarouselSlotEditor = ({
  slotDef,
  items,
  search,
  activeFilter,
  onItemsChange,
}: {
  slotDef: { key: string; label: string; hint: string };
  items: CarouselItem[];
  search: string;
  activeFilter: VisibilityFilter;
  onItemsChange: (items: CarouselItem[]) => void;
}) => {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const showCarousel = entryMatches(search, activeFilter, {
    text: `${slotDef.key} ${slotDef.label} Homepage Hero Carousel CMS Managed Static Fallback Needs Migration`,
    kind: "carousel",
    source: items.length > 0 ? "CMS Managed" : "Static Fallback",
    cms: items.length > 0,
    fallback: items.length === 0,
    needsMigration: items.length === 0,
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const publicUrl = await uploadSiteImage(file, slotDef.key);
      const res = await cmsApi(`/cms/carousel/${slotDef.key}`, "POST", {
        image_url: publicUrl,
        alt_text: "",
        focal_x: 50,
        focal_y: 50,
      });
      onItemsChange([...items, res.item]);
      toast({ title: "Image added to carousel" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const addFallbackToCarousel = async (image: { src: string; alt: string }) => {
    setUploading(true);
    try {
      const res = await cmsApi(`/cms/carousel/${slotDef.key}`, "POST", {
        image_url: image.src,
        alt_text: image.alt,
        focal_x: 50,
        focal_y: 50,
      });
      onItemsChange([...items, res.item]);
      toast({ title: "Fallback image added", description: "This image is now CMS-managed and can use carousel focal controls." });
    } catch (err: any) {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const moveItem = async (index: number, direction: "up" | "down") => {
    const newItems = [...items];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= newItems.length) return;
    [newItems[index], newItems[swapIndex]] = [newItems[swapIndex], newItems[index]];
    // Reassign display_order
    const reordered = newItems.map((item, i) => ({ ...item, display_order: i + 1 }));
    onItemsChange(reordered);
    // Persist order
    await cmsApi(`/cms/carousel/${slotDef.key}/reorder`, "POST", {
      order: reordered.map(item => ({ id: item.id, display_order: item.display_order })),
    });
  };

  const updateItem = async (id: string, changes: Partial<CarouselItem>) => {
    try {
      const res = await cmsApi(`/cms/carousel/item/${id}`, "PATCH", changes);
      onItemsChange(items.map(item => item.id === id ? res.item : item));
    } catch (err: any) {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    }
  };

  const updateItemLocal = (id: string, changes: Partial<CarouselItem>) => {
    onItemsChange(items.map(item => item.id === id ? { ...item, ...changes } : item));
  };

  const deleteItem = async (id: string) => {
    try {
      await cmsApi(`/cms/carousel/item/${id}`, "DELETE");
      onItemsChange(items.filter(item => item.id !== id));
      toast({ title: "Image removed" });
    } catch (err: any) {
      toast({ title: "Remove failed", description: err.message, variant: "destructive" });
    }
  };

  return (
    <Card className="rounded-2xl border-border/60 bg-card/95">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold">{slotDef.label}</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5 font-mono">{slotDef.key} · {slotDef.hint}</p>
            <WhereUsed value="Homepage Hero Carousel" />
            <p className="mt-2 text-xs text-muted-foreground">Public homepage uses active DB carousel items first, then static lifestyleImages if this carousel is empty.</p>
          </div>
          <div className="flex items-center gap-2">
            <SourceBadges source={items.length > 0 ? "CMS Managed" : "Static Fallback"} needsMigration={items.length === 0} readOnly={items.length === 0} />
            <Badge variant="outline" className="text-xs">{items.length} image{items.length !== 1 ? "s" : ""}</Badge>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="hidden" onChange={handleUpload} />
            <Button size="sm" variant="outline" className="rounded-xl h-8 px-3 text-xs" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Upload className="mr-1 h-3 w-3" />}
              {uploading ? "Uploading…" : "Add Image"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {!showCarousel ? (
          <EmptyFilterState />
        ) : items.length === 0 ? (
          <div className="space-y-3">
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-amber-400/30 bg-amber-500/5 py-8 text-center">
            <ImageIcon className="h-10 w-10 text-muted-foreground/30" />
            <div>
              <p className="text-sm font-medium text-amber-800">No DB carousel images yet</p>
              <p className="text-xs text-amber-700/80">The public homepage is currently protected by the static fallback images below.</p>
            </div>
          </div>
          {lifestyleImages.map((image, index) => (
            <div key={image.animationKey || image.src} className="flex gap-3 rounded-xl border border-amber-400/30 bg-amber-500/5 p-3">
              <div className="h-20 w-32 shrink-0 overflow-hidden rounded-lg border border-border/40 bg-muted/30">
                <img src={image.src} alt={image.alt} className="h-full w-full object-cover" style={{ objectPosition: image.objectPosition || "center" }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-muted-foreground">{index + 1}.</span>
                  <p className="text-sm font-semibold truncate">{image.alt}</p>
                </div>
                <WhereUsed value="Homepage Hero Carousel fallback" />
                <p className="mt-2 text-xs text-muted-foreground font-mono break-all">{image.src}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <SourceBadges source="Static Fallback" readOnly needsMigration />
                <Button size="sm" variant="outline" className="rounded-xl h-8 px-3 text-xs" onClick={() => addFallbackToCarousel(image)} disabled={uploading}>
                  {uploading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Plus className="mr-1 h-3 w-3" />}
                  Add to carousel
                </Button>
              </div>
            </div>
          ))}
          </div>
        ) : (
          items.map((item, index) => (
            <div key={item.id} className="flex gap-3 rounded-xl border border-border/40 bg-muted/10 p-3">
              {/* Thumbnail */}
              <div className="h-20 w-32 shrink-0 overflow-hidden rounded-lg border border-border/40 bg-muted/30">
                <img
                  src={item.image_url}
                  alt={item.alt_text || "Carousel image"}
                  className="h-full w-full object-cover"
                  style={{ objectPosition: `${item.focal_x}% ${item.focal_y}%` }}
                />
              </div>

              {/* Controls */}
              <div className="flex flex-1 flex-col gap-2 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <SourceBadges source="CMS Managed" />
                  <WhereUsed value="Homepage Hero Carousel" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-muted-foreground w-5">{index + 1}.</span>
                  <Input
                    value={item.alt_text}
                    onChange={(e) => onItemsChange(items.map(i => i.id === item.id ? { ...i, alt_text: e.target.value } : i))}
                    onBlur={() => updateItem(item.id, { alt_text: item.alt_text })}
                    placeholder="Alt text (describe the image)"
                    className="h-7 text-xs rounded-lg flex-1"
                  />
                </div>

                {/* Focal point */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">Focal X — {item.focal_x}%</p>
                    <Slider min={0} max={100} step={1} value={[item.focal_x]}
                      onValueChange={([v]) => updateItemLocal(item.id, { focal_x: v })}
                      onValueCommit={([v]) => updateItem(item.id, { focal_x: v })}
                    />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">Focal Y — {item.focal_y}%</p>
                    <Slider min={0} max={100} step={1} value={[item.focal_y]}
                      onValueChange={([v]) => updateItemLocal(item.id, { focal_y: v })}
                      onValueCommit={([v]) => updateItem(item.id, { focal_y: v })}
                    />
                  </div>
                </div>
              </div>

              {/* Order + delete */}
              <div className="flex flex-col items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveItem(index, "up")} disabled={index === 0}>
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <span className="text-[10px] text-muted-foreground font-mono">{index + 1}/{items.length}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveItem(index, "down")} disabled={index === items.length - 1}>
                  <ChevronDown className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive mt-1" onClick={() => deleteItem(item.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};

export default WebsiteManager;
