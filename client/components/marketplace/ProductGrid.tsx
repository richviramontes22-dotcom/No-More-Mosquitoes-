import { useState } from "react";
import { CatalogItem, CatalogItemCategory } from "@/hooks/dashboard/useCatalogItems";
import { ProductCard } from "./ProductCard";
import { Loader2, AlertCircle, Package, Wrench, MessageCircle, Layers } from "lucide-react";

interface ProductGridProps {
  items: CatalogItem[];
  isLoading?: boolean;
  error?: Error | null;
  onAddToCart?: (item: CatalogItem) => void;
  onRequestConsultation?: (item: CatalogItem) => void;
}

const CATEGORY_CONFIG: Record<CatalogItemCategory, { label: string; desc: string; icon: React.ElementType }> = {
  add_on:       { label: "Service Add-Ons", desc: "Enhancements delivered at your next visit", icon: Wrench },
  product:      { label: "Products", desc: "Yard signs, treatments, and branded items", icon: Package },
  consultation: { label: "Consultations", desc: "Expert guidance and custom solutions", icon: MessageCircle },
  service:      { label: "Services", desc: "Standalone professional services", icon: Layers },
};

const categoryOrder: CatalogItemCategory[] = ["add_on", "product", "consultation", "service"];

const categoryFilterLabels: Record<CatalogItemCategory | "all", string> = {
  all: "All Items",
  add_on: "Add-Ons",
  product: "Products",
  consultation: "Consultations",
  service: "Services",
};

export const ProductGrid = ({
  items,
  isLoading = false,
  error = null,
  onAddToCart,
  onRequestConsultation,
}: ProductGridProps) => {
  const [selectedCategory, setSelectedCategory] = useState<CatalogItemCategory | "all">("all");

  const itemsByCategory = items.reduce(
    (acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    },
    {} as Record<CatalogItemCategory, CatalogItem[]>
  );

  const filteredItems =
    selectedCategory === "all" ? items : itemsByCategory[selectedCategory as CatalogItemCategory] || [];

  const categoryTabs = categoryOrder.filter((cat) => itemsByCategory[cat]?.length > 0);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading catalog…</p>
      </div>
    );
  }

  if (error && items.length === 0) {
    return (
      <div className="rounded-[24px] border border-red-200 bg-red-50 p-8">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-red-900">Unable to Load Catalog</p>
            <p className="text-sm text-red-700 mt-1">{error?.message || "Failed to load marketplace items"}</p>
          </div>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-[24px] border-dashed border-2 border-border/40 p-16 text-center bg-muted/5 flex flex-col items-center gap-3">
        <Package className="h-10 w-10 text-muted-foreground/30" />
        <p className="font-semibold text-muted-foreground">No items available yet</p>
        <p className="text-sm text-muted-foreground/70">Check back soon — new add-ons are added regularly.</p>
      </div>
    );
  }

  // Category filter chips
  const filterChips = (
    <div className="flex flex-wrap gap-2 pb-1">
      {(["all", ...categoryTabs] as (CatalogItemCategory | "all")[]).map((cat) => {
        const active = selectedCategory === cat;
        const count = cat === "all" ? items.length : (itemsByCategory[cat as CatalogItemCategory]?.length ?? 0);
        return (
          <button
            key={cat}
            type="button"
            onClick={() => setSelectedCategory(cat)}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold border transition-all duration-200 ${
              active
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-card text-muted-foreground border-border/60 hover:border-primary/40 hover:text-foreground"
            }`}
          >
            {categoryFilterLabels[cat]}
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
              active ? "bg-white/20 text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}>
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );

  // "All" view: render by category sections
  if (selectedCategory === "all") {
    return (
      <div className="space-y-10">
        {categoryTabs.length > 1 && filterChips}
        {categoryOrder
          .filter((cat) => itemsByCategory[cat]?.length > 0)
          .map((cat) => {
            const config = CATEGORY_CONFIG[cat];
            const Icon = config.icon;
            return (
              <div key={cat} className="space-y-5">
                {/* Section header */}
                <div className="flex items-center gap-3 pb-2 border-b border-border/40">
                  <div className="h-8 w-8 rounded-xl bg-primary/8 flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h2 className="font-display font-bold text-base text-foreground">{config.label}</h2>
                    <p className="text-xs text-muted-foreground">{config.desc}</p>
                  </div>
                  <span className="ml-auto text-xs text-muted-foreground font-medium">{itemsByCategory[cat].length} items</span>
                </div>
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {itemsByCategory[cat].map((item) => (
                    <ProductCard
                      key={item.id}
                      item={item}
                      onAddToCart={onAddToCart}
                      onRequestConsultation={onRequestConsultation}
                    />
                  ))}
                </div>
              </div>
            );
          })}
      </div>
    );
  }

  // Filtered single category view
  return (
    <div className="space-y-6">
      {categoryTabs.length > 1 && filterChips}
      {filteredItems.length === 0 ? (
        <div className="rounded-[24px] border-dashed border-2 border-border/40 p-12 text-center bg-muted/5">
          <p className="text-muted-foreground">No {categoryFilterLabels[selectedCategory].toLowerCase()} available.</p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((item) => (
            <ProductCard
              key={item.id}
              item={item}
              onAddToCart={onAddToCart}
              onRequestConsultation={onRequestConsultation}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ProductGrid;
