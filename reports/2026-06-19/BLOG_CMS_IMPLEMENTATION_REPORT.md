# Blog / CMS — Implementation Report
**Date:** 2026-06-19

## What Was Built

| Piece | File |
|---|---|
| Migration | `db/migrations/2026-06-19_blog_cms_hardening.sql` — `featured_image_url`, `author_id`, slug UNIQUE index |
| Admin API | `server/routes/adminContent.ts` — extended POST/PUT, new `GET /content/blog/:id` |
| Admin UI | `client/pages/admin/Content.tsx` — extended create dialog, new edit dialog |
| Public single-post page | `client/pages/BlogPost.tsx` — now DB-first with static fallback |
| Route alias | `/admin/blog` → `/admin/content` |

No new table, no new CRUD API shape, no new admin page was built from scratch — per the audit's finding, this system was already ~80% complete (table, full backend CRUD, public listing query, a working create+publish-toggle+delete admin UI) and only the gaps were filled in.

## Schema

Two columns added: `featured_image_url` (matches the spec's exact field name; the existing `body` column already covers "content markdown/plain text", just under a different name than the spec used). `author_id` is a nullable FK to `profiles`, populated from `req.adminUserId` on create when not explicitly supplied — additive alongside the existing free-text `author` display name, not a replacement (removing `author` would break the public listing query in `Blog.tsx`, which reads it today).

A `UNIQUE` index on `slug` was added (verified the table had none before — schema drift, like everything else in this table). Both `POST` and `PUT` now catch Postgres `23505` and return a clean `409 "A post with this slug already exists"` instead of a raw DB error.

## Admin UI

**Create dialog** — now collects every field the API already accepted but the old dialog never sent: content (`body`), tags, featured image URL, SEO title, SEO description. Previously, a post could be created but its actual content could only ever be set by directly hitting the API outside the UI.

**Edit dialog (new)** — there was no way to edit a post's content after creation before this phase; only publish-toggle and delete existed. The new dialog pre-fills every field (including the ones the create dialog now also collects) and calls the existing `PUT` endpoint.

## Public Site

`BlogPost.tsx` (the `/blog/:slug` detail page) was, per the audit, 100% hardcoded with a literal "in a real app, this would come from a CMS" comment — meaning a post created via the admin UI would show up in the `/blog` list (which already queried the DB) but clicking through would show nothing real. Fixed by adding the same DB-first/static-fallback pattern `Blog.tsx`'s listing already uses: query `blog_posts` by slug + `published = true`, fall back to the static `blogContent`/`blogPosts` map only if no matching published row exists. Existing static posts continue to render exactly as before (zero regression for them); new DB-authored posts now render correctly for the first time.

## `/admin/blog`

Added as a route alias to `/admin/content` (where the blog editor actually lives, alongside FAQs and the marketplace catalog), using the exact same redirect pattern already established in this codebase for `/dashboard/support` → `/dashboard/help`. A second, parallel blog admin page was deliberately not built — that would be the literal "duplicate system" failure condition the spec explicitly warns against.

## Explicitly Not Done (per constraints)

No AI writing assistance, no comments system, no public user accounts for the blog — none of these were touched or scaffolded.

## Validation

`pnpm typecheck` clean, `pnpm test` 134/134.
