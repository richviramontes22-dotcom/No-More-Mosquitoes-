# Report 11 — Promotional Popup Customer Display

**Sprint:** Customer-Facing Flow Cleanup + Promo Popup System  
**Phase:** 11  
**Date:** 2026-07-13  
**Status:** COMPLETE

---

## Files Created / Modified

### New: `client/components/promotions/PromotionalPopup.tsx`

Customer-facing popup modal, mounted in `MainLayout` so it appears on all public pages.

**Fetch trigger:** `useEffect` on `pathname` change. On each route transition:
1. Checks if path is blocked (never shows on `/onboarding`, `/legal-acceptance`, `/legal`,
   `/reset-password`, `/dashboard/billing`, `/dashboard/marketplace`).
2. Fetches `GET /api/promotional-popups/active?path=${pathname}`.
3. Filters by audience client-side using `useAuth()` + `useProfile()`.
4. Checks dismissal state via `isDismissed()`.
5. If all checks pass: sets popup data, then shows modal after an 800ms delay so the page
   renders before the popup appears.

**Audience filtering (client-side):**
```tsx
const isLoggedIn = !!user;
const isCustomer = isLoggedIn && profile?.role === "customer";
if (p.audience === "public" && isLoggedIn) return;     // logged-in users skip "public only"
if (p.audience === "logged_in" && !isLoggedIn) return; // guests skip "logged-in only"
if (p.audience === "customers" && !isCustomer) return; // non-customers skip "customers only"
// "all" and "logged_out" (= public) always pass
```

`useProfile()` fix: changed destructuring from `{ profile }` (wrong — hook returns
`UseQueryResult`) to `{ data: profile }` (correct).

**Dismissal storage:**

| Frequency | Mechanism |
|-----------|-----------|
| `once_per_session` | `sessionStorage` marker + `localStorage` "session" flag |
| `once_per_day` | `localStorage` ISO date string (YYYY-MM-DD) |
| `always` | Never dismissed (re-shows on every route change) |

**Modal layout:**
- Fixed fullscreen backdrop (`z-50`, `backdrop-blur-sm`) — click dismisses
- Centered card (`max-w-md`, `rounded-[24px]`, `shadow-2xl`)
- Optional header image (`h-44 object-cover`)
- Title + subtitle + body
- Primary CTA button + secondary CTA button (each routes internally or opens external tab)
- "No thanks, dismiss" text link
- Escape key dismisses

**CTA navigation:**
- URLs starting with `http://` / `https://` → `window.open(..., "_blank", "noopener,noreferrer")`
- All other URLs → `navigate(url)` (React Router internal navigation)
- Dismiss fires before navigation so popup doesn't flash on the destination

**Accessibility:**
- `role="dialog"`, `aria-modal="true"`, `aria-labelledby="promo-popup-title"`
- Dismiss button has `aria-label="Dismiss promotion"`
- Backdrop has `aria-hidden="true"`
- Focus-visible ring on dismiss and "no thanks" controls

### Modified: `client/components/layout/MainLayout.tsx`

```tsx
import PromotionalPopup from "../promotions/PromotionalPopup";
// ...
<PromotionalPopup />  // added before closing </div>
```

Renders once at the layout level — one fetch per route change, not per component mount.

---

## TypeScript Fix

`useProfile()` returns `UseQueryResult<Profile, Error>`. Changed:

```tsx
// Before (error: Property 'profile' does not exist on type 'UseQueryResult<Profile, Error>')
const { profile } = useProfile();

// After
const { data: profile } = useProfile();
```

The `profile` variable is typed `Profile | undefined` (undefined when not logged in or not yet
loaded). The audience checks handle `undefined` safely via optional chaining and `??`.

---

## Error Handling

Fetch errors are caught and silently ignored (`catch { /* non-critical */ }`). A failing popup
fetch never surfaces to the user or breaks any other flow. The `cancelled` flag prevents
stale fetch results from showing after a route change.
