import { Router } from "express";
import { supabase } from "../lib/supabase";
import { findStripePrice } from "../lib/stripe-prices";

const router = Router();
const STRIPE_API = "https://api.stripe.com/v1";

function getSecret() {
  const key = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_API_KEY || process.env.STRIPE_SECRET;
  return key || undefined;
}

async function stripeFetch(path: string, init?: RequestInit) {
  const secret = getSecret();
  if (!secret) throw Object.assign(new Error("Stripe not configured"), { status: 501 });

  const headers: Record<string, string> = {
    Authorization: `Bearer ${secret}`,
  };

  if (init?.method === "POST" && init.body) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
  }

  const res = await fetch(`${STRIPE_API}${path}`, {
    ...init,
    headers: { ...headers, ...init?.headers },
  } as RequestInit);

  if (!res.ok) {
    const text = await res.text();
    console.error(`Stripe Error (${res.status}):`, text);
    throw Object.assign(new Error(text), { status: res.status });
  }

  return res.json();
}

/**
 * Retrieves the Stripe Customer ID for a user.
 * Prioritizes the stored 'stripe_customer_id' in Supabase.
 */
async function getOrCreateStripeCustomer(user: any) {
  // 1. Check Supabase first
  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single();

  if (profile?.stripe_customer_id) return profile.stripe_customer_id;

  // 2. Fallback to email search in Stripe (extra safety)
  const customersData = await stripeFetch(`/customers?email=${encodeURIComponent(user.email!)}&limit=1`);
  let customerId = (customersData.data && customersData.data[0]) ? customersData.data[0].id : null;

  // 3. Create if not found
  if (!customerId) {
    const newCustomer = await stripeFetch("/customers", {
      method: "POST",
      body: new URLSearchParams({
        email: user.email!,
        name: user.user_metadata?.name || user.email!.split("@")[0],
        metadata: { supabase_id: user.id }
      }).toString()
    });
    customerId = newCustomer.id;
  }

  // 4. Persist in Supabase
  await supabase
    .from("profiles")
    .update({ stripe_customer_id: customerId })
    .eq("id", user.id);

  return customerId;
}

async function getAuthenticatedUser(req: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader) throw Object.assign(new Error("Missing auth header"), { status: 401 });

  const token = authHeader.split(" ")[1];
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) throw Object.assign(new Error("Invalid session"), { status: 401 });
  return user;
}

/**
 * POST /api/billing/create-checkout-session
 * Handles first-time subscription signups.
 */
router.post("/create-checkout-session", async (req, res) => {
  try {
    const { propertyId, acreage, cadenceDays, program } = req.body;
    const user = await getAuthenticatedUser(req);
    const customerId = await getOrCreateStripeCustomer(user);

    // Resolve Price ID Server-Side
    const plan = findStripePrice(acreage, cadenceDays, program === "one_time");
    if (!plan) throw new Error("Could not resolve a matching pricing tier for this property size and cadence.");

    const returnUrl = `${req.headers.origin}/dashboard/billing`;

    const body = new URLSearchParams({
      customer: customerId,
      'line_items[0][price]': plan.stripePriceId,
      'line_items[0][quantity]': '1',
      mode: program === "one_time" ? 'payment' : 'subscription',
      success_url: `${returnUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin}/pricing`,
      'metadata[user_id]': user.id,
      'metadata[property_id]': propertyId,
      'metadata[tier_key]': plan.id,
      'metadata[cadence_days]': cadenceDays.toString(),
    });

    // For recurring plans, attach metadata to the subscription as well
    if (program !== "one_time") {
      body.append('subscription_data[metadata][user_id]', user.id);
      body.append('subscription_data[metadata][property_id]', propertyId);
      body.append('subscription_data[metadata][cadence_days]', cadenceDays.toString());
    }

    const session = await stripeFetch("/checkout/sessions", {
      method: "POST",
      body: body.toString()
    });

    res.json({ url: session.url });
  } catch (e: any) {
    console.error("Checkout session error:", e);
    res.status(e.status || 500).json({ error: e.message || "Failed to create checkout session" });
  }
});

