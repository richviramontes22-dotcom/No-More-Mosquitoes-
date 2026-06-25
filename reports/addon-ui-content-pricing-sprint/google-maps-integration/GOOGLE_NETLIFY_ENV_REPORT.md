# Netlify Environment Variables Report

**Date:** 2026-06-13
**Status:** ✅ Netlify CLI is connected (`npx netlify status` →
project `teal-profiterole-096187`, https://nomoremosquitoes.us, user
`rich.viramontes22@gmail.com`) — the `netlify env:set` commands below are now
the **primary, automatable path** for this phase. Confirmed via
`npx netlify env:list` that the current 11 production env vars do **not**
yet include `GOOGLE_MAPS_SERVER_KEY` or `VITE_GOOGLE_MAPS_BROWSER_KEY`.

**This phase remains blocked only on the upstream key *values*** — Phase 2
(creating the two Google API keys in `no-more-mosquitos`) still requires
`gcloud auth login`, an interactive browser OAuth flow
([GOOGLE_CLOUD_SETUP_REPORT.md](./GOOGLE_CLOUD_SETUP_REPORT.md)). Once those
key values exist (from the Console steps in
[GOOGLE_API_KEY_MANUAL_STEPS.md](./GOOGLE_API_KEY_MANUAL_STEPS.md), or via
`gcloud alpha services api-keys create` after authenticating), run:

```sh
npx netlify env:set GOOGLE_MAPS_SERVER_KEY "<server key value>" --context production
npx netlify env:set VITE_GOOGLE_MAPS_BROWSER_KEY "<browser key value>" --context production
npx netlify env:list   # verify both now present (values masked)
```

No `netlify link` step is needed — `netlify.toml` + the already-linked
project (`teal-profiterole-096187`) make this repo's CLI calls resolve to the
right site automatically (confirmed by `npx netlify status` above).

---

## Manual steps (Netlify Console) — alternative if you prefer the UI

1. Go to **app.netlify.com** → select the **No More Mosquitoes** site.
2. **Site configuration → Environment variables → Add a variable**.
3. Add variable 1:
   - **Key:** `GOOGLE_MAPS_SERVER_KEY`
   - **Value:** *(the server geocoding key from Phase 2)*
   - **Scopes:** all (or at least "Functions" + "Builds" — this is read by
     `server/services/parcel/googleAddressService.ts` at request time inside
     the Netlify Function)
   - **Deploy contexts:** Production (add Preview/Branch deploys too if you
     want Google geocoding tested on preview deploys — otherwise those will
     transparently use the Nominatim fallback, which is safe)
4. Add variable 2:
   - **Key:** `VITE_GOOGLE_MAPS_BROWSER_KEY`
   - **Value:** *(the browser Places key from Phase 2)*
   - **Scopes:** Builds (Vite inlines `VITE_`-prefixed vars **at build time**,
     so this must be available during `npm run build`, not just at runtime)
   - **Deploy contexts:** same as above
5. **Trigger a new deploy** — env var changes only take effect on the *next*
   build/deploy, not retroactively.

### ⚠️ Naming check (critical)

| Variable | Prefix | Exposed to browser? |
|---|---|---|
| `GOOGLE_MAPS_SERVER_KEY` | none | **No** — server/Function only |
| `VITE_GOOGLE_MAPS_BROWSER_KEY` | `VITE_` | **Yes** — by design, restricted via HTTP referrers |

Do **not** add a `VITE_` prefix to the server key — doing so would bundle a
Geocoding-API-restricted-but-otherwise-unrestricted key into the public JS
bundle. The existing `.env.example` already documents both names correctly
(`GOOGLE_MAPS_SERVER_KEY` / `VITE_GOOGLE_MAPS_BROWSER_KEY`), and the code in
Phase 4–7 reads exactly these two names — no code changes needed if you use
these exact variable names.

---

## Local development

Add both keys to your local `.env` (already has placeholder lines, currently
blank):

```
GOOGLE_MAPS_SERVER_KEY=<server key value>
VITE_GOOGLE_MAPS_BROWSER_KEY=<browser key value>
```

Restart `npm run dev` after editing `.env` — Vite only reads env files at
startup.

**Leaving both blank (current state) is safe** — this is exactly the
"Google fails or is unavailable" case the code is designed to handle: backend
geocoding falls back to Nominatim, and the frontend autocomplete component
falls back to plain manual text entry (see Phase 5/6 reports).

---

## Status against Phase 3 checklist

| Item | Status |
|---|---|
| Netlify CLI available | ✅ Connected via `npx netlify` (no global install needed) |
| `GOOGLE_MAPS_SERVER_KEY` set in Netlify | ❌ Not set — blocked on Phase 2 key value (`gcloud auth login`, human auth) |
| `VITE_GOOGLE_MAPS_BROWSER_KEY` set in Netlify | ❌ Not set — blocked on Phase 2 key value (same) |
| Env var names verified against code | ✅ `.env.example` and code (Phase 4–7) use exactly `GOOGLE_MAPS_SERVER_KEY` / `VITE_GOOGLE_MAPS_BROWSER_KEY` |
| `netlify env:set` commands documented | ✅ above — ready to run as soon as key values exist |
| Manual Console steps documented (alternative) | ✅ above |
