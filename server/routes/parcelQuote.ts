import { Router } from "express";
import type { Request, Response } from "express";
import { lookupParcel, isError } from "../services/parcel/parcelLookupService";
import { buildPricingQuote } from "../services/parcel/pricingQuote";
import { checkRateLimit } from "../services/parcel/rateLimit";
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

    return res.status(status).json({ ok: false, code: result.errorCode, message: result.message });
  }

  const quote = result.acreage != null ? buildPricingQuote(result.acreage) : null;

  // Persist coordinates to property if propertyId was provided and lat/lng are known.
  // The client passes lat/lng from Google Places autocomplete when available.
  // Non-fatal: a coordinate write failure never blocks the quote response.
  if (propertyId && typeof lat === "number" && typeof lng === "number") {
    const db = supabaseAdmin ?? supabase;
    void Promise.resolve(db.from("properties").update({ lat, lng }).eq("id", propertyId)).catch(() => {});
  }

  return res.json({
    ok: true,
    normalizedAddress: result.normalizedAddress,
    county: result.county,
    apn: result.apn,
    acreage: result.acreage,
    acreageSource: result.acreageSource,
    confidence: result.confidence,
    quote,
    cached: result.cached,
  });
});

export default router;
