-- ============================================================
-- Legal Document Management System
--
-- Three tables:
--   legal_documents              — versioned documents, draft → attorney_review
--                                   → approved → deployed → archived
--   legal_acceptance_settings    — singleton config; enforcement_enabled
--                                   defaults to FALSE (registration is
--                                   unaffected until an admin opts in)
--   customer_legal_acceptances   — immutable per-customer acceptance log
--
-- Plus the `legal-documents` Supabase Storage bucket (public, same pattern
-- as `job-media` in 2026-05-28_job_media_storage.sql), and RLS throughout.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.legal_documents (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type TEXT        NOT NULL CHECK (document_type IN (
                              'terms_and_conditions', 'privacy_policy',
                              'service_agreement', 'pesticide_consent'
                            )),
  title         TEXT        NOT NULL,
  version       TEXT        NOT NULL,
  status        TEXT        NOT NULL DEFAULT 'draft' CHECK (status IN (
                              'draft', 'attorney_review', 'approved', 'deployed', 'archived'
                            )),
  content_md    TEXT,
  file_url      TEXT,
  file_name     TEXT,
  mime_type     TEXT,
  uploaded_by   UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  effective_date TIMESTAMPTZ,
  deployed_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS legal_documents_type_status_idx ON public.legal_documents (document_type, status);

ALTER TABLE public.legal_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS legal_documents_admin_all ON public.legal_documents;
CREATE POLICY legal_documents_admin_all ON public.legal_documents
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- Anyone (including anonymous visitors) can read deployed documents — required
-- for the public /legal/* pages. Draft/attorney_review/approved/archived rows
-- are only ever reachable through the admin-only policy above.
DROP POLICY IF EXISTS legal_documents_public_read_deployed ON public.legal_documents;
CREATE POLICY legal_documents_public_read_deployed ON public.legal_documents
  FOR SELECT
  USING (status = 'deployed');

CREATE TABLE IF NOT EXISTS public.legal_acceptance_settings (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  enforcement_enabled         BOOLEAN     NOT NULL DEFAULT FALSE,
  require_terms               BOOLEAN     NOT NULL DEFAULT TRUE,
  require_privacy             BOOLEAN     NOT NULL DEFAULT TRUE,
  require_service_agreement   BOOLEAN     NOT NULL DEFAULT TRUE,
  require_pesticide_consent   BOOLEAN     NOT NULL DEFAULT TRUE,
  updated_by                  UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.legal_acceptance_settings (enforcement_enabled)
SELECT FALSE
WHERE NOT EXISTS (SELECT 1 FROM public.legal_acceptance_settings);

ALTER TABLE public.legal_acceptance_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS legal_acceptance_settings_admin_all ON public.legal_acceptance_settings;
CREATE POLICY legal_acceptance_settings_admin_all ON public.legal_acceptance_settings
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- Public read — the (anonymous) signup form needs to know whether
-- enforcement is on before deciding whether to show the legal gate at all.
-- Contains no sensitive data (booleans only).
DROP POLICY IF EXISTS legal_acceptance_settings_public_read ON public.legal_acceptance_settings;
CREATE POLICY legal_acceptance_settings_public_read ON public.legal_acceptance_settings
  FOR SELECT
  USING (true);

CREATE TABLE IF NOT EXISTS public.customer_legal_acceptances (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id        UUID        REFERENCES public.profiles(id) ON DELETE CASCADE,
  customer_id       UUID,
  document_id       UUID        NOT NULL REFERENCES public.legal_documents(id) ON DELETE RESTRICT,
  document_type     TEXT        NOT NULL,
  document_version  TEXT        NOT NULL,
  accepted_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address        TEXT,
  user_agent        TEXT,
  acceptance_method TEXT        NOT NULL DEFAULT 'registration_checkbox',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cla_profile_id_idx   ON public.customer_legal_acceptances (profile_id);
CREATE INDEX IF NOT EXISTS cla_document_type_idx ON public.customer_legal_acceptances (document_type);
CREATE INDEX IF NOT EXISTS cla_accepted_at_idx   ON public.customer_legal_acceptances (accepted_at);

ALTER TABLE public.customer_legal_acceptances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cla_admin_all ON public.customer_legal_acceptances;
CREATE POLICY cla_admin_all ON public.customer_legal_acceptances
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- Customers can read their own acceptance history (e.g. an account/legal page
-- showing what they've agreed to). No general public read.
DROP POLICY IF EXISTS cla_read_own ON public.customer_legal_acceptances;
CREATE POLICY cla_read_own ON public.customer_legal_acceptances
  FOR SELECT
  USING (profile_id = auth.uid());

-- Customers can create their OWN acceptance record, and only while enforcement
-- is enabled — prevents a customer from writing acceptance rows for themselves
-- (or anyone else) while the feature is off, and the profile_id check prevents
-- writing on another customer's behalf. No UPDATE/DELETE policy exists for any
-- non-admin role, so acceptance records are immutable once written.
DROP POLICY IF EXISTS cla_insert_own_when_enforced ON public.customer_legal_acceptances;
CREATE POLICY cla_insert_own_when_enforced ON public.customer_legal_acceptances
  FOR INSERT
  WITH CHECK (
    profile_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.legal_acceptance_settings WHERE enforcement_enabled = true)
  );

-- ─── Storage bucket ────────────────────────────────────────────────────────────
-- Same pattern as job-media (2026-05-28_job_media_storage.sql): public bucket,
-- RLS restricts writes to admins. Public readability is path-based (UUID paths
-- aren't guessable); the application layer is what actually gates which file_url
-- values are ever returned to non-admin callers (deployed documents only).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'legal-documents',
  'legal-documents',
  true,
  20971520, -- 20 MB per file
  ARRAY[
    'text/markdown', 'text/plain', 'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND schemaname = 'storage'
      AND policyname = 'Admins can upload legal documents'
  ) THEN
    CREATE POLICY "Admins can upload legal documents"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'legal-documents'
        AND EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND schemaname = 'storage'
      AND policyname = 'Admins can delete legal documents'
  ) THEN
    CREATE POLICY "Admins can delete legal documents"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'legal-documents'
        AND EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
      );
  END IF;
END $$;

-- Reuse the shared updated_at trigger (defined in 2026-06-15_create_leads_tables.sql).
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS legal_documents_updated_at ON public.legal_documents;
CREATE TRIGGER legal_documents_updated_at
  BEFORE UPDATE ON public.legal_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS legal_acceptance_settings_updated_at ON public.legal_acceptance_settings;
CREATE TRIGGER legal_acceptance_settings_updated_at
  BEFORE UPDATE ON public.legal_acceptance_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
