import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CatalogItem, formatItemPrice } from "@/hooks/dashboard/useCatalogItems";
import { ShoppingCart, AlertCircle, Phone, Image as ImageIcon } from "lucide-react";
import { useState, useMemo } from "react";
import { resolveImageUrl } from "@/lib/marketplace/imageResolver";

interface ProductCardProps {
  item: CatalogItem;
  onAddToCart?: (item: CatalogItem) => void;
  onRequestConsultation?: (item: CatalogItem) => void;
}

const ProductImage = ({ item }: { item: CatalogItem }) => {
  const [imageError, setImageError] = useState(false);

  // Resolve the image URL from the catalog item's image_url filename
  const resolvedImageUrl = useMemo(() => {
    if (!item.imageUrl) return null;
    // Try to resolve from the filename in imageUrl
    const cdnUrl = resolveImageUrl(item.imageUrl);
    return cdnUrl;
  }, [item.imageUrl]);

  // Show placeholder if no resolved image or error loading it
  if (!resolvedImageUrl || imageError) {
    return (
      <div className="w-full h-48 rounded-lg bg-gradient-to-br from-muted/50 to-muted/30 flex flex-col items-center justify-center border border-border/40 mb-4">
        <ImageIcon className="h-8 w-8 text-muted-foreground/40 mb-2" />
        <p className="text-xs text-muted-foreground text-center px-2">
          {item.category === "product" ? "Product image" : "Service image"} coming soon
        </p>
      </div>
    );
  }

  return (
    <div className="w-full h-48 rounded-lg overflow-hidden bg-muted/10 mb-4">
      <img
        src={resolvedImageUrl}
        alt={item.name}
        className="w-full h-full object-cover"
        onError={() => setImageError(true)}
      />
    </div>
  );
};

export const ProductCard = ({
  item,
  onAddToCart,
  onRequestConsultation,
}: ProductCardProps) => {
  const isConsultationItem = item.priceType === "consultation" || item.requiresConsultation;
  const categoryLabels: Record<string, string> = {
    add_on: "Add-On Service",
    product: "Product",
    consultation: "Consultation",
    service: "Service",
  };

  return (
    <article className="flex h-full flex-col justify-between rounded-[24px] border border-border/60 bg-card/95 shadow-soft overflow-hidden hover:shadow-md transition-shadow">
      {/* Image Container */}
      <div className="p-4 pb-0">
        <ProductImage item={item} />
      </div>

      {/* Header */}
      <div className="px-6 py-4 mb-0">
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 className="font-display text-lg text-foreground flex-1">{item.name}</h3>
          <Badge variant="secondary" className="shrink-0 bg-primary/10 text-primary border-none">
            {categoryLabels[item.category]}
          </Badge>
        </div>

        <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
          {item.description}
        </p>
      </div>

      {/* Details Section */}
      <div className="space-y-3 mb-6 px-6 py-4 border-y border-border/40">
        {/* Price */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">Price:</span>
          <span className="text-lg font-display font-semibold text-foreground">
            {formatItemPrice(item)}
          </span>
        </div>

        {/* Service Requirements */}
        {(item.requiresSchedule || item.requiresConsultation) && (
          <div className="flex items-start gap-2 bg-primary/5 rounded-lg p-3">
            <AlertCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <div className="text-xs space-y-1">
              {item.requiresSchedule && (
                <div>Requires appointment scheduling</div>
              )}
              {item.requiresConsultation && (
                <div>Consultation required - we'll call within 24 hours</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="px-6 pb-6 grid grid-cols-1 gap-2">
        {isConsultationItem ? (
          <Button
            onClick={() => onRequestConsultation?.(item)}
            variant="outline"
            className="rounded-full border-border/60 h-10"
          >
            <Phone className="mr-2 h-4 w-4 text-primary" />
            Request Consultation
          </Button>
        ) : (
          <Button
            onClick={() => onAddToCart?.(item)}
            className="rounded-full h-10 shadow-brand"
          >
            <ShoppingCart className="mr-2 h-4 w-4" />
            Add to Cart
          </Button>
        )}
      </div>
    </article>
  );
};

export default ProductCard;
