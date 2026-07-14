# Report 08 — Promotional Popup System Design

**Sprint:** Customer-Facing Flow Cleanup + Promo Popup System  
**Phase:** 8  
**Date:** 2026-07-13  
**Status:** COMPLETE

---

## Objective

Design an admin-managed promotional popup system: DB schema, API surface, admin CRUD UI, and
customer-facing display component — all without breaking existing flows or weakening auth.

---

## System Overview

```
Admin creates/edits popup
      ↓
POST/PATCH /api/admin/promotional-popups  (requireAdmin)
      ↓
promotional_popups table  (Supabase, RLS)
      ↓
GET /api/promotional-popups/active?path=  (public, anon client)
      ↓
PromotionalPopup.tsx  (React, MainLayout)
      ↓
Customer sees modal (audience + dismissal filtered client-side)
```

---

## Database Schema

**Table:** `promotional_popups`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | `gen_random_uuid()` |
| `title` | text NOT NULL | Required |
| `subtitle` | text | Optional tagline |
| `body` | text | Copy text |
| `image_url` | text | Header image |
| `cta_label` | text | Primary button label |
| `cta_url` | text | Primary button URL |
| `secondary_label` | text | Secondary button label |
| `secondary_url` | text | Secondary button URL |
| `audience` | text | `all` / `public` / `customers` / `logged_in` / `logged_out` |
| `page_target` | text | `all` / `home` / `pricing` / `services` / `marketplace` / `dashboard` / `custom` |
| `custom_path` | text | Used when `page_target = 'custom'` |
| `start_at` | timestamptz | Null = no start bound |
| `end_at` | timestamptz | Null = no end bound |
| `active` | boolean | Manual kill-switch |
| `frequency` | text | `once_per_session` / `once_per_day` / `always` |
| `priority` | integer | Higher = served first when multiple match |
| `created_at` / `updated_at` | timestamptz | Managed by DB |

**RLS policy:**
- Public (`SELECT`): `active = true AND (start_at IS NULL OR start_at <= now()) AND (end_at IS NULL OR end_at > now())`
- Service role: full access (admin endpoints use `supabaseAdmin`)

Migration file: `db/migrations/2026-07-13_create_promotional_popups.sql`

---

## API Design

### Admin (protected — `requireAdmin`)

| Method | Path | Action |
|--------|------|--------|
| GET | `/api/admin/promotional-popups` | List all popups (newest first) |
| POST | `/api/admin/promotional-popups` | Create popup |
| PATCH | `/api/admin/promotional-popups/:id` | Update popup |
| DELETE | `/api/admin/promotional-popups/:id` | Soft-deactivate (or `?hard=true` for real delete) |

### Public (unauthenticated)

| Method | Path | Action |
|--------|------|--------|
| GET | `/api/promotional-popups/active` | Return highest-priority active popup for given `?path=` |

The public endpoint uses the anon `supabase` client (not `supabaseAdmin`) so RLS applies —
it can only read rows that pass the active/date filter. Returns `{ popup: PopupData | null }`.

**Page-target matching (server-side):**
- `all` → always matches
- `home` → path is `/`
- `pricing` / `services` / `marketplace` / `dashboard` → path starts with `/${target}`
- `custom` → `custom_path` must be a prefix of the request path

---

## Security Considerations

- **CTA URL sanitization:** `isValidCtaUrl()` in `adminPromotionalPopups.ts` rejects
  `javascript:`, `data:`, `vbscript:` schemes on admin write. Stored URLs are safe to render
  in `<Button onClick={() => navigate(url)}>` or `window.open()`.
- **Audience filtering:** Done client-side in `PromotionalPopup.tsx` using `useAuth()` +
  `useProfile()`. The public API returns a candidate popup; React filters it if audience
  requirements aren't met. This is intentional — there's no sensitive data in a popup (no PII,
  no pricing private to one user); the audience setting is a targeting preference, not a
  security boundary.
- **No auth weakening:** Admin routes are behind `requireAdmin`. Public route uses anon client
  with RLS. No existing middleware changed.

---

## Dismissal Logic

| Frequency | Storage | Key | Value |
|-----------|---------|-----|-------|
| `once_per_session` | `sessionStorage` + `localStorage` | `promo_popup_dismissed_<id>` | `"session"` |
| `once_per_day` | `localStorage` | `promo_popup_dismissed_<id>` | ISO date string (YYYY-MM-DD) |
| `always` | — | — | Never dismissed |

A fresh popup (new `id`) always shows, even if a previous version was dismissed.

---

## Blocked Paths

Popup never auto-appears on: `/onboarding`, `/legal-acceptance`, `/legal`, `/reset-password`,
`/dashboard/billing`, `/dashboard/marketplace` (checkout-sensitive pages).
