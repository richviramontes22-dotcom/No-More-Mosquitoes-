import { useEffect, useMemo, useState } from "react";
import SectionHeading from "@/components/common/SectionHeading";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Trash2, Plus, Pencil, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { AdminOwnershipBadge, AdminOwnershipNote } from "@/components/admin/AdminOwnershipBadge";

// ── helpers ──────────────────────────────────────────────────────────────────
async function adminFetch(path: string, method = "GET", body?: unknown) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const res = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Request failed");
  return json;
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface BlogPost {
  id: string; slug: string; title: string; excerpt: string;
  published: boolean; published_at: string | null;
  reading_time_minutes: number; author: string;
}

interface Faq {
  id: string; question: string; answer: string;
  category: string; display_order: number; active: boolean;
}

interface CatalogItem {
  id: string; name: string; description: string;
  price_cents: number; image_url: string; category: string; active: boolean;
}

// ── Main page ─────────────────────────────────────────────────────────────────
const Content = () => {
  const { toast } = useToast();

  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [postFilter, setPostFilter] = useState("");
  const [faqFilter, setFaqFilter] = useState("");
  const [catalogFilter, setCatalogFilter] = useState("");

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [blogsRes, faqsRes, catalogRes] = await Promise.all([
        adminFetch("/api/admin/content/blog"),
        adminFetch("/api/admin/content/faqs"),
        adminFetch("/api/admin/content/catalog"),
      ]);
      setPosts(blogsRes.posts || []);
      setFaqs(faqsRes.faqs || []);
      setCatalog(catalogRes.items || []);
    } catch (err: any) {
      toast({ title: "Load failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const deletePost = async (id: string) => {
    try {
      await adminFetch(`/api/admin/content/blog/${id}`, "DELETE");
      setPosts((p) => p.filter((x) => x.id !== id));
      toast({ title: "Post deleted" });
    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
  };

  const togglePostPublished = async (post: BlogPost) => {
    try {
      const updated = await adminFetch(`/api/admin/content/blog/${post.id}`, "PUT", { published: !post.published });
      setPosts((p) => p.map((x) => x.id === post.id ? updated.post : x));
    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
  };

  const deleteFaq = async (id: string) => {
    try {
      await adminFetch(`/api/admin/content/faqs/${id}`, "DELETE");
      setFaqs((f) => f.filter((x) => x.id !== id));
      toast({ title: "FAQ deleted" });
    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
  };

  const deleteCatalogItem = async (id: string) => {
    try {
      await adminFetch(`/api/admin/content/catalog/${id}`, "DELETE");
      setCatalog((c) => c.filter((x) => x.id !== id));
      toast({ title: "Item deleted" });
    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
  };

  const filteredPosts = useMemo(() => {
    const q = postFilter.trim().toLowerCase();
    return q ? posts.filter((p) => (p.title + p.excerpt).toLowerCase().includes(q)) : posts;
  }, [posts, postFilter]);

  const filteredFaqs = useMemo(() => {
    const q = faqFilter.trim().toLowerCase();
    return q ? faqs.filter((f) => (f.question + f.answer).toLowerCase().includes(q)) : faqs;
  }, [faqs, faqFilter]);

  const filteredCatalog = useMemo(() => {
    const q = catalogFilter.trim().toLowerCase();
    return q ? catalog.filter((c) => c.name.toLowerCase().includes(q)) : catalog;
  }, [catalog, catalogFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
      </div>
    );
  }

  return (
    <div className="grid gap-8">
      <div className="grid gap-3">
        <SectionHeading eyebrow="Content & Website" title="Legacy Content Tools" description="Manage blog posts and legacy FAQ/catalog records while Website Manager remains the primary public presentation surface." />
        <AdminOwnershipNote
          title="Ownership clarity"
          description="Blog management currently lives here. FAQs and Marketplace Products overlap with Website Manager and should be treated as legacy operational tools until canonical ownership is consolidated."
        >
          <AdminOwnershipBadge kind="legacy" />
          <AdminOwnershipBadge kind="operational" label="Operational Records" />
        </AdminOwnershipNote>
      </div>

      <Tabs defaultValue="blog">
        <TabsList>
          <TabsTrigger value="blog">Blog Posts</TabsTrigger>
          <TabsTrigger value="faq">FAQs</TabsTrigger>
          <TabsTrigger value="catalog">Marketplace Products</TabsTrigger>
        </TabsList>

        {/* ── Blog ── */}
        <TabsContent value="blog" className="mt-4 space-y-4">
          <AdminOwnershipNote
            title="Blog ownership"
            description="This is the current operational blog manager. Future consolidation can move Blog under the Content & Website domain without changing public rendering."
          >
            <AdminOwnershipBadge kind="primary" />
          </AdminOwnershipNote>
          <div className="flex items-center justify-between gap-3">
            <Input placeholder="Search posts…" className="w-72" value={postFilter} onChange={(e) => setPostFilter(e.target.value)} />
            <NewBlogPostDialog onCreated={(post) => { setPosts((p) => [post, ...p]); toast({ title: "Post created" }); }} />
          </div>
          <div className="rounded-2xl border border-border/70 bg-card/95">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Author</TableHead>
                  <TableHead>Read time</TableHead>
                  <TableHead>Published</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPosts.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No blog posts yet.</TableCell></TableRow>
                ) : filteredPosts.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.title}</TableCell>
                    <TableCell className="text-muted-foreground">{p.author}</TableCell>
                    <TableCell>{p.reading_time_minutes} min</TableCell>
                    <TableCell>
                      <Switch checked={p.published} onCheckedChange={() => togglePostPublished(p)} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deletePost(p.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ── FAQ ── */}
        <TabsContent value="faq" className="mt-4 space-y-4">
          <AdminOwnershipNote
            title="Legacy FAQ management"
            description="Website Manager also exposes public FAQ visibility. Use this page only when managing legacy FAQ records directly."
          >
            <AdminOwnershipBadge kind="legacy" />
          </AdminOwnershipNote>
          <div className="flex items-center justify-between gap-3">
            <Input placeholder="Search FAQs…" className="w-72" value={faqFilter} onChange={(e) => setFaqFilter(e.target.value)} />
            <NewFaqDialog onCreated={(faq) => { setFaqs((f) => [faq, ...f]); toast({ title: "FAQ added" }); }} />
          </div>
          <div className="rounded-2xl border border-border/70 bg-card/95">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[35%]">Question</TableHead>
                  <TableHead>Answer</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFaqs.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No FAQs yet.</TableCell></TableRow>
                ) : filteredFaqs.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{f.question}</TableCell>
                    <TableCell className="text-muted-foreground text-sm line-clamp-2">{f.answer}</TableCell>
                    <TableCell><Badge variant="outline">{f.category}</Badge></TableCell>
                    <TableCell><Badge variant="outline" className={f.active ? "bg-green-500/10 text-green-700" : "bg-muted"}>{f.active ? "Active" : "Hidden"}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteFaq(f.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ── Catalog ── */}
        <TabsContent value="catalog" className="mt-4 space-y-4">
          <AdminOwnershipNote
            title="Operational product management"
            description="Use this area for legacy marketplace product records. Website Manager's Marketplace tab clarifies public presentation and visibility."
          >
            <AdminOwnershipBadge kind="operational" />
          </AdminOwnershipNote>
          <div className="flex items-center justify-between gap-3">
            <Input placeholder="Search products…" className="w-72" value={catalogFilter} onChange={(e) => setCatalogFilter(e.target.value)} />
            <NewCatalogItemDialog onCreated={(item) => { setCatalog((c) => [item, ...c]); toast({ title: "Product added" }); }} />
          </div>
          <div className="rounded-2xl border border-border/70 bg-card/95">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCatalog.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No products yet.</TableCell></TableRow>
                ) : filteredCatalog.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell><Badge variant="outline">{item.category}</Badge></TableCell>
                    <TableCell>${(item.price_cents / 100).toFixed(2)}</TableCell>
                    <TableCell><Badge variant="outline" className={item.active ? "bg-green-500/10 text-green-700" : "bg-muted"}>{item.active ? "Active" : "Hidden"}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteCatalogItem(item.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

// ── Dialogs ───────────────────────────────────────────────────────────────────

const NewBlogPostDialog = ({ onCreated }: { onCreated: (post: BlogPost) => void }) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(""); const [slug, setSlug] = useState("");
  const [excerpt, setExcerpt] = useState(""); const [author, setAuthor] = useState("No More Mosquitoes");
  const [reading, setReading] = useState(3);

  const autoSlug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const res = await adminFetch("/api/admin/content/blog", "POST", {
        title: title.trim(), slug: slug.trim() || autoSlug(title), excerpt: excerpt.trim(),
        author, reading_time_minutes: reading, published: false,
      });
      onCreated(res.post);
      setOpen(false); setTitle(""); setSlug(""); setExcerpt("");
    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-xl shadow-brand"><Plus className="mr-2 h-4 w-4" />New Post</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>New Blog Post</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Title *</Label><Input value={title} onChange={(e) => { setTitle(e.target.value); setSlug(autoSlug(e.target.value)); }} /></div>
          <div><Label>Slug</Label><Input value={slug} onChange={(e) => setSlug(e.target.value)} /></div>
          <div><Label>Excerpt</Label><Textarea value={excerpt} onChange={(e) => setExcerpt(e.target.value)} rows={2} /></div>
          <div><Label>Author</Label><Input value={author} onChange={(e) => setAuthor(e.target.value)} /></div>
          <div><Label>Reading time (minutes)</Label><Input type="number" min={1} value={reading} onChange={(e) => setReading(parseInt(e.target.value || "1", 10))} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!title.trim() || saving}>{saving ? "Saving…" : "Create Post"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const NewFaqDialog = ({ onCreated }: { onCreated: (faq: Faq) => void }) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false); const [saving, setSaving] = useState(false);
  const [question, setQuestion] = useState(""); const [answer, setAnswer] = useState("");
  const [category, setCategory] = useState("general");

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const res = await adminFetch("/api/admin/content/faqs", "POST", { question: question.trim(), answer: answer.trim(), category });
      onCreated(res.faq);
      setOpen(false); setQuestion(""); setAnswer("");
    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-xl shadow-brand"><Plus className="mr-2 h-4 w-4" />New FAQ</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>New FAQ</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Question *</Label><Input value={question} onChange={(e) => setQuestion(e.target.value)} /></div>
          <div><Label>Answer *</Label><Textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={3} /></div>
          <div><Label>Category</Label>
            <select className="w-full h-10 rounded-xl border border-border/60 bg-background px-3 text-sm" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="general">General</option>
              <option value="billing">Billing</option>
              <option value="service">Service</option>
              <option value="safety">Safety</option>
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!question.trim() || !answer.trim() || saving}>{saving ? "Saving…" : "Add FAQ"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const NewCatalogItemDialog = ({ onCreated }: { onCreated: (item: CatalogItem) => void }) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false); const [saving, setSaving] = useState(false);
  const [name, setName] = useState(""); const [description, setDescription] = useState("");
  const [priceDollars, setPriceDollars] = useState(""); const [imageUrl, setImageUrl] = useState("");
  const [category, setCategory] = useState("treatment");

  const handleSubmit = async () => {
    const price_cents = Math.round(parseFloat(priceDollars) * 100);
    if (isNaN(price_cents) || price_cents <= 0) { toast({ title: "Invalid price", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const res = await adminFetch("/api/admin/content/catalog", "POST", {
        name: name.trim(), description: description.trim(), price_cents, image_url: imageUrl.trim(), category,
      });
      onCreated(res.item);
      setOpen(false); setName(""); setDescription(""); setPriceDollars(""); setImageUrl("");
    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-xl shadow-brand"><Plus className="mr-2 h-4 w-4" />Add Product</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Add Marketplace Product</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></div>
          <div><Label>Price (USD) *</Label><Input type="number" min="0" step="0.01" placeholder="29.99" value={priceDollars} onChange={(e) => setPriceDollars(e.target.value)} /></div>
          <div><Label>Image URL</Label><Input placeholder="https://…" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} /></div>
          <div><Label>Category</Label>
            <select className="w-full h-10 rounded-xl border border-border/60 bg-background px-3 text-sm" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="treatment">Treatment</option>
              <option value="repellent">Repellent</option>
              <option value="gear">Gear</option>
              <option value="bundle">Bundle</option>
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || !priceDollars || saving}>{saving ? "Saving…" : "Add Product"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default Content;
