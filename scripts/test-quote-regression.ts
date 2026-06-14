import "dotenv/config";
import { geocodeAddress } from "../server/services/parcel/googleAddressService";
import { lookupParcel } from "../server/services/parcel/parcelLookupService";

const ADDRESSES: { label: string; address: string; zip: string; city: string; state: string }[] = [
  { label: "A: with Unit 31",      address: "22216 Caminito Escobedo, Unit 31", zip: "92692", city: "Laguna Hills", state: "CA" },
  { label: "B: without unit",      address: "22216 Caminito Escobedo",          zip: "92692", city: "Laguna Hills", state: "CA" },
  { label: "C1: #31 style",        address: "22216 Caminito Escobedo #31",      zip: "92692", city: "Laguna Hills", state: "CA" },
  { label: "C2: Apt 31 style",     address: "22216 Caminito Escobedo Apt 31",   zip: "92692", city: "Laguna Hills", state: "CA" },
  { label: "C3: Unit 31 (no comma)", address: "22216 Caminito Escobedo Unit 31", zip: "92692", city: "Laguna Hills", state: "CA" },
  { label: "D1: known OC (Anaheim)", address: "100 Civic Center Dr",            zip: "92801", city: "Anaheim", state: "CA" },
  { label: "D2: known OC (Santa Ana)", address: "20 Civic Center Plaza",        zip: "92701", city: "Santa Ana", state: "CA" },
];

async function main() {
  console.log(`GOOGLE_MAPS_SERVER_KEY set: ${!!process.env.GOOGLE_MAPS_SERVER_KEY}`);
  console.log(`ENABLE_PARCEL_COUNTY_LOOKUP: ${process.env.ENABLE_PARCEL_COUNTY_LOOKUP ?? "(default true)"}`);
  console.log("=".repeat(80));

  for (const { label, address, zip, city, state } of ADDRESSES) {
    console.log(`\n--- ${label} ---`);
    console.log(`Input: "${address}", ${city}, ${state} ${zip}`);

    // 1. Geocoding only
    const geo = await geocodeAddress(address, zip, city, state, 8000);
    if (geo) {
      console.log(`Geocode: OK lat=${geo.lat}, lng=${geo.lng}`);
      console.log(`  normalizedAddress="${geo.normalizedAddress}"`);
    } else {
      console.log(`Geocode: NULL (no result)`);
    }

    // 2. Full lookupParcel flow
    try {
      const result = await lookupParcel({ address, zip, city, state });
      if ("errorCode" in result) {
        console.log(`lookupParcel: ERROR ${result.errorCode} — "${result.message}"`);
      } else {
        console.log(`lookupParcel: OK county=${result.county} apn=${result.apn} acreage=${result.acreage} source=${result.acreageSource} confidence=${result.confidence} cached=${result.cached}`);
      }
    } catch (err: any) {
      console.log(`lookupParcel: THROWN ${err?.message}`);
    }
  }
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
