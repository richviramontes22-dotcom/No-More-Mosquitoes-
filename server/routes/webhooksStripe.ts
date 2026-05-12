import { Router, Request, Response, raw } from "express";
import { supabase } from "../lib/supabase";
import Stripe from "stripe";
import {
  createSubscriptionServiceOrder,
  createOneTimeServiceOrder,
  createMarketplaceAddOnServiceOrder,
  markServiceOrderRefunded,
} from "../services/serviceOrders";

const router = Router();
const STRIPE_API = "https://api.stripe.com/v1";

// Initialize Stripe with secret key for signature verification
const getStripeClient = () => {
  const apiKey = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_API_KEY || process.env.STRIPE_SECRET;
  if (!apiKey) return null;
  return new Stripe(apiKey, { apiVersion: "2023-10-16" as any });
};

/**
 * Stripe Webhook Handler with Signature Verification
 * Endpoint: POST /api/webhooks/stripe
 *
 * IMPORTANT: This route must receive raw body (not JSON parsed)
 * so signature verification can work correctly.
 */
router.post("/stripe", async (req: Request, res: Response) => {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripe = getStripeClient();

  if (!stripe || !webhookSecret) {
    console.error("[Stripe Webhook] Missing Stripe client or webhook secret");
    return res.status(500).json({ error: "Server configuration missing." });
  }

  // Get the signature from headers
  const signature = req.headers["stripe-signature"];
  if (!signature) {
    console.error("[Stripe Webhook] Missing stripe-signature header");
    return res.status(400).json({ error: "Missing stripe-signature header" });
  }

  // Get the raw body
  let rawBody: Buffer | string;
  if (Buffer.isBuffer(req.body)) {
    rawBody = req.body;
  } else if (typeof req.body === "string") {
    rawBody = req.body;
  } else {
    // If body is already parsed as JSON, convert back to string
    rawBody = JSON.stringify(req.body);
  }

  // Verify the signature using Stripe library
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature as string,
      webhookSecret
    );
    console.log("[Stripe Webhook] ✓ Signature verified for event:", event.type);
  } catch (err: any) {
    console.error("[Stripe Webhook] ✗ Signature verification failed:", err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  const type = event.type;
  const object = event.data.object;

  if (!type || !object) {
    console.error("[Stripe Webhook] Invalid event structure:", event);
    return res.status(400).json({ error: "Invalid event structure" });
  }

  try {
    switch (type) {
      case "checkout.session.completed": {
        const session = object as Stripe.Checkout.Session;
        const {
          user_id,
          property_id,
          cadence_days,
          purchase_type,
          appointment_id,
          subtotal_cents,
          tax_cents,
          total_cents,
          item_count
        } = session.metadata ?? {};

        // Handle marketplace purchases
        if (purchase_type === "marketplace" && user_id) {
          const confirmationId = `ORD-${Date.now().toString().slice(-8).toUpperCase()}`;
          const chargeId = session.payment_intent ?
            (typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent.id)
            : null;

          // Create marketplace order (idempotent: use upsert on stripe_session_id)
          const { data: orderData, error: orderError } = await supabase
            .from("marketplace_orders")
            .upsert({
              user_id,
              appointment_id: appointment_id && appointment_id !== "unscheduled" ? appointment_id : null,
              property_id: property_id && property_id !== "unspecified" ? property_id : null,
              stripe_session_id: session.id,
              stripe_payment_intent_id: session.payment_intent ?
                (typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent.id)
                : null,
              stripe_charge_id: chargeId,
              subtotal_cents: subtotal_cents ? parseInt(subtotal_cents, 10) : 0,
              tax_cents: tax_cents ? parseInt(tax_cents, 10) : 0,
              total_cents: total_cents ? parseInt(total_cents, 10) : 0,
              currency: "USD",
              status: "completed",
              fulfillment_status: "pending",
              confirmation_id: confirmationId,
              created_at: new Date().toISOString(),
            }, { onConflict: "stripe_session_id" }).select().single();

          if (orderError) {
            console.error("[Webhook] Error persisting marketplace order:", orderError);
            return;
          }

          if (orderData) {
            // HARDENING: Always fetch line items from Stripe API explicitly
            // Do NOT rely on session.line_items being present in webhook payload
            try {
              const stripeKey = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_API_KEY || process.env.STRIPE_SECRET;

              const lineItemsResponse = await fetch(
                `https://api.stripe.com/v1/checkout/sessions/${session.id}/line_items`,
                {
                  headers: {
                    Authorization: `Bearer ${stripeKey}`,
                  },
                }
              );

              if (!lineItemsResponse.ok) {
                const errorText = await lineItemsResponse.text();
                console.error(`[Webhook] Line items fetch failed (${lineItemsResponse.status}):`, errorText.slice(0, 200));
                throw new Error(`Failed to fetch line items: ${lineItemsResponse.status}`);
              }

              const lineItemsData = await lineItemsResponse.json();
              const lineItems = lineItemsData.data || [];

              if (lineItems.length === 0) {
                console.warn(`[Webhook] No line items found for session ${session.id}`);
              }

              // Parse item snapshots from metadata for additional field recovery
              let itemSnapshots: any[] = [];
              try {
                if (session.metadata?.item_snapshots) {
                  itemSnapshots = JSON.parse(session.metadata.item_snapshots);
                }
              } catch (e) {
                console.warn("[Webhook] Failed to parse item snapshots:", e);
              }

              // Create order items with idempotency
              // HARDENING: Use upsert to prevent duplicate items on webhook retry
              for (let i = 0; i < lineItems.length; i++) {
                const lineItem = lineItems[i];
                const itemSnapshot = itemSnapshots[i] || {};
                const unitPriceCents = lineItem.price?.unit_amount || 0;
                const quantity = lineItem.quantity || 1;
                const totalPriceCents = unitPriceCents * quantity;

                // Upsert with composite key (order_id, item_name) to prevent duplicates
                // This ensures retries don't create duplicate items
                await supabase
                  .from("marketplace_order_items")
                  .upsert({
                    order_id: orderData.id,
                    catalog_item_id: itemSnapshot.catalogItemId || null,
                    item_name: lineItem.description || itemSnapshot.name || "Marketplace Item",
                    quantity: quantity,
                    unit_price_cents: unitPriceCents,
                    total_price_cents: totalPriceCents,
                    created_at: new Date().toISOString(),
                  }, {
                    // HARDENING: Idempotency key prevents duplicate items on retry
                    // Key: (order_id, item_name) uniquely identifies an item in an order
                    onConflict: "order_id, item_name",
                  });
              }

              console.log(`[Webhook] Successfully persisted ${lineItems.length} line items for order ${orderData.id}`);

              // Create service_order for this marketplace purchase (redirect checkout path)
              // FIX: checkout.session.completed marketplace branch previously had no service_order creation
              const firstLineItem = lineItems[0];
              const firstSnapshot = itemSnapshots[0];
              console.log("[service-orders] checkout.session.completed marketplace — creating service_order for order:", orderData.id);
              await createMarketplaceAddOnServiceOrder({
                marketplace_order_id: orderData.id,
                stripe_payment_intent_id: typeof session.payment_intent === "string"
                  ? session.payment_intent
                  : (session.payment_intent as any)?.id ?? null,
                user_id,
                property_id: property_id && property_id !== "unspecified" ? property_id : null,
                appointment_id: appointment_id && appointment_id !== "unscheduled" ? appointment_id : null,
                item_count: lineItems.length,
                first_item_name: firstLineItem?.description || firstSnapshot?.name || null,
              });
            } catch (err) {
              console.error("[Webhook] Error persisting marketplace line items:", {
                sessionId: session.id,
                orderId: orderData.id,
                error: err instanceof Error ? err.message : String(err),
              });
              // HARDENING: Make line-item persistence blocking to ensure data completeness
              // If we can't get line items, the order is incomplete and should fail
              // This ensures webhook retries will eventually succeed
              throw err;
            }
          }

          break;
        }

        // Handle subscription purchases (preserve existing logic)
        if (!property_id) {
          break;
        }

        // Update Property Record
        await supabase
          .from("properties")
          .update({
            program: session.mode === "subscription" ? "subscription" : "one_time",
            cadence: parseInt(cadence_days ?? "30", 10),
            // price update handled via invoice.paid for accuracy
          })
          .eq("id", property_id);

        if (session.mode === "subscription") {
          const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
          if (subscriptionId) {
            await supabase
              .from("subscriptions")
              .upsert({
                stripe_subscription_id: subscriptionId,
                user_id,
                property_id,
                status: "active",
                cadence_days: parseInt(cadence_days ?? "30", 10),
                updated_at: new Date().toISOString(),
              }, { onConflict: "stripe_subscription_id" });
          }
          // Subscription service_orders are created on invoice.paid, not here
        }

        // Create service_order for one-time service payments (not subscription, not marketplace)
        if (session.mode === "payment" && user_id) {
          const piId = typeof session.payment_intent === "string"
            ? session.payment_intent
            : (session.payment_intent as any)?.id ?? null;

          await createOneTimeServiceOrder({
            stripe_session_id: session.id,
            stripe_payment_intent_id: piId,
            user_id,
            property_id: property_id ?? null,
          });
        }

        break;
      }

      case "invoice.paid": {
        const invoice = object as any;
        const subscriptionId = invoice.subscription;

        // Resolve user_id: prefer invoice metadata, fall back via subscription → property
        let resolvedUserId: string | null = invoice.metadata?.user_id || null;

        if (!resolvedUserId && subscriptionId) {
          // Fallback: look up the subscription row we stored and read property_id → user_id
          const { data: subRow } = await supabase
            .from("subscriptions")
            .select("property_id, user_id")
            .eq("stripe_subscription_id", subscriptionId)
            .maybeSingle();

          if (subRow?.user_id) {
            resolvedUserId = subRow.user_id;
          } else if (subRow?.property_id) {
            const { data: propRow } = await supabase
              .from("properties")
              .select("user_id")
              .eq("id", subRow.property_id)
              .maybeSingle();
            resolvedUserId = propRow?.user_id || null;
          }
        }

        // Record Payment in Supabase
        await supabase
          .from("payments")
          .insert({
            user_id: resolvedUserId,
            stripe_payment_intent_id: invoice.payment_intent,
            stripe_charge_id: invoice.charge,
            amount_cents: invoice.amount_paid,
            currency: invoice.currency,
            status: "succeeded",
            method: "card",
            created_at: new Date(invoice.created * 1000).toISOString(),
          });

        // Sync Subscription status
        let localSubId: string | null = null;
        let localPropertyId: string | null = null;
        let localCadenceDays: number | null = null;
        let localPeriodEnd: string | null = null;

        if (subscriptionId) {
          const periodEnd = new Date(invoice.period_end * 1000).toISOString();
          localPeriodEnd = periodEnd;

          const { data: upsertedSub } = await supabase
            .from("subscriptions")
            .upsert({
              stripe_subscription_id: subscriptionId,
              user_id: resolvedUserId,
              status: "active",
              current_period_end: periodEnd,
              last_invoice_id: invoice.id,
              last_payment_at: new Date().toISOString(),
            }, { onConflict: "stripe_subscription_id" })
            .select("id, property_id, cadence_days")
            .maybeSingle();

          localSubId = upsertedSub?.id ?? null;
          localPropertyId = upsertedSub?.property_id ?? null;
          localCadenceDays = upsertedSub?.cadence_days ?? null;
        }

        // Create service_order for this billing period (new records only — no backfill)
        if (resolvedUserId && invoice.id) {
          await createSubscriptionServiceOrder({
            stripe_invoice_id: invoice.id,
            user_id: resolvedUserId,
            property_id: localPropertyId,
            subscription_id: localSubId,
            cadence_days: localCadenceDays,
            current_period_end: localPeriodEnd,
          });
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = object as any;
        const subscriptionId = invoice.subscription;

        console.warn("[Webhook] invoice.payment_failed — subscription:", subscriptionId, "customer:", invoice.customer);

        // Mark the subscription as past_due if it exists in our DB
        if (subscriptionId) {
          await supabase
            .from("subscriptions")
            .update({ status: "past_due", updated_at: new Date().toISOString() })
            .eq("stripe_subscription_id", subscriptionId);
        }
        break;
      }

      case "checkout.session.expired": {
        const session = object as any;
        const { purchase_type, user_id } = session.metadata ?? {};

        if (purchase_type === "marketplace" && user_id) {
          // Mark any pending marketplace order for this session as expired
          await supabase
            .from("marketplace_orders")
            .update({ status: "expired" })
            .eq("user_id", user_id)
            .eq("status", "pending")
            .lt("created_at", new Date().toISOString());
        }
        break;
      }

      case "customer.subscription.updated": {
        const sub = object as any;
        await supabase
          .from("subscriptions")
          .upsert({
            stripe_subscription_id: sub.id,
            status: sub.status,
            current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
            cancel_at_period_end: sub.cancel_at_period_end,
            updated_at: new Date().toISOString()
          }, { onConflict: "stripe_subscription_id" });
        break;
      }

      case "customer.subscription.deleted": {
        const sub = object as any;
        await supabase
          .from("subscriptions")
          .update({ status: "canceled", updated_at: new Date().toISOString() })
          .eq("stripe_subscription_id", sub.id);
        break;
      }

      // Marketplace in-app payment confirmation
      case "payment_intent.succeeded": {
        const pi = object as any;
        const { purchase_type, user_id: piUserId, promo_code_id } = pi.metadata ?? {};

        if (purchase_type !== "marketplace" || !piUserId) break;

        // Update pre-created order to completed
        const { error: updateError } = await supabase
          .from("marketplace_orders")
          .update({
            status: "completed",
            stripe_charge_id: pi.latest_charge || null,
          })
          .eq("stripe_payment_intent_id", pi.id)
          .eq("user_id", piUserId);

        if (updateError) {
          console.error("[Webhook] payment_intent.succeeded order update failed:", updateError.message);
        }

        // Fetch the completed marketplace order for service_order creation
        console.log("[service-orders] payment_intent.succeeded — fetching order for PI:", pi.id);
        const { data: completedOrder, error: orderFetchError } = await supabase
          .from("marketplace_orders")
          .select("id, appointment_id, property_id")
          .eq("stripe_payment_intent_id", pi.id)
          .eq("user_id", piUserId)
          .maybeSingle();

        if (orderFetchError) {
          console.error("[service-orders] Failed to fetch marketplace_order:", orderFetchError.message);
        }

        // Create service_order for ALL completed marketplace purchases (Phase 3A).
        // FIX: Removed isAppointmentBased gate — was preventing service_order creation
        // for purchases where catalog items lack fulfillment_type/category metadata.
        // All completed marketplace orders represent committed operational work.
        if (completedOrder) {
          const { data: orderItems } = await supabase
            .from("marketplace_order_items")
            .select("item_name, catalog_item_id")
            .eq("order_id", completedOrder.id)
            .limit(5);

          const firstItem = (orderItems as any[])?.[0];
          console.log("[service-orders] Creating marketplace_add_on service_order:", {
            marketplace_order_id: completedOrder.id,
            appointment_id: completedOrder.appointment_id,
            item_count: orderItems?.length ?? 0,
            first_item: firstItem?.item_name,
          });

          await createMarketplaceAddOnServiceOrder({
            marketplace_order_id: completedOrder.id,
            stripe_payment_intent_id: pi.id,
            user_id: piUserId,
            property_id: completedOrder.property_id ?? null,
            appointment_id: completedOrder.appointment_id ?? null,
            item_count: orderItems?.length ?? 0,
            first_item_name: firstItem?.item_name ?? null,
          });
        } else {
          console.warn("[service-orders] payment_intent.succeeded — no marketplace_order found for PI:", pi.id);
        }

        // Increment promo used_count ONLY after confirmed successful payment.
        // Uses atomic RPC (increment_promo_used_count) if available in Supabase.
        // Falls back to read-then-write if RPC is not deployed yet.
        // Run ORDERS_FULFILLMENT_PHASE2_SUPABASE_SQL.sql to enable atomic path.
        if (promo_code_id) {
          try {
            const { error: rpcError } = await supabase.rpc("increment_promo_used_count", {
              promo_id: promo_code_id,
            });

            if (rpcError) {
              // Fallback: non-atomic read-then-write (acceptable until RPC is deployed)
              console.warn("[Webhook] increment_promo_used_count RPC unavailable, using fallback:", rpcError.message);
              const { data: promoRow } = await supabase
                .from("promo_codes")
                .select("used_count")
                .eq("id", promo_code_id)
                .eq("active", true)
                .maybeSingle();

              if (promoRow) {
                await supabase
                  .from("promo_codes")
                  .update({ used_count: (promoRow.used_count || 0) + 1 })
                  .eq("id", promo_code_id);
              }
            }
          } catch (promoErr: any) {
            console.error("[Webhook] promo used_count increment failed:", promoErr.message);
          }
        }

        break;
      }

      case "payment_intent.payment_failed": {
        const pi = object as any;
        const { purchase_type } = pi.metadata ?? {};

        if (purchase_type !== "marketplace") break;

        // Mark pending order as failed so it doesn't clutter order history
        await supabase
          .from("marketplace_orders")
          .update({ status: "failed" })
          .eq("stripe_payment_intent_id", pi.id)
          .eq("status", "pending");
        break;
      }

      // Refund tracking — keeps DB state in sync with Stripe
      case "charge.refunded": {
        const charge = object as any;
        const paymentIntentId = charge.payment_intent;

        if (!paymentIntentId) {
          console.warn("[Webhook] charge.refunded: no payment_intent on charge, skipping");
          break;
        }

        // Update marketplace_orders if one matches this payment intent
        const { data: mOrder } = await supabase
          .from("marketplace_orders")
          .select("id, fulfillment_status")
          .eq("stripe_payment_intent_id", paymentIntentId)
          .maybeSingle();

        if (mOrder) {
          await supabase
            .from("marketplace_orders")
            .update({
              status: "refunded",
              // Cancel fulfillment if not already fulfilled
              fulfillment_status: mOrder.fulfillment_status === "fulfilled" ? "fulfilled" : "cancelled",
            })
            .eq("id", mOrder.id);
          console.log(`[Webhook] charge.refunded: marketplace_order ${mOrder.id} marked refunded`);
        }

        // Update payments record if one matches this payment intent
        const { data: payRow } = await supabase
          .from("payments")
          .select("id, status")
          .eq("stripe_payment_intent_id", paymentIntentId)
          .maybeSingle();

        if (payRow && payRow.status !== "refunded") {
          await supabase
            .from("payments")
            .update({ status: "refunded" })
            .eq("id", payRow.id);
          console.log(`[Webhook] charge.refunded: payment ${payRow.id} marked refunded`);
        }

        // Mark any linked service_orders as refunded (Phase 3A: new records only)
        await markServiceOrderRefunded(
          paymentIntentId,
          mOrder?.id ?? null
        );

        break;
      }
    }

    res.json({ received: true });
  } catch (err: any) {
    console.error(`Webhook Error: ${err.message}`);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
});

export default router;
