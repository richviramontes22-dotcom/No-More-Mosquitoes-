# 02 — Marketplace Admin Backend Audit Report

**Date:** 2026-07-03

---

## File Audited

`server/routes/adminCms.ts` — "Marketplace Catalog" section (lines 223–300)

Mounted at: `app.use("/api/admin", adminCmsRouter)` → `/api/admin/cms/catalog`

---

## Existing Catalog CRUD Endpoints

| Endpoint | Auth | Description |
|---|---|---|
| `GET /api/admin/cms/catalog` | `requireAdmin` | List all items including inactive |
| `POST /api/admin/cms/catalog` | `requireAdmin` | Create item |
| `PATCH /api/admin/cms/catalog/:id` | `requireAdmin` | Update item (field whitelist) |
| `DELETE /api/admin/cms/catalog/:id` | `requireAdmin` | Soft delete (sets `active=false`) |

All four endpoints require a valid admin Bearer token enforced by `requireAdmin` middleware. ✅

---

## Fields Supported

### GET response fields
```
id, slug, name, category, fulfillment_type, price_type, price_cents,
min_price_cents, max_price_cents, image_url, active, is_featured,
display_order, description
```

### POST creates with
```
slug, name, category, fulfillment_type, price_type, price_cents,
min_price_cents, max_price_cents, image_url, description, active,
is_featured, display_order, requires_property (hardcoded true),
requires_schedule (hardcoded false), requires_consultation (hardcoded false),
currency (USD)
```

### PATCH allowed fields (before this sprint)
```
name, description, price_cents, min_price_cents, max_price_cents,
price_type, category, fulfillment_type, image_url, active,
is_featured, display_order
```

**Gap found:** `requires_property`, `requires_schedule`, `requires_consultation`, `slug` were NOT patchable.

---

## Findings

| Question | Answer |
|---|---|
| Does adminCms expose CRUD endpoints? | ✅ Yes — GET, POST, PATCH, DELETE |
| Are endpoints protected by requireAdmin? | ✅ Yes — all four |
| What fields can be updated? | All catalog fields (after this sprint's fix) |
| Active/inactive toggle? | ✅ Yes — PATCH `{active: false}` or DELETE → `active=false` |
| imageUrl updatable? | ✅ Yes |
| category, fulfillmentType, priceType updatable? | ✅ Yes |
| sortOrder updatable? | ✅ Yes — `display_order` + `sort_order` sync |
| requires_* updatable? | ❌ Before sprint / ✅ After sprint patch |
| slug updatable? | ❌ Before sprint / ✅ After sprint patch |
| Are catalog descriptions NULL in DB? | ✅ Yes — all 14 items have NULL descriptions in production |
| Frontend fallback covers all 14? | ✅ Yes — `catalogMetadata.ts` has all 14 slugs |
| RLS constraints? | Service-role client bypasses RLS for admin writes |

---

## Fix Applied This Sprint

`server/routes/adminCms.ts` PATCH `allowed` array extended:

```ts
const allowed = ["name", "slug", "description", "price_cents", "min_price_cents", "max_price_cents",
  "price_type", "category", "fulfillment_type", "image_url", "active", "is_featured", "display_order",
  "requires_property", "requires_schedule", "requires_consultation"];
```

---

## Verdict: READY ✅

All four CRUD endpoints exist, all are admin-protected, and the PATCH gap is fixed.
The admin catalog management UI can be built against these endpoints without any additional backend changes.
