import { loadStripe } from "@stripe/stripe-js";

// Shared Stripe instance — import this wherever stripePromise is needed
// to avoid creating multiple instances.
export const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "");
