-- Contact form submissions from the public /contact page
CREATE TABLE IF NOT EXISTS public.contact_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'read', 'replied', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.contact_inquiries ENABLE ROW LEVEL SECURITY;

-- Anyone can submit a contact form
CREATE POLICY "Anyone can submit contact inquiries" ON public.contact_inquiries
  FOR INSERT WITH CHECK (true);

-- Only admins can read inquiries
CREATE POLICY "Admins can read contact inquiries" ON public.contact_inquiries
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE INDEX IF NOT EXISTS contact_inquiries_status_idx ON public.contact_inquiries (status);
CREATE INDEX IF NOT EXISTS contact_inquiries_created_at_idx ON public.contact_inquiries (created_at DESC);
