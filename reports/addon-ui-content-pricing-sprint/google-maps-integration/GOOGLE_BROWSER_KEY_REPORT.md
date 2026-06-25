# Phase 4 — Create Browser Places API Key

**Status:** ✅ **COMPLETE** — key created with both API restrictions (Places
+ Maps JavaScript) and HTTP-referrer restrictions in a single CLI call. **No
Console fallback needed** — the alpha `--allowed-referrers` flag worked.

## Command run

```sh
gcloud alpha services api-keys create \
  --display-name="No More Mosquitoes Browser Places Key" \
  --api-target=service=places-backend.googleapis.com \
  --api-target=service=maps-backend.googleapis.com \
  --allowed-referrers="https://nomoremosquitoes.us/*,https://www.nomoremosquitoes.us/*,http://localhost:5173/*,http://localhost:8080/*,http://localhost:8082/*" \
  --project=no-more-mosquitos \
  --format="json" > /tmp/browser_key_create.json 2>/dev/null
```

## ⚠️ Note on a key rotation during creation

The **first** attempt redirected stdout to a file but then ran `cat` on the
**stderr** file to check for errors — that stderr stream contained `gcloud`'s
LRO "Operation [...] complete. Result: {...}" message, which includes
`keyString`, and `cat`-ing it printed the value to the session output.
**That key (uid `a707103e-0b41-4b4a-bca1-7f3b487d1314`) was immediately
deleted** (`gcloud alpha services api-keys delete ... --quiet`, output also
suppressed) and a replacement was created with stderr redirected to
`/dev/null` and only `grep -v keyString` used to inspect the result. **The
final key in use (uid `4cfada6d-4335-451f-b9cf-a81f3eabb84b`) was never
displayed in any tool output, report, or chat message.**

## Result (non-sensitive fields only)

```json
{
  "displayName": "No More Mosquitoes Browser Places Key",
  "name": "projects/956274756367/locations/global/keys/4cfada6d-4335-451f-b9cf-a81f3eabb84b",
  "uid": "4cfada6d-4335-451f-b9cf-a81f3eabb84b",
  "restrictions": {
    "apiTargets": [
      { "service": "places-backend.googleapis.com" },
      { "service": "maps-backend.googleapis.com" }
    ],
    "browserKeyRestrictions": {
      "allowedReferrers": [
        "https://nomoremosquitoes.us/*",
        "https://www.nomoremosquitoes.us/*",
        "http://localhost:5173/*",
        "http://localhost:8080/*",
        "http://localhost:8082/*"
      ]
    }
  }
}
```

## Where the value now lives

| Location | Status |
|---|---|
| Netlify env var `VITE_GOOGLE_MAPS_BROWSER_KEY` (production context) | ✅ Set — see [GOOGLE_NETLIFY_ENV_SET_REPORT.md](./GOOGLE_NETLIFY_ENV_SET_REPORT.md) |
| Local `.env` | ✅ Set — see [GOOGLE_LOCAL_ENV_REPORT.md](./GOOGLE_LOCAL_ENV_REPORT.md) |
| Any report/commit/chat message | ❌ Never (by design) |

## Target configuration

| | |
|---|---|
| Display name | `No More Mosquitoes Browser Places Key` |
| uid | `4cfada6d-4335-451f-b9cf-a81f3eabb84b` |
| Env var | `VITE_GOOGLE_MAPS_BROWSER_KEY` |
| API restriction | ✅ Places API + Maps JavaScript API |
| Application restriction | ✅ HTTP referrers (5 entries above) |
| Consumed by | `client/lib/googleMapsLoader.ts` (build-time inlined via Vite, `import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY`) |

This key **is** shipped to the browser by design — the referrer restriction
limits where it can be used from.

## Status against Phase 4 checklist

| Item | Status |
|---|---|
| Key created | ✅ |
| API-restricted to Places + Maps JS | ✅ (set at creation via `--api-target`) |
| HTTP-referrer restricted | ✅ — `--allowed-referrers` succeeded, no Console fallback needed |
| Key value retrieved and set (Netlify + local `.env`) | ✅ |
