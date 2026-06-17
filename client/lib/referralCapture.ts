// Captures a `?ref=CODE` URL parameter and persists it so a referred visitor's
// code survives navigation through to the schedule-request form, even if they
// land on a different page first (e.g. a blog post) before booking.

const KEY = "nmm_referral_code";
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days — referral attribution window

interface StoredReferral {
  code: string;
  savedAt: string;
}

/** Call once on app load. Reads `?ref=` from the URL and stores it if present. */
export function captureReferralCodeFromUrl(): void {
  try {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (!ref || !ref.trim()) return;

    const stored: StoredReferral = { code: ref.trim().toUpperCase(), savedAt: new Date().toISOString() };
    localStorage.setItem(KEY, JSON.stringify(stored));
  } catch {
    // Storage unavailable (private browsing, quota) — silently no-op.
  }
}

/** Returns the stored referral code if present and not expired, else null. */
export function getStoredReferralCode(): string | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;

    const data = JSON.parse(raw) as Partial<StoredReferral>;
    if (typeof data.code !== "string" || typeof data.savedAt !== "string") return null;

    const age = Date.now() - new Date(data.savedAt).getTime();
    if (age > TTL_MS) {
      localStorage.removeItem(KEY);
      return null;
    }

    return data.code;
  } catch {
    return null;
  }
}
