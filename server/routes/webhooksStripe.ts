import { Router, Request, Response, raw } from "express";
import { supabase } from "../lib/supabase";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import Stripe from "stripe";
import {
  createSubscriptionServiceOrder,
  createOneTimeServiceOrder,
  createMarketplaceAddOnServiceOrder,
  markServiceOrderRefunded,
} from "../services/serviceOrders";
import { getEmailProvider, getFromEmail } from "../services/notifications/providers/index";
import {
  buildPaymentFailedEmail,
  buildSubscriptionActivatedEmail,
  buildSubscriptionCancelledEmail,
  buildSubscriptionRenewedEmail,
} from "../services/notifications/emailTemplates";
import { logNotification, isDuplicateProfileNotification, isDuplicateByPayload } from "../services/notifications/notificationLogger";
import { sendConfirmationForAppointment } from "../services/notifications/sendAppointmentConfirmation";
import { notifyAdmin, notifyAdminCritical } from "../services/notifications/adminNotificationService";

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
    // Alert admin — potential webhook tampering or misconfiguration (fire-and-forget, non-blocking)
    try {
      notifyAdminCritical("system.webhook_signature_failure", "Stripe webhook signature verification failed", {
        body: `A Stripe webhook was received but failed signature verification. This may indicate a misconfigured webhook secret or a spoofed request. Error: ${err.message}`,
        entity_type: "webhook",
        metadata: {
          error: err.message,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (alertErr: any) {
      console.error("[Stripe Webhook] Failed to send admin alert for signature failure:", alertErr.message);
    }
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

          // ── Create first appointment from scheduling preference ────────────────
          // The customer selected a date + window in ScheduleFlow before Stripe redirect.
          // Those fields were stored in session metadata. We create the appointment now
          // so the subscription is never orphaned.
          const {
            scheduled_date,
            window_id,
            window_label,
            window_start,
            op_notes,
            pref_days,
            pref_windows,
            flex_days,
          } = session.metadata ?? {};

          if (scheduled_date && window_id && user_id && property_id) {
            try {
              const db = supabaseAdmin ?? supabase;

              // Idempotency: don't double-create if webhook fires twice for same session
              const { count: existing } = await db
                .from("appointments")
                .select("id", { count: "exact", head: true })
                .eq("user_id", user_id)
                .eq("property_id", property_id)
                .eq("scheduled_date", scheduled_date)
                .not("status", "in", '("canceled","cancelled")');

              if ((existing ?? 0) === 0) {
                const scheduledAt = window_start
                  ? `${scheduled_date}T${window_start}:00`
                  : `${scheduled_date}T08:00:00`;

                const { error: apptErr } = await db
                  .from("appointments")
                  .insert({
                    user_id,
                    property_id,
                    status:         "scheduled",
                    service_type:   "Mosquito Service",
                    scheduled_date,
                    window:         window_id,
                    window_label:   window_label || window_id,
                    scheduled_at:   scheduledAt,
                    notes:          op_notes || null,
                  });

                if (apptErr) {
                  console.error("[Webhook] Failed to create first appointment:", apptErr.message);
                } else {
                  console.log(`[Webhook] First appointment created: user=${user_id}, date=${scheduled_date}, window=${window_id}`);

                  // Alert admin — new appointment has no assignment yet
                  notifyAdmin({
                    event_type:  "scheduling.appointment_created_without_assignment",
                    severity:    "info",
                    title:       `New appointment needs assignment — ${scheduled_date}`,
                    body:        `Subscription checkout created appointment for ${scheduled_date} (${window_label || window_id}). No technician assigned yet.`,
                    entity_type: "user",
                    entity_id:   user_id ?? undefined,
                    metadata:    {
                      user_id,
                      property_id,
                      scheduled_date,
                      window_label: window_label || window_id,
                    },
                  });

                  // Send appointment confirmation email for the newly created appointment
                  ;(async () => {
                    try {
                      const { data: newApptRow } = await db
                        .from("appointments")
                        .select("id")
                        .eq("user_id", user_id)
                        .eq("property_id", property_id)
                        .eq("scheduled_date", scheduled_date)
                        .not("status", "in", '("canceled","cancelled")')
                        .order("created_at", { ascending: false })
                        .limit(1)
                        .maybeSingle();

                      if (newApptRow?.id) {
                        await sendConfirmationForAppointment(newApptRow.id);
                      }
                    } catch (confirmErr: any) {
                      console.error("[Webhook] Appointment confirmation email error:", confirmErr.message);
                    }
                  })();
                }
              } else {
                console.log(`[Webhook] Appointment already exists for user=${user_id}, date=${scheduled_date} — skipping`);
              }
            } catch (apptCreateErr: any) {
              // Non-fatal: log but don't fail the webhook response
              console.error("[Webhook] Unexpected error creating first appointment:", apptCreateErr?.message);
            }
          } else {
            console.warn(`[Webhook] No scheduling metadata found for session ${session.id} — subscription created without appointment`);
          }

          // ── Persist availability preferences to property ───────────────────────
          // Stored as service_preferences JSONB so operations can use them for
          // recurring appointment generation without re-asking the customer.
          if (property_id && (pref_days || pref_windows || flex_days !== undefined)) {
            try {
              const db = supabaseAdmin ?? supabase;
              const servicePreferences = {
                preferred_days_of_week: pref_days
                  ? pref_days.split(",").map(Number).filter(n => !isNaN(n))
                  : null,
                preferred_windows: pref_windows
                  ? pref_windows.split(",").map((s: string) => s.trim()).filter(Boolean)
                  : null,
                flexibility_days: flex_days !== undefined ? parseInt(flex_days, 10) : null,
              };
              await db
                .from("properties")
                .update({ service_preferences: servicePreferences })
                .eq("id", property_id);
              console.log(`[Webhook] Saved service_preferences for property ${property_id}`);
            } catch (prefErr: any) {
              console.error("[Webhook] Failed to save service_preferences:", prefErr?.message);
            }
          }
        }

        // Send subscription_activated email for new subscriptions (fire-and-forget)
        if (session.mode === "subscription" && user_id && purchase_type !== "marketplace") {
          ;(async () => {
            try {
              const dbAdmin = supabaseAdmin ?? supabase;
              const alreadySent = await isDuplicateProfileNotification(user_id, "subscription_activated", 48);
              if (alreadySent) return;

              const { data: profile } = await dbAdmin
                .from("profiles")
                .select("email, name")
                .eq("id", user_id)
                .maybeSingle();

              if (!profile?.email) return;

              const planName     = "Mosquito Control Subscription";
              const startDate    = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
              const dashboardUrl = `${process.env.APP_BASE_URL || "https://nomoremosquitoes.us"}/dashboard`;
              const customerName = profile.name || profile.email.split("@")[0];

              const { subject, html, text } = buildSubscriptionActivatedEmail({
                customerName,
                planName,
                startDate,
                dashboardUrl,
              });

              const emailProvider = getEmailProvider();
              await emailProvider.send({ to: profile.email, from: getFromEmail(), subject, html, text });

              await logNotification({
                profileId:        user_id,
                recipientEmail:   profile.email,
                channel:          "email",
                notificationType: "subscription_activated",
                subject,
                status:           "sent",
                provider:         "resend",
                sentAt:           new Date().toISOString(),
                payload:          { session_id: session.id },
              });

              console.log(`[Webhook] subscription_activated email sent to ${profile.email}`);

              // Alert owner — new subscriber
              notifyAdmin({
                event_type:  "billing.new_subscription",
                severity:    "info",
                title:       `New subscription — ${profile.email}`,
                body:        `${customerName} just subscribed to ${planName}.`,
                entity_type: "user",
                entity_id:   user_id ?? undefined,
                metadata: {
                  customer_email: profile.email,
                  plan:           planName,
                  session_id:     session.id,
                },
              });
            } catch (err: any) {
              console.error("[Webhook] subscription_activated email error:", err.message);
            }
          })();
        }

        // One-time service payments: create service_order AND first appointment
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

          // Create appointment for one-time service if scheduling metadata was captured
          const {
            scheduled_date: ot_date,
            window_id: ot_window,
            window_label: ot_label,
            window_start: ot_start,
            op_notes: ot_notes,
          } = session.metadata ?? {};

          if (ot_date && ot_window && property_id) {
            try {
              const db = supabaseAdmin ?? supabase;
              const { count: otExisting } = await db
                .from("appointments")
                .select("id", { count: "exact", head: true })
                .eq("user_id", user_id)
                .eq("property_id", property_id)
                .eq("scheduled_date", ot_date)
                .not("status", "in", '("canceled","cancelled")');

              if ((otExisting ?? 0) === 0) {
                const ot_scheduled_at = ot_start
                  ? `${ot_date}T${ot_start}:00`
                  : `${ot_date}T08:00:00`;

                await db.from("appointments").insert({
                  user_id,
                  property_id,
                  status:       "scheduled",
                  service_type: "Mosquito Service",
                  scheduled_date: ot_date,
                  window:       ot_window,
                  window_label: ot_label || ot_window,
                  scheduled_at: ot_scheduled_at,
                  notes:        ot_notes || null,
                });
                console.log(`[Webhook] One-time appointment created: user=${user_id}, date=${ot_date}`);
              }
            } catch (otErr: any) {
              console.error("[Webhook] Failed to create one-time appointment:", otErr?.message);
            }
          }
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

          // Use supabaseAdmin — webhook runs without a user JWT so anon-key
          // writes are blocked by RLS on the subscriptions table.
          const db = supabaseAdmin ?? supabase;
          const { data: upsertedSub } = await db
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

          // Mark the user as fully onboarded — invoice.paid is the authoritative
          // payment confirmation signal. This covers all payment paths: inline
          // PaymentElement, Stripe Checkout redirect, and subscription renewals.
          if (resolvedUserId) {
            await db
              .from("profiles")
              .update({ is_onboarded: true })
              .eq("id", resolvedUserId);
          }
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

        // Sync real payment method card details to profile (non-fatal)
        try {
          const stripe = getStripeClient();
          if (stripe && resolvedUserId) {
            const pmId = invoice.default_payment_method ?? invoice.payment_intent;
            if (pmId && typeof pmId === "string" && pmId.startsWith("pm_")) {
              const pm = await stripe.paymentMethods.retrieve(pmId);
              if (pm.card) {
                const expMonth = String(pm.card.exp_month).padStart(2, "0");
                const expYear  = String(pm.card.exp_year).slice(-2);
                const dbWrite  = supabaseAdmin ?? supabase;
                await dbWrite.from("profiles").update({
                  card_last4:  pm.card.last4,
                  card_brand:  pm.card.brand,
                  card_expiry: `${expMonth}/${expYear}`,
                }).eq("id", resolvedUserId);
              }
            }
          }
        } catch (pmErr: any) {
          console.error("[webhook] Failed to sync payment method:", pmErr.message);
        }

        // Send subscription renewal email for recurring payments (not the first charge).
        // A subscription renewal has billing_reason == 'subscription_cycle'.
        if (resolvedUserId && subscriptionId && invoice.billing_reason === "subscription_cycle") {
          ;(async () => {
            try {
              const invoiceId = invoice.id as string | undefined;
              if (!invoiceId) return;

              const alreadySent = await isDuplicateByPayload("subscription_renewed", "invoice_id", invoiceId, 24);
              if (alreadySent) return;

              const dbAdmin = supabaseAdmin ?? supabase;
              const { data: profile } = await dbAdmin
                .from("profiles")
                .select("email, name")
                .eq("id", resolvedUserId)
                .maybeSingle();

              if (!profile?.email) return;

              const amountCents: number = invoice.amount_paid ?? 0;
              const currency: string    = (invoice.currency as string | undefined)?.toUpperCase() ?? "USD";
              const amountFormatted     = `${currency === "USD" ? "$" : ""}${(amountCents / 100).toFixed(2)}`;
              const nextBillingDate     = localPeriodEnd
                ? new Date(localPeriodEnd).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
                : "your next billing date";

              const { data: subInfo } = await dbAdmin
                .from("subscriptions")
                .select("program, cadence_days")
                .eq("stripe_subscription_id", subscriptionId)
                .maybeSingle();

              const planName = subInfo?.program === "annual" ? "Annual Plan" : "Monthly Subscription";
              const customerName = profile.name || profile.email.split("@")[0];
              const dashboardUrl = `${process.env.APP_BASE_URL || "https://nomoremosquitoes.us"}/dashboard`;

              const { subject, html, text } = buildSubscriptionRenewedEmail({
                customerName,
                planName,
                amount: amountFormatted,
                nextBillingDate,
                dashboardUrl,
              });

              const emailProvider = getEmailProvider();
              await emailProvider.send({ to: profile.email, from: getFromEmail(), subject, html, text });

              await logNotification({
                profileId:        resolvedUserId,
                recipientEmail:   profile.email,
                channel:          "email",
                notificationType: "subscription_renewed",
                subject,
                status:           "sent",
                provider:         "resend",
                sentAt:           new Date().toISOString(),
                payload:          { invoice_id: invoiceId },
              });

              console.log(`[Webhook] subscription_renewed email sent to ${profile.email}`);
            } catch (err: any) {
              console.error("[Webhook] subscription_renewed email error:", err.message);
            }
          })();
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

        // Send payment failed email (fire-and-forget, non-blocking)
        ;(async () => {
          try {
            const invoiceId = invoice.id as string | undefined;
            if (!invoiceId) return;

            // Duplicate prevention: skip if already sent for this invoice within 24h
            const alreadySent = await isDuplicateByPayload("payment_failed", "invoice_id", invoiceId, 24);
            if (alreadySent) {
              console.log(`[Webhook] payment_failed email already sent for invoice ${invoiceId} — skipping`);
              return;
            }

            // Resolve user profile from subscriptions table
            let profileId: string | null = null;
            let profileEmail: string | null = null;
            let profileName: string | null = null;

            if (subscriptionId) {
              const dbAdmin = supabaseAdmin ?? supabase;
              const { data: subRow } = await dbAdmin
                .from("subscriptions")
                .select("user_id")
                .eq("stripe_subscription_id", subscriptionId)
                .maybeSingle();

              if (subRow?.user_id) {
                profileId = subRow.user_id;
                const { data: profile } = await dbAdmin
                  .from("profiles")
                  .select("email, name")
                  .eq("id", subRow.user_id)
                  .maybeSingle();
                profileEmail = profile?.email ?? null;
                profileName  = profile?.name ?? null;
              }
            }

            if (!profileEmail) {
              console.log("[Webhook] payment_failed: no customer email found — skipping email");
              return;
            }

            const amountCents: number = invoice.amount_due ?? invoice.amount_remaining ?? 0;
            const currency: string    = (invoice.currency as string | undefined)?.toUpperCase() ?? "USD";
            const amountFormatted     = `${currency === "USD" ? "$" : ""}${(amountCents / 100).toFixed(2)}`;
            const billingPortalUrl    = `${process.env.APP_BASE_URL || "https://nomoremosquitoes.us"}/dashboard/billing`;
            const supportEmail        = process.env.SUPPORT_EMAIL || "support@nomoremosquitoes.us";
            const customerName        = profileName || profileEmail.split("@")[0];

            const { subject, html, text } = buildPaymentFailedEmail({
              customerName,
              amount: amountFormatted,
              currency,
              billingPortalUrl,
              supportEmail,
            });

            const emailProvider = getEmailProvider();
            await emailProvider.send({
              to:      profileEmail,
              from:    getFromEmail(),
              subject,
              html,
              text,
            });

            await logNotification({
              profileId,
              recipientEmail:   profileEmail,
              channel:          "email",
              notificationType: "payment_failed",
              subject,
              status:           "sent",
              provider:         "resend",
              sentAt:           new Date().toISOString(),
              payload:          { invoice_id: invoiceId },
            });

            console.log(`[Webhook] payment_failed email sent to ${profileEmail} for invoice ${invoiceId}`);

            // Alert owner — payment failures need prompt follow-up
            notifyAdminCritical("billing.payment_failed", `Payment failed — ${amountFormatted}`, {
              entity_type: "subscription",
              entity_id:   subscriptionId ?? undefined,
              body: `Customer ${profileEmail} had a payment of ${amountFormatted} fail. Subscription may become past_due.`,
              metadata: {
                customer_email: profileEmail,
                amount:         amountFormatted,
                invoice_id:     invoiceId,
              },
            });
          } catch (err: any) {
            console.error("[Webhook] payment_failed email error:", err.message);
          }
        })();

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
        // IMPORTANT: Do NOT set status='active' here.
        // invoice.paid is the authoritative signal for activating a subscription —
        // it only fires after a real verified charge. Blindly writing sub.status
        // here can elevate a subscription to 'active' from Stripe auto-charges,
        // test-clock advances, or retried incomplete subscriptions — all before
        // the customer has confirmed payment in the UI.
        // We DO sync cancellation/degradation states so admins see accurate info.
        if (sub.status !== "active") {
          await supabase
            .from("subscriptions")
            .update({
              status: sub.status,
              current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
              cancel_at_period_end: sub.cancel_at_period_end,
              updated_at: new Date().toISOString(),
            })
            .eq("stripe_subscription_id", sub.id);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = object as any;

        // Resolve user_id from the local subscriptions row before updating status
        const { data: subRow } = await supabase
          .from("subscriptions")
          .select("id, user_id, property_id, program")
          .eq("stripe_subscription_id", sub.id)
          .maybeSingle();

        await supabase
          .from("subscriptions")
          .update({ status: "canceled", updated_at: new Date().toISOString() })
          .eq("stripe_subscription_id", sub.id);

        // Cascade: cancel future appointments and skip their assignments.
        // Idempotent — NOT IN guards prevent double-canceling terminal rows.
        if (subRow?.user_id) {
          try {
            const db = supabaseAdmin ?? supabase;
            const today = new Date().toISOString().slice(0, 10);

            const { data: futureAppts } = await db
              .from("appointments")
              .select("id")
              .eq("user_id", subRow.user_id)
              .not("status", "in", '("completed","canceled","cancelled","canceled_by_admin","canceled_by_customer")')
              .gte("scheduled_date", today);

            if (futureAppts && futureAppts.length > 0) {
              const apptIds = futureAppts.map((a: any) => a.id);

              await db
                .from("appointments")
                .update({ status: "canceled" })
                .in("id", apptIds);

              await db
                .from("assignments")
                .update({ status: "skipped" })
                .in("appointment_id", apptIds)
                .not("status", "in", '("completed","skipped","no_show","canceled","cancelled")');

              console.log(`[Webhook] customer.subscription.deleted — canceled ${apptIds.length} future appointment(s) for user ${subRow.user_id}`);
            }
          } catch (cascadeErr: any) {
            // Non-fatal — subscription is already marked canceled; log and continue
            console.error("[Webhook] customer.subscription.deleted cascade failed (non-fatal):", cascadeErr.message);
          }

          // Send subscription cancelled email (fire-and-forget)
          ;(async () => {
            try {
              const dbAdmin = supabaseAdmin ?? supabase;
              const alreadySent = await isDuplicateProfileNotification(subRow.user_id, "subscription_canceled", 24);
              if (alreadySent) return;

              const { data: profile } = await dbAdmin
                .from("profiles")
                .select("email, name")
                .eq("id", subRow.user_id)
                .maybeSingle();

              if (!profile?.email) return;

              const endDate = sub.current_period_end
                ? new Date(sub.current_period_end * 1000).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
                : new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

              const planName = subRow.program === "annual" ? "Annual Plan" : "Monthly Subscription";
              const customerName = profile.name || profile.email.split("@")[0];
              const dashboardUrl = `${process.env.APP_BASE_URL || "https://nomoremosquitoes.us"}/dashboard`;
              const supportEmail = process.env.SUPPORT_EMAIL || "support@nomoremosquitoes.us";

              const { subject, html, text } = buildSubscriptionCancelledEmail({
                customerName,
                planName,
                endDate,
                dashboardUrl,
                supportEmail,
              });

              const emailProvider = getEmailProvider();
              await emailProvider.send({ to: profile.email, from: getFromEmail(), subject, html, text });

              await logNotification({
                profileId:        subRow.user_id,
                recipientEmail:   profile.email,
                channel:          "email",
                notificationType: "subscription_canceled",
                subject,
                status:           "sent",
                provider:         "resend",
                sentAt:           new Date().toISOString(),
              });

              console.log(`[Webhook] subscription_canceled email sent to ${profile.email}`);

              // Alert owner — subscription cancellations reduce recurring revenue
              notifyAdmin({
                event_type:  "subscriptions.cancelled",
                severity:    "warning",
                title:       `Subscription cancelled — ${profile.email}`,
                body:        `${profile.name || profile.email} cancelled their ${planName}. Access ends ${endDate}.`,
                entity_type: "subscription",
                entity_id:   subRow?.id ?? undefined,
                metadata: {
                  customer_email: profile.email,
                  plan:           planName,
                  ends:           endDate,
                },
              });
            } catch (emailErr: any) {
              console.error("[Webhook] subscription_canceled email error:", emailErr.message);
            }
          })();
        }

        break;
      }

      // Marketplace in-app payment confirmation
      case "payment_intent.succeeded": {
        const pi = object as any;
        const { purchase_type, program: piProgram, user_id: piUserId, property_id: piPropertyId, cadence_days: piCadenceDays, promo_code_id } = pi.metadata ?? {};

        // Annual plan: write/refresh the subscription row. This is the webhook fallback
        // in case confirm-booking was not called (e.g. direct Stripe Dashboard charge,
        // webhook replay, or client failure). Idempotent via upsert on stripe_subscription_id.
        if (piProgram === "annual" && piUserId && piPropertyId) {
          const periodEnd = new Date();
          periodEnd.setFullYear(periodEnd.getFullYear() + 1);
          const db = supabaseAdmin ?? supabase;
          await db.from("subscriptions").upsert({
            stripe_subscription_id: pi.id,
            user_id:             piUserId,
            property_id:         piPropertyId,
            status:              "active",
            program:             "annual",
            cadence_days:        parseInt(String(piCadenceDays ?? "21"), 10),
            current_period_end:  periodEnd.toISOString(),
            last_payment_at:     new Date().toISOString(),
            updated_at:          new Date().toISOString(),
          }, { onConflict: "stripe_subscription_id" });
          console.log(`[Webhook] Annual plan subscription row upserted: user=${piUserId} expires=${periodEnd.toISOString().slice(0, 10)}`);
        }

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
