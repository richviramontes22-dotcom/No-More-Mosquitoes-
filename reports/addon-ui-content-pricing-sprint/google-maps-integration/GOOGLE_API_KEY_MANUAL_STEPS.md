# Google API Key — Manual Console Steps

Use this if you'd rather not use `gcloud alpha` (which is in alpha and has
inconsistent flag support for key restrictions). All steps are in
[Google Cloud Console](https://console.cloud.google.com/).

**Prerequisite:** project `no-more-mosquitos` exists, billing is enabled, and
the Geocoding API, Places API, and Maps JavaScript API are enabled (see
[GOOGLE_CLOUD_SETUP_REPORT.md](./GOOGLE_CLOUD_SETUP_REPORT.md)). If the APIs
aren't enabled yet, do that first via **APIs & Services → Library** — search
for each API by name and click **Enable**.

---

## Key 1 — Server Geocoding Key (`GOOGLE_MAPS_SERVER_KEY`)

1. Go to **APIs & Services → Credentials**.
2. Click **+ Create Credentials → API key**.
3. A key is generated immediately — click **Edit API key** (or it opens
   automatically).
4. **Name:** `No More Mosquitoes Server Geocoding Key`
5. **Application restrictions:** select **None**.
   - (Netlify Functions don't have a fixed outbound IP on the standard
     plan, so IP restriction isn't practical. Relying on the *API
     restriction* below plus keeping this key server-side only is the
     correct control here.)
6. **API restrictions:** select **Restrict key**, then check **only**:
   - Geocoding API
7. Click **Save**.
8. Click the key to open it again, click the copy icon next to the key value.
9. Paste this value into:
   - Your local `.env` as `GOOGLE_MAPS_SERVER_KEY=...`
   - Netlify env vars as `GOOGLE_MAPS_SERVER_KEY` (server-side, **no** `VITE_`
     prefix — see [GOOGLE_NETLIFY_ENV_REPORT.md](./GOOGLE_NETLIFY_ENV_REPORT.md))

---

## Key 2 — Browser Places Key (`VITE_GOOGLE_MAPS_BROWSER_KEY`)

1. **APIs & Services → Credentials → + Create Credentials → API key**.
2. **Name:** `No More Mosquitoes Browser Places Key`
3. **Application restrictions:** select **Websites** (HTTP referrers), then
   **Add an item** for each of:
   - `https://nomoremosquitoes.us/*`
   - `https://www.nomoremosquitoes.us/*`
   - `http://localhost:5173/*`
   - `http://localhost:8080/*`
   - `http://localhost:8082/*`
4. **API restrictions:** select **Restrict key**, then check:
   - Places API
   - Maps JavaScript API
5. Click **Save**.
6. Copy the key value and paste into:
   - Local `.env` as `VITE_GOOGLE_MAPS_BROWSER_KEY=...`
   - Netlify env vars as `VITE_GOOGLE_MAPS_BROWSER_KEY` (note the `VITE_`
     prefix — this one IS exposed to the browser by design; the referrer
     restriction above is what limits abuse)

---

## Verifying

- After saving, **Credentials** should list both keys with their restriction
  badges visible ("Geocoding API" for key 1; "2 APIs" + the referrer list
  icon for key 2).
- Test key 1 with a direct curl (replace `YOUR_KEY`):
  ```sh
  curl "https://maps.googleapis.com/maps/api/geocode/json?address=22216+Caminito+Escobedo,+Laguna+Hills,+CA+92692&key=YOUR_KEY"
  ```
  Expect `"status": "OK"` with a `results` array.
- Test key 2 is referrer-restricted by trying the same Geocoding-style call
  with key 2 — it should fail with `REQUEST_DENIED` (since key 2 isn't
  authorized for the Geocoding API). This confirms the API restriction is
  working as intended.

---

## Common pitfalls

- **Forgetting the `VITE_` prefix mismatch.** `GOOGLE_MAPS_SERVER_KEY` must
  **not** have a `VITE_` prefix (it would otherwise be bundled into the
  client JS and exposed). `VITE_GOOGLE_MAPS_BROWSER_KEY` **must** have it
  (Vite only exposes `VITE_`-prefixed env vars to client code — see
  `vite.config.ts`).
- **Referrer format.** Google matches referrers as prefixes with wildcard
  `*` support — `https://nomoremosquitoes.us/*` covers all paths on that
  exact host but **not** `www.` or `http://` variants, which is why both the
  apex and `www` HTTPS origins are listed separately. There is no need to add
  a bare `http://nomoremosquitoes.us/*` since the site force-redirects HTTP →
  HTTPS (`netlify.toml`).
- **New keys can take a few minutes to start working** after creation —
  if a test call returns `API_KEY_INVALID` immediately after creating the
  key, wait ~5 minutes and retry before assuming something is misconfigured.
