import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { CatalogItem, formatItemPrice } from "@/hooks/dashboard/useCatalogItems";
import { ShoppingCart, Phone, AlertCircle, Sparkles } from "lucide-react";
import { resolveImageUrl } from "@/lib/marketplace/imageResolver";

interface ProductCardProps {
  item: CatalogItem;
  onAddToCart?: (item: CatalogItem) => void;
  onRequestConsultation?: (item: CatalogItem) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  add_on:       "Add-On",
  product:      "Product",
  consultation: "Consultation",
  service:      "Service",
};

const ProductImage = ({ item }: { item: CatalogItem }) => {
  const [imageError, setImageError] = useState(false);

  const src = useMemo(() => {
    // 1. Try imageResolver (CDN + local maps)
    const resolved = resolveImageUrl(item.imageUrl ?? null);
    if (resolved) return resolved;
    // 2. Fallback: try /addons/{slug}.jpg for add-on services
    if (item.category === "add_on" && item.slug) return `/addons/${item.slug}.jpg`;
    return null;
  }, [item.imageUrl, item.category, item.slug]);

  if (!src || imageError) {
    return (
      <div className="aspect-[4/3] w-full bg-gradient-to-br from-primary/5 via-primary/3 to-muted/30 flex flex-col items-center justify-center">
        <Sparkles className="h-10 w-10 text-primary/20 mb-1.5" />
        <p className="text-[11px] text-muted-foreground/50 font-medium">
          {CATEGORY_LABELS[item.category] ?? "Service"}
        </p>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={item.name}
      className="aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
      onError={() => setImageError(true)}
    />
  );
};

export const ProductCard = ({ item, onAddToCart, onRequestConsultation }: ProductCardProps) => {
  const isConsultation = item.priceType === "consultation" || item.requiresConsultation;

  return (
    <article className="group flex flex-col rounded-[20px] border border-border/60 bg-card overflow-hidden shadow-soft hover:shadow-md hover:border-primary/20 transition-all duration-300">
      {/* Image */}
      <div className="overflow-hidden">
        <ProductImage item={item} />
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-5 gap-3">
        {/* Name + price */}
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-base font-bold text-foreground leading-snug flex-1">
            {item.name}
          </h3>
          <span className="text-sm font-black text-primary whitespace-nowrap shrink-0">
            {formatItemPrice(item)}
          </span>
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2 flex-1">
          {item.description}
        </p>

        {/* Scheduling / consultation notice */}
        {(item.requiresSchedule || item.requiresConsultation) && (
          <div className="flex items-start gap-2 bg-primary/5 rounded-xl px-3 py-2 text-xs text-primary/80">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            {item.requiresConsultation
              ? "Consultation required — we'll call within 24 hrs"
              : "Delivered at your next scheduled service visit"}
          </div>
        )}

        {/* CTA */}
        <div className="pt-1">
          {isConsultation ? (
            <Button
              onClick={() => onRequestConsultation?.(item)}
              variant="outline"
              size="sm"
              className="w-full rounded-xl border-primary/30 text-primary hover:bg-primary/5 h-10"
            >
              <Phone className="mr-2 h-3.5 w-3.5" />
              Request Consultation
            </Button>
          ) : (
            <Button
              onClick={() => onAddToCart?.(item)}
              size="sm"
              className="w-full rounded-xl h-10 shadow-sm"
            >
              <ShoppingCart className="mr-2 h-3.5 w-3.5" />
              Add to Cart
            </Button>
          )}
        </div>
      </div>
    </article>
  );
};

export default ProductCard;
