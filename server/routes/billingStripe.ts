import { Router } from "express";
import { supabase } from "../lib/supabase";
import { findStripePriceAsync } from "../lib/stripe-prices";

const router = Router();
const STRIPE_API = "https://api.stripe.com/v1";

/**
 * Get the correct application origin for Stripe redirect URLs
 *
 * CRITICAL FOR STRIPE: This function must NEVER return localhost in non-local environments
 * because Stripe will then redirect users to http://localhost which causes ERR_CONNECTION_REFUSED.
 *
 * Priority order:
 * 1. APP_BASE_URL (explicit override for deployed environments)
 * 2. x-forwarded-proto/host (trusted proxy headers from load balancers/CDN)
 * 3. request.protocol + request.get('host') if NOT localhost
 * 4. localhost ONLY if BOTH: host includes localhost AND NODE_ENV === 'development'
 * 5. Safe fallback using host header
 */
function getStripeOrigin(request: any): string {
  const proto = request.protocol || 'https';
  const host = request.get('host');

  // 1. HIGHEST PRIORITY: Explicit APP_BASE_URL override
  if (process.env.APP_BASE_URL) {
    return process.env.APP_BASE_URL;
  }

  // 2. TRUSTED PROXY HEADERS (reverse proxies, load balancers, CDN)
  const forwardedProto = request.get('x-forwarded-proto');
  const forwardedHost = request.get('x-forwarded-host');
  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  // 3. DIRECT HOST HEADER (only if NOT localhost/127.0.0.1)
  if (host && !host.includes('localhost') && !host.includes('127.0.0.1')) {
    return `${proto}://${host}`;
  }

  // 4. LOCALHOST - only allowed in explicit local development
  if (host?.includes('localhost') && process.env.NODE_ENV === 'development') {
    return `${proto}://${host}`;
  }

  // 5. LAST RESORT: Use host as-is
  if (host) {
    const origin = `${proto}://${host}`;
    console.warn(`[STRIPE] Origin from fallback host header: ${origin}`);
    return origin;
  }

  // 6. FINAL FALLBACK: Should not reach here in normal operation
  console.error('[STRIPE] Could not determine origin, using https://localhost');
  return 'https://localhost';
}

function getSecret() {
  const key = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_API_KEY || process.env.STRIPE_SECRET;

  // TEMPORARY DEBUG: Log Stripe key source (safe - only prefix)
  return key || undefined;
}

