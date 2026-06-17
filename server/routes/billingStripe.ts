import { Router } from "express";
import { supabase } from "../lib/supabase";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { findStripePriceAsync } from "../lib/stripe-prices";
import { logger } from "../lib/logger";
import { checkpoint, CP } from "../lib/checkpoint";
import { safeErrorMessage, ERROR_CODES } from "../lib/apiErrors";
import { captureException } from "../lib/sentry";
import { sendConfirmationForAppointment } from "../services/notifications/sendAppointmentConfirmation";
// Relative import (not the "@shared" alias): this module is reachable from
// vite.config.ts's dynamic `import("./server")`, and Vite's config-bundler
// externalizes bare/aliased specifiers, which Node then can't resolve.
import { lookupAnnualCents, lookupOneTimeCents } from "../../shared/pricing";

const router = Router();
const STRIPE_API = "https://api.stripe.com/v1";

// When STRIPE_AUTO_TAX=true in env, automatic Stripe Tax is requested on all charges.
// Requires Stripe Tax to be configured in the Stripe Dashboard.
const autoTaxEnabled = () => process.env.STRIPE_AUTO_TAX === "true";

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
  if (!key) return undefined;

  const isLiveKey = key.startsWith("sk_live_");
  const isTestKey = key.startsWith("sk_test_");
  const isProd = process.env.NODE_ENV === "production";
  const mode = isLiveKey ? "LIVE" : isTestKey ? "TEST" : "UNKNOWN";

  // Log active mode on every key resolution — visible in Netlify function logs
  console.log(`[Billing] Stripe key mode: ${mode} | NODE_ENV: ${process.env.NODE_ENV || "unset"}`);

  if (isProd && isTestKey) {
    console.warn("[Billing] WARNING: STRIPE_SECRET_KEY is a TEST key but NODE_ENV=production. Subscription/plan-change flows will fail if service_plans contains live price IDs.");
  }
  if (!isProd && isLiveKey) {
    console.warn("[Billing] WARNING: STRIPE_SECRET_KEY is a LIVE key but NODE_ENV is not production. Real charges may occur.");
  }

  return key;
}

