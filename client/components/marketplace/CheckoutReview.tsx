import { useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CartItemEntry, useCart } from "@/contexts/CartContext";
import { Appointment } from "@/hooks/dashboard/useAppointments";
import { formatPrice } from "@/hooks/dashboard/useCatalogItems";
import { AlertCircle, Calendar, Clock, MapPin, Package, ArrowRight, Tag, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export interface AppliedPromo {
  code: string;
  discount_cents: number;
  stripe_promotion_code_id: string | null;
  promo_code_id: string | null; // DB UUID — used to increment used_count after payment
  description: string;
}

interface CheckoutReviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nextAppointment: Appointment | null;
  isLoading?: boolean;
  error?: string | null;
  onConfirm?: () => void;
  appliedPromo?: AppliedPromo | null;
  onPromoApplied?: (promo: AppliedPromo | null) => void;
}

const CheckoutReview = ({
  open,
  onOpenChange,
  nextAppointment,
  isLoading = false,
  error = null,
  onConfirm,
  appliedPromo = null,
  onPromoApplied,
}: CheckoutReviewProps) => {
  const { items, subtotalCents, taxCents, totalCents } = useCart();
  const [promoInput, setPromoInput] = useState("");
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);

  const handleApplyPromo = async () => {
    if (!promoInput.trim()) return;
    setPromoError(null);
    setPromoLoading(true);
    try {
      const res = await fetch("/api/promos/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: promoInput.trim(), order_total_cents: totalCents }),
      });
      const json = await res.json();
      if (!res.ok) { setPromoError(json.error || "Invalid code"); return; }
      onPromoApplied?.({
        code: promoInput.trim().toUpperCase(),
        discount_cents: json.discount_cents,
        stripe_promotion_code_id: json.stripe_promotion_code_id,
        promo_code_id: json.promo_code_id ?? null,
        description: json.description || "",
      });
      setPromoInput("");
    } catch {
      setPromoError("Could not validate code. Try again.");
    } finally {
      setPromoLoading(false);
    }
  };

  const discountedTotal = appliedPromo
    ? Math.max(0, totalCents - appliedPromo.discount_cents)
    : totalCents;

  if (!items.length) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:w-96 flex flex-col">
          <SheetHeader>
            <SheetTitle>Checkout</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col items-center justify-center flex-1 gap-4 text-center">
            <Package className="h-12 w-12 text-muted-foreground/40" />
            <p className="font-semibold text-foreground">Your cart is empty</p>
            <Button
              onClick={() => onOpenChange(false)}
              className="mt-2 rounded-full"
            >
              Continue Shopping
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // Fallback price calculation for display (mirrors CartPanel logic)
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:w-full md:w-[600px] flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Order Review
          </SheetTitle>
          <SheetDescription>
            Review your items and confirm delivery to your next appointment
          </SheetDescription>
        </SheetHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <ScrollArea className="flex-1 pr-4 -mr-4">
          <div className="space-y-6">
            {/* Appointment Info */}
            {nextAppointment ? (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-foreground">Scheduled Delivery</h3>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{new Date(nextAppointment.date).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>Window: {nextAppointment.timeWindow}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{nextAppointment.address}</span>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground pt-2 border-t border-primary/10">
                  Job #{nextAppointment.displayId}
                </div>
              </div>
            ) : (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No upcoming appointment found. These items cannot be scheduled for delivery.
                </AlertDescription>
              </Alert>
            )}

            {/* Order Items */}
            <div className="space-y-3">
              <h3 className="font-semibold text-foreground">Order Items</h3>
              {items.map((item) => {
                const price = item.cartPrice ?? calculateCartPrice(item);
                return (
                  <div key={item.id} className="flex items-start justify-between rounded-lg border border-border/40 bg-muted/20 p-3">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{item.name}</p>
                      <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{formatPrice(price * item.quantity)}</p>
                      <p className="text-xs text-muted-foreground">{formatPrice(price)} each</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Order Summary */}
            <div className="space-y-2 border-t border-border/40 pt-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal:</span>
                <span className="font-medium">{formatPrice(subtotalCents)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax (est.):</span>
                <span className="font-medium">{formatPrice(taxCents)}</span>
              </div>
              {appliedPromo && (
                <div className="flex justify-between text-sm">
                  <span className="text-green-600 flex items-center gap-1">
                    <Tag className="h-3.5 w-3.5" /> {appliedPromo.code}
                    <button onClick={() => onPromoApplied?.(null)} className="ml-1 text-muted-foreground hover:text-destructive text-xs">✕</button>
                  </span>
                  <span className="font-medium text-green-600">−{formatPrice(appliedPromo.discount_cents)}</span>
                </div>
              )}
              <div className="flex justify-between items-center py-3 border-t border-border/40 text-base font-display font-bold">
                <span>Total:</span>
                <span className="text-primary text-lg">{formatPrice(discountedTotal)}</span>
              </div>
            </div>

            {/* Promo Code Input */}
            {!appliedPromo && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground flex items-center gap-1"><Tag className="h-4 w-4" />Promo Code</p>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter code…"
                    value={promoInput}
                    onChange={(e) => { setPromoInput(e.target.value.toUpperCase()); setPromoError(null); }}
                    className="uppercase"
                    onKeyDown={(e) => e.key === "Enter" && handleApplyPromo()}
                  />
                  <Button variant="outline" onClick={handleApplyPromo} disabled={!promoInput.trim() || promoLoading} className="rounded-xl shrink-0">
                    {promoLoading ? "…" : "Apply"}
                  </Button>
                </div>
                {promoError && <p className="text-xs text-destructive">{promoError}</p>}
              </div>
            )}
            {appliedPromo && (
              <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/5 p-3 text-sm text-green-700">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>Promo <strong>{appliedPromo.code}</strong> applied — saving {formatPrice(appliedPromo.discount_cents)}!</span>
              </div>
            )}

            {/* Fulfillment Note */}
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                These items and services will be delivered or performed during your scheduled service visit on{" "}
                <strong>
                  {nextAppointment
                    ? new Date(nextAppointment.date).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })
                    : "your next appointment"}
                </strong>
                .
              </AlertDescription>
            </Alert>
          </div>
        </ScrollArea>

        {/* Action Buttons */}
        <div className="border-t border-border/40 space-y-3 pt-6">
          <Button
            onClick={onConfirm}
            disabled={isLoading || !nextAppointment}
            className="w-full rounded-full h-11 shadow-brand"
          >
            {isLoading ? "Confirming..." : "Confirm Order"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full rounded-full border-border/60 h-11"
          >
            Continue Shopping
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default CheckoutReview;
