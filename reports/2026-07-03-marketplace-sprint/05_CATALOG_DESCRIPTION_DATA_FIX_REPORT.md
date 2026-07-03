# 05 — Catalog Description Data Fix Report

**Date:** 2026-07-03

---

## Status

**PENDING MANUAL APPROVAL** — SQL provided below for human review and execution in Supabase SQL Editor.

---

## Background

All 14 active catalog items in production have `description = NULL` in the `catalog_items` table. The prior sprint added a static frontend fallback in `catalogMetadata.ts` so customer-facing descriptions show immediately. This SQL makes those descriptions permanent in the database.

---

## Verification

The admin catalog management page at `/admin/catalog` now shows "No Description: 14" in the stats bar, confirming the gap.

---

## Reviewed SQL

The following SQL only updates rows where `description IS NULL` and does NOT touch prices, active state, categories, or any other field.

```sql
-- Catalog item description backfill
-- Only updates rows where description is currently NULL
-- Does NOT modify price_cents, active, category, or any other fields
-- Run in Supabase SQL Editor: https://app.supabase.com/project/qamfxqbtvwwlzlmqrqbh/editor

UPDATE catalog_items SET description = 'Durable aluminum yard sign with metal stake. Lets your neighbors know you''re protecting your outdoor space from mosquitoes.'
  WHERE slug = 'yard-sign-metal' AND description IS NULL;

UPDATE catalog_items SET description = 'Corrugated plastic yard sign to show your neighbors you take mosquito control seriously. Lightweight and easy to place.'
  WHERE slug = 'yard-sign-general' AND description IS NULL;

UPDATE catalog_items SET description = 'Decorative garden flag to proudly display your No More Mosquitoes commitment. Adds a clean, professional look to your yard.'
  WHERE slug = 'garden-flag' AND description IS NULL;

UPDATE catalog_items SET description = 'EPA-registered Bacillus thuringiensis dunks for standing water. Kills mosquito larvae before they hatch — safe for pets, birds, and wildlife.'
  WHERE slug = 'mosquito-dunks' AND description IS NULL;

UPDATE catalog_items SET description = 'Add professional fly trap placement and monitoring to your next service visit. Targets house flies, fruit flies, and gnats in problem outdoor areas.'
  WHERE slug = 'fly-trap-service' AND description IS NULL;

UPDATE catalog_items SET description = 'Add spider web removal to your next visit. Technicians clear webs from eaves, entry doors, fences, and high-traffic outdoor areas.'
  WHERE slug = 'spider-web-service' AND description IS NULL;

UPDATE catalog_items SET description = 'Clogged gutters are a top mosquito breeding site. Add a professional cleanout to eliminate standing water breeding zones at the source.'
  WHERE slug = 'gutter-cleaning' AND description IS NULL;

UPDATE catalog_items SET description = 'Gambusia affinis are aggressive mosquito larva eaters, ideal for ornamental ponds and slow-moving water. Includes expert consultation and stocking guidance.'
  WHERE slug = 'mosquito-fish-gambusia-affinis' AND description IS NULL;

UPDATE catalog_items SET description = 'Koi are highly effective mosquito larvae consumers and add beauty to any water feature. Includes consultation on stocking density and pond compatibility.'
  WHERE slug = 'mosquito-fish-koi' AND description IS NULL;

UPDATE catalog_items SET description = 'Guppies thrive in warm, shallow water and consume large quantities of mosquito larvae. Ideal for small garden ponds and water containers.'
  WHERE slug = 'mosquito-fish-guppy' AND description IS NULL;

UPDATE catalog_items SET description = 'Goldfish readily consume mosquito larvae and are easy to maintain. A natural, chemical-free larvicide option for backyard ponds.'
  WHERE slug = 'mosquito-fish-goldfish' AND description IS NULL;

UPDATE catalog_items SET description = 'Native minnows are natural mosquito predators that thrive in local water conditions. Includes expert consultation on species selection and stocking rates.'
  WHERE slug = 'mosquito-fish-minnows' AND description IS NULL;

UPDATE catalog_items SET description = 'Betta fish are excellent mosquito larvivores for smaller water features and containers. Includes consultation on habitat and care requirements.'
  WHERE slug = 'mosquito-fish-betta-fish' AND description IS NULL;

UPDATE catalog_items SET description = 'Bluegill and sunfish are powerful mosquito larvae consumers for larger ponds and water bodies. Includes consultation on pond compatibility and stocking density.'
  WHERE slug = 'mosquito-fish-bluegill' AND description IS NULL;
```

---

## Affected Rows

- Expected: 14 rows updated (one per slug, all currently NULL)
- If a slug was already given a description manually, its row is safely skipped by `AND description IS NULL`

---

## Rollback Strategy

```sql
-- To clear all descriptions back to NULL (not recommended but possible):
UPDATE catalog_items SET description = NULL
  WHERE slug IN (
    'yard-sign-metal','yard-sign-general','garden-flag','mosquito-dunks',
    'fly-trap-service','spider-web-service','gutter-cleaning',
    'mosquito-fish-gambusia-affinis','mosquito-fish-koi','mosquito-fish-guppy',
    'mosquito-fish-goldfish','mosquito-fish-minnows','mosquito-fish-betta-fish',
    'mosquito-fish-bluegill'
  );
```

---

## Current State

- Frontend descriptions: **LIVE** (via `catalogMetadata.ts` fallback — customers see descriptions today)
- DB descriptions: **NULL** (SQL above still needs to be run)
- Admin catalog page `/admin/catalog` "No Description: 14" stat will clear to 0 after SQL is executed

**Decision: run the SQL in Supabase SQL Editor at your convenience. No urgency — the frontend fallback covers customers already.**
