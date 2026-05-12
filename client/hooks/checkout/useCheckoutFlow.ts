import { useState } from "react";
import { Appointment } from "@/hooks/dashboard/useAppointments";
import { CartItemEntry } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Checkout state type
 */
export type CheckoutStage = "review" | "confirming" | "confirmed" | "error" | "redirecting";

export interface CheckoutState {
  stage: CheckoutStage;
  nextAppointment: Appointment | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook to manage checkout flow state and logic
 * Handles:
 * - Finding next appointment
 * - Validating cart state
 * - Creating real Stripe checkout session
 * - Progressing through checkout stages
 * - Error handling
 */
export const useCheckoutFlow = () => {
  const { user } = useAuth();
  const [stage, setStage] = useState<CheckoutStage>("review");
  const [nextAppointment, setNextAppointment] = useState<Appointment | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Initialize checkout with next appointment
   */
  const initializeCheckout = (appointment: Appointment | null) => {
    setIsLoading(true);
    setError(null);

    try {
      if (!appointment) {
        setError("No upcoming appointment found. Please schedule a service first.");
        setStage("error");
        setIsLoading(false);
        return false;
      }

      setNextAppointment(appointment);
      setStage("review");
      setIsLoading(false);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to initialize checkout";
      setError(message);
      setStage("error");
      setIsLoading(false);
      return false;
    }
  };

  /**
   * Progress to Stripe checkout - creates real Stripe session
   */
  const confirmCheckout = async (items: CartItemEntry[], subtotalCents: number, taxCents: number, totalCents: number) => {
    setIsLoading(true);
    setError(null);

    try {
      setStage("confirming");

      // Get auth token
      const { data } = await import("@/lib/supabase").then(m => m.supabase.auth.getSession());
      const token = data.session?.access_token;

      if (!token) {
        throw new Error("Not authenticated");
      }

      // Create Stripe checkout session
      const response = await fetch("/api/marketplace/create-checkout-session", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: items.map(item => ({
            id: item.id,
            name: item.name,
            quantity: item.quantity,
            priceCents: item.cartPrice ?? (item.priceType === "fixed" ? item.priceCents : 0),
          })),
          appointmentId: nextAppointment?.id,
          propertyId: (nextAppointment as any)?.propertyId,
          subtotalCents,
          taxCents,
          totalCents,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create checkout session");
      }

      const { sessionUrl } = await response.json();

      if (!sessionUrl) {
        throw new Error("No checkout URL returned from server");
      }

      // Redirect to Stripe Checkout
      // HARDENING: Use top-level navigation for embedded/iframe contexts
      // Stripe Checkout refuses to run inside iframes, so we must navigate the top-level window
      setStage("redirecting");

      try {
        // Try to navigate the top-level window (handles iframe/embedded contexts like Builder preview)
        if (window.top && window.top !== window) {
          // We're inside an iframe, navigate top-level window
          window.top.location.href = sessionUrl;
        } else {
          // We're in the top-level window, navigate normally
          window.location.href = sessionUrl;
        }
      } catch (redirectErr) {
        // In some cases, cross-origin restrictions may prevent window.top access
        // Fall back to regular navigation with a user-facing message
        console.error("[Checkout] Could not redirect to top level:", redirectErr);
        setError(
          "Payment requires opening Stripe Checkout. " +
          "Please click the button below or open the app in a new tab to complete your payment."
        );
        setStage("error");
        setIsLoading(false);

        // Provide a fallback button for user to open in new tab
        // This will be rendered in the error UI
        return false;
      }

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to process checkout";
      console.error("[Checkout] Error:", message);
      setError(message);
      setStage("error");
      setIsLoading(false);
      return false;
    }
  };

  /**
   * Reset checkout flow
   */
  const resetCheckout = () => {
    setStage("review");
    setNextAppointment(null);
    setIsLoading(false);
    setError(null);
  };

  return {
    stage,
    nextAppointment,
    isLoading,
    error,
    initializeCheckout,
    confirmCheckout,
    resetCheckout,
  };
};
