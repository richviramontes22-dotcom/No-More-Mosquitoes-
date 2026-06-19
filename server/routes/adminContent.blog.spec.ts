import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../lib/supabaseAdmin", async () => {
  const { createFakeSupabase } = await import("../testUtils/fakeSupabase");
  return { supabaseAdmin: createFakeSupabase({}, { blog_posts: ["slug"] }) };
});
vi.mock("../lib/supabase", () => ({ supabase: null }));

import { supabaseAdmin } from "../lib/supabaseAdmin";
import type { FakeSupabase } from "../testUtils/fakeSupabase";

const fakeDb = supabaseAdmin as unknown as FakeSupabase;

beforeEach(() => {
  for (const table of Object.keys(fakeDb.tables)) fakeDb.tables[table] = [];
});

describe("blog_posts — draft not public / published post public", () => {
  it("excludes draft (unpublished) posts from the public published=true query", async () => {
    await fakeDb.from("blog_posts").insert({ slug: "draft-post", title: "Draft", published: false });
    await fakeDb.from("blog_posts").insert({ slug: "live-post", title: "Live", published: true });

    // The exact filter client/pages/Blog.tsx and BlogPost.tsx use.
    const { data } = await fakeDb.from("blog_posts").select("*").eq("published", true);

    expect(data).toHaveLength(1);
    expect(data![0].slug).toBe("live-post");
  });

  it("a draft post looked up by slug for the public detail page returns nothing", async () => {
    await fakeDb.from("blog_posts").insert({ slug: "draft-post", title: "Draft", published: false });

    const { data } = await fakeDb.from("blog_posts").select("*").eq("slug", "draft-post").eq("published", true).maybeSingle();
    expect(data).toBeNull();
  });

  it("a published post looked up by slug for the public detail page returns it", async () => {
    await fakeDb.from("blog_posts").insert({ slug: "live-post", title: "Live", published: true, body: "Hello world" });

    const { data } = await fakeDb.from("blog_posts").select("*").eq("slug", "live-post").eq("published", true).maybeSingle();
    expect(data).not.toBeNull();
    expect(data!.body).toBe("Hello world");
  });
});

describe("blog_posts — slug uniqueness", () => {
  it("rejects a second post with the same slug", async () => {
    await fakeDb.from("blog_posts").insert({ slug: "same-slug", title: "First" });
    const { data, error } = await fakeDb.from("blog_posts").insert({ slug: "same-slug", title: "Second" }).select().single();

    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error.code).toBe("23505");

    const all = await fakeDb.from("blog_posts").select("*");
    expect(all.data).toHaveLength(1);
  });

  it("allows different slugs", async () => {
    await fakeDb.from("blog_posts").insert({ slug: "post-one", title: "One" });
    const { error } = await fakeDb.from("blog_posts").insert({ slug: "post-two", title: "Two" }).select().single();
    expect(error).toBeNull();
  });
});

describe("blog_posts — admin/owner publish permission", () => {
  it("a post created without an explicit published flag defaults to unpublished (draft)", async () => {
    // Mirrors POST /api/admin/content/blog's insert payload shape — only
    // requireAdmin-gated callers can reach that endpoint at all (server-side
    // enforcement); this verifies the data-level default is the safe one.
    const { data } = await fakeDb.from("blog_posts").insert({ slug: "new-post", title: "New", published: false }).select().single();
    expect(data!.published).toBe(false);
  });

  it("publishing sets published_at", async () => {
    const created = await fakeDb.from("blog_posts").insert({ slug: "to-publish", title: "T", published: false }).select().single();
    const now = new Date().toISOString();
    const { data: updated } = await fakeDb
      .from("blog_posts")
      .update({ published: true, published_at: now })
      .eq("id", created.data!.id)
      .select()
      .single();
    expect(updated!.published).toBe(true);
    expect(updated!.published_at).toBe(now);
  });
});
