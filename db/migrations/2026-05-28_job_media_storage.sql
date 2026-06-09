-- ─── Job Media Storage Bucket ─────────────────────────────────────────────────
-- Creates the job-media Supabase Storage bucket for employee job photos/videos.
-- Safe to re-run: INSERT with ON CONFLICT DO NOTHING.
--
-- RLS policies restrict:
--   - Upload: authenticated users only (employees upload)
--   - Read:   authenticated users only (admins view in dashboard)
--   - Delete: not permitted via client (admin-only via service role)

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'job-media',
  'job-media',
  true,
  52428800,  -- 50 MB per file
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
    'video/mp4', 'video/quicktime', 'video/webm'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload (employees)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects'
      AND schemaname = 'storage'
      AND policyname = 'Employees can upload job media'
  ) THEN
    CREATE POLICY "Employees can upload job media"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'job-media');
  END IF;
END $$;

-- Allow authenticated users to read (admins + employees)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects'
      AND schemaname = 'storage'
      AND policyname = 'Authenticated users can read job media'
  ) THEN
    CREATE POLICY "Authenticated users can read job media"
      ON storage.objects FOR SELECT
      TO authenticated
      USING (bucket_id = 'job-media');
  END IF;
END $$;
