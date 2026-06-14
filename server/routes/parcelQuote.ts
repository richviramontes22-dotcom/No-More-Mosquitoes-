import { Router } from "express";
import type { Request, Response } from "express";
import { lookupParcel, isError } from "../services/parcel/parcelLookupService";
import { buildPricingQuote } from "../services/parcel/pricingQuote";
import { checkRateLimit } from "../services/parcel/rateLimit";
import { reverseGeocode } from "../services/parcel/googleAddressService";
import { getCachedReverseGeocode, setCachedReverseGeocode } from "../services/parcel/reverseGeocodeCache";
import { buildAddressHash } from "../services/parcel/cache";
import { notifyAdmin } from "../services/notifications/adminNotificationService";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { supabase } from "../lib/supabase";

const router = Router();

/**
 * POST /api/parcel/quote
 * address + ZIP → county GIS lookup → acreage → pricing quote
 * Optional: propertyId — if provided, persists resolved lat/lng to the property row.
 */
router.post("/quote", async (req: Request, res: Response) => {
  const { allowed, retryAfterMs } = checkRateLimit(req);
  if (!allowed) {
    res.setHeader("Retry-After", Math.ceil(retryAfterMs / 1000).toString());
    return res.status(429).json({
      ok: false,
      code: "RATE_LIMITED",
      message: "Too many requests. Please wait a moment before trying again.",
    });
  }

  const { address, zip, city, state, lat, lng, placeId, propertyId } = req.body ?? {};

  if (typeof address !== "string" || !address.trim()) {
    return res.status(400).json({ ok: false, code: "INVALID_ADDRESS", message: "Address is required." });
  }
  if (typeof zip !== "string" || !zip.trim()) {
    return res.status(400).json({ ok: false, code: "INVALID_ADDRESS", message: "ZIP code is required." });
  }

  const result = await lookupParcel({
    address: address.trim(),
    zip: zip.trim().replace(/\D/g, "").slice(0, 5),
    city: city?.trim(),
    state: state?.trim() ?? "CA",
    lat: typeof lat === "number" ? lat : undefined,
    lng: typeof lng === "number" ? lng : undefined,
    placeId: typeof placeId === "string" ? placeId : undefined,
  }, (req as any).requestId);

  if (isError(result)) {
    const status =
      result.errorCode === "INVALID_ADDRESS"        ? 400 :
      result.errorCode === "RATE_LIMITED"            ? 429 :
      result.errorCode === "MANUAL_REVIEW_REQUIRED"  ? 422 : 503;

    // A manual-review address is still a real prospect — they just couldn't
    // be auto-quoted (no GIS parcel match). Capture as a lead so the team can
    // follow up and quote it by hand, flagged so it's distinguishable from a
    // normal instant-quote lead.
    if (result.errorCode === "MANUAL_REVIEW_REQUIRED") {
      const cleanZip = zip.trim().replace(/\D/g, "").slice(0, 5);
      notifyAdmin({
        event_type: "leads.manual_review_required",
        severity: "info",
        title: `New lead — manual review required (${address.trim()})`,
        body: `${address.trim()}${city ? `, ${city.trim()}` : ""} ${cleanZip} could not be auto-quoted (${result.message}). Needs a manual quote.`,
        entity_type: "lead",
        entity_id: buildAddressHash(`${address.trim()}, ${cleanZip}`),
        metadata: {
          address: address.trim(),
          city: city?.trim(),
          state: state?.trim() ?? "CA",
          zip: cleanZip,
          manualReview: true,
          reason: result.message,
        },
      });
    }

    return res.status(status).json({ ok: false, code: result.errorCode, message: result.message });
  }

  const quote = result.acreage != null ? buildPricingQuote(result.acreage) : null;

  // Properties whose parcel acreage exceeds the priced range (e.g. a condo/HOA
  // shared parcel, or any large lot) can't be quoted from raw GIS acreage —
  // the frontend should ask the customer for their unit's/treatment area size
  // instead of rendering subscription/annual tiles with no price.
  const oversized = result.acreage != null && result.acreage > 2.0;

  // Persist coordinates to property if propertyId was provided and lat/lng are known.
  // The client passes lat/lng from Google Places autocomplete when available.
  // Non-fatal: a coordinate write failure never blocks the quote response.
  if (propertyId && typeof lat === "number" && typeof lng === "number") {
    const db = supabaseAdmin ?? supabase;
    void Promise.resolve(db.from("properties").update({ lat, lng }).eq("id", propertyId)).catch(() => {});
  }

  // ── Surface as a lead in the admin alerts feed ─────────────────────────────
  // Anyone who gets this far entered a real address and saw a price — that's
  // a sales lead even if they never submit the booking form. Deduped per
  // address for 1 hour by notifyAdmin so re-quoting the same address doesn't
  // spam the feed.
  notifyAdmin({
    event_type: "leads.quote_requested",
    severity: "info",
    title: `New price quote — ${result.normalizedAddress}`,
    body: `An instant quote was generated for ${result.normalizedAddress}${result.county !== "unknown" ? ` (${result.county} County)` : ""}, ${result.acreage ?? "?"} ac.`,
    entity_type: "lead",
    entity_id: buildAddressHash(result.normalizedAddress),
    metadata: {
      address: result.normalizedAddress,
      zip: zip.trim().replace(/\D/g, "").slice(0, 5),
      county: result.county,
      acreage: result.acreage,
      confidence: result.confidence,
      oversized,
    },
  });

  return res.json({
    ok: true,
    normalizedAddress: result.normalizedAddress,
    county: result.county,
    apn: result.apn,
    acreage: result.acreage,
    acreageSource: result.acreageSource,
    confidence: result.confidence,
    quote,
    oversized,
    cached: result.cached,
  });
});

/**
 * GET /api/parcel/reverse-geocode?lat=..&lng=..
 * lat/lng → ZIP/city/state/county. Used to backfill ZIP when a Places
 * Autocomplete selection has no postal_code (e.g. a street with no house
 * number) — the nearest specific address usually has one.
 */
router.get("/reverse-geocode", async (req: Request, res: Response) => {
  const { allowed, retryAfterMs } = checkRateLimit(req);
  if (!allowed) {
    res.setHeader("Retry-After", Math.ceil(retryAfterMs / 1000).toString());
    return res.status(429).json({
      ok: false,
      code: "RATE_LIMITED",
      message: "Too many requests. Please wait a moment before trying again.",
    });
  }

  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ ok: false, code: "INVALID_ADDRESS", message: "lat and lng are required." });
  }

  const cached = getCachedReverseGeocode(lat, lng);
  if (cached) {
    return res.json({ ok: true, zip: cached.zip, city: cached.city, state: cached.state, county: cached.county, cached: true });
  }

  const result = await reverseGeocode(lat, lng);
  if (!result) {
    return res.status(503).json({ ok: false, code: "PROVIDER_TIMEOUT", message: "Reverse geocoding is temporarily unavailable." });
  }

  setCachedReverseGeocode(lat, lng, result);

  return res.json({ ok: true, zip: result.zip, city: result.city, state: result.state, county: result.county, cached: false });
});

export default router;
