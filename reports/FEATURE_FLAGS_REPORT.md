# Feature Flags Report
**Date:** 2026-06-02
**Files:** `server/lib/featureFlags.ts`, `client/lib/featureFlags.ts`

---

## All Flags, Defaults, and Enforcement

| Flag | Default | Safe if OFF | Enforced In |
|------|---------|-------------|-------------|
| `ENABLE_INLINE_PAYMENT` | `true` | Booking flow disabled | `server/lib/featureFlags.ts` (future gate) |
| `ENABLE_REMINDER_EMAILS` | `true` | No emails sent | `reminderScheduler.ts` |
| `REMINDER_DRY_RUN` | `false` | Sends real emails | `reminderScheduler.ts` |
| `ENABLE_PARCEL_COUNTY_LOOKUP` | `true` | Falls back to manual review | `parcelLookupService.ts` (future gate) |
| `ENABLE_REGRID_FALLBACK` | `false` | No Regrid API calls | `parcelLookupService.ts` (future gate) |
| `ENABLE_WORKFORCE_VALIDATION` | `true` | No validation on publish | `adminRoutes.ts` (publish gate) |
| `ENABLE_ROUTE_PUBLISH_GATE` | `true` | Publish always succeeds | `adminRoutes.ts` (publish gate) |
| `ENABLE_ADMIN_DEBUG_PANEL` | `false` | Debug page returns 403 | `adminDebug.ts` + `client/lib/featureFlags.ts` |
| `ENABLE_VERBOSE_CHECKPOINTS` | `false` | Checkpoints at debug only | `checkpoint.ts` + `logger.ts` |

---

## Safe Default Policy

- **Default `true`**: Flags that enable features that should work in production
- **Default `false`**: Flags that enable optional, costly, or verbose behavior
- **Never default to a dangerous state**: `REMINDER_DRY_RUN` defaults to `false` (real sends) in production — this is the expected production behavior. Set to `true` in staging to test without sending.

---

## How to Set Flags

**Local development (`.env`):**
```
REMINDER_DRY_RUN=true
ENABLE_VERBOSE_CHECKPOINTS=true
ENABLE_ADMIN_DEBUG_PANEL=true
ENABLE_REGRID_FALLBACK=false
```

**Production (Netlify Dashboard → Environment Variables):**
```
REMINDER_DRY_RUN=false        # send real emails
ENABLE_REGRID_FALLBACK=false  # cost control
ENABLE_ADMIN_DEBUG_PANEL=false  # hide debug page
ENABLE_VERBOSE_CHECKPOINTS=false  # reduce log volume
```

---

## Client-Side Flags

Client flags only read `VITE_`-prefixed variables (bundled at build time). They cannot read server-side operational flags.

| Flag | Variable | Default |
|------|----------|---------|
| `adminDebugPanel` | `VITE_ENABLE_ADMIN_DEBUG_PANEL` | `false` |
| `devTools` | `import.meta.env.DEV` | `true` in dev, `false` in prod |

To show the debug panel link in the admin nav (without the feature flag): the Debug page is always registered as a route at `/admin/debug`. The route is accessible to admins regardless of flag. The `ENABLE_ADMIN_DEBUG_PANEL=false` flag makes the API return 403 in production — the page renders an error state.

---

## Deployment Notes

1. **Do not set `REMINDER_DRY_RUN=true` in production** unless deliberately testing
2. **`ENABLE_REGRID_FALLBACK=false` is the correct production setting** — Regrid costs money per call and is not needed for normal operation
3. **`ENABLE_ADMIN_DEBUG_PANEL=false` in production** — debug panel exposes provider config status
4. **Flags are read at call time** (functions, not constants) — changing env vars takes effect without code deploy on most platforms
