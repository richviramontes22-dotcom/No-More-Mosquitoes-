import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { CatalogItem, formatItemPrice } from "@/hooks/dashboard/useCatalogItems";
import { ShoppingCart, Phone, AlertCircle, Sparkles, ChevronDown, ChevronUp, Star, Leaf, Flame, Zap } from "lucide-react";
import { resolveImageUrl } from "@/lib/marketplace/imageResolver";
import { getCatalogMeta, getBadgeLabel } from "@/lib/marketplace/catalogMetadata";

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

const BADGE_STYLES = {
  recommended: { bg: "bg-primary/10 text-primary border-primary/20", icon: Star },
  popular:     { bg: "bg-amber-50 text-amber-700 border-amber-200", icon: Flame },
  new:         { bg: "bg-blue-50 text-blue-700 border-blue-200", icon: Zap },
  value:       { bg: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: Star },
  eco:         { bg: "bg-green-50 text-green-700 border-green-200", icon: Leaf },
};

const ProductImage = ({ item }: { item: CatalogItem }) => {
  const [imageError, setImageError] = useState(false);

  const src = useMemo(() => {
    const resolved = resolveImageUrl(item.imageUrl ?? null);
    if (resolved) return resolved;
    if (item.category === "add_on" && item.slug) return `/addons/${item.slug}.jpg`;
    return null;
  }, [item.imageUrl, item.category, item.slug]);

  if (!src || imageError) {
    return (
      <div className="aspect-[4/3] w-full bg-gradient-to-br from-primary/8 via-primary/4 to-muted/20 flex flex-col items-center justify-center gap-2">
        <Sparkles className="h-10 w-10 text-primary/25" />
        <p className="text-[11px] text-muted-foreground/60 font-semibold uppercase tracking-wide">
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
  const [expanded, setExpanded] = useState(false);
  const isConsultation = item.priceType === "consultation" || item.requiresConsultation;
  const meta = getCatalogMeta(item.slug);

  // Use DB description if present, fall back to static meta
  const description = item.description ?? meta?.description ?? null;
  const badgeLabel = meta?.badge ? getBadgeLabel(meta.badge) : null;
  const badgeStyle = meta?.badge ? BADGE_STYLES[meta.badge] : null;
  const BadgeIcon = badgeStyle?.icon;

  return (
    <article className="group flex flex-col rounded-[22px] border border-border/60 bg-card overflow-hidden shadow-soft hover:shadow-lg hover:border-primary/25 transition-all duration-300">
      {/* Image */}
      <div className="overflow-hidden relative">
        <ProductImage item={item} />
        {/* Badge overlay */}
        {badgeLabel && badgeStyle && BadgeIcon && (
          <div className={`absolute top-3 left-3 flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold ${badgeStyle.bg} backdrop-blur-sm`}>
            <BadgeIcon className="h-3 w-3" />
            {badgeLabel}
          </div>
        )}
        {/* Category chip */}
        <div className="absolute top-3 right-3 rounded-full bg-black/40 backdrop-blur-sm px-2.5 py-1 text-[10px] font-semibold text-white/90">
          {CATEGORY_LABELS[item.category] ?? "Service"}
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-5 gap-3">
        {/* Name + price */}
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-base font-bold text-foreground leading-snug flex-1">
            {item.name}
          </h3>
          <span className="text-base font-black text-primary whitespace-nowrap shrink-0 tabular-nums">
            {formatItemPrice(item)}
          </span>
        </div>

        {/* Best for */}
        {meta?.bestFor && (
          <p className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wide">
            Best for: {meta.bestFor}
          </p>
        )}

        {/* Description */}
        {description && (
          <div>
            <p className={`text-sm text-muted-foreground leading-relaxed ${expanded ? "" : "line-clamp-2"}`}>
              {description}
            </p>
            {description.length > 90 && (
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="mt-1 flex items-center gap-1 text-xs font-semibold text-primary/70 hover:text-primary transition-colors"
              >
                {expanded ? (
                  <><ChevronUp className="h-3 w-3" /> Less</>
                ) : (
                  <><ChevronDown className="h-3 w-3" /> Learn more</>
                )}
              </button>
            )}
          </div>
        )}

        {/* Scheduling / consultation notice */}
        {(item.requiresSchedule || item.requiresConsultation) && (
          <div className="flex items-start gap-2 bg-primary/6 rounded-xl px-3 py-2 text-xs text-primary/80">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            {item.requiresConsultation
              ? "Consultation required — we'll reach out within 24 hours"
              : "Delivered at your next scheduled service visit"}
          </div>
        )}

        {/* Compatibility pills */}
        {(meta?.oneTimeCompatible !== undefined || meta?.recurringCompatible !== undefined) && (
          <div className="flex gap-1.5 flex-wrap">
            {meta?.oneTimeCompatible && (
              <span className="inline-flex items-center rounded-full bg-muted/60 px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">
                One-time
              </span>
            )}
            {meta?.recurringCompatible && (
              <span className="inline-flex items-center rounded-full bg-primary/8 px-2.5 py-1 text-[10px] font-semibold text-primary/70">
                Subscription add-on
              </span>
            )}
          </div>
        )}

        {/* CTA */}
        <div className="pt-1 mt-auto">
          {isConsultation ? (
            <Button
              onClick={() => onRequestConsultation?.(item)}
              variant="outline"
              size="sm"
              className="w-full rounded-xl border-primary/30 text-primary hover:bg-primary/5 h-10 font-semibold"
            >
              <Phone className="mr-2 h-3.5 w-3.5" />
              Request Consultation
            </Button>
          ) : (
            <Button
              onClick={() => onAddToCart?.(item)}
              size="sm"
              className="w-full rounded-xl h-10 shadow-sm font-semibold"
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
