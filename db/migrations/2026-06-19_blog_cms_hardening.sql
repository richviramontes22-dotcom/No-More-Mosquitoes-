-- ============================================================
-- Blog / CMS Hardening
--
-- The blog_posts table, its full CRUD API (server/routes/adminContent.ts),
-- and the public listing query (client/pages/Blog.tsx) already existed
-- before this migration — this only adds the two columns that were
-- genuinely missing (verified live: id, slug, title, excerpt, body, author,
-- tags, published, published_at, reading_time_minutes, seo_title,
-- seo_description, created_at, updated_at already exist; content/
-- featured_image_url/author_id did not).
-- ============================================================

ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS featured_image_url TEXT,
  ADD COLUMN IF NOT EXISTS author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Enforce slug uniqueness at the DB level (the public single-post page
-- looks posts up by slug — two posts sharing a slug would be ambiguous).
CREATE UNIQUE INDEX IF NOT EXISTS blog_posts_slug_unique_idx ON public.blog_posts (slug);
