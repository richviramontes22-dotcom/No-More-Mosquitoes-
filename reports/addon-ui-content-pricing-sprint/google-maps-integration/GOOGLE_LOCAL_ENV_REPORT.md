# Phase 6 — Optional Local `.env` Setup

**Status:** ✅ **COMPLETE** — user approved; both keys added to local `.env`.

## 1. Local `.env` exists and is gitignored

- `c:\Users\elija\OneDrive\Desktop\NMM2\.env` exists, gitignored via:
  ```
  .env
  .env.*
  !.env.example
  ```

## 2. `.env.example` already documents the two Google Maps vars (from prior sprint)

```
# ─── Parcel Acreage Lookup (county GIS adapters — cache-first) ────────────────
# Google Maps server key (backend geocoding — never expose to browser)
GOOGLE_MAPS_SERVER_KEY=

# Google Maps browser key (frontend Places Autocomplete — restrict by domain in GCP)
VITE_GOOGLE_MAPS_BROWSER_KEY=
```

No changes needed — this is a committed template with empty placeholders, as
intended.

## 3. User approval obtained, then both keys appended to local `.env`

Per spec ("ask before writing keys"), the user was asked explicitly and chose
**"Yes, add both to .env"**. Both values were appended directly from the
local temp files created during Phases 3–4 (`gcloud ... get-key-string`
output, never printed) via:

```sh
printf '\n# ─── Parcel Acreage Lookup ... ────────────────\n# Google Maps server key (backend geocoding — never expose to browser)\nGOOGLE_MAPS_SERVER_KEY=%s\n\n# Google Maps browser key (frontend Places Autocomplete — restrict by domain in GCP)\nVITE_GOOGLE_MAPS_BROWSER_KEY=%s\n' "$(cat /tmp/server_key.txt)" "$(cat /tmp/browser_key.txt)" >> .env
rm -f /tmp/server_key.txt /tmp/browser_key.txt
```

Verified by checking variable **names** only:

```sh
$ grep -oE '^[A-Z_]+=' .env | tail -2
GOOGLE_MAPS_SERVER_KEY=
VITE_GOOGLE_MAPS_BROWSER_KEY=
```

`.env` remains untracked by git (confirmed via `.gitignore` above) — values
were never printed in any tool output, report, or chat message.

## Effect on local dev

With both vars now present in local `.env`, `npm run dev` will:
- Use **Google Geocoding first** (falling back to Nominatim only on error) —
  `server/services/parcel/googleAddressService.ts`.
- Load the **Google Places Autocomplete** script and render the autocomplete
  dropdown in `QuoteWidgetSection`, `AddressCheckerSection`, and
  `AddPropertyDialog` — `client/lib/googleMapsLoader.ts`.

## Live validation with the new key (done)

Re-ran `npx tsx scripts/test-quote-regression.ts` with the new `.env` —
`GOOGLE_MAPS_SERVER_KEY set: true`, all 7 addresses geocoded successfully.

A second, targeted one-off check (`geocodeAddress("20 Civic Center Plaza",
"92701", "Santa Ana", "CA", 8000)`, temp script created and deleted
immediately after) confirmed:

```json
{"source":"google","placeId":"ChIJY1lMZqrZ3IARJevsVsQxn54","locationType":"GEOMETRIC_CENTER","lat":33.7490199,"lng":-117.8747314}
```

**`source: "google"`** — the new server key works end-to-end for real
Geocoding API requests, returning a real `placeId` and `locationType`. This
directly confirms Phase 9 Q9 (backend Google geocoding) with live evidence,
not just code review.

The autocomplete dropdown (browser key, `VITE_GOOGLE_MAPS_BROWSER_KEY`)
requires a running dev server + browser interaction — not exercised this
session, but the key itself is confirmed valid (correct length, Places +
Maps JS + referrer restrictions applied per
[GOOGLE_BROWSER_KEY_REPORT.md](./GOOGLE_BROWSER_KEY_REPORT.md)).

## Status against Phase 6 checklist

| Item | Status |
|---|---|
| Local `.env` existence checked | ✅ |
| `.env.example` placeholders present | ✅ (prior sprint) |
| User asked before writing real values | ✅ |
| Real key values written to `.env` | ✅ |
| `.env` remains gitignored | ✅ |
