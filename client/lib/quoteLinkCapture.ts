// Captures a `?qt=TOKEN` URL parameter from an admin-sent quote link
// (server/routes/adminLeads.ts POST /:id/send-quote) and turns it into the
// same pendingOnboarding state the public quote widgets use, so a prospect
// who clicks the link lands on /login with their address and plan already
// filled in -- mirrors client/lib/referralCapture.ts's pattern, but this
// one needs a network round-trip (GET /api/leads/quote-link/:token) since
// the token alone carries no quote data, only a lookup key.

import { savePendingOnboarding } from "./pendingOnboarding";

interface QuoteLinkResponse {
  ok: boolean;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  acreage?: number | null;
  program?: "subscription" | "one_time" | "annual" | null;
  cadenceDays?: number | null;
  estimatedPriceCents?: number | null;
  name?: string | null;
  email?: string | null;
  message?: string;
}

/** Call once on app load. Reads `?qt=` from the URL and, if present, fetches
 * and stores the quote it points at. Best-effort -- a missing/expired token
 * or a network failure just means no pre-fill, never a thrown error. */
export async function captureQuoteLinkFromUrl(): Promise<void> {
  try {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("qt");
    if (!token || !token.trim()) return;

    const res = await fetch(`/api/leads/quote-link/${encodeURIComponent(token.trim())}`);
    if (!res.ok) return;

    const data: QuoteLinkResponse = await res.json();
    if (!data.ok || !data.address) return;

    savePendingOnboarding({
      address: data.address,
      city: data.city ?? undefined,
      state: data.state ?? undefined,
      zip: data.zip ?? undefined,
      acreage: data.acreage ?? undefined,
      program: data.program ?? undefined,
      cadenceDays: data.cadenceDays ?? undefined,
      estimatedPrice: data.estimatedPriceCents != null ? data.estimatedPriceCents / 100 : undefined,
      source: "admin_quote",
    });
  } catch {
    // Network failure or malformed response -- silently no-op, same as
    // referralCapture's posture on storage errors.
  }
}
