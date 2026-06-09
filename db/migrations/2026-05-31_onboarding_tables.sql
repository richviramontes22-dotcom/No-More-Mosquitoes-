-- ─── Employee Onboarding + Compliance Tables ─────────────────────────────────
-- Sprint 3: Legal acknowledgment infrastructure
-- Idempotent — safe to re-run.

-- ── 1. Add onboarding tracking columns to employees ──────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employees' AND column_name='onboarding_status') THEN
    ALTER TABLE public.employees ADD COLUMN onboarding_status text NOT NULL DEFAULT 'not_started'
      CHECK (onboarding_status IN ('not_started','pending','in_progress','completed','approved'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employees' AND column_name='onboarding_completed_at') THEN
    ALTER TABLE public.employees ADD COLUMN onboarding_completed_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employees' AND column_name='onboarding_approved_at') THEN
    ALTER TABLE public.employees ADD COLUMN onboarding_approved_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employees' AND column_name='onboarding_approved_by') THEN
    ALTER TABLE public.employees ADD COLUMN onboarding_approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employees' AND column_name='gps_consent_form_version_id') THEN
    ALTER TABLE public.employees ADD COLUMN gps_consent_form_version_id uuid;
  END IF;
END $$;

-- ── 2. onboarding_forms ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.onboarding_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'custom',
  -- categories: employment_agreement, safety, chemical_handling, vehicle_policy,
  --   gps_consent, equipment_policy, media_policy, workers_comp, background_check,
  --   arbitration, nda, handbook, contractor_agreement, custom
  form_type text NOT NULL DEFAULT 'acknowledgment',
  -- acknowledgment: text body + checkbox + typed name
  -- pdf_view: admin uploads PDF, employee confirms read
  -- upload_required: employee must upload a document
  required_for text[] NOT NULL DEFAULT '{}',
  -- worker_types that must complete: ['employee','contractor','vendor','test']
  required_roles text[] NOT NULL DEFAULT '{}',
  -- roles: ['technician','dispatcher'] — empty = all roles
  is_required boolean NOT NULL DEFAULT true,
  blocks_assignments boolean NOT NULL DEFAULT false,
  -- if true, employees cannot access assignment detail until form is complete
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_forms_active ON public.onboarding_forms (is_active);
CREATE INDEX IF NOT EXISTS idx_onboarding_forms_category ON public.onboarding_forms (category);

-- ── 3. onboarding_form_versions ───────────────────────────────────────────────
-- Immutable once published. New policy = new version, old preserved for audit.
CREATE TABLE IF NOT EXISTS public.onboarding_form_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public.onboarding_forms(id) ON DELETE CASCADE,
  version_number int NOT NULL,
  title text NOT NULL,
  body_text text,
  -- full text the employee reads before acknowledging
  acknowledgment_statement text,
  -- the exact sentence the employee confirms (snapshot stored on sign)
  document_url text,
  -- optional Supabase Storage URL for PDFs
  document_filename text,
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  is_current boolean NOT NULL DEFAULT false,
  -- only one per form should be is_current=true
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (form_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_form_versions_form ON public.onboarding_form_versions (form_id, is_current);

-- ── 4. employee_onboarding_assignments ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.employee_onboarding_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  form_id uuid NOT NULL REFERENCES public.onboarding_forms(id) ON DELETE CASCADE,
  form_version_id uuid NOT NULL REFERENCES public.onboarding_form_versions(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','completed','skipped','reassigned')),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  due_date date,
  completed_at timestamptz,
  skipped_reason text,
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (employee_id, form_version_id)
);

CREATE INDEX IF NOT EXISTS idx_onboarding_assignments_employee ON public.employee_onboarding_assignments (employee_id, status);
CREATE INDEX IF NOT EXISTS idx_onboarding_assignments_form ON public.employee_onboarding_assignments (form_id);

-- ── 5. employee_form_signatures ───────────────────────────────────────────────
-- IMMUTABLE after insert. Never update. New version = new row.
CREATE TABLE IF NOT EXISTS public.employee_form_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  form_id uuid NOT NULL REFERENCES public.onboarding_forms(id) ON DELETE CASCADE,
  form_version_id uuid NOT NULL REFERENCES public.onboarding_form_versions(id) ON DELETE CASCADE,
  assignment_id uuid REFERENCES public.employee_onboarding_assignments(id) ON DELETE SET NULL,
  signature_text text NOT NULL,
  -- typed full name: "I, [name], acknowledge..."
  checkbox_acknowledged boolean NOT NULL DEFAULT false,
  acknowledgment_statement text NOT NULL,
  -- SNAPSHOT of the exact statement text at time of signing — never changes
  ip_address inet,
  user_agent text,
  signed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, form_version_id)
  -- one signature per employee per form version
);

CREATE INDEX IF NOT EXISTS idx_signatures_employee ON public.employee_form_signatures (employee_id);
CREATE INDEX IF NOT EXISTS idx_signatures_form_version ON public.employee_form_signatures (form_version_id);

-- ── 6. employee_document_uploads ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.employee_document_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  assignment_id uuid REFERENCES public.employee_onboarding_assignments(id) ON DELETE SET NULL,
  form_id uuid REFERENCES public.onboarding_forms(id) ON DELETE SET NULL,
  document_type text NOT NULL DEFAULT 'custom',
  document_url text NOT NULL,
  filename text,
  file_size_bytes int,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  review_status text NOT NULL DEFAULT 'pending'
    CHECK (review_status IN ('pending','approved','rejected')),
  review_notes text
);

