# Phase 10 — Deployment Plan

## Status: ✅ Guide complete. Code is deployed already (it's part of `main`'s
working tree); only the **Google API setup** (Phases 1–3) remains as a manual
prerequisite, each step below marked CLI-first per the automation
requirement, with manual fallback steps and the *exact reason* CLI can't
finish the job.

This guide assumes you're starting from **today's state**: code complete,
typechecked, tested, and built (Phase 9); no Google API keys exist yet;
Netlify CLI is connected (`npx netlify status` → project
`teal-profiterole-096187`, https://nomoremosquitoes.us).

---

## Step 1 — Authenticate `gcloud` (manual — human auth required)

```sh
gcloud auth login
gcloud config set project no-more-mosquitos
gcloud projects describe no-more-mosquitos      # confirm access
gcloud beta billing projects describe no-more-mosquitos   # confirm billing is linked
```

**Why this can't be automated:** `gcloud auth login` opens an interactive
browser OAuth consent screen tied to *your* Google account
(`elijahnobledev@gmail.com` or whichever account owns `no-more-mosquitos`).
There is no service-account/CI credential configured in this environment
(`gcloud auth list` → "No credentialed accounts"), and creating one would
itself require Console access this session doesn't have. This satisfies
automation-requirement exception **#2 (requires human authentication)**.

**If billing is not linked**, stop here and link a billing account first
(Console → Billing → Link a billing account) — exception **#3 (billing
activation required)**. Every step below depends on billing being active.

---

## Step 2 — Enable the three Maps Platform APIs (CLI, ready to run)

```sh
gcloud services enable geocoding-backend.googleapis.com --project=no-more-mosquitos
gcloud services enable places-backend.googleapis.com     --project=no-more-mosquitos
gcloud services enable maps-backend.googleapis.com       --project=no-more-mosquitos

# verify
gcloud services list --enabled --project=no-more-mosquitos --filter="name~maps OR name~places OR name~geocoding"
```

No manual fallback needed — these are plain `gcloud services enable` calls
that work as soon as Step 1 is done.

---

## Step 3 — Create the two API keys

### Server Geocoding Key (CLI, ready to run)

```sh
gcloud alpha services api-keys create \
  --display-name="No More Mosquitoes Server Geocoding Key" \
  --api-target=service=geocoding-backend.googleapis.com \
  --project=no-more-mosquitos
```

### Browser Places Key (CLI attempt, manual fallback for referrer restriction)

```sh
gcloud alpha services api-keys create \
  --display-name="No More Mosquitoes Browser Places Key" \
  --api-target=service=places-backend.googleapis.com \
  --api-target=service=maps-backend.googleapis.com \
  --allowed-referrers="https://nomoremosquitoes.us/*,https://www.nomoremosquitoes.us/*,http://localhost:5173/*,http://localhost:8080/*,http://localhost:8082/*" \
  --project=no-more-mosquitos
```

**Why a manual fallback may be needed:** `gcloud alpha services api-keys
create --allowed-referrers` is an **alpha** flag and is inconsistently
supported across SDK versions (noted in
[GOOGLE_API_KEY_SETUP_REPORT.md](./GOOGLE_API_KEY_SETUP_REPORT.md)). If the
command above errors on `--allowed-referrers`, this is exception **#1 (CLI
support does not exist** for that specific sub-feature in your installed SDK
version) — create the key without that flag, then set the HTTP-referrer
restriction via Console:

1. **console.cloud.google.com** → select project `no-more-mosquitos`.
2. **APIs & Services → Credentials**.
3. Click the **"No More Mosquitoes Browser Places Key"** entry.
4. Under **Application restrictions**, select **HTTP referrers (web
   sites)**.
5. Add each of: `https://nomoremosquitoes.us/*`,
   `https://www.nomoremosquitoes.us/*`, `http://localhost:5173/*`,
   `http://localhost:8080/*`, `http://localhost:8082/*`.
6. Click **Save**.

### Retrieve both key values

```sh
gcloud alpha services api-keys list --project=no-more-mosquitos
gcloud alpha services api-keys get-key-string KEY_ID --project=no-more-mosquitos
```

---

## Step 4 — Set quotas (manual Console — CLI quota APIs are alpha/unreliable)

