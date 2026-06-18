import express from "express";
import { supabase } from "../lib/supabase";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { requireAdmin } from "../middleware/requireAdmin";
import { getNotificationSettings, updateNotificationSettings } from "../services/notifications/notificationSettingsService";

const router = express.Router();
const db = supabaseAdmin ?? supabase;

/**
 * GET /api/admin/settings
 * Fetch all admin settings (admin only)
 */
router.get("/settings", requireAdmin, async (_req, res) => {
  try {
    const { data, error } = await db
      .from("admin_settings")
      .select("*")
      .order("setting_key");

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    const settingsMap = (data || []).reduce(
      (acc, setting) => ({
        ...acc,
        [setting.setting_key]: setting.setting_value,
      }),
      {} as Record<string, any>
    );

    res.json(settingsMap);
  } catch (err) {
    console.error("[Admin Settings] GET error:", err);
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * POST /api/admin/settings
 * Save or update a specific admin setting (admin only)
 * Body: { setting_key: string, setting_value: any }
 */
router.post("/settings", requireAdmin, async (req, res) => {
  try {
    const { setting_key, setting_value } = req.body;

    if (!setting_key || setting_value === undefined) {
      return res.status(400).json({ error: "Missing setting_key or setting_value" });
    }

    const sensitiveKeys = ["stripe.secretKey", "twilio.token", "sendgrid.apiKey", "googleMaps.apiKey", "sentry.dsn"];
    if (sensitiveKeys.includes(setting_key)) {
      console.warn(`[Admin Settings] Sensitive key update attempted: ${setting_key}. Consider storing secrets in env vars.`);
    }

    const { data, error } = await db
      .from("admin_settings")
      .upsert(
        {
          setting_key,
          setting_value,
          updated_by: req.adminUserId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "setting_key" }
      )
      .select("*")
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ success: true, setting: data });
  } catch (err) {
    console.error("[Admin Settings] POST error:", err);
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * DELETE /api/admin/settings/:settingKey
 * Delete a specific admin setting (admin only)
 */
router.delete("/settings/:settingKey", requireAdmin, async (req, res) => {
  try {
    const { settingKey } = req.params;

    const { error } = await db
      .from("admin_settings")
      .delete()
      .eq("setting_key", settingKey);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("[Admin Settings] DELETE error:", err);
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Customer notification settings (Platform Growth Phase 2) ────────────────

router.get("/notification-settings", requireAdmin, async (_req, res) => {
  try {
    const settings = await getNotificationSettings();
    res.json({ settings });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/notification-settings", requireAdmin, async (req, res) => {
  const allowedFields = ["reminder_24h_enabled", "reminder_2h_enabled", "review_request_enabled", "review_link_url"];
  const updates: Record<string, any> = {};
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: "No valid fields to update" });

  try {
    const settings = await updateNotificationSettings({ ...updates, updated_by: req.adminUserId ?? null });
    res.json({ success: true, settings });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
