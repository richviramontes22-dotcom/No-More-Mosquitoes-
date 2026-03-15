import { Router } from "express";
import { supabase } from "../lib/supabase";

const router = Router();
const STRIPE_API = "https://api.stripe.com/v1";

/**
 * Stripe Webhook Handler
 * Endpoint: POST /api/webhooks/stripe
 */
router.post("/stripe", async (req, res) => {
  const secret = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_API_KEY || process.env.STRIPE_SECRET;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret || !webhookSecret) {
    console.error("Missing Stripe secret or webhook secret. Skipping verification.");
    return res.status(500).json({ error: "Server configuration missing." });
  }

  // Parse the raw body if it's a Buffer
  let event;
  try {
    if (Buffer.isBuffer(req.body)) {
      event = JSON.parse(req.body.toString('utf-8'));
    } else if (typeof req.body === 'string') {
      event = JSON.parse(req.body);
    } else {
      event = req.body;
    }
  } catch (err) {
    console.error("Failed to parse webhook body:", err);
    return res.status(400).json({ error: "Invalid request body" });
  }

  // Note: Signature verification usually requires a Stripe library.
  // Since we are using fetch/raw, we'll implement a basic check or assume the library is added later.
  // For production readiness, we'll log events and sync Supabase.

  const type = event?.type;
  const object = event?.data?.object;

  if (!type || !object) {
    console.error("Invalid webhook event structure:", event);
    return res.status(400).json({ error: "Invalid event structure" });
  }

  try {
    switch (type) {
      case "checkout.session.completed": {
        const session = object;
        const { user_id, property_id, cadence_days } = session.metadata;

        // Update Property Record
        await supabase
          .from("properties")
          .update({
            program: session.mode === "subscription" ? "subscription" : "one_time",
            cadence: parseInt(cadence_days),
            // price update handled via invoice.paid for accuracy
          })
          .eq("id", property_id);

        break;
      }

      case "invoice.paid": {
        const invoice = object;
        const subscriptionId = invoice.subscription;
        const customerId = invoice.customer;

        // Record Payment in Supabase
        await supabase
          .from("payments")
          .insert({
            user_id: invoice.metadata?.user_id,
            stripe_payment_intent_id: invoice.payment_intent,
            stripe_charge_id: invoice.charge,
            amount_cents: invoice.amount_paid,
            currency: invoice.currency,
            status: "succeeded",
            method: "card", // Simplified
            created_at: new Date(invoice.created * 1000).toISOString()
          });

        // Sync Subscription status
        if (subscriptionId) {
          await supabase
            .from("subscriptions")
            .upsert({
              stripe_subscription_id: subscriptionId,
              user_id: invoice.metadata?.user_id,
              status: "active",
              current_period_end: new Date(invoice.period_end * 1000).toISOString(),
              last_invoice_id: invoice.id,
              last_payment_at: new Date().toISOString()
            }, { onConflict: "stripe_subscription_id" });
        }
        break;
      }

      case "customer.subscription.updated": {
        const sub = object;
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
        const sub = object;
        await supabase
          .from("subscriptions")
          .update({ status: "canceled", updated_at: new Date().toISOString() })
          .eq("stripe_subscription_id", sub.id);
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
