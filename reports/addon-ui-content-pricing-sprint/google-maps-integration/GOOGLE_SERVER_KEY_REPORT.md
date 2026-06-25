# Phase 3 — Create Server Geocoding API Key

**Status:** ✅ **COMPLETE** — key created, restricted to Geocoding API, value
set in Netlify (Phase 5) and local `.env` (Phase 6). **Value never printed in
any report or persisted file.**

## Commands run

```sh
gcloud alpha services api-keys create \
  --display-name="No More Mosquitoes Server Geocoding Key" \
  --api-target=service=geocoding-backend.googleapis.com \
  --project=no-more-mosquitos \
  --format="json" > /tmp/server_key_create.json 2>/tmp/server_key_create.err

gcloud alpha services api-keys get-key-string \
  projects/956274756367/locations/global/keys/22a11ce1-1461-4985-b226-f6a09d9db8dd \
  --format="value(keyString)" > /tmp/server_key.txt 2>/dev/null
```

An extra one-time prerequisite was needed beyond the original plan: the
**API Keys API** (`apikeys.googleapis.com`) itself was not enabled on
`no-more-mosquitos` and had to be enabled first
(`gcloud services enable apikeys.googleapis.com --project=no-more-mosquitos`)
before `api-keys create` would work. This is now reflected in
[GOOGLE_APIS_ENABLEMENT_REPORT.md](./GOOGLE_APIS_ENABLEMENT_REPORT.md).

## ⚠️ Note on a key rotation during creation

The **first** attempt at this command used
`--format="value(response.name,response.uid)"`, but `gcloud`'s long-running-
operation polling still printed the full `Result: {...}` JSON — including
`keyString` — to the session output before the `--format` filter was
applied. **That key (uid `ad5764d6-a66d-4e4a-94f5-25fa8bb90dff`) was
immediately deleted** (`gcloud alpha services api-keys delete ... --quiet`)
and a replacement was created using the file-redirect method above, whose
value was never printed anywhere. **The final key in use (uid
`22a11ce1-1461-4985-b226-f6a09d9db8dd`) was never displayed in any tool
output, report, or chat message.**

## Result (non-sensitive fields only)

```json
{
  "displayName": "No More Mosquitoes Server Geocoding Key",
  "name": "projects/956274756367/locations/global/keys/22a11ce1-1461-4985-b226-f6a09d9db8dd",
  "uid": "22a11ce1-1461-4985-b226-f6a09d9db8dd",
  "restrictions": {
    "apiTargets": [
      { "service": "geocoding-backend.googleapis.com" }
    ]
  }
}
```

## Where the value now lives

| Location | Status |
|---|---|
| Netlify env var `GOOGLE_MAPS_SERVER_KEY` (production context) | ✅ Set — see [GOOGLE_NETLIFY_ENV_SET_REPORT.md](./GOOGLE_NETLIFY_ENV_SET_REPORT.md) |
| Local `.env` | ✅ Set — see [GOOGLE_LOCAL_ENV_REPORT.md](./GOOGLE_LOCAL_ENV_REPORT.md) |
| Any report/commit/chat message | ❌ Never (by design) |

## Target configuration

| | |
|---|---|
| Display name | `No More Mosquitoes Server Geocoding Key` |
| uid | `22a11ce1-1461-4985-b226-f6a09d9db8dd` |
| Env var | `GOOGLE_MAPS_SERVER_KEY` |
| API restriction | **Geocoding API only** ✅ |
| Application restriction | None (Netlify Functions don't have a stable egress IP on the standard plan) |
| Consumed by | `server/services/parcel/googleAddressService.ts` (server-side `process.env.GOOGLE_MAPS_SERVER_KEY`) |

## Status against Phase 3 checklist

| Item | Status |
|---|---|
| Key created | ✅ |
| Key restricted to Geocoding API | ✅ |
| Key value retrieved and set (Netlify + local `.env`) | ✅ |
| Key handling rules followed (value never exposed in persisted artifacts) | ✅ — with a mid-flight rotation after an initial accidental console print, documented above |
