/**
 * Netlify Scheduled Function — expire-annual-plans
 *
 * Runs daily at 9:00 AM UTC (after send-reminders and generate-appointments).
 * Transitions annual subscriptions from 'active' to 'expired' when their
 * current_period_end has passed. Creates an admin alert ticket for each
 * newly-expired plan.
 *
 * Environment variables required:
 *   VITE_SUPABASE_URL (or SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY (or VITE_SUPABASE_ANON_KEY as fallback)
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

export const handler = async () => {
  const startedAt = new Date().toISOString();
  console.log(`[expire-annual-plans] Starting at ${startedAt}`);

  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL;

  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("[expire-annual-plans] Missing Supabase credentials");
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Missing Supabase credentials", startedAt }),
    };
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const today = new Date().toISOString();

  // Find active annual subscriptions whose period has ended
  const { data: expired, error: fetchError } = await supabase
    .from("subscriptions")
    .select("id, user_id, property_id, stripe_subscription_id, current_period_end")
    .eq("program", "annual")
    .eq("status", "active")
    .not("current_period_end", "is", null)
    .lt("current_period_end", today);

  if (fetchError) {
    console.error("[expire-annual-plans] Query failed:", fetchError.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: fetchError.message, startedAt }),
    };
  }

  const expiredList = expired ?? [];
  console.log(`[expire-annual-plans] Found ${expiredList.length} expired annual subscription(s)`);

  let expired_count = 0;
  const errors: string[] = [];
  const todayDate = new Date().toISOString().slice(0, 10);

  for (const sub of expiredList) {
    try {
      // Mark subscription as expired
      const { error: updateErr } = await supabase
        .from("subscriptions")
        .update({ status: "expired", updated_at: new Date().toISOString() })
        .eq("id", sub.id);

      if (updateErr) {
        errors.push(`sub ${sub.id}: update failed — ${updateErr.message}`);
        continue;
      }

      console.log(`[expire-annual-plans] Subscription ${sub.id} (user=${sub.user_id}) marked expired`);

      // Create an admin alert ticket — deduped by subject + date so re-runs don't create duplicates.
      // tickets.user_id is NOT NULL, so we use sub.user_id as the ticket owner.
      if (sub.user_id) {
        try {
          const ticketSubject = `Annual plan expired: subscription ${sub.id}`;

          const { data: existing } = await supabase
            .from("tickets")
            .select("id")
            .eq("subject", ticketSubject)
            .gte("created_at", `${todayDate}T00:00:00Z`)
            .maybeSingle();

          if (!existing) {
            const { error: ticketErr } = await supabase.from("tickets").insert({
              user_id: sub.user_id,
              subject: ticketSubject,
              description: `Annual plan for user ${sub.user_id} (property ${sub.property_id ?? "unknown"}) expired on ${sub.current_period_end}. Renewal outreach recommended.`,
              status: "open",
              priority: "high",
              created_at: new Date().toISOString(),
            });

            if (ticketErr) {
              console.warn(`[expire-annual-plans] Ticket creation failed for sub ${sub.id} (non-fatal):`, ticketErr.message);
            } else {
              console.log(`[expire-annual-plans] Admin alert ticket created for sub ${sub.id}`);
            }
          } else {
            console.log(`[expire-annual-plans] Alert ticket already exists for sub ${sub.id} today — skipping`);
          }
        } catch (ticketCreateErr: any) {
          console.warn(`[expire-annual-plans] Ticket creation threw (non-fatal):`, ticketCreateErr.message);
        }
      }

      expired_count++;
    } catch (err: any) {
      errors.push(`sub ${sub.id}: ${err.message}`);
    }
  }

  const summary = { startedAt, checked: expiredList.length, expired_count, errors };
  console.log("[expire-annual-plans] Complete:", JSON.stringify(summary, null, 2));

  return {
    statusCode: 200,
    body: JSON.stringify(summary),
  };
};