For each of the three APIs (Geocoding, Places, Maps JavaScript):

1. **console.cloud.google.com → APIs & Services → \<API name\> → Quotas**.
2. Find the **requests per day** quota.
3. Click the pencil/edit icon, set the new limit:
   - Geocoding API: **500/day**
   - Places API: **1,000/day**
   - Maps JavaScript API: **1,000/day**
4. Submit (large reductions may require a justification — these are
   *reductions* from Google's default high limits, so no review wait is
   expected).

**Why manual:** `gcloud alpha services quota` exists but operates on
"consumer quota overrides" via a verbose, per-metric API
(`services.consumers.quotaMetrics.limits`) that requires looking up exact
metric/limit resource names per API — far more error-prone than the Console's
quota editor for a one-time setup. This is exception **#1 (CLI support is
technically present but impractical/unreliable for this operation)**; full
rationale and the *why these caps are safe* analysis is in
[GOOGLE_MAPS_COST_CONTROL_REPORT.md](./GOOGLE_MAPS_COST_CONTROL_REPORT.md).

---

## Step 5 — Set a billing budget alert (manual Console)

1. **console.cloud.google.com → Billing → Budgets & Alerts → Create budget**.
2. Scope: project `no-more-mosquitos`.
3. Amount: **$10–$25/month** (beta tripwire — see Phase 8 for why this is
   far above expected usage).
4. Alert thresholds: 50%, 90%, 100% → email to your account.

