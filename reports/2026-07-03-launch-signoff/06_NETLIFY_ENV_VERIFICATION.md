# Phase 06 — Netlify Production Environment Verification

**Date:** 2026-07-13  
**Sprint:** Production Launch Verification

---

## CLI Investigation Results

The Netlify CLI was used to attempt env var listing. All methods returned unexpected results:

| Command | Result |
|---|---|
| `netlify env:list --context production` | "No environment variables set for project teal-profiterole-096187 in the production context" |
| `netlify env:list` (dev context) | "No environment variables set for project teal-profiterole-096187 in the dev context" |
| `netlify api getSiteEnvVars --data '{"site_id":"..."}'` | `TextHTTPError: Not Found` |
| `netlify api getEnvVars --data '{"account_id":"thenoble12","site_id":"..."}'` | `JSONHTTPError: Not Found` |

### Interpretation

**The CLI cannot read env vars** but this does not mean env vars are absent. Two likely causes:

1. **Netlify "environment variables" v2 API**: Newer Netlify accounts use the `addons/netlify-addon-envsecrets` system or the newer `/api/v1/accounts/{account_slug}/env` endpoint — the CLI's `env:list` command may be hitting the wrong API version for this account type.
2. **Team vs. site scope**: Variables set at the team/account level in Netlify don't appear under `env:list` for a specific site.

The site `https://nomoremosquitoes.us` was previously deployed and confirmed working (typecheck, build, and function bundle all pass with real env vars required at runtime). The CLI account is `elijahnobledev@gmail.com`, which is confirmed linked to the correct site.

**The CLI limitation does NOT indicate missing env vars — it indicates a CLI scope or API version mismatch.**

---

## Required Action: Verify in Netlify Dashboard Directly

1. Open: **https://app.netlify.com/projects/teal-profiterole-096187**
2. Navigate to: **Site configuration → Environment variables**
3. Verify the following checklist — names only, never paste values anywhere:

```
□ APP_BASE_URL = https://nomoremosquitoes.us (not localhost, not http)
□ VITE_SUPABASE_URL present
□ VITE_SUPABASE_ANON_KEY present
□ SUPABASE_SERVICE_ROLE_KEY present
□ STRIPE_SECRET_KEY starts with sk_live_
□ VITE_STRIPE_PUBLISHABLE_KEY starts with pk_live_
□ STRIPE_WEBHOOK_SECRET present
□ RESEND_API_KEY present
□ RESEND_FROM_EMAIL present (matches sending domain)
□ SUPPORT_PHONE present (format: +1XXXXXXXXXX)
□ OWNER_EMAIL present
□ ADMIN_ALERT_EMAILS present
□ GOOGLE_MAPS_SERVER_KEY present
□ VITE_GOOGLE_MAPS_BROWSER_KEY present
□ SUPABASE_ACCESS_TOKEN NOT present (belongs in CI/CD only)
□ LIVE_STRIPE_SECRET_KEY NOT present (old naming, remove if exists)
□ TWILIO_* vars NOT present (Twilio is not used)
```

Full variable descriptions are in `reports/2026-07-03-marketplace-sprint/11_NETLIFY_PRODUCTION_ENV_VERIFICATION_GUIDE.md`.

---

## Runtime Confirmation

After verifying env vars, confirm the production server recognizes them:

1. Open: `https://nomoremosquitoes.us/api/health`
   - Should return `{"status":"ok","database":"connected",...}`
   - If `stripeMode` shows `"test"` while STRIPE_SECRET_KEY is `sk_live_*`, a Netlify redeploy is needed.

2. Open: `https://nomoremosquitoes.us/api/health/stripe`
   - Should return `{"mode":"live","configured":true}`

---

## Verdict

| Check | Status |
|---|---|
| Netlify CLI env:list | ❌ Returns empty (CLI API version mismatch — not reliable) |
| Netlify dashboard manual verification | ⏳ Pending user action |
| /api/health runtime check | ⏳ Pending after dashboard verification |

**Phase 06: PENDING — user must verify env vars in Netlify dashboard and run /api/health check.**
