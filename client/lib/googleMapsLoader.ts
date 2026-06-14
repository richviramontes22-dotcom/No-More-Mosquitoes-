import { useEffect, useState } from "react";

const SCRIPT_ID = "google-maps-places-script";

let loadPromise: Promise<void> | null = null;

/** Inject the Google Maps JS API (Places library) script exactly once.
 *  Safe to call multiple times — subsequent calls reuse the same promise. */
export function loadGoogleMapsScript(apiKey: string): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps can only load in a browser"));
  }
  if (window.google?.maps?.places) {
    return Promise.resolve();
  }
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load Google Maps script")));
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&loading=async`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Maps script"));
    document.head.appendChild(script);
  });

  return loadPromise;
}

export type GoogleMapsScriptStatus = "idle" | "loading" | "ready" | "error";

/** Loads the Google Maps Places script if VITE_GOOGLE_MAPS_BROWSER_KEY is
 *  configured. Returns "idle" when no key is present (manual address entry
 *  remains the only option), "ready" once Autocomplete can be used, or
 *  "error" if the script failed to load (e.g. key missing/restricted). */
export function useGoogleMapsScript(): GoogleMapsScriptStatus {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY as string | undefined;
  const [status, setStatus] = useState<GoogleMapsScriptStatus>(apiKey ? "loading" : "idle");

  useEffect(() => {
    if (!apiKey) {
      setStatus("idle");
      return;
    }
    if (window.google?.maps?.places) {
      setStatus("ready");
      return;
    }

    let cancelled = false;
    setStatus("loading");
    loadGoogleMapsScript(apiKey)
      .then(() => {
        if (!cancelled) setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  return status;
}
