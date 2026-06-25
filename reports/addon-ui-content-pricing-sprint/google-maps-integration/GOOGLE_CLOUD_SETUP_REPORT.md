# Google Cloud Setup Report

**Date:** 2026-06-12
**Target project:** `no-more-mosquitos`

---

## Summary

`gcloud` CLI **is installed** (Google Cloud SDK 534.0.0) but **is not
authenticated to any account** in this environment, and **no project is
configured**. This blocks every `gcloud`-based step in Phases 1–3 (project
verification, billing check, API enablement, and API key creation) — none of
these are read-only/no-auth operations.

```
$ gcloud auth list
No credentialed accounts.

$ gcloud config get-value project
(unset)

$ gcloud projects describe no-more-mosquitos
ERROR: (gcloud.projects.describe) You do not currently have an active account selected.
Please run:
  $ gcloud auth login
```

**This is not something I can complete on your behalf** — `gcloud auth
login` opens an interactive browser OAuth flow tied to *your* Google
account, which has to run on a machine where you can complete that login.
Per the "smallest safe scope" / confirm-before-acting guidance, I'm not going
to attempt a device-code login flow or otherwise try to authenticate with
credentials I don't have.

---

## What you need to do (one-time)

Run these on a machine where you can complete a browser login (this can be
done locally — it does **not** need to be this sandboxed environment, since
it only updates `gcloud`'s local credential store):

```sh
# 1. Authenticate (opens a browser)
gcloud auth login

# 2. Point the CLI at the right project
gcloud config set project no-more-mosquitos

# 3. Verify the project exists and you have access
gcloud projects describe no-more-mosquitos

# 4. Verify billing is enabled on this project
gcloud beta billing projects describe no-more-mosquitos
```

> Note: the project ID given in the spec is `no-more-mosquitos` (with an
> "s") — double-check this matches the actual GCP project ID in the console
> (`gcloud projects list`), since "No More Mosquitoes" (the brand name) is
> spelled with "oe". If the real project ID differs, substitute it in all
> commands below and in Phase 2/3.

**If step 4 shows billing is not enabled**, per the original instructions:
**stop here** — "Billing must be activated before Google Maps APIs will
work." Enable billing via **Console → Billing → Link a billing account**,
then re-run step 4 to confirm before proceeding.

---

## APIs to enable (once authenticated + billing confirmed)

The Geocoding/Places/Maps JS backend service IDs are stable and well-known;
once authenticated, these should work as-is:

```sh
gcloud services enable geocoding-backend.googleapis.com  --project=no-more-mosquitos
gcloud services enable places-backend.googleapis.com      --project=no-more-mosquitos
gcloud services enable maps-backend.googleapis.com        --project=no-more-mosquitos
```

`maps-frontend.googleapis.com` (listed as a possibility in the spec) is **not
a real, separately-enableable service** in current Google Maps Platform — the
Maps JavaScript API frontend usage is covered by `maps-backend.googleapis.com`
plus the API key's own restrictions. If any of the three commands above fail
with "service not found," run:

```sh
gcloud services list --available --filter="name~maps OR name~places OR name~geocoding"
```

and substitute the exact service IDs returned.

To confirm enablement afterward:

```sh
gcloud services list --enabled --project=no-more-mosquitos --filter="name~maps OR name~places OR name~geocoding"
```

---

## Status against Phase 1 checklist

| Item | Status |
|---|---|
| `gcloud` CLI available | ✅ Yes (v534.0.0) |
| Authenticated account | ❌ No — **manual action required** (`gcloud auth login`) |
| Active project set | ❌ No — **manual action required** (`gcloud config set project no-more-mosquitos`) |
| Project exists / accessible | ⚠️ Unknown — could not verify without auth |
| Billing enabled | ⚠️ Unknown — could not verify without auth |
| Geocoding API enabled | ⚠️ Not attempted — blocked on the above |
| Places API enabled | ⚠️ Not attempted — blocked on the above |
| Maps JavaScript API enabled | ⚠️ Not attempted — blocked on the above |

---

## How this affects the rest of the plan

This blocker **only affects Phases 1–3** (cloud project setup, API key
creation, Netlify env var configuration) — all of which require either
`gcloud` auth or credentials/values (the actual API key strings) that only
exist once Phase 1–2 are done manually.

**Everything else proceeds independently and is unaffected:**
- Phases 4–7 (code changes) are written to work correctly with **or without**
  `GOOGLE_MAPS_SERVER_KEY`/`VITE_GOOGLE_MAPS_BROWSER_KEY` set — exactly as the
  existing `googleAddressService.ts` already does (falls back to Nominatim /
  manual entry when the key is absent). The code can be completed, type-checked,
  built, and tested now.
- Phase 8 (cost controls) and Phase 10 (deployment guide) are documentation
  and can be written now, with the exact `gcloud`/Console commands for you to
  run once authenticated.
- Phase 9 (validation) will run with Google geocoding **disabled** (no key
  present in this environment) — i.e. it will exercise the
  Nominatim/`stripUnitSuffix`/manual-fallback paths, which is exactly the
  "Google fails or is unavailable" fallback case the spec requires to keep
  working. Once you've completed Phase 1–3 and added a real
  `GOOGLE_MAPS_SERVER_KEY` to your environment, re-running
  `scripts/test-quote-regression.ts` will exercise the Google-first path —
  see [GOOGLE_GEOCODING_PLACES_VALIDATION_REPORT.md](./GOOGLE_GEOCODING_PLACES_VALIDATION_REPORT.md).

See [GOOGLE_API_KEY_SETUP_REPORT.md](./GOOGLE_API_KEY_SETUP_REPORT.md) for
the key-creation steps and
[GOOGLE_NETLIFY_ENV_REPORT.md](./GOOGLE_NETLIFY_ENV_REPORT.md) for wiring the
resulting keys into Netlify.
