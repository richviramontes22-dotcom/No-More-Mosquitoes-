import { useMemo, useState } from "react";
import SectionHeading from "@/components/common/SectionHeading";
import { messages as seed, findCustomer } from "@/data/admin";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const Messages = () => {
  const [threads, setThreads] = useState(() => seed.slice());
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState(threads[0]?.id ?? "");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter((t) => (t.subject + findCustomer(t.customerId).name).toLowerCase().includes(q));
  }, [threads, query]);

  const active = filtered.find((t) => t.id === activeId) ?? filtered[0] ?? null;

  const reply = (body: string) => {
    if (!active) return;
    const msg = { id: `local_${Math.random()}`, at: new Date().toISOString(), from: "agent" as const, body };
    setThreads((prev) => prev.map((t) => (t.id === active.id ? { ...t, messages: [...t.messages, msg], lastMessageAt: msg.at, unreadCount: 0 } : t)));
  };

  return (
    <div className="grid gap-8">
      <SectionHeading
        eyebrow="Support Inbox"
        title="Customer conversations"
        description="Threaded messages across email, SMS, and web."
      />

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="rounded-2xl border border-border/70 bg-card/95 p-3">
          <Input placeholder="Search subject or name" value={query} onChange={(e) => setQuery(e.target.value)} />
          <div className="mt-3 divide-y">
            {filtered.map((t) => {
              const c = findCustomer(t.customerId);
              const active = t.id === activeId;
              return (
                <button
                  key={t.id}
                  className={`block w-full p-3 text-left text-sm ${active ? "bg-muted/60" : "hover:bg-muted/40"}`}
                  onClick={() => setActiveId(t.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-muted-foreground">{new Date(t.lastMessageAt).toLocaleDateString()}</div>
                  </div>
                  <div className="mt-1 line-clamp-1 text-muted-foreground">{t.subject}</div>
                  {t.unreadCount > 0 && (
                    <div className="mt-1 text-xs text-primary">{t.unreadCount} unread</div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card/95 p-4">
          {active ? (
            <Conversation threadId={active.id} onReply={reply} />
          ) : (
            <div className="p-10 text-center text-sm text-muted-foreground">Select a conversation</div>
          )}
        </div>
      </div>
    </div>
  );
};

const Conversation = ({ threadId, onReply }: { threadId: string; onReply: (body: string) => void }) => {
  const t = seed.find((x) => x.id === threadId)!;
  const c = findCustomer(t.customerId);
  const [body, setBody] = useState("");

  return (
    <div className="grid h-full grid-rows-[auto_1fr_auto] gap-3">
      <div className="border-b pb-2">
        <div className="text-sm font-semibold">{c.name}</div>
        <div className="text-xs text-muted-foreground">{t.subject}</div>
      </div>
      <div className="space-y-2 overflow-y-auto pr-2">
        {t.messages.map((m) => (
          <div key={m.id} className="text-sm">
            <span className="mr-2 rounded bg-muted px-2 py-0.5 text-muted-foreground">{m.from}</span>
            <span>{m.body}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <Input placeholder="Type a reply…" value={body} onChange={(e) => setBody(e.target.value)} />
        <Button
          onClick={() => {
            if (!body.trim()) return;
            onReply(body.trim());
            setBody("");
          }}
        >
          Send
        </Button>
      </div>
    </div>
  );
};

export default Messages;
