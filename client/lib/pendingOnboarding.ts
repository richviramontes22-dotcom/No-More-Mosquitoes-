// Stores quote/onboarding intent in sessionStorage so it survives
// the login/signup redirect without forcing the user to re-enter data.

const KEY     = "nmm_pending_onboarding";
const VERSION = 2;         // bump when PendingOnboarding shape changes
const TTL_MS  = 2 * 60 * 60 * 1000; // 2 hours

export interface PendingOnboarding {
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  acreage?: number;
  program?: "subscription" | "one_time" | "annual";
  cadenceDays?: number;
  estimatedPrice?: number;
  source?: string;
  savedAt?: string;  // ISO timestamp — used for TTL
  _v?: number;       // schema version — used to discard stale/incompatible data
}

/** Stored shape (includes version wrapper). */
interface StoredOnboarding extends PendingOnboarding {
  _v: number;
  savedAt: string;
}

export function savePendingOnboarding(data: PendingOnboarding): void {
  try {
    const stored: StoredOnboarding = {
      ...data,
      _v:      VERSION,
      savedAt: new Date().toISOString(),
    };
    sessionStorage.setItem(KEY, JSON.stringify(stored));
  } catch {
    // Storage quota exceeded or private-browsing restriction — silently no-op.
  }
}

export function loadPendingOnboarding(): PendingOnboarding | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;

    // Safe parse — malformed JSON should never crash the app
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      clearPendingOnboarding();
      return null;
    }

    // Must be a plain object
    if (typeof data !== "object" || data === null || Array.isArray(data)) {
      clearPendingOnboarding();
      return null;
    }

    const record = data as Partial<StoredOnboarding>;

    // Version check: discard data written by an older schema
    if (record._v !== undefined && record._v < VERSION) {
      clearPendingOnboarding();
      return null;
    }

    // TTL check: expire after 2 hours
    if (record.savedAt) {
      const age = Date.now() - new Date(record.savedAt).getTime();
      if (age > TTL_MS) {
        clearPendingOnboarding();
        return null;
      }
    }

    // Field-level validation: coerce obviously corrupt numeric fields
    const validated: PendingOnboarding = {};

    if (typeof record.address === "string")      validated.address  = record.address;
    if (typeof record.city    === "string")      validated.city     = record.city;
    if (typeof record.state   === "string")      validated.state    = record.state;
    if (typeof record.zip     === "string")      validated.zip      = record.zip;
    if (typeof record.source  === "string")      validated.source   = record.source;
    if (typeof record.savedAt === "string")      validated.savedAt  = record.savedAt;

    if (typeof record.acreage === "number" && isFinite(record.acreage) && record.acreage >= 0) {
      validated.acreage = record.acreage;
    }
    if (typeof record.cadenceDays === "number" && isFinite(record.cadenceDays) && record.cadenceDays > 0) {
      validated.cadenceDays = record.cadenceDays;
    }
    if (typeof record.estimatedPrice === "number" && isFinite(record.estimatedPrice) && record.estimatedPrice >= 0) {
      validated.estimatedPrice = record.estimatedPrice;
    }
    if (record.program === "subscription" || record.program === "one_time" || record.program === "annual") {
      validated.program = record.program;
    }

    return validated;
  } catch {
    // Unexpected error reading/validating — clear and return null
    clearPendingOnboarding();
    return null;
  }
}

export function clearPendingOnboarding(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

export function hasPendingOnboarding(): boolean {
  return loadPendingOnboarding() !== null;
}
