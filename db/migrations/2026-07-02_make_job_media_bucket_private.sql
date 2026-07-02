-- ============================================================
-- Fix: job-media Supabase Storage bucket was created public.
--
-- Risk: Any actor who knows (or guesses) an object URL can
-- access job site photos without authentication.
-- Objects are stored at assignments/{uuid}/{timestamp}.{ext} —
-- the UUID component makes enumeration infeasible, but the
-- bucket should still be private to enforce authentication at
-- the bucket level.
--
-- After this migration:
-- - Uploads still require authentication (existing storage policy)
-- - Downloads require authentication (storage RLS policy)
-- - getPublicUrl() still returns a URL but it requires a valid
--   JWT to access (or a signed URL from createSignedUrl())
-- - Client code now stores the storage path, not the public URL,
--   and generates signed URLs at display time (1-hour expiry)
--
-- Applied: 2026-07-02
-- ============================================================

UPDATE storage.buckets
SET public = false
WHERE id = 'job-media';