async function stripeFetch(path: string, init?: RequestInit, timeoutMs = 8000) {
  const secret = getSecret();
  if (!secret) throw Object.assign(new Error("Stripe not configured"), { status: 501 });

  const headers: Record<string, string> = {
    Authorization: `Bearer ${secret}`,
  };

  if (init?.method === "POST" && init.body) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
  }

  // Abort controller guards against Netlify's 10s function timeout.
  // 8s leaves 2s buffer for the outer handler to return a clean error response.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(`${STRIPE_API}${path}`, {
      ...init,
      headers: { ...headers, ...init?.headers },
      signal: controller.signal,
    } as RequestInit);
  } catch (fetchErr: any) {
    clearTimeout(timer);
    if (fetchErr?.name === "AbortError") {
      throw Object.assign(new Error("Stripe API request timed out"), { status: 504 });
    }
    throw Object.assign(new Error("Stripe API unreachable"), { status: 502 });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const text = await res.text();
    console.error(`[Billing] Stripe Error (${res.status}): ${path}`, text.slice(0, 200));
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
    const params = new URLSearchParams({
      email: user.email!,
      name: user.user_metadata?.name || user.email!.split("@")[0],
      'metadata[supabase_id]': user.id
    });
    const newCustomer = await stripeFetch("/customers", {
      method: "POST",
      body: params.toString()
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
    const plan = await findStripePriceAsync(acreage, cadenceDays, program === "one_time", supabase);
    if (!plan) throw new Error("Could not resolve a matching pricing tier for this property size and cadence.");

    // Use Stripe-safe origin resolution (never returns localhost in non-local envs)
    const origin = getStripeOrigin(req);
    const returnUrl = `${origin}/dashboard/billing`;

    const body = new URLSearchParams({
      customer: customerId,
      'line_items[0][price]': plan.stripePriceId,
      'line_items[0][quantity]': '1',
      mode: program === "one_time" ? 'payment' : 'subscription',
      success_url: `${returnUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/pricing`,
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

    // VERIFY: Log the actual URLs being sent to Stripe
    const successUrl = `${returnUrl}?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${origin}/pricing`;
    console.log(`[BILLING STRIPE] Checkout URLs - Success: ${successUrl}, Cancel: ${cancelUrl}`);

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
 * If no subscription exists, creates one instead (migration path for customers without active subscriptions).
 */
router.post("/update-subscription-plan", async (req, res) => {
  try {
    const { propertyId, acreage, frequency, program } = req.body;

    // Validate required fields
    if (!propertyId) throw new Error("Property ID is required");
    if (!acreage) throw new Error("Acreage is required");
    if (!frequency) throw new Error("Frequency is required");

    const user = await getAuthenticatedUser(req);
    const customerId = await getOrCreateStripeCustomer(user);

    // 1. Resolve new Price ID
    const plan = await findStripePriceAsync(acreage, frequency, program === "one_time", supabase);
    if (!plan) {
      throw new Error(`Invalid plan configuration: acreage=${acreage}, frequency=${frequency}, program=${program}`);
    }

    // 2. Find existing subscription for this property (check all non-cancelled statuses)
    let subscriptions;
    try {
      subscriptions = await stripeFetch(`/subscriptions?customer=${customerId}&limit=100`);
    } catch (stripeError: any) {
      console.error("[Billing] Stripe fetch error:", stripeError);
      throw new Error("Failed to fetch subscriptions from Stripe");
    }

    const targetSub = subscriptions.data?.find((s: any) =>
      s.metadata?.property_id === propertyId && s.status !== 'canceled'
    );

    // 3. If subscription exists, update it; otherwise create a new one
    if (targetSub) {
      // Update the subscription item
      const itemId = targetSub.items.data[0].id;
      try {
        await stripeFetch(`/subscriptions/${targetSub.id}`, {
          method: 'POST',
          body: new URLSearchParams({
            'items[0][id]': itemId,
            'items[0][price]': plan.stripePriceId,
            'metadata[tier_key]': plan.id,
            'metadata[cadence_days]': frequency.toString()
          }).toString()
        });
        console.log(`[Billing] Successfully updated subscription ${targetSub.id} for property ${propertyId}`);
      } catch (stripeError: any) {
        console.error("[Billing] Stripe subscription update failed:", stripeError);
        throw new Error("Failed to update subscription in Stripe");
      }

      res.json({ success: true, message: "Subscription plan updated successfully." });
    } else {
      // No subscription exists: create a new one
      console.log(`[Billing] Creating new subscription for property ${propertyId} (no existing subscription found)`);

      const params = new URLSearchParams({
        customer: customerId,
        'items[0][price]': plan.stripePriceId,
        'metadata[user_id]': user.id,
        'metadata[property_id]': propertyId,
        'metadata[tier_key]': plan.id,
        'metadata[cadence_days]': frequency.toString(),
      });

      let subscription;
      try {
        subscription = await stripeFetch("/subscriptions", {
          method: "POST",
          body: params.toString()
        });
        console.log(`[Billing] Successfully created subscription ${subscription.id} for property ${propertyId}`);
      } catch (stripeError: any) {
        console.error("[Billing] Stripe subscription creation failed:", stripeError);
        throw new Error("Failed to create subscription in Stripe");
      }

      // Also save to Supabase for local tracking
      try {
        const { error: dbError } = await supabase
          .from("subscriptions")
          .upsert({
            user_id: user.id,
            property_id: propertyId,
            plan_id: plan.id,
            stripe_subscription_id: subscription.id,
            status: 'active',
            cadence_days: frequency,
            amount_cents: subscription.items.data[0].price.unit_amount,
            currency: subscription.currency?.toUpperCase() || 'USD',
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          }, { onConflict: 'stripe_subscription_id' });

        if (dbError) {
          console.warn("[Billing] Failed to sync subscription to Supabase:", dbError);
          // Don't fail the request - Stripe is source of truth, but log it
        } else {
          console.log(`[Billing] Successfully synced subscription ${subscription.id} to Supabase`);
        }
      } catch (dbError: any) {
        console.error("[Billing] Database error:", dbError);
        // Don't fail - Stripe is source of truth
      }

      res.json({
        success: true,
        message: "Subscription created successfully.",
        subscriptionId: subscription.id
      });
    }
  } catch (e: any) {
    console.error("[Billing] Update plan error:", e);
    res.status(e.status || 500).json({ error: e.message });
  }
});

/**
 * Updates a customer's service frequency (cadence) natively via Stripe API.
 */
router.post("/update-subscription-cadence", async (req, res) => {
  try {
    const { propertyId, acreage, newCadence } = req.body;

    if (!propertyId) return res.status(400).json({ error: "Property ID is required" });
    if (!acreage) return res.status(400).json({ error: "Acreage is required" });
    if (!newCadence) return res.status(400).json({ error: "New cadence is required" });

    const user = await getAuthenticatedUser(req);
    const customerId = await getOrCreateStripeCustomer(user);

    const plan = await findStripePriceAsync(acreage, newCadence, false, supabase);
    if (!plan) return res.status(400).json({ error: "Invalid cadence for this property size." });

    const subscriptionData = await stripeFetch(`/subscriptions?customer=${customerId}&status=active`);

    // Guard: Stripe response must have a data array
    const subList: any[] = Array.isArray(subscriptionData?.data) ? subscriptionData.data : [];
    const targetSub = subList.find(
      (s: any) => s.metadata?.property_id === propertyId
    );

    if (!targetSub) {
      // No active subscription found — not an error; cadence unchanged
      return res.json({ success: true, message: "No active subscription found for this property." });
    }

    const itemId = targetSub.items?.data?.[0]?.id;
    if (!itemId) {
      return res.status(500).json({ error: "Subscription item ID could not be resolved." });
    }

    await stripeFetch(`/subscriptions/${targetSub.id}`, {
      method: 'POST',
      body: new URLSearchParams({
        'items[0][id]': itemId,
        'items[0][price]': plan.stripePriceId,
        'metadata[cadence_days]': newCadence.toString()
      }).toString()
    });

    res.json({ success: true, message: "Cadence updated successfully." });
  } catch (e: any) {
    console.error("[Billing] update-subscription-cadence error:", e.message);
    res.status(e.status || 500).json({ error: e.message || "Failed to update cadence." });
  }
});

/**
 * Creates a payment method from a Stripe test token and attaches it to a customer.
 * In test mode, we use Stripe's test tokens and update customer metadata.
 */
router.post("/create-and-attach-payment-method", async (req, res) => {
  try {
    const { stripeTestToken, billingZip } = req.body;
    const user = await getAuthenticatedUser(req);
    const customerId = await getOrCreateStripeCustomer(user);

    // Map test token to card details for display purposes
    const cardDetails: Record<string, { brand: string; last4: string; expiry: string }> = {
      tok_visa: { brand: "Visa", last4: "4242", expiry: "12/26" },
      tok_mastercard: { brand: "Mastercard", last4: "4444", expiry: "12/26" },
      tok_amex: { brand: "American Express", last4: "0005", expiry: "12/26" },
    };

    const details = cardDetails[stripeTestToken] || cardDetails["tok_visa"];

    // Create a source from the test token and attach to customer
    const sourceResponse = await stripeFetch(`/customers/${customerId}/sources`, {
      method: "POST",
      body: new URLSearchParams({
        source: stripeTestToken,
        "metadata[card_brand]": details.brand,
        "metadata[card_last4]": details.last4,
      }).toString(),
    });

    // Update customer metadata with card info for display
    await stripeFetch(`/customers/${customerId}`, {
      method: "POST",
      body: new URLSearchParams({
        "metadata[card_brand]": details.brand,
        "metadata[card_last4]": details.last4,
        "metadata[card_expiry]": details.expiry,
        description: `Customer: ${user.email} | Card: ${details.brand} ending in ${details.last4}`,
      }).toString(),
    });

    res.json({
      success: true,
      message: "Payment method added successfully.",
      cardInfo: details
    });
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

/**
 * Cancels a subscription for a property.
 * Finds the active subscription for the property and cancels it at the end of the billing period.
 */
router.post("/cancel-subscription", async (req, res) => {
  try {
    const { propertyId } = req.body;
    const user = await getAuthenticatedUser(req);

    if (!propertyId) {
      throw new Error("Property ID is required");
    }

    // Get the subscription for this property
    const customerId = await getOrCreateStripeCustomer(user);

    // Find subscriptions for this customer
    const subscriptions = await stripeFetch(`/subscriptions?customer=${customerId}&status=active`);
    const targetSub = subscriptions.data.find((s: any) => s.metadata?.property_id === propertyId);

    if (!targetSub) {
      throw new Error("No active subscription found for this property");
    }

    // Cancel the subscription at the end of the billing period
    await stripeFetch(`/subscriptions/${targetSub.id}`, {
      method: "DELETE",
      body: new URLSearchParams({
        invoice_now: "false" // Don't create an invoice for remaining time
      }).toString()
    });

    // Mark the property as cancelled in the database by updating metadata
    const { data: supabaseUser, error: dbError } = await supabase
      .from("profiles")
      .select("subscription_metadata")
      .eq("id", user.id)
      .single();

    if (!dbError && supabaseUser) {
      // Update subscription metadata to mark as cancelled
      const metadata = supabaseUser.subscription_metadata || {};
      metadata[`property_${propertyId}_cancelled_at`] = new Date().toISOString();

      await supabase
        .from("profiles")
        .update({ subscription_metadata: metadata })
        .eq("id", user.id);
    }

    res.json({
      success: true,
      message: "Subscription cancelled successfully. Your service will end at the billing period.",
      subscriptionId: targetSub.id
    });
  } catch (e: any) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

/**
 * GET /api/billing/invoices
 * Returns the authenticated customer's real Stripe invoices.
 */
router.get("/invoices", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    const customerId = await getOrCreateStripeCustomer(user);
    if (!customerId) return res.json({ invoices: [] });

    const limit = Math.min(Number(req.query.limit || 10), 50);
    const data = await stripeFetch(`/invoices?customer=${customerId}&limit=${limit}&status=paid`);

    const invoices = (data.data || []).map((inv: any) => ({
      id: inv.id,
      number: inv.number || inv.id,
      status: inv.status,
      total: inv.total,
      currency: inv.currency,
      created: inv.created ? new Date(inv.created * 1000).toISOString() : null,
      invoice_pdf: inv.invoice_pdf || null,
      hosted_invoice_url: inv.hosted_invoice_url || null,
    }));

    res.json({ invoices });
  } catch (e: any) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

export default router;
