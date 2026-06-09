import { Router } from "express";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { supabase } from "../lib/supabase";

const router = Router();
const db = supabaseAdmin ?? supabase;

const SUPPORT_PHONE = process.env.SUPPORT_PHONE || "(949) 555-0100";
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "support@nomoremosquitoes.us";
const COMPANY_NAME  = "No More Mosquitoes";

/**
 * POST /api/webhooks/sms
 * Receives inbound SMS webhooks from Twilio.
 * Handles STOP / START / HELP keywords for TCPA compliance.
 *
 * Twilio sends: application/x-www-form-urlencoded
 *   Body    — message text
 *   From    — sender's phone number (E.164)
 *   To      — our Twilio number
 */
router.post("/sms", async (req, res) => {
  // Twilio expects a 200 TwiML response (or empty 200) — never return 4xx/5xx
  const rawBody: string = req.body?.Body ?? "";
  const fromPhone: string = req.body?.From ?? "";

  const keyword = rawBody.trim().toUpperCase().split(/\s+/)[0] ?? "";

  // Helper: log to notification_log (fire-and-forget, non-fatal)
  const logEvent = (type: "sms_opt_out" | "sms_opt_in", status: "sent" | "skipped") => {
    (async () => {
      try {
        if (!fromPhone) return;
        // Attempt to look up profile by phone number
        const { data: profileRow } = await db
          .from("profiles")
          .select("id")
          .eq("phone", fromPhone)
          .maybeSingle();

        await Promise.resolve(
          db.from("notification_log").insert({
            profile_id:        profileRow?.id ?? null,
            recipient_phone:   fromPhone,
            channel:           "sms",
            notification_type: type,
            status,
            provider:          "twilio",
            created_at:        new Date().toISOString(),
          })
        ).catch(() => {});
      } catch (err: any) {
        console.error("[SMS Webhook] logEvent failed:", err.message);
      }
    })();
  };

  // Helper: update notification_preferences in profile (profiles.notification_preferences JSONB)
  const updateSmsOptOut = async (phoneNumber: string, optedOut: boolean) => {
    try {
      const { data: profileRow } = await db
        .from("profiles")
        .select("id, notification_preferences")
        .eq("phone", phoneNumber)
        .maybeSingle();

      if (!profileRow?.id) {
        console.log(`[SMS Webhook] No profile found for phone ${phoneNumber} — opt-out recorded in log only`);
        return;
      }

      const existingPrefs: Record<string, unknown> =
        (profileRow.notification_preferences as Record<string, unknown>) ?? {};

      await db
        .from("profiles")
        .update({
          notification_preferences: {
            ...existingPrefs,
            smsOptedOut: optedOut,
          },
        })
        .eq("id", profileRow.id);

      console.log(`[SMS Webhook] Profile ${profileRow.id} smsOptedOut=${optedOut} (phone: ${phoneNumber})`);
    } catch (err: any) {
      console.error("[SMS Webhook] updateSmsOptOut failed:", err.message);
    }
  };

  if (keyword === "STOP" || keyword === "STOPALL" || keyword === "UNSUBSCRIBE" || keyword === "CANCEL" || keyword === "END" || keyword === "QUIT") {
    console.log(`[SMS Webhook] STOP received from ${fromPhone}`);
    // Update profile opt-out preference
    await updateSmsOptOut(fromPhone, true);
    logEvent("sms_opt_out", "sent");

    // Respond with TwiML (Twilio will also handle STOP automatically but we log it)
    res.set("Content-Type", "text/xml");
    return res.status(200).send(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Message>You have been unsubscribed from ${COMPANY_NAME} SMS notifications. Reply START to re-subscribe.</Message></Response>`
    );
  }

  if (keyword === "START" || keyword === "YES" || keyword === "UNSTOP") {
    console.log(`[SMS Webhook] START received from ${fromPhone}`);
    await updateSmsOptOut(fromPhone, false);
    logEvent("sms_opt_in", "sent");

    res.set("Content-Type", "text/xml");
    return res.status(200).send(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Message>Welcome back! You have re-subscribed to ${COMPANY_NAME} SMS notifications. Reply STOP to unsubscribe anytime.</Message></Response>`
    );
  }

  if (keyword === "HELP" || keyword === "INFO") {
    console.log(`[SMS Webhook] HELP received from ${fromPhone}`);

    res.set("Content-Type", "text/xml");
    return res.status(200).send(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${COMPANY_NAME} alerts. For support call ${SUPPORT_PHONE} or email ${SUPPORT_EMAIL}. Reply STOP to unsubscribe. Msg&amp;data rates may apply.</Message></Response>`
    );
  }

  // All other inbound messages — acknowledge with empty TwiML
  res.set("Content-Type", "text/xml");
  return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`);
});

export default router;
