# Phase 2 — Enable Required Google APIs

**Status:** ✅ **COMPLETE** — all three APIs enabled and verified.

## Commands run

```sh
$ gcloud services enable geocoding-backend.googleapis.com --project=no-more-mosquitos
Operation "operations/acat.p2-956274756367-fb9604fd-9351-4c4f-a360-5775a9530df4" finished successfully.

$ gcloud services enable places-backend.googleapis.com --project=no-more-mosquitos
Operation "operations/acat.p2-956274756367-66c449fe-0989-43ad-939c-0c44cf42b273" finished successfully.

$ gcloud services enable maps-backend.googleapis.com --project=no-more-mosquitos
Operation "operations/acat.p2-956274756367-fed9ae98-67d6-419a-a9bb-afe78a9cd558" finished successfully.
```

## Verification

```sh
$ gcloud services list --enabled --project=no-more-mosquitos --filter="name~maps OR name~places OR name~geocoding"
NAME                              TITLE
geocoding-backend.googleapis.com  Geocoding API
maps-backend.googleapis.com       Maps JavaScript API
places-backend.googleapis.com     Places API
```

All three APIs are enabled on project `no-more-mosquitos`.

## Status against Phase 2 checklist

| Item | Status |
|---|---|
| Geocoding API enabled | ✅ |
| Places API enabled | ✅ |
| Maps JavaScript API enabled | ✅ |
| Verified via `services list --enabled` | ✅ |

Next: [GOOGLE_SERVER_KEY_REPORT.md](./GOOGLE_SERVER_KEY_REPORT.md) (Phase 3).
