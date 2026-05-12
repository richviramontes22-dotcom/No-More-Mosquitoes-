import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CartItemEntry, useCart } from "@/contexts/CartContext";
import { formatPrice } from "@/hooks/dashboard/useCatalogItems";
import { Trash2, ShoppingCart, ArrowRight, Plus, Minus } from "lucide-react";

interface CartPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCheckout?: () => void;
}

const CartItemDisplay = ({ item }: { item: CartItemEntry }) => {
  const { updateQuantity, removeItem } = useCart();

  // Calculate effective cart price from the item's price type
  const cartPrice = item.cartPrice ?? calculateCartPrice(item);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border/40 bg-muted/20 p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h4 className="font-semibold text-foreground text-sm">{item.name}</h4>
          {item.propertyId && (
            <p className="text-xs text-muted-foreground mt-1">Property: {item.propertyId}</p>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => removeItem(item.id)}
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Price per unit:</span>
        <span className="text-sm font-semibold">{formatPrice(cartPrice)}</span>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Quantity:</span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => updateQuantity(item.id, item.quantity - 1)}
          >
            <Minus className="h-3 w-3" />
          </Button>
          <span className="w-8 text-center text-sm font-semibold">{item.quantity}</span>
          <Button
            variant="outline"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => updateQuantity(item.id, item.quantity + 1)}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <div className="border-t border-border/40 pt-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">Subtotal:</span>
        <span className="text-sm font-display font-bold text-primary">
          {formatPrice(cartPrice * item.quantity)}
        </span>
      </div>
    </div>
  );
};

/**
 * Calculate the effective cart price for display
 * Mirrors the logic in CartContext.getCartPrice
 */
function calculateCartPrice(item: CartItemEntry): number {
  if (item.priceType === "fixed" && item.priceCents !== null) {
    return item.priceCents;
  }
  if (item.priceType === "free") {
    return 0;
  }
  if (item.priceType === "range" && item.minPriceCents !== null) {
    return item.minPriceCents;
  }
  return 0;
}

export const CartPanel = ({
  open,
  onOpenChange,
  onCheckout,
}: CartPanelProps) => {
  const { items, itemCount, subtotalCents, taxCents, totalCents } = useCart();
  const hasItems = items.length > 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:w-96 flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Cart ({itemCount} {itemCount === 1 ? "item" : "items"})
          </SheetTitle>
          <SheetDescription>
            Review items and proceed to checkout
          </SheetDescription>
        </SheetHeader>

        {hasItems ? (
          <>
            {/* Cart Items */}
            <ScrollArea className="flex-1 pr-4 -mr-4">
              <div className="space-y-3">
                {items.map((item) => (
                  <CartItemDisplay key={item.id} item={item} />
                ))}
              </div>
            </ScrollArea>

            {/* Cart Summary */}
            <div className="border-t border-border/40 space-y-3 pt-6">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span className="font-semibold">{formatPrice(subtotalCents)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax (est.):</span>
                  <span className="font-semibold">{formatPrice(taxCents)}</span>
                </div>
              </div>

              <div className="flex justify-between items-center py-3 border-t border-border/40 text-base font-display font-bold">
                <span>Total:</span>
                <span className="text-primary text-lg">{formatPrice(totalCents)}</span>
              </div>

              {/* Action Buttons */}
              <div className="grid gap-2">
                <Button
                  onClick={onCheckout}
                  className="rounded-full h-11 shadow-brand"
                >
                  Proceed to Checkout
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="rounded-full border-border/60 h-11"
                >
                  Continue Shopping
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center flex-1 gap-4 text-center">
            <ShoppingCart className="h-12 w-12 text-muted-foreground/40" />
            <div>
              <p className="font-semibold text-foreground">Your cart is empty</p>
              <p className="text-sm text-muted-foreground mt-1">
                Browse the marketplace to add items
              </p>
            </div>
            <Button
              onClick={() => onOpenChange(false)}
              className="mt-2 rounded-full"
            >
              Start Shopping
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default CartPanel;
