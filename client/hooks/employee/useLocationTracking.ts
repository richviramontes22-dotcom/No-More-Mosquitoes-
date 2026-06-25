import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

export type TrackingStatus = "off" | "active" | "permission_denied" | "unsupported";

const PING_INTERVAL_MS = 60_000;

/**
 * Periodic GPS ping while `enabled` is true — the caller is responsible for
 * computing `enabled` as "clocked in AND GPS-consented" (and recomputing it
 * reactively so revoking consent or clocking out flips this to false and
 * the effect below tears the interval down). The server independently
 * re-verifies consent and open-shift state on every ping regardless
 * (see POST /api/employee/shifts/location-ping) — this hook is the client
 * side of that contract, not the actual enforcement.
 */
export function useLocationTracking(enabled: boolean): TrackingStatus {
  const [status, setStatus] = useState<TrackingStatus>("off");
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      setStatus("off");
      if (intervalRef.current != null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    if (!("geolocation" in navigator)) {
      setStatus("unsupported");
      return;
    }

    let stopped = false;

    const sendPing = () => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          if (stopped) return;
          try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token) return;
            const res = await fetch("/api/employee/shifts/location-ping", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                accuracy: pos.coords.accuracy,
              }),
            });
            if (stopped) return;
            if (res.ok) setStatus("active");
            // A 403 here means the server's own checks (consent/shift) caught
            // something the client's `enabled` flag missed — e.g. consent was
            // withdrawn in another tab. Stop claiming "active" but don't
            // force a page-level error state for what the server already
            // safely rejected.
            else if (res.status === 403) setStatus("off");
          } catch {
            // Transient network failure — one missed ping isn't worth
            // flipping the indicator off; the next interval tick retries.
          }
        },
        () => { if (!stopped) setStatus("permission_denied"); },
        { enableHighAccuracy: true, maximumAge: 30_000, timeout: 20_000 }
      );
    };

    sendPing();
    intervalRef.current = window.setInterval(sendPing, PING_INTERVAL_MS);

    return () => {
      stopped = true;
      if (intervalRef.current != null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled]);

  return status;
}
