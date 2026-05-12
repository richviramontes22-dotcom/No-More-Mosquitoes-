import { useState } from "react";
import { useStripe, useElements, CardElement } from "@stripe/react-stripe-js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CreditCard, Lock, Loader2, ShieldCheck, AlertCircle } from "lucide-react";
import { supabase, withTimeout } from "@/lib/supabase";

interface PaymentMethodDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const PaymentMethodDialog = ({
  open,
  onOpenChange,
  onSuccess,
}: PaymentMethodDialogProps) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zip, setZip] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      // Validate inputs
      if (!stripe || !elements) {
        throw new Error("Stripe is not initialized");
      }

      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        throw new Error("Card element not found");
      }

      if (!zip) {
        throw new Error("Billing ZIP code is required");
      }

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error("No active session");
      }

      // Create payment method token using Stripe.js
      const { error: stripeError, paymentMethod } = await stripe.createPaymentMethod({
        type: "card",
        card: cardElement,
        billing_details: {
          address: {
            postal_code: zip,
          },
        },
      });

      if (stripeError) {
        throw new Error(stripeError.message || "Failed to create payment method");
      }

      if (!paymentMethod) {
        throw new Error("Payment method creation failed");
      }

      // Send payment method ID to backend to attach to customer
      const response = await withTimeout(fetch("/api/billing/attach-payment-method", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          paymentMethodId: paymentMethod.id,
        }),
      }), 10000, "Attach payment method");

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to attach payment method");
      }

      // Reset form
      setZip("");
      elements.getElement(CardElement)?.clear();

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Payment Method Error:", error);
      setError(error.message || "An error occurred while adding the payment method");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleZipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "").slice(0, 5);
    setZip(value);
  };

  const cardElementOptions = {
    style: {
      base: {
        fontSize: "16px",
        color: "currentColor",
        "::placeholder": {
          color: "rgba(0, 0, 0, 0.4)",
        },
      },
      invalid: {
        color: "#ef4444",
      },
    },
    hidePostalCode: true,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-[32px] p-0 overflow-hidden border-none shadow-2xl">
        <div className="bg-primary p-8 text-primary-foreground relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <CreditCard className="h-32 w-32 rotate-12" />
          </div>
          <DialogHeader className="relative z-10">
            <DialogTitle className="text-2xl font-display font-bold">
              Add Payment Method
            </DialogTitle>
            <DialogDescription className="text-primary-foreground/80 font-medium">
              We use Stripe for secure, 256-bit encrypted payments.
            </DialogDescription>
          </DialogHeader>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="space-y-4">
            {/* Stripe Card Element */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground/70">
                Card Details
              </Label>
              <div className="rounded-xl border border-border/60 p-4 bg-background focus-within:ring-2 focus-within:ring-primary/20">
                <CardElement options={cardElementOptions} />
              </div>
            </div>

            {/* ZIP Code Input */}
            <div className="space-y-2">
              <Label htmlFor="zip" className="text-sm font-semibold text-foreground/70">
                Billing ZIP Code
              </Label>
              <Input
                id="zip"
                placeholder="90210"
                value={zip}
                onChange={handleZipChange}
                className="rounded-xl h-12 border-border/60 focus-visible:ring-primary/20"
                required
              />
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="rounded-2xl bg-red-50 border border-red-200 p-4 flex gap-3 items-start">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm text-red-600 font-medium mb-1">{error}</p>
                {error.includes("expiration") && (
                  <p className="text-xs text-red-600">
                    💡 Use an expiration date in the future (e.g., 12/26, 12/27, etc.)
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Test Card Info */}
          <div className="rounded-2xl bg-blue-50 border border-blue-200 p-4 flex gap-3 items-start">
            <CreditCard className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
            <div className="text-[11px] text-blue-900 leading-relaxed space-y-1">
              <p className="font-medium">Test Card Examples:</p>
              <p>Visa: <code className="bg-blue-100 px-1 rounded">4242 4242 4242 4242</code></p>
              <p>Mastercard: <code className="bg-blue-100 px-1 rounded">5555 5555 5555 4444</code></p>
              <p>Any future expiry (MM/YY): <code className="bg-blue-100 px-1 rounded">12/26</code> • CVC: <code className="bg-blue-100 px-1 rounded">123</code></p>
            </div>
          </div>

          {/* Security Info */}
          <div className="rounded-2xl bg-muted/40 p-4 flex gap-3 items-start border border-border/40">
            <ShieldCheck className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Your card information is securely tokenized by Stripe. We never see or
              store your full card details.
            </p>
          </div>

          {/* Submit Button */}
          <div className="flex flex-col gap-3 pt-4">
            <Button
              type="submit"
              className="w-full rounded-xl h-12 shadow-brand font-bold text-base"
              disabled={isSubmitting || !stripe || !elements}
            >
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Securely Add Card
            </Button>
            <p className="text-[10px] text-center text-muted-foreground flex items-center justify-center gap-1">
              <Lock className="h-3 w-3" /> PCI-DSS Compliant Infrastructure
            </p>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
