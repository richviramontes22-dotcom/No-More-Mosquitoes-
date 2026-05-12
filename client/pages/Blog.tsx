import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { CtaBand, PageHero } from "@/components/page";
import SectionHeading from "@/components/common/SectionHeading";
import Seo from "@/components/seo/Seo";
import { blogPosts as staticBlogPosts } from "@/data/blog";
import { supabase } from "@/lib/supabase";
import { useTranslation } from "@/hooks/use-translation";

const blogSchema = {
  "@context": "https://schema.org",
  "@type": "Blog",
  name: "Mosquito & Pest Insights",
  url: "https://nomoremosquitoes.us/blog",
  description: "Seasonal prevention tips and company updates from No More Mosquitoes.",
};

const Blog = () => {
  const { t } = useTranslation();

  const { data: dbPosts = [] } = useQuery({
    queryKey: ["blog_posts_public"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("id, slug, title, excerpt, author, tags, published_at, reading_time_minutes")
        .eq("published", true)
        .order("published_at", { ascending: false });
      if (error || !data?.length) return [];
      return data.map((p: any) => ({
        slug: p.slug,
        title: p.title,
        excerpt: p.excerpt || "",
        publishedAt: p.published_at,
        readingTimeMinutes: p.reading_time_minutes || 3,
        author: p.author || "No More Mosquitoes",
        tags: p.tags || [],
      }));
    },
    staleTime: 5 * 60 * 1000,
    retry: 0,
    refetchOnWindowFocus: false,
  });

  // Use DB posts if available, otherwise fall back to static data
  const blogPosts = dbPosts.length > 0 ? dbPosts : staticBlogPosts;
  return (
    <div className="flex flex-col gap-0">
      <Seo
        title="Blog"
        description="Seasonal prevention tips and company updates."
        canonicalUrl="https://nomoremosquitoes.us/blog"
        jsonLd={[blogSchema]}
      />
      <PageHero
        variant="centered"
        title="Mosquito & Pest Insights"
        description="Seasonal tips and trends from licensed OC technicians."
        primaryCta={{ label: t("hero.scheduleService") || "Schedule Service", href: "/schedule" }}
        secondaryCta={{ label: "Get updates", href: "/contact" }}
      />
      <section className="bg-background py-24">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Latest posts"
            title="Fresh perspectives from the route."
            description="We share what we learn from treating backyards across Orange County so you can keep your home ahead of mosquito and pest season."
          />
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {blogPosts.length === 0 ? (
              <div className="rounded-[28px] border border-border/60 bg-card/90 p-8 text-center text-sm text-muted-foreground shadow-soft">
                Posts coming soon. Check back after our next service wave.
              </div>
            ) : (
              blogPosts.map((post) => (
                <article
                  key={post.slug}
                  className="flex h-full flex-col rounded-[28px] border border-border/60 bg-card/90 p-6 shadow-soft"
                >
                  <div className="flex flex-col gap-2 text-xs uppercase tracking-[0.3em] text-muted-foreground">
                    <span>{new Date(post.publishedAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}</span>
                    <span>{post.readingTimeMinutes} min read</span>
                  </div>
                  <h3 className="mt-4 font-display text-2xl text-foreground">{post.title}</h3>
                  <p className="mt-3 text-sm text-muted-foreground">{post.excerpt}</p>
                  <Link
                    to={`/blog/${post.slug}`}
                    className="mt-auto inline-flex items-center gap-2 text-sm font-semibold text-primary transition hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    Read full post
                  </Link>
                </article>
              ))
            )}
          </div>
        </div>
      </section>
      <CtaBand title={t("hero.planVisit")} href="/schedule" />
    </div>
  );
};

export default Blog;
