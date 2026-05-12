import { useState, useEffect } from "react";
import { useToast } from "./use-toast";
import { supabase } from "@/lib/supabase";

export interface AdminSettingsState {
  team: Array<{ id: string; name: string; email: string; role: "admin" | "support" }>;
  flags: {
    autoAssignTickets: boolean;
    requireCompletionVideo: boolean;
    enableReserviceRequests: boolean;
    smsReminders: boolean;
  };
  integrations: {
    supabase: { enabled: boolean; url: string; anonKey: string };
    stripe: { enabled: boolean; secretKey: string; publicKey: string };
    sendgrid: { enabled: boolean; apiKey: string };
    twilio: { enabled: boolean; sid: string; token: string };
    googleMaps: { enabled: boolean; apiKey: string };
    sentry: { enabled: boolean; dsn: string };
    netlify: { enabled: boolean };
    builder: { enabled: boolean; apiKey: string };
    neon: { enabled: boolean; connectionString: string };
    notion: { enabled: boolean; token: string };
  };
}

export const useAdminSettings = () => {
  const { toast } = useToast();
  const [settings, setSettings] = useState<AdminSettingsState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);

      // Get the current session to get the JWT token
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        console.warn("[Admin Settings] No auth token available");
        setLoading(false);
        return;
      }

      const response = await fetch("/api/admin/settings", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          toast({
            title: "Permission Denied",
            description: "You do not have permission to access admin settings",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
        throw new Error(`Failed to load settings: ${response.statusText}`);
      }

      const data = await response.json();

      // Reconstruct the settings object from the flat key-value structure
      const reconstructedSettings: AdminSettingsState = {
        team: data["team"] || [],
        flags: data["flags"] || {
          autoAssignTickets: true,
          requireCompletionVideo: true,
          enableReserviceRequests: true,
          smsReminders: true,
        },
        integrations: data["integrations"] || {
          supabase: { enabled: true, url: "", anonKey: "" },
          stripe: { enabled: true, secretKey: "", publicKey: "" },
          sendgrid: { enabled: false, apiKey: "" },
          twilio: { enabled: false, sid: "", token: "" },
          googleMaps: { enabled: false, apiKey: "" },
          sentry: { enabled: false, dsn: "" },
          netlify: { enabled: false },
          builder: { enabled: false, apiKey: "" },
          neon: { enabled: false, connectionString: "" },
          notion: { enabled: false, token: "" },
        },
      };

      setSettings(reconstructedSettings);
    } catch (err) {
      console.error("[Admin Settings] Error loading settings:", err);
      toast({
        title: "Error Loading Settings",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (newSettings: AdminSettingsState) => {
    try {
      setSaving(true);

      // Get the current session to get the JWT token
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        throw new Error("No authentication token available");
      }

      // Save each section separately
      const savePromises = [
        fetch("/api/admin/settings", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            setting_key: "team",
            setting_value: newSettings.team,
          }),
        }),
        fetch("/api/admin/settings", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            setting_key: "flags",
            setting_value: newSettings.flags,
          }),
        }),
        fetch("/api/admin/settings", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            setting_key: "integrations",
            setting_value: newSettings.integrations,
          }),
        }),
      ];

      const responses = await Promise.all(savePromises);

      // Check if any failed
      for (const response of responses) {
        if (!response.ok) {
          throw new Error(`Failed to save settings: ${response.statusText}`);
        }
      }

      setSettings(newSettings);
      toast({
        title: "Settings Saved",
        description: "All settings have been saved successfully.",
      });

      return true;
    } catch (err) {
      console.error("[Admin Settings] Error saving settings:", err);
      toast({
        title: "Error Saving Settings",
        description: (err as Error).message,
        variant: "destructive",
      });
      return false;
    } finally {
      setSaving(false);
    }
  };

  return {
    settings,
    loading,
    saving,
    loadSettings,
    saveSettings,
  };
};