/**
 * POST /api/billing/create-portal-session
 */
router.post("/create-portal-session", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    const customerId = await getOrCreateStripeCustomer(user);
    const returnUrl = req.body.returnUrl || `${req.headers.origin}/dashboard/billing`;

    const session = await stripeFetch("/billing_portal/sessions", {
      method: "POST",
      body: new URLSearchParams({
        customer: customerId,
        return_url: returnUrl
      }).toString()
    });

    res.json({ url: session.url });
  } catch (e: any) {
    console.error("Portal session error:", e);
    res.status(e.status || 500).json({ error: e.message || "Failed to create portal session" });
  }
});

/**
 * Updates a customer's subscription plan natively via Stripe API.
 */
router.post("/update-subscription-plan", async (req, res) => {
  try {
    const { propertyId, acreage, frequency, program } = req.body;
    const user = await getAuthenticatedUser(req);
    const customerId = await getOrCreateStripeCustomer(user);

    // 1. Resolve new Price ID
    const plan = findStripePrice(acreage, frequency, program === "one_time");
    if (!plan) throw new Error("Invalid plan configuration.");

    // 2. Find existing subscription for this property
    const subscriptions = await stripeFetch(`/subscriptions?customer=${customerId}&status=active`);
    const targetSub = subscriptions.data.find((s: any) => s.metadata.property_id === propertyId);

    if (!targetSub) throw new Error("No active subscription found for this property to update.");

    // 3. Update the subscription item
    const itemId = targetSub.items.data[0].id;
    await stripeFetch(`/subscriptions/${targetSub.id}`, {
      method: 'POST',
      body: new URLSearchParams({
        'items[0][id]': itemId,
        'items[0][price]': plan.stripePriceId,
        'metadata[tier_key]': plan.id,
        'metadata[cadence_days]': frequency.toString()
      }).toString()
    });

    res.json({ success: true, message: "Subscription plan updated successfully." });
  } catch (e: any) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

/**
 * Updates a customer's service frequency (cadence) natively via Stripe API.
 */
router.post("/update-subscription-cadence", async (req, res) => {
  try {
    const { propertyId, acreage, newCadence } = req.body;
    const user = await getAuthenticatedUser(req);
    const customerId = await getOrCreateStripeCustomer(user);

    const plan = findStripePrice(acreage, newCadence);
    if (!plan) throw new Error("Invalid cadence for this property size.");

    const subscriptions = await stripeFetch(`/subscriptions?customer=${customerId}&status=active`);
    const targetSub = subscriptions.data.find((s: any) => s.metadata.property_id === propertyId);

    if (targetSub) {
      const itemId = targetSub.items.data[0].id;
      await stripeFetch(`/subscriptions/${targetSub.id}`, {
        method: 'POST',
        body: new URLSearchParams({
          'items[0][id]': itemId,
          'items[0][price]': plan.stripePriceId,
          'metadata[cadence_days]': newCadence.toString()
        }).toString()
      });
    }

    res.json({ success: true, message: "Cadence updated successfully." });
  } catch (e: any) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

/**
 * Attaches a new payment method to a customer natively.
 */
router.post("/attach-payment-method", async (req, res) => {
  try {
    const { paymentMethodId } = req.body;
    const user = await getAuthenticatedUser(req);
    const customerId = await getOrCreateStripeCustomer(user);

    await stripeFetch(`/payment_methods/${paymentMethodId}/attach`, {
      method: 'POST',
      body: new URLSearchParams({ customer: customerId }).toString()
    });

    await stripeFetch(`/customers/${customerId}`, {
      method: 'POST',
      body: new URLSearchParams({
        'invoice_settings[default_payment_method]': paymentMethodId
      }).toString()
    });

    res.json({ success: true, message: "Payment method updated successfully." });
  } catch (e: any) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

export default router;
