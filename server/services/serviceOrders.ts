/**
 * Centralized service_order creation helpers.
 *
 * All creation is idempotent — safe to call multiple times for the same
 * event (webhook retries). Uses Postgres partial unique indexes as the
 * conflict target so no application-level duplicate check is needed.
 *
 * Rules:
 * - Only creates records for confirmed payment events (invoice.paid, payment_intent.succeeded)
 * - Does NOT create for failed/past_due/expired events
 * - Does NOT backfill historical data
 * - Never throws in a way that breaks the caller's webhook success path
 */

import { supabase } from "../lib/supabase";
import { supabaseAdmin } from "../lib/supabaseAdmin";

// Prefer service-role client so RLS doesn't block server-side writes.
// CRITICAL: service_orders RLS requires authenticated role. If supabaseAdmin is null
// (SUPABASE_SERVICE_ROLE_KEY not set), inserts will be blocked by RLS and silently fail.
const db = supabaseAdmin ?? supabase;

if (!supabaseAdmin) {
  console.error(
    "[service-orders] CRITICAL: supabaseAdmin is null — SUPABASE_SERVICE_ROLE_KEY is not set. " +
    "service_orders inserts will fail due to RLS. Set SUPABASE_SERVICE_ROLE_KEY in server environment."
  );
} else {
  console.log("[service-orders] service role client available — RLS bypassed for inserts.");
}

// ── Input types ───────────────────────────────────────────────────────────────

export interface SubscriptionServiceOrderInput {
  stripe_invoice_id: string;
  user_id: string;
  property_id?: string | null;
  subscription_id?: string | null;
  cadence_days?: number | null;
  current_period_end?: string | null;
}

export interface OneTimeServiceOrderInput {
  stripe_session_id: string;
  stripe_payment_intent_id: string | null;
  user_id: string;
  property_id?: string | null;
}

export interface MarketplaceAddOnServiceOrderInput {
  marketplace_order_id: string;
  stripe_payment_intent_id?: string | null;
  user_id: string;
  property_id?: string | null;
  appointment_id?: string | null;
  item_count?: number;
  first_item_name?: string | null;
}

// ── Helper: build service order title ────────────────────────────────────────

function subscriptionTitle(cadenceDays: number | null | undefined): string {
  if (cadenceDays) return `Mosquito Service – Every ${cadenceDays}d`;
  return "Mosquito Service";
}

// ── createSubscriptionServiceOrder ───────────────────────────────────────────

/**
 * Creates a service_order for one subscription billing period.
 * Idempotency key: stripe_invoice_id (partial unique index in DB).
 * Called from: invoice.paid webhook handler.
 */
export async function createSubscriptionServiceOrder(
  input: SubscriptionServiceOrderInput
): Promise<void> {
  const {
    stripe_invoice_id,
    user_id,
    property_id,
    subscription_id,
    cadence_days,
    current_period_end,
  } = input;

  const title = subscriptionTitle(cadence_days);

  const source_metadata: Record<string, unknown> = {
    stripe_invoice_id,
    ...(cadence_days != null && { cadence_days }),
    ...(current_period_end && { current_period_end }),
  };

  console.log("[service-orders] createSubscriptionServiceOrder — attempting upsert:", {
    stripe_invoice_id,
    user_id,
    property_id,
    subscription_id,
    cadence_days,
    using_service_role: !!supabaseAdmin,
  });

  try {
    const { data, error } = await db
      .from("service_orders")
      .upsert(
        {
          source: "subscription",
          user_id,
          property_id: property_id ?? null,
          subscription_id: subscription_id ?? null,
          stripe_invoice_id,
          title,
          status: "pending",
          priority: "normal",
          source_metadata,
        },
        { onConflict: "stripe_invoice_id" }
      )
      .select("id, status")
      .maybeSingle();

    if (error) {
      console.error("[service-orders] subscription upsert FAILED:", {
        stripe_invoice_id,
        message: error.message,
        code: error.code,
        details: (error as any).details,
        hint: (error as any).hint,
      });
    } else {
      console.log("[service-orders] subscription service_order OK:", {
        stripe_invoice_id,
        row_id: data?.id,
        status: data?.status,
      });
    }
  } catch (err: unknown) {
    console.error("[service-orders] subscription unexpected error:", err instanceof Error ? err.message : String(err));
  }
}

// ── createOneTimeServiceOrder ─────────────────────────────────────────────────

/**
 * Creates a service_order for a one-time service purchase.
 * Idempotency key: stripe_payment_intent_id (partial unique index WHERE source='one_time').
 * Called from: checkout.session.completed webhook (mode=payment, not marketplace).
 */
