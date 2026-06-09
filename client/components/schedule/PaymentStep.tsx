import { useState } from "react";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Loader2, Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { stripePromise } from "@/lib/stripe";

interface PaymentFormProps {
  onPaymentConfirmed: (paymentIntentId: string) => Promise<void>;
  onError: (message: string) => void;
  returnUrl: string;
  amountLabel?: string;
}

const PaymentForm = ({ onPaymentConfirmed, onError, returnUrl, amountLabel }: PaymentFormProps) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsProcessing(true);
    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: returnUrl },
        redirect: "if_required",
      });

      if (error) {
        onError(error.message ?? "Payment failed. Please try again.");
        return;
      }

      if (paymentIntent?.status === "succeeded") {
        await onPaymentConfirmed(paymentIntent.id);
      } else {
        onError("Payment could not be confirmed. Please try again.");
      }
    } catch (err: any) {
      onError(err.message ?? "An unexpected error occurred.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Stripe PaymentElement — renders card fields + Apple Pay / Google Pay
          automatically when available on the customer's device/browser. */}
      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        <PaymentElement
          options={{
            layout: "tabs",
            // Wallet methods (Apple Pay, Google Pay) appear automatically on
            // compatible devices. Listing them first prioritises the wallet
            // experience on supported browsers.
            paymentMethodOrder: ["apple_pay", "google_pay", "card"],
            wallets: { applePay: "auto", googlePay: "auto" },
            fields: { billingDetails: { name: "auto" } },
          }}
        />
      </div>

      {/* Trust badges */}
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1"><Lock className="h-3 w-3" /> 256-bit SSL</span>
        <span className="flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> Powered by Stripe</span>
        <span>Card data never touches our servers</span>
      </div>

      <Button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full h-14 rounded-2xl shadow-brand text-base font-bold"
      >
        {isProcessing ? (
          <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Processing payment…</>
        ) : amountLabel ? (
          <>Pay {amountLabel} — Confirm Service</>
        ) : (
          "Confirm & Pay"
        )}
      </Button>
    </form>
  );
};

interface PaymentStepProps {
  clientSecret: string;
  onPaymentConfirmed: (paymentIntentId: string) => Promise<void>;
  onError: (message: string) => void;
  returnUrl: string;
  /** Display amount on the submit button, e.g. "$95" */
  amountLabel?: string;
}

/**
 * Wraps Stripe PaymentElement in its own <Elements> provider scoped to the
 * per-intent clientSecret. Supports card, Apple Pay, Google Pay, and any other
 * payment method Stripe enables for the account automatically.
 */
const PaymentStep = ({ clientSecret, onPaymentConfirmed, onError, returnUrl, amountLabel }: PaymentStepProps) => (
  <Elements
    stripe={stripePromise}
    options={{
      clientSecret,
      appearance: {
        theme: "stripe",
        variables: {
          colorPrimary: "#0f766e",
          borderRadius: "12px",
          fontFamily: '"Manrope", "Inter", system-ui, sans-serif',
        },
      },
    }}
  >
    <PaymentForm
      onPaymentConfirmed={onPaymentConfirmed}
      onError={onError}
      returnUrl={returnUrl}
      amountLabel={amountLabel}
    />
  </Elements>
);

export default PaymentStep;
