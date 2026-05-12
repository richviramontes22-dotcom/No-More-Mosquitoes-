import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCart } from "@/contexts/CartContext";
import { Appointment } from "@/hooks/dashboard/useAppointments";
import { formatPrice } from "@/hooks/dashboard/useCatalogItems";
import { CheckCircle2, Calendar, Clock, MapPin, Package, ArrowRight, Home } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface CheckoutConfirmationProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nextAppointment: Appointment | null;
  onComplete?: () => void;
}

const CheckoutConfirmation = ({
  open,
  onOpenChange,
  nextAppointment,
  onComplete,
}: CheckoutConfirmationProps) => {
  const { items, subtotalCents, taxCents, totalCents, clearCart } = useCart();

  const handleClose = () => {
    // Clear cart after confirmation is viewed
    clearCart();
    onOpenChange(false);
    onComplete?.();
  };

  // Fallback price calculation
  function calculateCartPrice(item: any): number {
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
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent className="w-full sm:w-full md:w-[600px] flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
            Order Confirmed!
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 pr-4 -mr-4">
          <div className="space-y-6">
            {/* Confirmation Message */}
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Your order has been confirmed and will be delivered during your next scheduled service visit.
              </AlertDescription>
            </Alert>

            {/* Delivery Info */}
            {nextAppointment && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-3">
                <div className="flex items-center gap-2 mb-3">
                  <Home className="h-4 w-4 text-blue-600" />
                  <h3 className="font-semibold text-blue-900">Delivery Information</h3>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <Calendar className="h-4 w-4 text-blue-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-blue-900">
                        {new Date(nextAppointment.date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                      </p>
                      <p className="text-xs text-blue-700">Service Date</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Clock className="h-4 w-4 text-blue-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-blue-900">{nextAppointment.timeWindow}</p>
                      <p className="text-xs text-blue-700">Time Window</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-blue-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-blue-900">{nextAppointment.address}</p>
                      <p className="text-xs text-blue-700">Location</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Order Details */}
            <div className="space-y-3">
              <h3 className="font-semibold text-foreground">Order Summary</h3>
              {items.map((item) => {
                const price = item.cartPrice ?? calculateCartPrice(item);
                return (
                  <div key={item.id} className="flex items-start justify-between rounded-lg border border-border/40 bg-muted/10 p-3">
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

            {/* Receipt */}
            <div className="rounded-lg border border-border/60 bg-muted/30 p-4 space-y-3">
              <h4 className="font-semibold text-sm text-foreground">Receipt</h4>
              <div className="space-y-2 text-sm border-t border-border/40 pt-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span className="font-medium">{formatPrice(subtotalCents)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax (CA):</span>
                  <span className="font-medium">{formatPrice(taxCents)}</span>
                </div>
                <div className="border-t border-border/40 pt-2 flex justify-between font-bold text-base">
                  <span>Total:</span>
                  <span className="text-primary">{formatPrice(totalCents)}</span>
                </div>
              </div>
            </div>

            {/* Next Steps */}
            <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <h4 className="font-semibold text-sm text-amber-900">What's Next?</h4>
              <ul className="text-xs text-amber-800 space-y-1 list-disc list-inside">
                <li>Your items will be ready for delivery on your scheduled service date</li>
                <li>You'll receive a reminder 24 hours before your appointment</li>
                <li>Our team will bring all purchased items and services during the visit</li>
              </ul>
            </div>

            {/* Confirmation ID */}
            <div className="text-center text-xs text-muted-foreground border-t border-border/40 pt-4">
              <p className="mb-2">Confirmation ID:</p>
              <p className="font-mono text-sm font-semibold text-foreground">
                {`ORD-${Date.now().toString().slice(-8).toUpperCase()}`}
              </p>
            </div>
          </div>
        </ScrollArea>

        {/* Action Buttons */}
        <div className="border-t border-border/40 space-y-3 pt-6">
          <Button
            onClick={handleClose}
            className="w-full rounded-full h-11 shadow-brand"
          >
            Back to Dashboard
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default CheckoutConfirmation;
