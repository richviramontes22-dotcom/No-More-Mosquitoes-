/**
 * GET /api/unsubscribe?unsub=<profileId>
 *
 * One-click email unsubscribe endpoint (CAN-SPAM compliance).
 * No authentication required — the profileId in the URL is the "token".
 * Sets notification_preferences.emailOptedOut = true for the profile.
 *
 * Responds with a simple HTML confirmation page.
 */

import { Router } from "express";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { supabase } from "../lib/supabase";
import { logNotification } from "../services/notifications/notificationLogger";

const router = Router();
const db = supabaseAdmin ?? supabase;

router.get("/unsubscribe", async (req, res) => {
  const { unsub } = req.query as Record<string, string>;

  const appUrl = process.env.APP_BASE_URL || "https://nomoremosquitoes.us";

  if (!unsub || typeof unsub !== "string") {
    return res.status(400).send(`
      <!DOCTYPE html><html><head><meta charset="UTF-8" /><title>Unsubscribe Error</title></head>
      <body style="font-family:sans-serif;text-align:center;padding:60px 20px;">
        <h2>Invalid unsubscribe link</h2>
        <p>The link you followed is incomplete or has expired.</p>
        <p><a href="${appUrl}/dashboard/profile">Manage preferences</a></p>
      </body></html>
    `);
  }

  try {
    // Fetch current preferences to merge (avoid overwriting other prefs)
    const { data: profile } = await db
      .from("profiles")
      .select("id, email, notification_preferences")
      .eq("id", unsub)
      .maybeSingle();

    if (!profile) {
      return res.status(404).send(`
        <!DOCTYPE html><html><head><meta charset="UTF-8" /><title>Unsubscribe</title></head>
        <body style="font-family:sans-serif;text-align:center;padding:60px 20px;">
          <h2>Link not found</h2>
          <p>We could not find your account. You may already be unsubscribed.</p>
        </body></html>
      `);
    }

    const currentPrefs = (profile.notification_preferences as Record<string, unknown>) ?? {};
    const updatedPrefs = { ...currentPrefs, emailOptedOut: true };

    await db
      .from("profiles")
      .update({ notification_preferences: updatedPrefs })
      .eq("id", unsub);

    // Log the unsubscribe action
    void logNotification({
      profileId:        unsub,
      recipientEmail:   profile.email ?? null,
      channel:          "email",
      notificationType: "email_opted_out",
      status:           "skipped",
      provider:         null,
      errorMessage:     null,
    });

    console.log(`[Unsubscribe] emailOptedOut=true set for profile ${unsub}`);

    return res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Unsubscribed — No More Mosquitoes</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f3f4f6; margin: 0; padding: 0; }
          .card { max-width: 480px; margin: 80px auto; background: #fff; border-radius: 12px; padding: 48px 40px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
          h1 { color: #2d6a4f; font-size: 24px; margin: 0 0 12px; }
          p { color: #6b7280; font-size: 15px; line-height: 1.6; margin: 0 0 16px; }
          a { color: #2d6a4f; text-decoration: none; font-weight: 600; }
          a:hover { text-decoration: underline; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>You've been unsubscribed</h1>
          <p>You will no longer receive promotional emails from No More Mosquitoes.</p>
          <p>Transactional emails (appointment confirmations, billing) may still be sent as required for your service.</p>
          <p><a href="${appUrl}/dashboard/profile">Manage your notification preferences</a></p>
        </div>
      </body>
      </html>
    `);
  } catch (err: any) {
    console.error("[Unsubscribe] Error:", err.message);
    return res.status(500).send(`
      <!DOCTYPE html><html><head><meta charset="UTF-8" /><title>Error</title></head>
      <body style="font-family:sans-serif;text-align:center;padding:60px 20px;">
        <h2>Something went wrong</h2>
        <p>Please try again later or contact us at <a href="${appUrl}">nomoremosquitoes.us</a>.</p>
      </body></html>
    `);
  }
});

export default router;
