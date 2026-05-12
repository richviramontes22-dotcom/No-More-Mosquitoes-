import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CatalogItem, CatalogItemCategory } from "@/hooks/dashboard/useCatalogItems";
import { ProductCard } from "./ProductCard";
import { Loader2, AlertCircle } from "lucide-react";

interface ProductGridProps {
  items: CatalogItem[];
  isLoading?: boolean;
  error?: Error | null;
  onAddToCart?: (item: CatalogItem) => void;
  onRequestConsultation?: (item: CatalogItem) => void;
}

const categoryLabels: Record<CatalogItemCategory, string> = {
  add_on: "Add-On Services",
  product: "Physical Products",
  consultation: "Consultations",
  service: "Services",
};

const categoryOrder: CatalogItemCategory[] = ["add_on", "product", "service", "consultation"];

export const ProductGrid = ({
  items,
  isLoading = false,
  error = null,
  onAddToCart,
  onRequestConsultation,
}: ProductGridProps) => {
  const [selectedCategory, setSelectedCategory] = useState<CatalogItemCategory | "all">("all");

  // Group items by category
  const itemsByCategory = items.reduce(
    (acc, item) => {
      if (!acc[item.category]) {
        acc[item.category] = [];
      }
      acc[item.category].push(item);
      return acc;
    },
    {} as Record<CatalogItemCategory, CatalogItem[]>
  );

  // Filter items based on selected category
  const filteredItems =
    selectedCategory === "all"
      ? items
      : itemsByCategory[selectedCategory as CatalogItemCategory] || [];

  const categoryTabs = categoryOrder.filter((cat) => itemsByCategory[cat]?.length > 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
      <div className="rounded-[24px] border-dashed border-2 p-12 text-center bg-muted/5">
        <p className="text-muted-foreground">No items available yet. Check back soon!</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Category Tabs */}
      {categoryTabs.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <Button
            variant={selectedCategory === "all" ? "default" : "outline"}
            onClick={() => setSelectedCategory("all")}
            className="rounded-full"
          >
            All Items ({items.length})
          </Button>
          {categoryTabs.map((category) => (
            <Button
              key={category}
              variant={selectedCategory === category ? "default" : "outline"}
              onClick={() => setSelectedCategory(category)}
              className="rounded-full"
            >
              {categoryLabels[category]} ({itemsByCategory[category].length})
            </Button>
          ))}
        </div>
      )}

      {/* Products Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredItems.map((item) => (
          <ProductCard
            key={item.id}
            item={item}
            onAddToCart={onAddToCart}
            onRequestConsultation={onRequestConsultation}
          />
        ))}
      </div>

      {/* Empty state for current category filter */}
      {filteredItems.length === 0 && selectedCategory !== "all" && (
        <div className="rounded-[24px] border-dashed border-2 p-12 text-center bg-muted/5">
          <p className="text-muted-foreground">
            No {categoryLabels[selectedCategory as CatalogItemCategory].toLowerCase()} available.
          </p>
        </div>
      )}
    </div>
  );
};

export default ProductGrid;
