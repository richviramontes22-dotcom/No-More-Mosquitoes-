import { useState } from "react";
import {
  PaymentElement,
  Elements,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CheckCircle2,
  Loader2,
  Lock,
  ShieldCheck,
  AlertCircle,
  Calendar,
  MapPin,
} from "lucide-react";
import { CartItemEntry } from "@/contexts/CartContext";
import { Appointment } from "@/hooks/dashboard/useAppointments";
import { formatPrice } from "@/hooks/dashboard/useCatalogItems";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "");

// ─── Inner form (must be inside Elements) ────────────────────────────────────
interface PaymentFormProps {
  amount: number;
  confirmationId: string;
  items: CartItemEntry[];
  subtotalCents: number;
  taxCents: number;
  nextAppointment: Appointment | null;
  onSuccess: (confirmationId: string) => void;
  onCancel: () => void;
}

const PaymentForm = ({
  amount,
  confirmationId,
  items,
  subtotalCents,
  taxCents,
  nextAppointment,
  onSuccess,
  onCancel,
}: PaymentFormProps) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [succeeded, setSucceeded] = useState(false);

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsProcessing(true);
    setError(null);

    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/dashboard/marketplace`,
      },
      redirect: "if_required",
    });

    if (confirmError) {
      setError(confirmError.message ?? "Payment failed. Please try again.");
      setIsProcessing(false);
      return;
    }

    if (paymentIntent && paymentIntent.status === "succeeded") {
      setSucceeded(true);
      setIsProcessing(false);
      // Brief delay so the success UI is visible before closing
      setTimeout(() => onSuccess(confirmationId), 1800);
      return;
    }

    setError("Unexpected payment status. Please contact support if your card was charged.");
    setIsProcessing(false);
  };

  // ── Success state ─────────────────────────────────────────────────────────
  if (succeeded) {
    return (
      <div className="flex flex-col items-center gap-6 py-8 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
          <CheckCircle2 className="h-10 w-10 text-green-600" />
        </div>
        <div className="space-y-2">
          <h3 className="text-2xl font-display font-bold text-foreground">Payment Successful!</h3>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            Your order has been confirmed and will be delivered at your next service visit.
          </p>
        </div>
        <div className="rounded-xl bg-muted/40 border border-border/60 px-6 py-3 text-sm">
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Confirmation ID</p>
          <p className="font-mono font-bold text-foreground">{confirmationId}</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handlePay} className="space-y-6">
      {/* Order summary */}
      <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 space-y-3">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">Order Summary</p>
        <div className="space-y-2">
          {items.map((item) => {
            const price = item.cartPrice ?? (item.priceCents ?? 0);
            return (
              <div key={item.id} className="flex justify-between text-sm">
                <span className="text-foreground">
                  {item.name}
                  {item.quantity > 1 && (
                    <span className="text-muted-foreground ml-1">× {item.quantity}</span>
                  )}
                </span>
                <span className="font-semibold">{formatPrice(price * item.quantity)}</span>
              </div>
            );
          })}
        </div>
        <Separator />
        <div className="space-y-1 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span>{formatPrice(subtotalCents)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Tax (CA)</span>
            <span>{formatPrice(taxCents)}</span>
          </div>
          <div className="flex justify-between font-bold text-base pt-1">
            <span>Total</span>
            <span className="text-primary">{formatPrice(amount)}</span>
          </div>
        </div>

        {/* Delivery info */}
        {nextAppointment && (
          <div className="rounded-xl bg-primary/5 border border-primary/10 p-3 space-y-1.5 text-xs">
            <p className="font-semibold text-primary">Delivery at next service visit</p>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {new Date(nextAppointment.date).toLocaleDateString(undefined, {
                weekday: "short", month: "short", day: "numeric",
              })} · {nextAppointment.timeWindow}
            </div>
            {nextAppointment.address && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <MapPin className="h-3 w-3" />
                {nextAppointment.address}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Stripe Payment Element */}
      <div className="space-y-3">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">Payment Details</p>
        <PaymentElement
          options={{
            layout: "tabs",
          }}
        />
      </div>

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-2 pt-2">
        <Button
          type="submit"
          disabled={!stripe || !elements || isProcessing}
          className="w-full h-12 rounded-xl shadow-brand text-base font-bold"
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Processing…
            </>
          ) : (
            <>
              <Lock className="h-4 w-4 mr-2" />
              Pay {formatPrice(amount)}
            </>
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="w-full rounded-xl"
          disabled={isProcessing}
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>

      {/* Trust badge */}
      <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5 text-green-600" />
        Secured by Stripe · Your card details are never stored
      </div>
    </form>
  );
};

// ─── Outer dialog (provides Elements context) ─────────────────────────────────
interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientSecret: string;
  confirmationId: string;
  amount: number;
  items: CartItemEntry[];
  subtotalCents: number;
  taxCents: number;
  nextAppointment: Appointment | null;
  onSuccess: (confirmationId: string) => void;
}

export const PaymentDialog = ({
  open,
  onOpenChange,
  clientSecret,
  confirmationId,
  amount,
  items,
  subtotalCents,
  taxCents,
  nextAppointment,
  onSuccess,
}: PaymentDialogProps) => {
  const elementsOptions = {
    clientSecret,
    appearance: {
      theme: "stripe" as const,
      variables: {
        borderRadius: "12px",
        fontFamily: "Manrope, Inter, system-ui, sans-serif",
      },
    },
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[92vh] overflow-y-auto rounded-[28px]">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Complete Payment</DialogTitle>
          <DialogDescription>
            Enter your card details to confirm your order.
          </DialogDescription>
        </DialogHeader>

        {clientSecret ? (
          <Elements stripe={stripePromise} options={elementsOptions}>
            <PaymentForm
              amount={amount}
              confirmationId={confirmationId}
              items={items}
              subtotalCents={subtotalCents}
              taxCents={taxCents}
              nextAppointment={nextAppointment}
              onSuccess={onSuccess}
              onCancel={() => onOpenChange(false)}
            />
          </Elements>
        ) : (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PaymentDialog;
