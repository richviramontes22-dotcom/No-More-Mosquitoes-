# Google API Key Setup Report

**Date:** 2026-06-12
**Status:** ⚠️ Not created — blocked on [GOOGLE_CLOUD_SETUP_REPORT.md](./GOOGLE_CLOUD_SETUP_REPORT.md) (gcloud not authenticated). Manual Console steps below are the recommended path regardless, since `gcloud alpha services api-keys` is in alpha and its key-restriction support is inconsistent across SDK versions.

This report documents the two keys the code (Phase 4–7) expects, and how to
create them. Exact step-by-step Console instructions are in
[GOOGLE_API_KEY_MANUAL_STEPS.md](./GOOGLE_API_KEY_MANUAL_STEPS.md) — use that
as the primary guide. The `gcloud alpha` equivalents are included below for
reference if you prefer the CLI once authenticated.

---

## 1. Server Geocoding Key

| | |
|---|---|
| Name (suggested) | `No More Mosquitoes Server Geocoding Key` |
| Env var | `GOOGLE_MAPS_SERVER_KEY` |
| Used by | `server/services/parcel/googleAddressService.ts` (server-side only) |
| API restriction | **Geocoding API** only |
| Application restriction | **None** (IP restriction optional — Netlify Functions don't have stable outbound IPs on the standard plan; leave unrestricted or use "None" unless you've set up a static egress IP) |
| Where it lives | Netlify **server-side** environment variable only — never `VITE_`-prefixed, never sent to the browser |

CLI equivalent (once authenticated):
```sh
gcloud alpha services api-keys create \
  --display-name="No More Mosquitoes Server Geocoding Key" \
  --api-target=service=geocoding-backend.googleapis.com \
  --project=no-more-mosquitos
```

## 2. Browser Places Key

| | |
|---|---|
| Name (suggested) | `No More Mosquitoes Browser Places Key` |
| Env var | `VITE_GOOGLE_MAPS_BROWSER_KEY` |
| Used by | `client/components/common/GoogleAddressAutocomplete.tsx` (browser-side) |
| API restriction | **Places API** + **Maps JavaScript API** |
| Application restriction | **HTTP referrers**: `https://nomoremosquitoes.us/*`, `https://www.nomoremosquitoes.us/*`, `http://localhost:5173/*`, `http://localhost:8080/*`, `http://localhost:8082/*` |
| Where it lives | Netlify environment variable **with** the `VITE_` prefix — this key IS shipped to the browser by design, but referrer restrictions limit where it can be used from |

CLI equivalent (once authenticated):
```sh
gcloud alpha services api-keys create \
  --display-name="No More Mosquitoes Browser Places Key" \
  --api-target=service=places-backend.googleapis.com \
  --api-target=service=maps-backend.googleapis.com \
  --allowed-referrers="https://nomoremosquitoes.us/*,https://www.nomoremosquitoes.us/*,http://localhost:5173/*,http://localhost:8080/*,http://localhost:8082/*" \
  --project=no-more-mosquitos
```

> `gcloud alpha services api-keys create` does not reliably support
> `--allowed-referrers` across all SDK versions in one shot — if it errors,
> create the key first (API-restricted only), then add the referrer
> restriction via the Console (`API restrictions` tab is more reliable via
> the CLI; `Application restrictions` → `HTTP referrers` is most reliably set
> via Console). [GOOGLE_API_KEY_MANUAL_STEPS.md](./GOOGLE_API_KEY_MANUAL_STEPS.md)
> covers this.

---

## Retrieving the key value

```sh
gcloud alpha services api-keys get-key-string KEY_ID --project=no-more-mosquitos
```

**Copy each key value directly into the Netlify environment variable** (see
[GOOGLE_NETLIFY_ENV_REPORT.md](./GOOGLE_NETLIFY_ENV_REPORT.md)) and into your
local `.env` for development. Per the sprint's instructions, key values are
not echoed in this report.

---

## Status against Phase 2 checklist

| Item | Status |
|---|---|
| Server geocoding key created | ❌ Not created — manual action required |
| Server key restricted to Geocoding API | ❌ Pending creation |
| Browser Places key created | ❌ Not created — manual action required |
| Browser key restricted to Places/Maps JS + referrers | ❌ Pending creation |
| Manual steps documented | ✅ [GOOGLE_API_KEY_MANUAL_STEPS.md](./GOOGLE_API_KEY_MANUAL_STEPS.md) |
