# Phase 5 — Set Netlify Environment Variables

**Status:** ✅ **COMPLETE** — both Google Maps env vars set in the
`production` context.

## 1. Linked site confirmed

| | |
|---|---|
| User | Richard Viramontes (rich.viramontes22@gmail.com) |
| Project | `teal-profiterole-096187` |
| Project URL | https://nomoremosquitoes.us |
| Project ID | 16a26e35-d0c9-41ad-89c0-7f3deb9d227e |

## 2. Commands run

```sh
npx netlify env:set GOOGLE_MAPS_SERVER_KEY "<value>" --context production
npx netlify env:set VITE_GOOGLE_MAPS_BROWSER_KEY "<value>" --context production
```

Both values were piped in via shell variable substitution from local temp
files (themselves populated directly from `gcloud ... get-key-string`,
output redirected, never printed) — the key values never appeared in any
tool output, report, or chat message. Both commands exited 0.

## 3. Verification

```sh
$ npx netlify env:get GOOGLE_MAPS_SERVER_KEY --context production | wc -c
40
$ npx netlify env:get VITE_GOOGLE_MAPS_BROWSER_KEY --context production | wc -c
40
```

40 bytes = 39-character Google API key + trailing newline — the expected
length for a Google Maps Platform key. Confirms both values are set
correctly **without ever printing them**.

```sh
$ npx netlify env:list --context production --json | grep -oE '"[A-Za-z_][A-Za-z0-9_]*":'
GOOGLE_MAPS_SERVER_KEY
PING_MESSAGE
REGRID_API_KEY
RESEND_API_KEY
RESEND_FROM_EMAIL
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
SUPABASE_SERVICE_ROLE_KEY
VITE_GOOGLE_MAPS_BROWSER_KEY
VITE_PUBLIC_BUILDER_KEY
VITE_STRIPE_PUBLISHABLE_KEY
VITE_SUPABASE_ANON_KEY
VITE_SUPABASE_URL
```

(Names extracted via `grep -oE '"[A-Za-z_]+":'` so only key names — never
values — are ever captured, even with `--json`.) Production now has **13**
env vars, up from 11; both new Google Maps vars are present.

> ⚠️ Note: `GOOGLE_MAPS_SERVER_KEY` and `VITE_GOOGLE_MAPS_BROWSER_KEY` were
> set with `--context production` only, so they do **not** appear in the
> default `npx netlify env:list` (which resolves the `dev` context). This is
> expected — `--context production` is exactly what the spec calls for.

## Status against Phase 5 checklist

| Item | Status |
|---|---|
| Netlify CLI connected / site linked | ✅ |
| `GOOGLE_MAPS_SERVER_KEY` set (production context) | ✅ |
| `VITE_GOOGLE_MAPS_BROWSER_KEY` set (production context) | ✅ |
| Values verified without being printed | ✅ (byte-length + name-only listing) |

Next: [GOOGLE_LOCAL_ENV_REPORT.md](./GOOGLE_LOCAL_ENV_REPORT.md) (Phase 6).
