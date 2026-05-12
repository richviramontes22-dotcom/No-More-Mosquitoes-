import express from "express";
import { supabase } from "../lib/supabase";

const router = express.Router();

/**
 * GET /api/admin/settings
 * Fetch all admin settings (admin only)
 */
router.get("/settings", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid authorization header" });
    }

    const token = authHeader.substring(7);

    // Set the auth context for the request
    const { data: user, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.user.id)
      .single();

    if (profileError || !profile || profile.role !== "admin") {
      return res.status(403).json({ error: "Forbidden: Only admins can access settings" });
    }

    // Fetch all settings
    const { data, error } = await supabase
      .from("admin_settings")
      .select("*")
      .order("setting_key");

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // Convert array to object for easier client usage
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
router.post("/settings", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid authorization header" });
    }

    const token = authHeader.substring(7);
    const { setting_key, setting_value } = req.body;

    if (!setting_key || setting_value === undefined) {
      return res.status(400).json({ error: "Missing setting_key or setting_value" });
    }

    // Get the authenticated user
    const { data: user, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.user.id)
      .single();

    if (profileError || !profile || profile.role !== "admin") {
      return res.status(403).json({ error: "Forbidden: Only admins can modify settings" });
    }

    // Never store actual API keys in the database - only validate that they're being updated
    // For sensitive keys (stripe, twilio, etc.), we recommend storing them in environment variables
    // and only allowing them to be validated/tested here
    const sensitiveKeys = ["stripe.secretKey", "twilio.token", "sendgrid.apiKey", "googleMaps.apiKey", "sentry.dsn"];
    if (sensitiveKeys.includes(setting_key)) {
      console.warn(`[Admin Settings] Sensitive key update attempted: ${setting_key}. Consider storing secrets in env vars.`);
      // Optionally reject, or validate against env vars
      // For now, allow but log the warning
    }

    // Upsert the setting
    const { data, error } = await supabase
      .from("admin_settings")
      .upsert(
        {
          setting_key,
          setting_value,
          updated_by: user.user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "setting_key" }
      )
      .select("*")
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({
      success: true,
      setting: data,
    });
  } catch (err) {
    console.error("[Admin Settings] POST error:", err);
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * DELETE /api/admin/settings/:settingKey
 * Delete a specific admin setting (admin only)
 */
router.delete("/settings/:settingKey", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid authorization header" });
    }

    const token = authHeader.substring(7);
    const { settingKey } = req.params;

    // Get the authenticated user
    const { data: user, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.user.id)
      .single();

    if (profileError || !profile || profile.role !== "admin") {
      return res.status(403).json({ error: "Forbidden: Only admins can delete settings" });
    }

    // Delete the setting
    const { error } = await supabase
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

export default router;
