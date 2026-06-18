import { supabase } from "../../lib/supabase";
import { supabaseAdmin } from "../../lib/supabaseAdmin";

const db = supabaseAdmin ?? supabase;

export interface CustomerNotificationSettings {
  id: string;
  reminder_24h_enabled: boolean;
  reminder_2h_enabled: boolean;
  review_request_enabled: boolean;
  review_link_url: string | null;
  updated_by: string | null;
  updated_at: string;
  created_at: string;
}

const DEFAULTS = {
  reminder_24h_enabled: true,
  reminder_2h_enabled: false,
  review_request_enabled: false,
  review_link_url: null as string | null,
};

/**
 * Singleton, DB-backed toggle layer on top of the existing env-var gates
 * (ENABLE_REMINDER_EMAILS / REMINDER_DRY_RUN). Both must allow a send — this
 * table never widens what the env vars already permit, it only lets an
 * admin narrow it further (or opt in to the new reminder_2h / review_request
 * sends) without a redeploy.
 */
export async function getNotificationSettings(): Promise<CustomerNotificationSettings> {
  const { data } = await db
    .from("customer_notification_settings")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (data) return data as CustomerNotificationSettings;

  const { data: created, error } = await db
    .from("customer_notification_settings")
    .insert(DEFAULTS)
    .select("*")
    .single();

  if (error || !created) {
    return { id: "", ...DEFAULTS, updated_by: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  }
  return created as CustomerNotificationSettings;
}

export async function updateNotificationSettings(
  updates: Partial<Omit<CustomerNotificationSettings, "id" | "created_at" | "updated_at">>,
): Promise<CustomerNotificationSettings> {
  const current = await getNotificationSettings();
  const { data, error } = await db
    .from("customer_notification_settings")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", current.id)
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Failed to update notification settings");
  return data as CustomerNotificationSettings;
}