export async function createOneTimeServiceOrder(
  input: OneTimeServiceOrderInput
): Promise<void> {
  const { stripe_session_id, stripe_payment_intent_id, user_id, property_id } = input;

  // Without a PI ID we have no idempotency key — log and skip rather than create dupes
  if (!stripe_payment_intent_id) {
    console.warn("[ServiceOrders] one_time skipped — no stripe_payment_intent_id for session:", stripe_session_id);
    return;
  }

  const source_metadata: Record<string, unknown> = {
    stripe_session_id,
    stripe_payment_intent_id,
  };

  console.log("[service-orders] createOneTimeServiceOrder — attempting upsert:", {
    stripe_session_id,
    stripe_payment_intent_id,
    user_id,
    using_service_role: !!supabaseAdmin,
  });

  try {
    const { data, error } = await db
      .from("service_orders")
      .upsert(
        {
          source: "one_time",
          user_id,
          property_id: property_id ?? null,
          stripe_payment_intent_id,
          title: "One-Time Mosquito Service",
          status: "pending",
          priority: "normal",
          source_metadata,
        },
        { onConflict: "stripe_payment_intent_id" }
      )
      .select("id, status")
      .maybeSingle();

    if (error) {
      console.error("[service-orders] one_time upsert FAILED:", {
        stripe_session_id,
        message: error.message,
        code: error.code,
        details: (error as any).details,
        hint: (error as any).hint,
      });
    } else {
      console.log("[service-orders] one_time service_order OK:", {
        stripe_payment_intent_id,
        row_id: data?.id,
        status: data?.status,
      });
    }
  } catch (err: unknown) {
    console.error("[service-orders] one_time unexpected error:", err instanceof Error ? err.message : String(err));
  }
}

// ── createMarketplaceAddOnServiceOrder ────────────────────────────────────────

/**
 * Creates a service_order for an appointment-based marketplace purchase.
 * Idempotency key: marketplace_order_id (partial unique index).
 * Called from: payment_intent.succeeded webhook (marketplace source, appointment-type items only).
 * Status starts as 'scheduled' when appointment_id is already known; 'pending' otherwise.
 */
export async function createMarketplaceAddOnServiceOrder(
  input: MarketplaceAddOnServiceOrderInput
): Promise<void> {
  const {
    marketplace_order_id,
    stripe_payment_intent_id,
    user_id,
    property_id,
    appointment_id,
    item_count,
    first_item_name,
  } = input;

  const title = first_item_name
    ? first_item_name.length > 80
      ? first_item_name.slice(0, 77) + "…"
      : first_item_name
    : "Marketplace Add-On Service";

  // If the order is already linked to an appointment, start as 'scheduled'
  const status = appointment_id ? "scheduled" : "pending";

  const source_metadata: Record<string, unknown> = {
    marketplace_order_id,
    ...(item_count != null && { item_count }),
    ...(appointment_id && { appointment_id }),
    ...(stripe_payment_intent_id && { stripe_payment_intent_id }),
  };

  console.log("[service-orders] createMarketplaceAddOnServiceOrder — attempting upsert:", {
    marketplace_order_id,
    user_id,
    appointment_id,
    status,
    title,
    using_service_role: !!supabaseAdmin,
  });

  try {
    const { data, error } = await db
      .from("service_orders")
      .upsert(
        {
          source: "marketplace_add_on",
          user_id,
          property_id: property_id ?? null,
          marketplace_order_id,
          appointment_id: appointment_id ?? null,
          stripe_payment_intent_id: stripe_payment_intent_id ?? null,
          title,
          status,
          priority: "normal",
          source_metadata,
        },
        { onConflict: "marketplace_order_id" }
      )
      .select("id, status")
      .maybeSingle();

    if (error) {
      console.error("[service-orders] marketplace_add_on upsert FAILED:", {
        marketplace_order_id,
        message: error.message,
        code: error.code,
        details: (error as any).details,
        hint: (error as any).hint,
      });
    } else {
      console.log("[service-orders] marketplace_add_on service_order OK:", {
        marketplace_order_id,
        row_id: data?.id,
        status: data?.status,
      });
    }
  } catch (err: unknown) {
    console.error("[service-orders] marketplace_add_on unexpected error:", err instanceof Error ? err.message : String(err));
  }
}

// ── markServiceOrderRefunded ──────────────────────────────────────────────────

/**
 * Marks any service_orders linked to a payment intent as refunded.
 * Idempotent — safe to call multiple times.
 * Called from: charge.refunded webhook handler.
 */
export async function markServiceOrderRefunded(
  stripe_payment_intent_id: string,
  marketplace_order_id?: string | null
): Promise<void> {
  const now = new Date().toISOString();

  try {
    // Match by PaymentIntent ID (covers one_time and marketplace_add_on)
    const { error: piError } = await db
      .from("service_orders")
      .update({
        status: "refunded",
        status_reason: "payment_refunded",
        refunded_at: now,
      })
      .eq("stripe_payment_intent_id", stripe_payment_intent_id)
      .not("status", "eq", "refunded"); // idempotent — skip already-refunded rows

    if (piError) {
      console.error("[ServiceOrders] refund by PI failed:", piError.message);
    }

    // Also match by marketplace_order_id (belt-and-suspenders for marketplace orders)
    if (marketplace_order_id) {
      const { error: moError } = await db
        .from("service_orders")
        .update({
          status: "refunded",
          status_reason: "payment_refunded",
          refunded_at: now,
        })
        .eq("marketplace_order_id", marketplace_order_id)
        .not("status", "eq", "refunded");

      if (moError) {
        console.error("[ServiceOrders] refund by marketplace_order_id failed:", moError.message);
      }
    }

    console.log("[ServiceOrders] refund applied for PI:", stripe_payment_intent_id);
  } catch (err: unknown) {
    console.error("[ServiceOrders] refund unexpected error:", err instanceof Error ? err.message : String(err));
  }
}
