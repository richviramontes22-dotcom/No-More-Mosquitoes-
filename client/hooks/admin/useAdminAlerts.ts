import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";

export interface AdminAlert {
  id: string;
  event_type: string;
  severity: "info" | "warning" | "critical";
  title: string;
  body?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  metadata?: Record<string, unknown> | null;
  acknowledged_at?: string | null;
  resolved_at?: string | null;
  notified_email: boolean;
  notified_sms: boolean;
  created_at: string;
}

export interface AdminAlertCounts {
  total: number;
  info: number;
  warning: number;
  critical: number;
}

async function getAdminToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getAdminToken();
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

/**
 * Polls /api/admin/alerts/counts every 60 seconds.
 * Returns null while loading, 0-counts while alerts table is empty.
 */
export function useAdminAlertCounts(enabled = true) {
  const [counts, setCounts] = useState<AdminAlertCounts | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchCounts = useCallback(async () => {
    if (!enabled) return;
    try {
      const data = await adminFetch<AdminAlertCounts>("/api/admin/alerts/counts");
      setCounts(data);
      setError(null);
    } catch (err: any) {
      // Silently ignore auth errors (user may not be admin)
      setError(err.message);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    void fetchCounts();
    intervalRef.current = setInterval(fetchCounts, 60_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [enabled, fetchCounts]);

  return { counts, error, refetch: fetchCounts };
}

interface UseAdminAlertsOptions {
  severity?: "info" | "warning" | "critical";
  limit?: number;
  unresolvedOnly?: boolean;
  enabled?: boolean;
}

/**
 * Fetches admin alerts with optional filters.
 */
export function useAdminAlerts(options: UseAdminAlertsOptions = {}) {
  const { severity, limit = 50, unresolvedOnly = true, enabled = true } = options;

  const [alerts, setAlerts] = useState<AdminAlert[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAlerts = useCallback(async () => {
    if (!enabled) return;
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        limit: String(limit),
        unresolved_only: unresolvedOnly ? "true" : "false",
      });
      if (severity) params.set("severity", severity);

      const data = await adminFetch<{ alerts: AdminAlert[] }>(`/api/admin/alerts?${params.toString()}`);
      setAlerts(data.alerts ?? []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [enabled, severity, limit, unresolvedOnly]);

  useEffect(() => {
    void fetchAlerts();
  }, [fetchAlerts]);

  return { alerts, isLoading, error, refetch: fetchAlerts };
}

/**
 * Acknowledges an alert — marks it as seen by admin.
 * Returns the updated alert or null on failure.
 */
export async function acknowledgeAlert(id: string): Promise<AdminAlert | null> {
  try {
    const data = await adminFetch<{ ok: boolean; alert: AdminAlert }>(
      `/api/admin/alerts/${id}/acknowledge`,
      { method: "POST" },
    );
    return data.alert ?? null;
  } catch (err: any) {
    console.error("[AdminAlerts] acknowledge failed:", err.message);
    return null;
  }
}

/**
 * Resolves an alert — marks the issue as addressed.
 */
export async function resolveAlert(id: string): Promise<AdminAlert | null> {
  try {
    const data = await adminFetch<{ ok: boolean; alert: AdminAlert }>(
      `/api/admin/alerts/${id}/resolve`,
      { method: "POST" },
    );
    return data.alert ?? null;
  } catch (err: any) {
    console.error("[AdminAlerts] resolve failed:", err.message);
    return null;
  }
}
