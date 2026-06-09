/**
 * Netlify Scheduled Function — send-annual-warnings
 *
 * Runs daily at 10:00 AM UTC (configured in netlify.toml).
 * Sends expiry warning emails for annual plans:
 *   - 30-day warning  → type 'annual_expiring_30d'
 *   - 7-day warning   → type 'annual_expiring_7d'
 *   - Expiration      → type 'annual_expired'
 *
 * Environment variables required:
 *   VITE_SUPABASE_URL (or SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY (or VITE_SUPABASE_ANON_KEY as fallback)
 *   RESEND_API_KEY
 *   RESEND_FROM_EMAIL
 *   APP_BASE_URL
 *   SUPPORT_EMAIL
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

// Import email templates and provider
// Note: these are server-side paths — Netlify esbuild handles the resolution
import {
  buildAnnualPlanExpiringEmail,
  buildAnnualPlanExpiredEmail,
} from "../../server/services/notifications/emailTemplates";

interface NotificationResult {
  sent: number;
  skipped: number;
  failed: number;
  errors: string[];
}

async function sendWarnings(): Promise<{
  startedAt: string;
  expiring_30d: NotificationResult;
  expiring_7d: NotificationResult;
  expired: NotificationResult;
}> {
  const startedAt = new Date().toISOString();

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase credentials");
  }

  const db = createClient(supabaseUrl, supabaseKey);

  const resendApiKey  = process.env.RESEND_API_KEY;
  const fromEmail     = process.env.RESEND_FROM_EMAIL || "No More Mosquitoes <hello@nomoremosquitoes.us>";
  const appBaseUrl    = process.env.APP_BASE_URL || "https://nomoremosquitoes.us";
  const supportEmail  = process.env.SUPPORT_EMAIL || "support@nomoremosquitoes.us";
  const renewUrl      = `${appBaseUrl}/dashboard/billing`;

  const now          = new Date();
  const nowIso       = now.toISOString();
  const day30        = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const day7         = new Date(now.getTime() + 7  * 24 * 60 * 60 * 1000).toISOString();
  const day31        = new Date(now.getTime() + 31 * 24 * 60 * 60 * 1000).toISOString();
  const day8         = new Date(now.getTime() + 8  * 24 * 60 * 60 * 1000).toISOString();

  async function wasNotificationSent(profileId: string, type: string, withinHours = 36): Promise<boolean> {
    try {
      const cutoff = new Date(Date.now() - withinHours * 60 * 60 * 1000).toISOString();
      const { count } = await db
        .from("notification_log")
        .select("id", { count: "exact", head: true })
        .eq("profile_id", profileId)
        .eq("notification_type", type)
        .eq("status", "sent")
        .gte("created_at", cutoff);
      return (count ?? 0) > 0;
    } catch {
      return false;
    }
  }

  async function sendEmail(to: string, subject: string, html: string, text: string): Promise<void> {
    if (!resendApiKey) {
      console.log(`[annual-warnings] Would send email to ${to} — subject: "${subject}" (RESEND_API_KEY not set)`);
      return;
    }
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: fromEmail, to, subject, html, text }),
    });
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Resend error ${response.status}: ${err.slice(0, 200)}`);
    }
  }

  async function logNotification(
    profileId: string,
    type: string,
    recipientEmail: string,
    subject: string,
    status: "sent" | "skipped" | "failed",
    errorMessage?: string,
  ) {
    await Promise.resolve(
      db.from("notification_log").insert({
        profile_id:        profileId,
        recipient_email:   recipientEmail,
        channel:           "email",
        notification_type: type,
        subject,
        status,
        provider:          resendApiKey ? "resend" : null,
        error_message:     errorMessage ?? null,
        sent_at:           status === "sent" ? new Date().toISOString() : null,
        created_at:        new Date().toISOString(),
      })
    ).catch(() => {});
  }

  // ─── 30-day warning ────────────────────────────────────────────────────────
  const result30d: NotificationResult = { sent: 0, skipped: 0, failed: 0, errors: [] };
  {
    const { data: subs30 } = await db
      .from("subscriptions")
      .select("id, user_id, current_period_end")
      .eq("program", "annual")
      .eq("status", "active")
      .not("current_period_end", "is", null)
      .gte("current_period_end", day30)
      .lt("current_period_end", day31)
      .not("user_id", "is", null);

    for (const sub of subs30 ?? []) {
      try {
        const alreadySent = await wasNotificationSent(sub.user_id, "annual_expiring_30d");
        if (alreadySent) { result30d.skipped++; continue; }

        const { data: profile } = await db.from("profiles").select("email, name").eq("id", sub.user_id).maybeSingle();
        if (!profile?.email) { result30d.skipped++; continue; }

        const expiryDate    = new Date(sub.current_period_end).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
        const customerName  = profile.name || profile.email.split("@")[0];
        const { subject, html, text } = buildAnnualPlanExpiringEmail({
          customerName,
          expiryDate,
          daysRemaining: 30,
          renewUrl,
          supportEmail,
        });

        await sendEmail(profile.email, subject, html, text);
        await logNotification(sub.user_id, "annual_expiring_30d", profile.email, subject, "sent");
        result30d.sent++;
        console.log(`[annual-warnings] 30d warning sent to ${profile.email} (sub ${sub.id})`);
      } catch (err: any) {
        result30d.failed++;
        result30d.errors.push(`sub ${sub.id}: ${err.message}`);
        console.error(`[annual-warnings] 30d warning failed for sub ${sub.id}:`, err.message);
      }
    }
  }

  // ─── 7-day warning ─────────────────────────────────────────────────────────
  const result7d: NotificationResult = { sent: 0, skipped: 0, failed: 0, errors: [] };
  {
    const { data: subs7 } = await db
      .from("subscriptions")
      .select("id, user_id, current_period_end")
      .eq("program", "annual")
      .eq("status", "active")
      .not("current_period_end", "is", null)
      .gte("current_period_end", day7)
      .lt("current_period_end", day8)
      .not("user_id", "is", null);

    for (const sub of subs7 ?? []) {
      try {
        const alreadySent = await wasNotificationSent(sub.user_id, "annual_expiring_7d");
        if (alreadySent) { result7d.skipped++; continue; }

        const { data: profile } = await db.from("profiles").select("email, name").eq("id", sub.user_id).maybeSingle();
        if (!profile?.email) { result7d.skipped++; continue; }

        const expiryDate    = new Date(sub.current_period_end).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
        const customerName  = profile.name || profile.email.split("@")[0];
        const { subject, html, text } = buildAnnualPlanExpiringEmail({
          customerName,
          expiryDate,
          daysRemaining: 7,
          renewUrl,
          supportEmail,
        });

        await sendEmail(profile.email, subject, html, text);
        await logNotification(sub.user_id, "annual_expiring_7d", profile.email, subject, "sent");
        result7d.sent++;
        console.log(`[annual-warnings] 7d warning sent to ${profile.email} (sub ${sub.id})`);
      } catch (err: any) {
        result7d.failed++;
        result7d.errors.push(`sub ${sub.id}: ${err.message}`);
        console.error(`[annual-warnings] 7d warning failed for sub ${sub.id}:`, err.message);
      }
    }
  }

  // ─── Expired plans ─────────────────────────────────────────────────────────
  const resultExpired: NotificationResult = { sent: 0, skipped: 0, failed: 0, errors: [] };
  {
    // Find plans that just expired (within the last 24h) and have been transitioned to expired
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const { data: expiredSubs } = await db
      .from("subscriptions")
      .select("id, user_id, current_period_end")
      .eq("program", "annual")
      .eq("status", "expired")
      .not("user_id", "is", null)
      .gte("current_period_end", yesterday)
      .lte("current_period_end", nowIso);

    for (const sub of expiredSubs ?? []) {
      try {
        const alreadySent = await wasNotificationSent(sub.user_id, "annual_expired");
        if (alreadySent) { resultExpired.skipped++; continue; }

        const { data: profile } = await db.from("profiles").select("email, name").eq("id", sub.user_id).maybeSingle();
        if (!profile?.email) { resultExpired.skipped++; continue; }

        const expiredDate  = new Date(sub.current_period_end).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
        const customerName = profile.name || profile.email.split("@")[0];
        const { subject, html, text } = buildAnnualPlanExpiredEmail({
          customerName,
          expiredDate,
          renewUrl,
          supportEmail,
        });

        await sendEmail(profile.email, subject, html, text);
        await logNotification(sub.user_id, "annual_expired", profile.email, subject, "sent");
        resultExpired.sent++;
        console.log(`[annual-warnings] expired email sent to ${profile.email} (sub ${sub.id})`);
      } catch (err: any) {
        resultExpired.failed++;
        resultExpired.errors.push(`sub ${sub.id}: ${err.message}`);
        console.error(`[annual-warnings] expired email failed for sub ${sub.id}:`, err.message);
      }
    }
  }

  return {
    startedAt,
    expiring_30d: result30d,
    expiring_7d:  result7d,
    expired:      resultExpired,
  };
}

export const handler = async () => {
  console.log("[send-annual-warnings] Starting");
  try {
    const summary = await sendWarnings();
    console.log("[send-annual-warnings] Complete:", JSON.stringify(summary, null, 2));
    return {
      statusCode: 200,
      body: JSON.stringify(summary),
    };
  } catch (err: any) {
    console.error("[send-annual-warnings] Fatal error:", err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
