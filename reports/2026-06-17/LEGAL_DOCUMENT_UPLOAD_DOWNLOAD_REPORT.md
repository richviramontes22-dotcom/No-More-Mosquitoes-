# Legal Document Upload/Download Report
**Date:** 2026-06-17

## Storage: Supabase Storage Is Used (Not the Fallback Path)

Confirmed configured and already in production use for the `job-media` bucket (`db/migrations/2026-05-28_job_media_storage.sql`). The new `legal-documents` bucket (created in `2026-06-17_legal_documents_system.sql`) follows the identical pattern: public bucket, RLS-restricted writes.

- **Allowed MIME types**: `text/markdown`, `text/plain`, `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (.docx) — covers .md, .txt, .pdf, .docx as requested.
- **Size limit**: 20 MB per file (legal documents are text-heavy, not media — well above any realistic need).
- **Write access**: `storage.objects` RLS restricts `INSERT` and `DELETE` on this bucket to authenticated users who are admins (`profiles.role = 'admin'` subquery) — same shape as every other admin-only RLS policy added this week.

## Upload Flow

Direct client-to-Supabase-Storage upload (no file bytes pass through the Express server), matching the established pattern for `job-media`:

1. Admin selects a file in the "Upload Replacement" dialog (`AdminLegal.tsx`).
2. The browser calls `supabase.storage.from("legal-documents").upload(path, file)` directly, where `path` is `${document_type}/${timestamp}-${filename}` — collision-proof and self-describing.
3. The resulting public URL (`getPublicUrl()`) plus filename/MIME type are sent to `POST /api/admin/legal/documents`, which **inserts a brand-new row** with `status: 'draft'` — it never updates or overwrites the document's current row. This is what "upload creates new draft version" and "do not overwrite deployed document in place" both require: a new file upload, an upload that replaces lost/corrupted content, or a fresh attorney redline are all just new draft rows, and every prior version (including whatever was previously deployed) stays exactly as it was, preserved for audit.
4. An admin can also skip file upload entirely and paste plain text/Markdown directly into the dialog's textarea (`content_md`) — useful for quick attorney-redline iteration without round-tripping a file.

## Download Flow

- **If the document has a `file_url`** (was uploaded as a file): download opens that URL directly in a new tab.
- **If the document only has `content_md`** (no file ever uploaded — e.g. the seeded drafts): download generates a `.md` file client-side from the text via a `Blob` + temporary `<a download>` link — no server round-trip needed.
- **Admin can download any status** — the admin page's document-fetch endpoint (`GET /api/admin/legal/documents`) returns every row regardless of status, and the download button works the same way for draft/attorney_review/approved/deployed/archived.
- **Public/customer download is status-gated, not file-gated**: the public endpoint `GET /api/legal/documents/:type` only ever queries `WHERE status = 'deployed'` — a draft document's `file_url`/`content_md` are never returned by this endpoint, regardless of whether the underlying Storage object is technically public-readable by direct URL.

## Security Model (documented, not glossed over)

The `legal-documents` bucket is **public**, exactly like `job-media`. This means: if someone obtained the exact Storage path of a draft document's file (e.g., from a leaked admin screenshot or browser history), they could fetch it directly, bypassing the `status = 'deployed'` gate — because Supabase Storage's own RLS for a public bucket doesn't consult the `legal_documents.status` column; it only gates writes. In practice this is a low risk: paths are UUID/timestamp-keyed and never displayed to non-admins, and the only place a draft's `file_url` is ever returned over the API is the `requireAdmin`-gated admin endpoint. This is the same trade-off already accepted for `job-media`, not a new gap introduced by this system. A fully private bucket with server-generated signed URLs (time-limited, regenerated per request) would close this gap entirely and is the recommended hardening step **if** these documents are ever sensitive enough to warrant it — noted here as a future option, not built now, since it's a meaningfully larger change (every download would need to go through an Express endpoint to mint a signed URL) and wasn't requested.

## What Happens If Storage Were Unavailable (Documented Fallback, Not Built — Not Needed)

Per the original instructions: "If storage not configured: Fallback to content_md storage only." Storage **is** configured (confirmed above), so this fallback path was not built as a separate code path. The system already supports content-only documents naturally — `content_md` is nullable independent of `file_url`, and a document with no file ever uploaded works identically everywhere (view, download-as-.md, deploy) to one that has a file. No additional fallback code was necessary.
