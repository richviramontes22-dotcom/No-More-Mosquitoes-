import { supabase } from "@/lib/supabase";

export interface RequiredLegalDocument {
  document_id: string;
  document_type: string;
  title: string;
  version: string;
}

export interface LegalStatus {
  enforcement_enabled: boolean;
  required: RequiredLegalDocument[];
}

export interface MyAcceptance {
  document_id: string;
  document_type: string;
  document_version: string;
  accepted_at: string;
}

/** Public — safe to call with no session. */
export async function fetchLegalStatus(): Promise<LegalStatus> {
  try {
    const res = await fetch("/api/legal/status");
    if (!res.ok) return { enforcement_enabled: false, required: [] };
    return await res.json();
  } catch {
    // Network/infra failure must never block registration or the dashboard —
    // treat as "enforcement off" rather than throwing.
    return { enforcement_enabled: false, required: [] };
  }
}

async function authHeader(): Promise<Record<string, string> | null> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : null;
}

export async function fetchMyAcceptances(): Promise<MyAcceptance[]> {
  const headers = await authHeader();
  if (!headers) return [];
  const res = await fetch("/api/legal/my-acceptances", { headers });
  if (!res.ok) return [];
  const data = await res.json();
  return data.acceptances ?? [];
}

export interface AcceptancePayloadItem {
  document_id: string;
  document_type: string;
  document_version: string;
}

/** Requires an active session — throws if the write fails (caller decides how to handle). */
export async function submitAcceptances(items: AcceptancePayloadItem[]): Promise<void> {
  const headers = await authHeader();
  if (!headers) throw new Error("No active session — cannot record legal acceptance yet.");

  const res = await fetch("/api/legal/acceptances", {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ acceptances: items.map((i) => ({ ...i, acceptance_method: "registration_checkbox" })) }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Failed to record legal acceptance");
  }
}

/**
 * Given the currently-required documents and the customer's existing
 * acceptances, returns the subset still needing acceptance (missing entirely,
 * or accepted at an older version than what's currently deployed).
 */
export function diffRequiredAgainstAccepted(
  required: RequiredLegalDocument[],
  accepted: MyAcceptance[],
): RequiredLegalDocument[] {
  const acceptedByType = new Map(accepted.map((a) => [a.document_type, a]));
  return required.filter((doc) => {
    const existing = acceptedByType.get(doc.document_type);
    return !existing || existing.document_version !== doc.version;
  });
}

// ─── Pending acceptance payload (signup-time capture) ────────────────────────
// Mirrors client/lib/pendingOnboarding.ts and client/lib/referralCapture.ts —
// localStorage with a TTL, since a normal signup has no active session yet
// (email confirmation pending) and the actual write must happen later, once
// the customer logs in and a session exists.

const PENDING_KEY = "nmm_pending_legal_acceptance";
const PENDING_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days — long enough to cover email-confirmation delay

interface StoredPendingAcceptance {
  items: AcceptancePayloadItem[];
  savedAt: string;
}

export function savePendingLegalAcceptance(items: AcceptancePayloadItem[]): void {
  try {
    const stored: StoredPendingAcceptance = { items, savedAt: new Date().toISOString() };
    localStorage.setItem(PENDING_KEY, JSON.stringify(stored));
  } catch {
    // Storage unavailable — non-fatal; the dashboard-entry gate will simply
    // show the explicit acceptance screen instead of auto-submitting.
  }
}

export function getPendingLegalAcceptance(): AcceptancePayloadItem[] | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<StoredPendingAcceptance>;
    if (!Array.isArray(data.items) || typeof data.savedAt !== "string") return null;
    const age = Date.now() - new Date(data.savedAt).getTime();
    if (age > PENDING_TTL_MS) {
      clearPendingLegalAcceptance();
      return null;
    }
    return data.items;
  } catch {
    return null;
  }
}

export function clearPendingLegalAcceptance(): void {
  try { localStorage.removeItem(PENDING_KEY); } catch { /* ignore */ }
}
