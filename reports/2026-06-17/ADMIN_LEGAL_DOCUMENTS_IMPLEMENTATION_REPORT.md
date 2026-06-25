# Admin Legal Documents Implementation Report
**Date:** 2026-06-17

## What Was Built

| Piece | File |
|---|---|
| Schema | `db/migrations/2026-06-17_legal_documents_system.sql` (3 tables, RLS, storage bucket) |
| Draft seed | `db/migrations/2026-06-17_seed_legal_document_drafts.sql` |
| Backend | `server/routes/adminLegal.ts` |
| Admin UI | `client/pages/admin/AdminLegal.tsx`, routed at `/admin/legal` |
| Nav | "Legal Documents" added to the Workforce group, directly under the existing "Legal & Compliance" entry |

## Status Lifecycle

`draft → attorney_review → approved → deployed → archived`

- **Mark Attorney Review** / **Mark Approved**: simple status transitions (`PATCH /api/admin/legal/documents/:id`), available on the document currently in that stage.
- **Deploy**: a dedicated endpoint (`POST /api/admin/legal/documents/:id/deploy`), not a generic status PATCH, because it has a side effect beyond the target row: it **first archives whatever was previously `deployed` for that same `document_type`**, then marks the new one `deployed` with `deployed_at = now()`. This guarantees at most one deployed version per type at any time — exactly the "archive old version" requirement, done automatically as part of deploying the new one rather than requiring a separate manual step. Refuses to run unless the target document's current status is `approved` — you cannot deploy a draft or an attorney_review document directly, by design.
- **Archive**: also available as a manual action on any non-archived document, for retiring a version without deploying a replacement (e.g., a draft that's been superseded before ever reaching attorney review).

## "Current Version" Display Logic

Each of the 4 document-type cards shows one "current" version — computed client-side as the non-archived row with the highest status rank (`deployed` > `approved` > `attorney_review` > `draft`), so the card always surfaces the most relevant version no matter how many drafts/historical versions exist. Everything else for that type appears in a compact "Version history" list beneath it, so nothing is hidden — an admin can always see every version that's ever existed for a document type, just not all expanded by default.

## Enforcement Settings Panel

Same card, same page — toggle for `enforcement_enabled` plus four per-document-type "required" toggles. The exact warning text requested ("Do not enable enforcement until all required documents are attorney-reviewed, approved, and deployed") is shown as a persistent `CardDescription`, not just a one-time tooltip.

**Enforcement cannot be enabled until required documents are deployed** — enforced server-side in `PATCH /api/admin/legal/settings`: before accepting `enforcement_enabled: true`, the endpoint checks every document type whose `require_*` flag is (or is being set) true, confirms a `deployed` row exists for each, and returns a `400` listing exactly which types are missing if not. This is a hard server-side gate, not just a UI nicety — even a direct API call cannot bypass it.

## Relationship to the Existing "Legal & Compliance" Page

`/admin/legal-compliance` (pre-existing) manages **employee onboarding compliance forms** (GPS consent, handbook acknowledgment, safety training, etc.) — a different audience and a different table set (`onboarding_forms` and friends, not touched by this sprint). The new `/admin/legal` page is for **customer-facing legal documents**. Both now appear in the same nav group with clearly distinct labels, but they are entirely separate systems — no code or data is shared between them.

## Validation

`pnpm typecheck` — 0 errors, confirmed after this piece.
