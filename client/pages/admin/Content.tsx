import { useMemo, useState } from "react";
import SectionHeading from "@/components/common/SectionHeading";
import { blogPosts as seedPosts } from "@/data/blog";
import { faqs as seedFaqs } from "@/data/site";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Content = () => {
  const [posts, setPosts] = useState(() => seedPosts.slice());
  const [faqs, setFaqs] = useState(() => seedFaqs.map((f) => ({ ...f })));

  const [postFilter, setPostFilter] = useState("");
  const filteredPosts = useMemo(() => {
    const q = postFilter.trim().toLowerCase();
    if (!q) return posts;
    return posts.filter((p) => (p.title + p.excerpt).toLowerCase().includes(q));
  }, [posts, postFilter]);

  const [faqFilter, setFaqFilter] = useState("");
  const filteredFaqs = useMemo(() => {
    const q = faqFilter.trim().toLowerCase();
    if (!q) return faqs;
    return faqs.filter((f) => (f.question + f.answer).toLowerCase().includes(q));
  }, [faqs, faqFilter]);

  return (
    <div className="grid gap-8">
      <SectionHeading
        eyebrow="Content"
        title="Blog & FAQ management"
        description="Draft, schedule, and publish content with SEO fields."
      />

      <Tabs defaultValue="blog">
        <TabsList>
          <TabsTrigger value="blog">Blog</TabsTrigger>
          <TabsTrigger value="faq">FAQ</TabsTrigger>
        </TabsList>

        <TabsContent value="blog" className="mt-4">
          <div className="flex items-center justify-between gap-3">
            <Input placeholder="Search posts" className="w-72" value={postFilter} onChange={(e) => setPostFilter(e.target.value)} />
            <NewPost onCreate={(p) => setPosts((prev) => [p, ...prev])} />
          </div>
          <div className="mt-4 rounded-2xl border border-border/70 bg-card/95 p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Published</TableHead>
                  <TableHead>Reading time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPosts.map((p) => (
                  <TableRow key={p.slug}>
                    <TableCell>{p.title}</TableCell>
                    <TableCell>{new Date(p.publishedAt).toLocaleDateString()}</TableCell>
                    <TableCell>{p.readingTimeMinutes} min</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="faq" className="mt-4">
          <div className="flex items-center justify-between gap-3">
            <Input placeholder="Search FAQs" className="w-72" value={faqFilter} onChange={(e) => setFaqFilter(e.target.value)} />
            <NewFaq onCreate={(f) => setFaqs((prev) => [f, ...prev])} />
          </div>
          <div className="mt-4 rounded-2xl border border-border/70 bg-card/95 p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Question</TableHead>
                  <TableHead>Answer</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFaqs.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="w-[40%]">{f.question}</TableCell>
                    <TableCell className="text-muted-foreground">{f.answer}</TableCell>
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

const NewPost = ({ onCreate }: { onCreate: (p: { slug: string; title: string; excerpt: string; publishedAt: string; readingTimeMinutes: number }) => void }) => {
  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reading, setReading] = useState(5);

  const valid = title.trim() && excerpt.trim();

  return (
    <div className="flex items-center gap-2">
      <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <Input placeholder="Excerpt" value={excerpt} onChange={(e) => setExcerpt(e.target.value)} />
      <input className="h-10 rounded-md border border-input bg-background px-3 text-sm" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <input className="h-10 w-24 rounded-md border border-input bg-background px-3 text-sm" type="number" min={1} value={reading} onChange={(e) => setReading(parseInt(e.target.value || "1", 10))} />
      <Button
        onClick={() =>
          onCreate({ slug: title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""), title: title.trim(), excerpt: excerpt.trim(), publishedAt: date, readingTimeMinutes: reading })
        }
        disabled={!valid}
      >
        Add
      </Button>
    </div>
  );
};

const NewFaq = ({ onCreate }: { onCreate: (f: { id: string; question: string; answer: string }) => void }) => {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const valid = question.trim() && answer.trim();
  return (
    <div className="flex items-center gap-2">
      <Input placeholder="Question" value={question} onChange={(e) => setQuestion(e.target.value)} />
      <Input placeholder="Answer" value={answer} onChange={(e) => setAnswer(e.target.value)} />
      <Button onClick={() => onCreate({ id: `faq_${Math.floor(Math.random() * 1e6)}`, question: question.trim(), answer: answer.trim() })} disabled={!valid}>
        Add
      </Button>
    </div>
  );
};

export default Content;