CREATE INDEX IF NOT EXISTS idx_doc_uploads_employee ON public.employee_document_uploads (employee_id);
CREATE INDEX IF NOT EXISTS idx_doc_uploads_review ON public.employee_document_uploads (review_status) WHERE review_status = 'pending';

-- ── 7. onboarding_audit_log ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.onboarding_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role text,
  -- 'admin', 'employee'
  action text NOT NULL,
  -- 'form_created','version_created','version_activated','form_assigned',
  -- 'form_signed','document_uploaded','document_approved','document_rejected',
  -- 'onboarding_approved','consent_withdrawn','form_deactivated'
  entity_type text,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON public.onboarding_audit_log (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON public.onboarding_audit_log (entity_type, entity_id);

-- ── RLS: admin full access, employee own records only ─────────────────────────
ALTER TABLE public.onboarding_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_form_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_onboarding_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_form_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_document_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_audit_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  -- Admin: full access to all tables
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='onboarding_forms' AND policyname='onboarding_forms_admin') THEN
    CREATE POLICY onboarding_forms_admin ON public.onboarding_forms FOR ALL
      USING (EXISTS (SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role='admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='onboarding_form_versions' AND policyname='onboarding_form_versions_admin') THEN
    CREATE POLICY onboarding_form_versions_admin ON public.onboarding_form_versions FOR ALL
      USING (EXISTS (SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role='admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='employee_onboarding_assignments' AND policyname='assignments_admin') THEN
    CREATE POLICY assignments_admin ON public.employee_onboarding_assignments FOR ALL
      USING (EXISTS (SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role='admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='employee_form_signatures' AND policyname='signatures_admin') THEN
    CREATE POLICY signatures_admin ON public.employee_form_signatures FOR ALL
      USING (EXISTS (SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role='admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='employee_document_uploads' AND policyname='uploads_admin') THEN
    CREATE POLICY uploads_admin ON public.employee_document_uploads FOR ALL
      USING (EXISTS (SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role='admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='onboarding_audit_log' AND policyname='audit_log_admin') THEN
    CREATE POLICY audit_log_admin ON public.onboarding_audit_log FOR ALL
      USING (EXISTS (SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role='admin'));
  END IF;

  -- Employee: own records only
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='onboarding_forms' AND policyname='onboarding_forms_employee_read') THEN
    CREATE POLICY onboarding_forms_employee_read ON public.onboarding_forms FOR SELECT
      USING (is_active = true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='onboarding_form_versions' AND policyname='form_versions_employee_read') THEN
    CREATE POLICY form_versions_employee_read ON public.onboarding_form_versions FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='employee_onboarding_assignments' AND policyname='assignments_employee') THEN
    CREATE POLICY assignments_employee ON public.employee_onboarding_assignments FOR SELECT
      USING (EXISTS (SELECT 1 FROM public.employees WHERE id=employee_onboarding_assignments.employee_id AND user_id=auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='employee_form_signatures' AND policyname='signatures_employee') THEN
    CREATE POLICY signatures_employee ON public.employee_form_signatures FOR SELECT
      USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='employee_document_uploads' AND policyname='uploads_employee') THEN
    CREATE POLICY uploads_employee ON public.employee_document_uploads FOR SELECT
      USING (EXISTS (SELECT 1 FROM public.employees WHERE id=employee_document_uploads.employee_id AND user_id=auth.uid()));
  END IF;
END $$;