async function stripeFetch(path: string, init?: RequestInit, timeoutMs = 6000) {
  const secret = getSecret();
  if (!secret) throw Object.assign(new Error("Stripe not configured"), { status: 501 });

  const headers: Record<string, string> = {
    Authorization: `Bearer ${secret}`,
    // Pin to a stable API version so invoice.payment_intent is reliably
    // returned as a string ID (or expanded PI object) regardless of the
    // account's default API version.
    "Stripe-Version": "2023-10-16",
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
  // 1. Check Supabase first — use limit(1) to avoid PGRST116 on duplicate profile rows
  const { data: profileRows } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .limit(1);

  const profile = Array.isArray(profileRows) ? profileRows[0] : null;
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
 * Guard: verifies the authenticated user has an active Stripe subscription
 * before allowing access to billing management endpoints (portal, plan changes,
 * cancellation). Returns 403 with a structured error if no active sub found.
 *
 * This is the server-side enforcement layer — even if the client-side nav
 * renders incorrectly, these endpoints will refuse to serve unpaid users.
 */
async function requireActiveSubscription(user: any): Promise<void> {
  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("id, status")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (!sub) {
    throw Object.assign(
      new Error("An active subscription is required to access this feature."),
      { status: 403, code: "NO_ACTIVE_SUBSCRIPTION" },
    );
  }
}

/**
 * POST /api/billing/create-checkout-session
 * Handles first-time subscription signups.
 */
router.post("/create-checkout-session", async (req, res) => {
  try {
    const {
      propertyId, acreage, cadenceDays, program,
      scheduledDate, window: windowId, windowLabel, windowStart, notes,
      preferredDays, preferredWindows, flexibilityDays,
    } = req.body;

    // Annual plans are prepaid one-time PaymentIntents, not recurring Stripe
    // Subscriptions — `mode` below would otherwise resolve to 'subscription'
    // for any program other than "one_time" and create a recurring charge.
    // Use /api/billing/create-payment-intent for annual plans instead.
    if (program === "annual") {
      return res.status(400).json({
        error: "Annual plans must use /api/billing/create-payment-intent, not create-checkout-session.",
      });
    }

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

    // Scheduling preference — persisted so the webhook can create the first appointment.
    // Stripe metadata values are capped at 500 chars; op_notes is truncated defensively.
    if (scheduledDate) body.append('metadata[scheduled_date]', scheduledDate);
    if (windowId)      body.append('metadata[window_id]',      windowId);
    if (windowLabel)   body.append('metadata[window_label]',   windowLabel);
    if (windowStart)   body.append('metadata[window_start]',   windowStart);
    if (notes)         body.append('metadata[op_notes]',       String(notes).slice(0, 490));
    // Availability preferences — stored as compact strings to fit Stripe metadata limits
    if (Array.isArray(preferredDays) && preferredDays.length)
      body.append('metadata[pref_days]', preferredDays.join(","));
    if (Array.isArray(preferredWindows) && preferredWindows.length)
      body.append('metadata[pref_windows]', preferredWindows.join(","));
    if (flexibilityDays !== undefined && flexibilityDays !== null)
      body.append('metadata[flex_days]', String(flexibilityDays));

    // For recurring plans, mirror scheduling fields onto subscription metadata too
    // (subscription metadata survives beyond the checkout session object)
    if (program !== "one_time") {
      body.append('subscription_data[metadata][user_id]',      user.id);
      body.append('subscription_data[metadata][property_id]',  propertyId);
      body.append('subscription_data[metadata][cadence_days]', cadenceDays.toString());
      if (scheduledDate) body.append('subscription_data[metadata][scheduled_date]', scheduledDate);
      if (windowId)      body.append('subscription_data[metadata][window_id]',      windowId);
      if (windowLabel)   body.append('subscription_data[metadata][window_label]',   windowLabel);
    }

    // VERIFY: Log the actual URLs being sent to Stripe
    const successUrl = `${returnUrl}?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${origin}/pricing`;
    console.log(`[BILLING STRIPE] Checkout URLs - Success: ${successUrl}, Cancel: ${cancelUrl}`);

    let session: any;
    try {
      session = await stripeFetch("/checkout/sessions", {
        method: "POST",
        body: body.toString()
      });
    } catch (sessionErr: any) {
      const isNoSuchPrice =
        typeof sessionErr.message === "string" &&
        (sessionErr.message.includes("No such price") || sessionErr.message.includes("resource_missing"));
      if (!isNoSuchPrice || !plan.priceCents) throw sessionErr;

      console.warn(`[create-checkout-session] Price ${plan.stripePriceId} not in Stripe — retrying with inline price_data`);
      const fallback = new URLSearchParams(body.toString());
      fallback.delete("line_items[0][price]");
      fallback.set("line_items[0][price_data][currency]", "usd");
      fallback.set("line_items[0][price_data][unit_amount]", String(plan.priceCents));
      fallback.set("line_items[0][price_data][product_data][name]", "Mosquito Control Service");
      fallback.set("line_items[0][price_data][product_data][metadata[plan]]", plan.id);
      if (program !== "one_time") {
        fallback.set("line_items[0][price_data][recurring][interval]", "month");
      }
      session = await stripeFetch("/checkout/sessions", {
        method: "POST",
        body: fallback.toString()
      });
    }

    res.json({ url: session.url });
  } catch (e: any) {
    console.error("Checkout session error:", e);
    res.status(e.status || 500).json({ error: e.message || "Failed to create checkout session" });
  }
});

/**
 * POST /api/billing/create-payment-intent
 *
 * For inline Stripe PaymentElement checkout (replaces hosted checkout redirect).
 * - one_time  → creates a PaymentIntent, returns clientSecret
 * - subscription → creates a Subscription with default_incomplete, returns the
 *                  latestInvoice PaymentIntent clientSecret
 */
router.post("/create-payment-intent", async (req, res) => {
  try {
    const {
      propertyId, acreage, cadenceDays, program,
      scheduledDate, window: windowId, windowLabel, windowStart, notes,
      preferredDays, preferredWindows, flexibilityDays,
      promoDiscountCents, stripePromotionCodeId, promoDatabaseId,
    } = req.body;

    // Log incoming params to server console — helps diagnose missing/bad values
    const stripeMode = process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_") ? "TEST"
      : process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_") ? "LIVE" : "UNSET";
    console.log(`[create-payment-intent] propertyId=${propertyId} acreage=${acreage} cadenceDays=${cadenceDays} program=${program} stripeMode=${stripeMode}`);

    // Early validation — missing or zero acreage produces no price match
    if (!propertyId) {
      return res.status(400).json({ error: "propertyId is required" });
    }
    const acreageNum = Number(acreage);
    if (!acreage || isNaN(acreageNum) || acreageNum <= 0) {
      return res.status(400).json({
        error: `Invalid acreage (${acreage}). Property must have a valid lot size set before checkout.`,
      });
    }

    const user       = await getAuthenticatedUser(req);
    const customerId = await getOrCreateStripeCustomer(user);
    const plan       = await findStripePriceAsync(acreageNum, cadenceDays, program === "one_time", supabase);
    if (!plan) {
      console.error(`[create-payment-intent] No price match — acreage=${acreageNum} cadence=${cadenceDays} program=${program} mode=${stripeMode}`);
      throw new Error(`No pricing tier found for acreage=${acreageNum} cadence=${cadenceDays}. Check that the property lot size is within a supported range (0.01–2 acres) and that cadence is 14, 21, 30, or 42 days.`);
    }
    console.log(`[create-payment-intent] plan resolved — id=${plan.id} priceId=${plan.stripePriceId}`);

    // Shared scheduling metadata attached to the Stripe object
    const meta: Record<string, string> = {
      user_id:      user.id,
      property_id:  propertyId,
      tier_key:     plan.id,
      cadence_days: String(cadenceDays),
    };
    if (scheduledDate) meta.scheduled_date = scheduledDate;
    if (windowId)      meta.window_id      = windowId;
    if (windowLabel)   meta.window_label   = windowLabel;
    if (windowStart)   meta.window_start   = windowStart;
    if (notes)         meta.op_notes       = String(notes).slice(0, 490);
    if (Array.isArray(preferredDays)    && preferredDays.length)    meta.pref_days    = preferredDays.join(",");
    if (Array.isArray(preferredWindows) && preferredWindows.length) meta.pref_windows = preferredWindows.join(",");
    if (flexibilityDays !== undefined)  meta.flex_days = String(flexibilityDays);
    if (promoDatabaseId)        meta.promo_code_id            = String(promoDatabaseId);
    if (stripePromotionCodeId)  meta.stripe_promotion_code_id = String(stripePromotionCodeId);

    // Subscriptions apply the discount via Stripe's own promotion-code mechanism
    // (Stripe computes the discounted invoice) — that requires a Stripe-synced code.
    // one_time/annual PaymentIntents instead reduce `amount` directly below, which
    // works even for local-only codes that never synced to Stripe.
    if (program !== "one_time" && program !== "annual" && promoDatabaseId && !stripePromotionCodeId) {
      return res.status(400).json({
        error: "This promo code isn't available for recurring plans yet. Try a one-time or annual plan, or contact support.",
      });
    }

    // Promo discount applied directly to one_time/annual PaymentIntent amounts —
    // mirrors the marketplace checkout's existing pattern. Stripe minimum charge is 50 cents.
    const applyPromoDiscount = (cents: number): number =>
      Math.max(50, cents - Math.min(promoDiscountCents || 0, cents));

    if (program === "annual") {
      // Annual plan: flat yearly charge as a one-time PaymentIntent.
      const annualCents = lookupAnnualCents(acreageNum);
      if (!annualCents) {
        return res.status(400).json({
          error: `No annual pricing tier found for acreage=${acreageNum}. Property must be 0.01–2.00 acres.`,
        });
      }
      const body = new URLSearchParams({
        amount:      String(applyPromoDiscount(annualCents)),
        currency:    "usd",
        customer:    customerId,
        description: "Annual Mosquito Service Plan",
        "automatic_payment_methods[enabled]": "true",
      });
      if (autoTaxEnabled()) body.append("automatic_tax[enabled]", "true");
      for (const [k, v] of Object.entries(meta)) body.append(`metadata[${k}]`, v);
      body.append("metadata[program]", "annual");

      const pi = await stripeFetch("/payment_intents", { method: "POST", body: body.toString() });
      console.log(`[create-payment-intent] annual plan resolved — acreage=${acreageNum} amount=${annualCents}`);
      return res.json({ clientSecret: pi.client_secret, intentId: pi.id, type: "payment_intent" });
    }

    if (program === "one_time") {
      // One-time treatment: flat per-acreage-tier charge as a one-time PaymentIntent.
      // Priced from the same acreage tier table as subscriptions/annual — no Stripe
      // Price object lookup needed (mirrors the annual branch above).
      const oneTimeCents = lookupOneTimeCents(acreageNum);
      if (!oneTimeCents) {
        return res.status(400).json({
          error: `No one-time pricing tier found for acreage=${acreageNum}. Property must be 0.01–2.00 acres.`,
        });
      }
      const body = new URLSearchParams({
        amount:      String(applyPromoDiscount(oneTimeCents)),
        currency:    "usd",
        customer:    customerId,
        description: "One-Time Mosquito Treatment",
        "automatic_payment_methods[enabled]": "true",
      });
      if (autoTaxEnabled()) body.append("automatic_tax[enabled]", "true");
      for (const [k, v] of Object.entries(meta)) body.append(`metadata[${k}]`, v);
      body.append("metadata[program]", "one_time");

      const pi = await stripeFetch("/payment_intents", { method: "POST", body: body.toString() });
      console.log(`[create-payment-intent] one_time plan resolved — acreage=${acreageNum} amount=${oneTimeCents}`);
      return res.json({ clientSecret: pi.client_secret, intentId: pi.id, type: "payment_intent" });
    }

    // ── Subscription: default_incomplete ────────────────────────────────────────
    //
    // Stripe creates: Subscription → Invoice (open) → PaymentIntent (requires_payment_method).
    // We need the PaymentIntent client_secret to mount the PaymentElement.
    //
    // expand[] in the POST body is reliable — Stripe decodes %5B%5D in form-encoded bodies.
    // expand[] in GET query strings is NOT reliable — Node.js 18+ (undici) percent-encodes
    // brackets before the request is sent, and Stripe ignores %5B%5D in query params.
    // We therefore never use expand[] in GET requests anywhere in this handler.
    //
    // PI extraction strategy (two paths, both valid Stripe API patterns):
    //   Path 1 — inline expand from the subscription POST response (cheapest: 0 extra calls)
    //   Path 2 — fetch invoice directly, then fetch PI by its string ID (2 extra calls, 100% reliable)

    const buildSubBody = (priceParam: Record<string, string>) => {
      const body = new URLSearchParams({
        customer:         customerId,
        payment_behavior: "default_incomplete",
        "payment_settings[save_default_payment_method]": "on_subscription",
        ...priceParam,
      });
      if (autoTaxEnabled()) body.append("automatic_tax[enabled]", "true");
      for (const [k, v] of Object.entries(meta)) body.append(`metadata[${k}]`, v);
      // Stripe-native discount — Stripe computes the discounted invoice/PI amount itself.
      if (stripePromotionCodeId) body.append("discounts[0][promotion_code]", String(stripePromotionCodeId));
      // Inline expand — works reliably in POST bodies via %5B%5D decoding on Stripe's side.
      body.append("expand[]", "latest_invoice");
      body.append("expand[]", "latest_invoice.payment_intent");
      return body;
    };

    let sub: any;
    try {
      sub = await stripeFetch("/subscriptions", {
        method: "POST",
        body: buildSubBody({ "items[0][price]": plan.stripePriceId }).toString(),
      });
    } catch (subErr: any) {
      // "No such price" means the price ID doesn't exist in the current key mode
      // (test/live mismatch, or the test price was never provisioned in this account).
      // Retry with inline price_data — Stripe creates an ephemeral price on the fly.
      const raw = typeof subErr.message === "string" ? subErr.message : "";
      let isNoSuchPrice = false;
      try { isNoSuchPrice = JSON.parse(raw)?.error?.code === "resource_missing"; } catch { /* not JSON */ }
      if (!isNoSuchPrice) isNoSuchPrice = raw.includes("No such price") || raw.includes("resource_missing");
      if (!isNoSuchPrice || !plan.priceCents) throw subErr;

      console.warn(
        `[create-payment-intent] Price ${plan.stripePriceId} not in Stripe — ` +
        `retrying with inline price_data (${plan.priceCents} cents)`
      );
      sub = await stripeFetch("/subscriptions", {
        method: "POST",
        body: buildSubBody({
          "items[0][price_data][currency]":            "usd",
          "items[0][price_data][unit_amount]":         String(plan.priceCents),
          "items[0][price_data][recurring][interval]": "month",
          "items[0][price_data][product_data][name]":  "Mosquito Control Service",
        }).toString(),
      });
    }

    // Resolve invoice ID — latest_invoice is an expanded object when Path 1 succeeds,
    // or a plain string ID when the expand was silently ignored by Stripe.
    const latestInvoiceField = (sub as any).latest_invoice;
    const latestInvoiceId: string | undefined =
      typeof latestInvoiceField === "string"
        ? latestInvoiceField
        : (latestInvoiceField as any)?.id;

    if (!latestInvoiceId) {
      throw new Error("Subscription created but Stripe returned no invoice. Check Stripe dashboard.");
    }

    let piClientSecret: string | undefined;
    let piId:           string | undefined;

    // Helper — extracts client_secret from an invoice object regardless of Stripe API version.
    // Stripe has changed how the payment intent is exposed across API versions:
    //   classic (pre-2024)  → invoice.payment_intent (string ID or expanded PI object)
    //   newer               → invoice.confirmation_secret.client_secret
    //   newest              → invoice.payments.data[0].payment.payment_intent (string)
    const extractFromInvoice = async (inv: any): Promise<void> => {
      if (piClientSecret) return;

      // 1. Expanded PI object (classic + newer Stripe when expand worked)
      const piField = inv?.payment_intent;
      if (piField && typeof piField === "object" && piField.client_secret) {
        piClientSecret = piField.client_secret;
        piId           = piField.id;
        return;
      }

      // 2. PI string ID (classic — expand not applied, or expand returned only the ID)
      if (typeof piField === "string" && piField.startsWith("pi_")) {
        const pi = await stripeFetch(`/payment_intents/${piField}`);
        piClientSecret = pi.client_secret;
        piId           = pi.id;
        return;
      }

      // 3. confirmation_secret (Stripe API 2025+ subscriptions)
      const confirmSecret = inv?.confirmation_secret?.client_secret as string | undefined;
      if (confirmSecret) {
        // The secret IS the client_secret; derive pi id from its prefix.
        piClientSecret = confirmSecret;
        piId           = confirmSecret.split("_secret_")[0];
        return;
      }

      // 4. Invoice Payments collection (newest Stripe API format)
      const paymentsPiId = inv?.payments?.data?.[0]?.payment?.payment_intent as string | undefined;
      if (typeof paymentsPiId === "string" && paymentsPiId.startsWith("pi_")) {
        const pi = await stripeFetch(`/payment_intents/${paymentsPiId}`);
        piClientSecret = pi.client_secret;
        piId           = pi.id;
        return;
      }
    };

    // ── Path 1: inline expand from subscription creation response ────────────────
    const invoiceObj = typeof latestInvoiceField === "object" && latestInvoiceField !== null
      ? latestInvoiceField as any : null;

    if (invoiceObj) {
      await extractFromInvoice(invoiceObj);
      if (piClientSecret) {
        console.log(`[create-payment-intent] Path 1 resolved — id=${piId}`);
      }
    }

    // ── Path 2: fetch invoice then PI (no expand in GET — it doesn't work) ───────
    if (!piClientSecret) {
      try {
        console.log(`[create-payment-intent] Path 2 — fetching invoice ${latestInvoiceId}`);
        let invoice = await stripeFetch(`/invoices/${latestInvoiceId}`);

        // Finalize draft invoices (uncommon for default_incomplete, but possible in edge cases).
        if ((invoice as any).status === "draft") {
          console.log(`[create-payment-intent] Invoice ${latestInvoiceId} is draft — finalizing`);
          await stripeFetch(`/invoices/${latestInvoiceId}/finalize`, { method: "POST", body: "" });
          invoice = await stripeFetch(`/invoices/${latestInvoiceId}`);
        }

        await extractFromInvoice(invoice);
        if (piClientSecret) {
          console.log(`[create-payment-intent] Path 2 resolved — id=${piId} status=${(invoice as any).status}`);
        } else {
          console.warn(
            `[create-payment-intent] Path 2 — invoice ${latestInvoiceId} has no resolvable payment intent.\n` +
            `  payment_intent=${JSON.stringify((invoice as any).payment_intent)}\n` +
            `  confirmation_secret=${JSON.stringify((invoice as any).confirmation_secret)}\n` +
            `  payments=${JSON.stringify((invoice as any).payments?.data?.slice(0,1))}`
          );
        }
      } catch (p2Err: any) {
        console.warn(`[create-payment-intent] Path 2 failed: ${p2Err.message}`);
      }
    }

    if (!piClientSecret) {
      throw new Error(
        `Payment intent could not be resolved for subscription ${(sub as any).id} / ` +
        `invoice ${latestInvoiceId}. Check Stripe dashboard logs.`
      );
    }

    return res.json({
      clientSecret:   piClientSecret,
      intentId:       piId,
      subscriptionId: (sub as any).id,
      type:           "subscription",
    });
  } catch (e: any) {
    console.error("[Billing] create-payment-intent error:", e);
    // stripeFetch throws raw Stripe API text as e.message — parse for a cleaner client error.
    let errorMsg: string = e.message || "Failed to create payment intent";
    try {
      const parsed = JSON.parse(errorMsg);
      errorMsg = parsed?.error?.message || errorMsg;
    } catch { /* not JSON */ }
    res.status(e.status || 500).json({ error: errorMsg });
  }
});

/**
 * Increments a promo code's used_count after a confirmed successful payment.
 * Uses the atomic increment_promo_used_count RPC if available, falling back to
 * a non-atomic read-then-write (acceptable — this is a usage counter, not a
 * financial figure). Mirrors the equivalent block in webhooksStripe.ts for the
 * marketplace flow.
 */
async function incrementPromoUsedCount(promoCodeId: string): Promise<void> {
  try {
    const { error: rpcError } = await supabaseAdmin.rpc("increment_promo_used_count", {
      promo_id: promoCodeId,
    });
    if (rpcError) {
      const { data: promoRow } = await supabaseAdmin
        .from("promo_codes")
        .select("used_count")
        .eq("id", promoCodeId)
        .eq("active", true)
        .maybeSingle();
      if (promoRow) {
        await supabaseAdmin
          .from("promo_codes")
          .update({ used_count: (promoRow.used_count || 0) + 1 })
          .eq("id", promoCodeId);
      }
    }
  } catch (err: any) {
    console.error("[Billing] promo used_count increment failed:", err.message);
  }
}

/**
 * POST /api/billing/confirm-booking
 *
 * Called by the client immediately after stripe.confirmPayment() succeeds.
 * Verifies the PaymentIntent is 'succeeded', creates the first appointment,
 * upserts the subscription record (for subscription plans), persists
 * availability preferences, and marks the user as onboarded.
 *
 * The existing webhook (checkout.session.completed / invoice.payment_succeeded)
 * handles service_order creation as an async fallback.
 */
router.post("/confirm-booking", async (req, res) => {
  const requestId = (req as any).requestId || "no-req-id";
  try {
    const {
      paymentIntentId, subscriptionId, program,
      propertyId, scheduledDate, windowId, windowLabel, windowStart,
      notes, cadenceDays, preferredDays, preferredWindows, flexibilityDays,
    } = req.body;

    checkpoint(requestId, CP.BILLING_START, { program, hasScheduledDate: !!scheduledDate });

    if (!paymentIntentId) throw Object.assign(new Error("paymentIntentId required"), { status: 400 });

    const user = await getAuthenticatedUser(req);

    // Verify payment succeeded against Stripe before trusting the client
    const pi = await stripeFetch(`/payment_intents/${paymentIntentId}`);
    if ((pi as any).status !== "succeeded") {
      logger.warn("billing.payment.not_succeeded", { requestId, piStatus: (pi as any).status });
      return res.status(402).json({
        ok: false, requestId,
        error:  "Payment has not been confirmed yet",
        piStatus: (pi as any).status,
      });
    }
    checkpoint(requestId, CP.BILLING_PAYMENT_VERIFIED, { userId: user.id });

    // Redeem the promo code (if any) now that payment is confirmed. Read the
    // promo_code_id back from Stripe metadata rather than trusting the request
    // body — for one_time/annual it's on the PaymentIntent; for subscriptions
    // it's on the Subscription object (metadata attached at creation in
    // create-payment-intent), not the invoice's PaymentIntent.
    void (async () => {
      try {
        let redeemedPromoId: string | undefined = (pi as any).metadata?.promo_code_id;
        if (!redeemedPromoId && program !== "one_time" && program !== "annual" && subscriptionId) {
          const sub = await stripeFetch(`/subscriptions/${subscriptionId}`);
          redeemedPromoId = (sub as any).metadata?.promo_code_id;
        }
        if (redeemedPromoId) await incrementPromoUsedCount(redeemedPromoId);
      } catch (promoErr: any) {
        console.error("[Billing] promo redemption lookup failed:", promoErr.message);
      }
    })();

    // For recurring subscription plans: upsert the subscription record
    if (program !== "one_time" && program !== "annual" && subscriptionId) {
      await supabaseAdmin.from("subscriptions").upsert({
        stripe_subscription_id: subscriptionId,
        user_id:      user.id,
        property_id:  propertyId,
        status:       "active",
        program:      "subscription",
        cadence_days: parseInt(String(cadenceDays ?? "21"), 10),
        updated_at:   new Date().toISOString(),
      }, { onConflict: "stripe_subscription_id" });
    }

    // For annual plans: record a subscription row using the PaymentIntent ID as key.
    // There is no Stripe Subscription object for annual plans — they are one-time
    // PaymentIntents. We use current_period_end = now + 365 days so ops know when
    // to reach out for renewal. Renewal is manual (customer re-purchases).
    if (program === "annual" && paymentIntentId) {
      const periodEnd = new Date();
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      await supabaseAdmin.from("subscriptions").upsert({
        stripe_subscription_id: paymentIntentId,
        user_id:              user.id,
        property_id:          propertyId,
        status:               "active",
        program:              "annual",
        cadence_days:         30, // Annual service runs on a monthly internal cadence
        amount_cents:         (pi as any).amount ?? null,
        current_period_end:   periodEnd.toISOString(),
        last_payment_at:      new Date().toISOString(),
        updated_at:           new Date().toISOString(),
      }, { onConflict: "stripe_subscription_id" });
      console.log(`[Billing] Annual plan subscription row created: user=${user.id} expires=${periodEnd.toISOString().slice(0, 10)}`);
    }

    // For one-time treatments: record a bookkeeping subscription row so the
    // dashboard can show the purchase. status="completed" (not "active") marks
    // this as a single completed treatment, not an ongoing plan — cadence_days
    // and current_period_end are intentionally null (no recurrence).
    if (program === "one_time" && paymentIntentId) {
      await supabaseAdmin.from("subscriptions").upsert({
        stripe_subscription_id: paymentIntentId,
        user_id:              user.id,
        property_id:          propertyId,
        status:               "completed",
        program:              "one_time",
        cadence_days:         null,
        amount_cents:         (pi as any).amount ?? null,
        current_period_end:   null,
        last_payment_at:      new Date().toISOString(),
        updated_at:           new Date().toISOString(),
      }, { onConflict: "stripe_subscription_id" });
      console.log(`[Billing] One-time treatment subscription row created: user=${user.id} amount=${(pi as any).amount}`);
    }

    // Create first appointment (idempotent — skip if one already exists for same date)
    if (scheduledDate && windowId && propertyId) {
      const { count: existing } = await supabaseAdmin
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("property_id", propertyId)
        .eq("scheduled_date", scheduledDate)
        .not("status", "in", '("canceled","cancelled")');

      if ((existing ?? 0) === 0) {
        const scheduledAt = windowStart
          ? `${scheduledDate}T${windowStart}:00`
          : `${scheduledDate}T08:00:00`;

        const { error: apptErr } = await supabaseAdmin.from("appointments").insert({
          user_id:        user.id,
          property_id:    propertyId,
          status:         "scheduled",
          service_type:   "Mosquito Service",
          scheduled_date: scheduledDate,
          window:         windowId,
          window_label:   windowLabel || windowId,
          scheduled_at:   scheduledAt,
          notes:          notes || null,
        });

        if (apptErr) {
          logger.error("billing.appointment.insert_failed", apptErr, { requestId, userId: user.id, scheduledDate });
        } else {
          checkpoint(requestId, CP.BILLING_APPOINTMENT_CREATED, { userId: user.id, scheduledDate });
          // Send appointment confirmation email (fire-and-forget — never blocks checkout)
          const { data: newAppt } = await supabaseAdmin
            .from("appointments")
            .select("id")
            .eq("user_id", user.id)
            .eq("property_id", propertyId)
            .eq("scheduled_date", scheduledDate)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (newAppt?.id) {
            void sendConfirmationForAppointment(newAppt.id).catch(() => {});
          }
        }
      }
    }

    // Persist availability preferences and program to property
    if (propertyId) {
      const updates: Record<string, any> = {
        program:  program === "one_time" ? "one_time" : program === "annual" ? "annual" : "subscription",
        // One-time treatments don't recur — no cadence to record.
        cadence:  program === "one_time" ? null : parseInt(String(cadenceDays ?? "21"), 10),
      };
      if (Array.isArray(preferredDays) || Array.isArray(preferredWindows)) {
        updates.service_preferences = {
          preferred_days_of_week: Array.isArray(preferredDays)    ? preferredDays    : null,
          preferred_windows:      Array.isArray(preferredWindows) ? preferredWindows : null,
          flexibility_days:       flexibilityDays !== undefined ? parseInt(String(flexibilityDays), 10) : null,
        };
      }
      await supabaseAdmin.from("properties").update(updates).eq("id", propertyId);
    }

    // Mark user as onboarded and clear any saved onboarding progress
    await supabaseAdmin
      .from("profiles")
      .update({ is_onboarded: true, onboarding_progress: null })
      .eq("id", user.id);

    checkpoint(requestId, CP.BILLING_PROFILE_ONBOARDED, { userId: user.id });
    checkpoint(requestId, CP.BILLING_COMPLETE, { userId: user.id, program });
    logger.info("billing.confirm_booking.complete", { requestId, userId: user.id, program });
    res.json({ ok: true, requestId, success: true });
  } catch (e: any) {
    logger.error("billing.confirm_booking.failed", e, { requestId, checkpoint: "billing.error" });
    captureException(e, { requestId, tags: { flow: "confirm_booking" } });
    res.status(e.status || 500).json({
      ok: false,
      requestId,
      errorCode: ERROR_CODES.BOOKING_FAILED,
      error: safeErrorMessage(e, "Failed to confirm booking"),
    });
  }
});

/**
 * POST /api/billing/create-portal-session
 *
 * Allows customers with status = 'active' OR 'past_due' to access the billing portal.
 * Past-due customers must be able to update their payment method to recover their account —
 * blocking them with requireActiveSubscription creates an unrecoverable deadlock.
 * Auth is still enforced (getAuthenticatedUser throws 401 for unauthenticated requests).
 */
router.post("/create-portal-session", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);

    // Allow active OR past_due subscriptions through to the portal.
    // All other routes still use requireActiveSubscription (active only).
    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("id, status")
      .eq("user_id", user.id)
      .in("status", ["active", "past_due"])
      .limit(1)
      .maybeSingle();

    if (!sub) {
      throw Object.assign(
        new Error("An active or past-due subscription is required to access the billing portal."),
        { status: 403, code: "NO_BILLABLE_SUBSCRIPTION" },
      );
    }

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
    if (acreage === undefined || acreage === null) throw new Error("Acreage is required");
    if (!frequency) throw new Error("Frequency is required");

    // Guard: one-time programs require Stripe Checkout, not subscription management.
    // Stripe rejects subscription creation/update with a one-time price ID.
    if (program === "one_time") {
      return res.status(400).json({
        error: "One-time treatments must be purchased through the marketplace — not via subscription management."
      });
    }

    // Guard: annual plans are prepaid PaymentIntents, not Stripe Subscriptions —
    // there is no recurring subscription object here to update. Without this
    // guard, the "no existing subscription found" path below would create a
    // brand-new recurring Stripe Subscription for an annual-only customer.
    if (program === "annual") {
      return res.status(400).json({
        error: "Annual plans don't support in-place plan changes — purchase a new annual plan via create-payment-intent."
      });
    }

    // Phase 1: auth + subscription guard + price lookup
    let user: any;
    let plan: any;
    try {
      [user, plan] = await Promise.all([
        getAuthenticatedUser(req),
        findStripePriceAsync(acreage, frequency, false, supabase),
      ]);
    } catch (e: any) {
      throw e;
    }
    await requireActiveSubscription(user);

    if (!plan) {
      throw Object.assign(new Error(`Invalid plan configuration: acreage=${acreage}, frequency=${frequency}, program=${program}`), { status: 400 });
    }

    // Phase 2: resolve customer, then fetch their subscriptions
    const customerId = await getOrCreateStripeCustomer(user);
    let subscriptions: any;
    try {
      subscriptions = await stripeFetch(`/subscriptions?customer=${customerId}&limit=100`);
    } catch (e: any) {
      const detail = typeof e === 'object' ? (e.message || JSON.stringify(e)) : String(e);
      console.error("[Billing] Subscription fetch failed:", detail);
      throw Object.assign(new Error("Failed to load plan data. Please try again."), { status: 502 });
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
        const detail = typeof stripeError === 'object' ? (stripeError.message || JSON.stringify(stripeError)) : String(stripeError);
        console.error("[Billing] Stripe subscription update failed:", detail);
        throw new Error("Failed to update subscription in Stripe");
      }

      res.json({ success: true, message: "Subscription plan updated successfully." });
    } else {
      // No subscription exists: create a new one
      console.log(`[Billing] Creating new subscription for property ${propertyId} (no existing subscription found)`);

      const params = new URLSearchParams({
        customer: customerId,
        'items[0][price]': plan.stripePriceId,
        // default_incomplete: subscription is created without immediately charging.
        // Prevents hard failure when customer has no default payment method at creation time.
        'payment_behavior': 'default_incomplete',
        'payment_settings[save_default_payment_method]': 'on_subscription',
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
        const detail = typeof stripeError === 'object' ? (stripeError.message || JSON.stringify(stripeError)) : String(stripeError);
        console.error("[Billing] Stripe subscription creation failed:", detail);
        // Classify the Stripe error for a user-facing message
        const isNoPaymentMethod = detail.includes("payment_method") || detail.includes("No payment") || detail.includes("card");
        const isNoSuchPrice    = detail.includes("No such price") || detail.includes("no such price");
        const isNoSuchCustomer = detail.includes("No such customer") || detail.includes("no such customer");
        const isModeMismatch   = isNoSuchPrice || isNoSuchCustomer;
        if (isModeMismatch) {
          // Live price IDs sent via test key (or vice versa) — env config issue, not user error
          console.error("[Billing] STRIPE MODE MISMATCH — price or customer not found in current key mode. Check STRIPE_SECRET_KEY env var matches the key mode used to create these prices.");
        }
        throw new Error(
          isNoPaymentMethod
            ? "No payment method found. Please add a payment method before updating your plan."
            : isModeMismatch
            ? "Service configuration error — please contact support."
            : "Failed to create subscription in Stripe"
        );
      }

      // Also save to Supabase for local tracking.
      // Use the actual status from Stripe — do NOT hardcode 'active'.
      // Subscriptions created with default_incomplete start as 'incomplete'
      // and only become 'active' after invoice.paid fires.
      try {
        const { error: dbError } = await supabaseAdmin
          .from("subscriptions")
          .upsert({
            user_id: user.id,
            property_id: propertyId,
            plan_id: plan.id,
            stripe_subscription_id: subscription.id,
            status: subscription.status ?? 'incomplete',
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
    if (acreage === undefined || acreage === null) return res.status(400).json({ error: "Acreage is required" });
    if (!newCadence) return res.status(400).json({ error: "New cadence is required" });

    // Phase 1: auth + subscription guard + price lookup
    let user: any;
    let plan: any;
    try {
      [user, plan] = await Promise.all([
        getAuthenticatedUser(req),
        findStripePriceAsync(acreage, newCadence, false, supabase),
      ]);
    } catch (e: any) {
      return res.status(e.status || 500).json({ error: e.message || "Authentication or plan lookup failed." });
    }
    await requireActiveSubscription(user);

    // Phase 2: resolve customer, then fetch their subscriptions
    const customerId = await getOrCreateStripeCustomer(user);
    let subscriptionData: any;
    try {
      subscriptionData = await stripeFetch(`/subscriptions?customer=${customerId}&status=active`);
    } catch (parallelError: any) {
      const detail = typeof parallelError === 'object'
        ? (parallelError.message || JSON.stringify(parallelError))
        : String(parallelError);
      console.error("[Billing] Cadence plan lookup or subscription fetch failed:", detail);
      return res.status(502).json({ error: "Failed to load plan data. Please try again." });
    }

    if (!plan) return res.status(400).json({ error: "Invalid cadence for this property size." });

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
  // Test-only endpoint: block in production to prevent accidental token-based card attachment.
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({ error: "Not available in production." });
  }
  try {
    const { stripeTestToken } = req.body;
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
    await stripeFetch(`/customers/${customerId}/sources`, {
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

    const pm: any = await stripeFetch(`/payment_methods/${paymentMethodId}/attach`, {
      method: 'POST',
      body: new URLSearchParams({ customer: customerId }).toString()
    });

    await stripeFetch(`/customers/${customerId}`, {
      method: 'POST',
      body: new URLSearchParams({
        'invoice_settings[default_payment_method]': paymentMethodId
      }).toString()
    });

    // Sync real card details to profile
    if (pm.card) {
      const expMonth = String(pm.card.exp_month).padStart(2, "0");
      const expYear  = String(pm.card.exp_year).slice(-2);
      await supabaseAdmin.from("profiles").update({
        card_last4:  pm.card.last4,
        card_brand:  pm.card.brand,
        card_expiry: `${expMonth}/${expYear}`,
      }).eq("id", user.id);
    }

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
    await requireActiveSubscription(user);

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
    const { data: profileRows2 } = await supabase
      .from("profiles")
      .select("subscription_metadata")
      .eq("id", user.id)
      .limit(1);
    const supabaseUser = Array.isArray(profileRows2) ? profileRows2[0] : null;

    if (supabaseUser) {
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