**Why manual:** budget creation via `gcloud billing budgets create` requires
a `--billing-account` ID and a structured JSON filter, and is a one-time
low-frequency setup — Console is faster and less error-prone here (exception
**#1**, practicality).

---

## Step 6 — Set Netlify environment variables (CLI, ready to run)

Netlify CLI is connected (confirmed via `npx netlify status`). Once Step 3's
key values exist:

```sh
npx netlify env:set GOOGLE_MAPS_SERVER_KEY "<server key value>" --context production
npx netlify env:set VITE_GOOGLE_MAPS_BROWSER_KEY "<browser key value>" --context production
npx netlify env:list   # confirm both now appear (values masked)
```

Also add both to your local `.env` (for `npm run dev`):

```
GOOGLE_MAPS_SERVER_KEY=<server key value>
VITE_GOOGLE_MAPS_BROWSER_KEY=<browser key value>
```

---

## Step 7 — Deploy (CLI)

This repo auto-deploys on push to `main` (existing Netlify pipeline). To
trigger a deploy that picks up the new env vars without a code change:

```sh
npx netlify deploy --prod --build
```

(or push any commit to `main` — either triggers `npm run build:client && npm
run bundle:functions` per `netlify.toml`, which inlines
`VITE_GOOGLE_MAPS_BROWSER_KEY` into the client bundle at build time and makes
`GOOGLE_MAPS_SERVER_KEY` available to the Netlify Function at runtime).

---

## Step 8 — Production verification

1. Visit `https://nomoremosquitoes.us` and open the quote widget / address
   checker. Start typing a CA address — a Google Places suggestion dropdown
   should appear (confirms `VITE_GOOGLE_MAPS_BROWSER_KEY` loaded and
   `useGoogleMapsScript()` reached `"ready"`).
2. Select a suggestion → confirm the address/city/state/zip fields populate
   and the quote returns normally (Unit 31 from
   [GOOGLE_GEOCODING_PLACES_VALIDATION_REPORT.md](./GOOGLE_GEOCODING_PLACES_VALIDATION_REPORT.md)
   is a good repeat test — should still return `oversized:true`,
   `acreage:21.057`).
3. Open browser DevTools → Network tab → confirm no request ever sends
   `GOOGLE_MAPS_SERVER_KEY` (it shouldn't appear anywhere in client-side
   requests; only the `VITE_`-prefixed browser key appears in the
   `maps.googleapis.com/maps/api/js?key=...` request, which is expected and
   referrer-restricted).
4. Check Netlify Function logs (`npx netlify logs:function api` or via
   Console → Functions) for `"event":"parcel.geocode.success"` entries —
   `source` should now read `"google"` for new (non-cached) addresses,
   confirming Google is now primary.
5. Test an oversized/shared-parcel address (e.g. Unit 31) end-to-end through
   the UI — the manual unit-size panel should still appear.
6. Test an out-of-area address (e.g. a TX address) — the amber "couldn't
   auto-detect, enter manually" panel should still appear.

---

## Step 9 — Ongoing quota/cost monitoring

See [GOOGLE_MAPS_COST_CONTROL_REPORT.md](./GOOGLE_MAPS_COST_CONTROL_REPORT.md)
for the full breakdown. In short: check **Console → APIs & Services →
Dashboard** periodically for request volume, and watch for the budget alert
emails from Step 5. A sustained shift in Netlify Function logs from
`source:"google"` to `source:"nominatim"` is the earliest signal of a
key/quota problem.

---

## Rollback plan

This integration was built so rollback is **purely a config change — no code
revert needed**:

```sh
npx netlify env:unset GOOGLE_MAPS_SERVER_KEY --context production
npx netlify env:unset VITE_GOOGLE_MAPS_BROWSER_KEY --context production
npx netlify deploy --prod --build   # or push to main to redeploy
```

Effects, immediately after redeploy:

- **Backend**: `geocodeAddress()` (Phase 4) finds `GOOGLE_MAPS_SERVER_KEY`
  unset → `geocodeWithGoogle()` is skipped entirely → every request falls
  through to **Nominatim** (+ `stripUnitSuffix` retry), exactly as validated
  in Phase 9 with no key present.
- **Frontend**: `useGoogleMapsScript()` (Phase 5) finds
  `VITE_GOOGLE_MAPS_BROWSER_KEY` unset at build time → returns `"idle"` → the
  Maps script is never loaded → `GoogleAddressAutocomplete` renders as a
  plain `<Input>` with manual typing only, on all three forms
  (`QuoteWidgetSection`, `AddressCheckerSection`, `AddPropertyDialog`).
- **County GIS parcel lookup, acreage system, oversized/shared-parcel panel**:
  entirely untouched by this integration at any point — unaffected by
  rollback.
- **`parcel_lookup_cache`**: rows with a `place_id` simply become unreachable
  via that column going forward (cache lookups fall back to
  `address_hash`-only matching) — no data needs to be deleted.

If you additionally want to revert the **code** (not just config), the
Phase 4–7 commits are isolated to: `client/types/google-maps.d.ts`,
`client/lib/googleMapsLoader.ts`,
`client/components/common/GoogleAddressAutocomplete.tsx`,
`server/services/parcel/googleAddressService.ts`, and the three form
components' Autocomplete wiring — but **this should not be necessary**, since
the config-only rollback above fully restores pre-sprint behavior.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| No Autocomplete dropdown appears | `VITE_GOOGLE_MAPS_BROWSER_KEY` not set, or Maps JavaScript API not enabled | Check Step 2/Step 6; check browser console for a `Google Maps JavaScript API error` message (Google embeds the specific reason, e.g. `RefererNotAllowedMapError`, `ApiNotActivatedMapError`) |
| Dropdown appears but selecting a suggestion does nothing | `place_changed` listener fields mismatch (should not happen — `AUTOCOMPLETE_FIELDS` unchanged) | Check browser console for JS errors; verify `geometry.location` is present in the response |
| Backend still using Nominatim (`source:"nominatim"` in logs) for new addresses | `GOOGLE_MAPS_SERVER_KEY` not set, Geocoding API not enabled, or key restricted to wrong API | Check Step 2/3/6; test the key directly: `curl "https://maps.googleapis.com/maps/api/geocode/json?address=Anaheim,CA&key=KEY"` |
| `RefererNotAllowedMapError` in console | Browser key's HTTP-referrer restriction doesn't include the current origin | Step 3 — add the missing origin (e.g. a Netlify deploy-preview URL) to the allowed referrers |
| `OVER_QUERY_LIMIT` / `RESOURCE_EXHAUSTED` | Daily quota (Step 4) exceeded | Backend gracefully falls back to Nominatim (no user-visible failure); raise the quota in Console if legitimate traffic, or investigate for abuse |
| 403/`PERMISSION_DENIED` from Geocoding API | API not enabled for the project, or key is API-restricted to the wrong service | Step 2 (enable API) / Step 3 (check key's API restrictions) |
