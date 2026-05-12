import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import SectionHeading from "@/components/common/SectionHeading";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Send } from "lucide-react";
import { AdminOwnershipBadge, AdminOwnershipNote } from "@/components/admin/AdminOwnershipBadge";

interface MessageThread {
  id: string;
  subject: string;
  customer_name: string;
  customer_email: string;
  assignment_id: string;
  created_at: string;
  last_message_at: string;
  unread_count: number;
  messages: Message[];
}

interface Message {
  id: string;
  body: string;
  from: "customer" | "agent";
  created_at: string;
}

const Messages = () => {
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string>("");
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  // Load message threads from Supabase (paginated, without messages)
  useEffect(() => {
    const loadThreads = async () => {
      try {
        setIsLoading(true);

        // Pagination: fetch only thread metadata, not full message history
        const offset = (page - 1) * ITEMS_PER_PAGE;
        const { data: threadData, error } = await supabase
          .from("message_threads")
          .select(`
            id,
            assignment_id,
            created_at,
            last_activity_at,
            assignments (
              appointment_id,
              profiles:user_id (name, email)
            )
          `)
          .order("last_activity_at", { ascending: false })
          .range(offset, offset + ITEMS_PER_PAGE - 1);

        if (error) {
          console.error("[Messages] Error loading:", error);
          setThreads([]);
          return;
        }

        // Map data - messages will be loaded on demand when thread is selected
        const mapped = (threadData || []).map((t: any) => ({
          id: t.id,
          subject: `Conversation #${t.id.slice(0, 8)}`,
          customer_name: t.assignments?.profiles?.name || "Unknown",
          customer_email: t.assignments?.profiles?.email || "",
          assignment_id: t.assignment_id,
          created_at: t.created_at,
          last_message_at: t.last_activity_at || t.created_at,
          unread_count: 0, // Would need separate query if tracking unread status
          messages: [] // Messages loaded on demand
        }));

        setThreads(mapped);
        if (mapped.length > 0 && !activeId) {
          setActiveId(mapped[0].id);
        }
      } catch (err) {
        console.error("[Messages] Exception:", err);
        setThreads([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadThreads();
  }, [page, activeId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter((t) => 
      (t.subject + t.customer_name + t.customer_email).toLowerCase().includes(q)
    );
  }, [threads, query]);

  const active = filtered.find((t) => t.id === activeId) ?? filtered[0] ?? null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading messages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-8">
      <SectionHeading
        eyebrow="Support Inbox"
        title="Customer conversations"
        description="Message threads between customers and support team."
      />

      <AdminOwnershipNote
        title="Support conversation queue"
        description="Messages remain in the Support domain. Customer profiles are linked for account context when a conversation needs escalation."
      >
        <AdminOwnershipBadge kind="operational" />
        <Button variant="outline" size="sm" className="rounded-xl" asChild>
          <Link to="/admin/customers">Customer Database</Link>
        </Button>
      </AdminOwnershipNote>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr] min-h-[500px]">
        <div className="rounded-2xl border border-border/70 bg-card/95 p-3 flex flex-col">
          <Input
            placeholder="Search by name..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="rounded-lg"
          />
          <div className="mt-3 divide-y flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No conversations found
              </div>
            ) : (
              filtered.map((t) => {
                const isActive = t.id === activeId;
                return (
                  <button
                    key={t.id}
                    className={`block w-full p-3 text-left text-sm transition-colors ${
                      isActive
                        ? "bg-primary/10 border-l-2 border-primary"
                        : "hover:bg-muted/40"
                    }`}
                    onClick={() => setActiveId(t.id)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium truncate">{t.customer_name}</div>
                      <div className="text-xs text-muted-foreground shrink-0">
                        {new Date(t.last_message_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                      {t.subject}
                    </div>
                    {t.unread_count > 0 && (
                      <div className="mt-1 text-xs font-bold text-primary">
                        {t.unread_count} unread
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
          <div className="border-t mt-3 pt-3 flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex-1"
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage(p => p + 1)}
              disabled={threads.length < ITEMS_PER_PAGE}
              className="flex-1"
            >
              Next
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card/95 overflow-hidden flex flex-col">
          {active ? (
            <Conversation thread={active} onMessageAdded={() => {}} />
          ) : (
            <div className="p-10 text-center text-sm text-muted-foreground flex items-center justify-center h-full">
              {threads.length === 0 ? "No conversations" : "Select a conversation"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const Conversation = ({ thread, onMessageAdded }: { thread: MessageThread; onMessageAdded: () => void }) => {
  const [body, setBody] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);

  // Load messages on demand when thread is selected
  useEffect(() => {
    const loadMessages = async () => {
      try {
        setIsLoadingMessages(true);
        const { data: msgData, error } = await supabase
          .from("messages")
          .select("id, body, from, created_at")
          .eq("thread_id", thread.id)
          .order("created_at", { ascending: true });

        if (error) throw error;

        setMessages((msgData || []).map((m: any) => ({
          id: m.id,
          body: m.body,
          from: m.from || "customer",
          created_at: m.created_at
        })));
      } catch (err) {
        console.error("[Conversation] Error loading messages:", err);
        setMessages([]);
      } finally {
        setIsLoadingMessages(false);
      }
    };

    loadMessages();
  }, [thread.id]);

  const handleSendReply = async () => {
    if (!body.trim()) return;

    try {
      setIsSending(true);
      const { data: msgData, error } = await supabase
        .from("messages")
        .insert({
          thread_id: thread.id,
          body: body.trim(),
          from: "agent"
        })
        .select("id, body, from, created_at")
        .single();

      if (error) throw error;

      // Add message to local state
      if (msgData) {
        setMessages(prev => [...prev, {
          id: msgData.id,
          body: msgData.body,
          from: msgData.from || "agent",
          created_at: msgData.created_at
        }]);
      }

      setBody("");
      onMessageAdded();
    } catch (err) {
      console.error("[Messages] Error sending reply:", err);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="grid h-full grid-rows-[auto_1fr_auto] gap-3 p-4">
      <div className="border-b pb-3">
        <div className="text-sm font-semibold">{thread.customer_name}</div>
        <div className="text-xs text-muted-foreground">{thread.customer_email}</div>
        <div className="text-xs text-muted-foreground mt-1">
          Started {new Date(thread.created_at).toLocaleDateString()}
        </div>
      </div>

      <div className="space-y-3 overflow-y-auto pr-2">
        {isLoadingMessages ? (
          <div className="text-center text-sm text-muted-foreground py-8 flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading messages...
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-8">
            No messages in this conversation
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`text-sm p-3 rounded-lg ${
                m.from === "agent"
                  ? "bg-primary/10 border border-primary/20 ml-auto max-w-xs"
                  : "bg-muted/50 border border-border/40 mr-auto max-w-xs"
              }`}
            >
              <div className="text-xs font-bold text-muted-foreground mb-1 capitalize">
                {m.from}
              </div>
              <div>{m.body}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {new Date(m.created_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit"
                })}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="border-t pt-3 grid grid-cols-[1fr_auto] gap-2">
        <Input
          placeholder="Type a reply…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSendReply();
            }
          }}
          className="rounded-lg"
          disabled={isSending}
        />
        <Button
          onClick={handleSendReply}
          disabled={!body.trim() || isSending}
          className="rounded-lg"
          size="icon"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default Messages;
