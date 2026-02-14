import { Router } from "express";

const router = Router();

const REGRID_API_KEY = process.env.REGRID_API_KEY;
const REGRID_API_BASE = "https://api.regrid.com/api/v2";

interface RegridParcel {
  acreage?: number;
  lot_area_sqft?: number;
}

interface RegridResponse {
  features?: Array<{
    properties?: RegridParcel;
  }>;
}

// Convert square feet to acres
const sqftToAcres = (sqft: number) => {
  return Math.round((sqft / 43560) * 100) / 100;
};

// Get parcel information by address
router.post("/parcel", async (req, res) => {
  try {
    if (!REGRID_API_KEY) {
      return res.status(501).json({ error: "Regrid API not configured" });
    }

    const { address, zip } = req.body;

    if (!address || !zip) {
      return res.status(400).json({ error: "Address and ZIP code required" });
    }

    // Search for parcels by address
    const searchQuery = encodeURIComponent(`${address}, ${zip}`);
    const response = await fetch(
      `${REGRID_API_BASE}/parcels/search?q=${searchQuery}&limit=1`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${REGRID_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      console.error("Regrid API error:", response.status, await response.text());
      return res.status(response.status).json({ error: "Failed to fetch parcel data" });
    }

    const data = (await response.json()) as RegridResponse;

    if (!data.features || data.features.length === 0) {
      // Fallback: try searching with just the address if zip failed, or vice versa
      // For now, just return 404
      return res.status(404).json({ error: "No parcel found for this address. Please enter square footage manually." });
    }

    const parcel = data.features[0].properties;
    if (!parcel) {
      return res.status(404).json({ error: "No parcel properties found for this address." });
    }

    // Try to get acreage or calculate from sqft
    // Regrid provides several fields that might contain area info
    let acreage = parcel.acreage;
    let sqft = parcel.lot_area_sqft;

    if (!acreage && sqft) {
      acreage = sqftToAcres(sqft);
    } else if (acreage && !sqft) {
      sqft = Math.round(acreage * 43560);
    }

    if (!acreage) {
      return res.status(404).json({ error: "Parcel found but acreage data is missing. Please enter square footage manually." });
    }

    return res.json({
      acreage: acreage,
      sqft: sqft,
    });
  } catch (error) {
    console.error("Regrid route error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
