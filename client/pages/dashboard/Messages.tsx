import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import SectionHeading from "@/components/common/SectionHeading";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useMessages, Thread } from "@/hooks/dashboard/useMessages";
import { stringifyError } from "@/lib/error-utils";
import { Loader2, MessageSquare, ChevronRight, User, Calendar, Send } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/lib/supabase";

const Messages = () => {
  const { user, isHydrated } = useAuth();
  const { toast } = useToast();
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [threadMessages, setThreadMessages] = useState<Array<{ id: string; body: string; from: string; created_at: string }>>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  const openThread = async (thread: Thread) => {
    setSelectedThread(thread);
    setLoadingMessages(true);
    setThreadMessages([]);
    try {
      const { data } = await supabase
        .from("messages")
        .select("id, body, from, created_at")
        .eq("thread_id", thread.id)
        .order("created_at", { ascending: true });
      setThreadMessages(data || []);
    } catch {
      // Non-fatal — show empty state
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !selectedThread || !user) return;
    setSending(true);
    try {
      const { data, error } = await supabase
        .from("messages")
        .insert({ thread_id: selectedThread.id, body: replyText.trim(), from: "customer" })
        .select()
        .single();
      if (error) throw error;
      setThreadMessages((prev) => [...prev, data]);
      setReplyText("");
      // Update thread last_activity_at
      await supabase
        .from("message_threads")
        .update({ last_activity_at: new Date().toISOString() })
        .eq("id", selectedThread.id);
    } catch (err: any) {
      toast({ title: "Failed to send", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  // Use React Query hook for caching and automatic data management
  // With keepPreviousData: true, data is preserved across refetches
  const { data: threads = [], isLoading, isError, error, status } = useMessages(user?.id);

  // SECTION 5: Guarantee page loader terminates
  const isPageLoading = isHydrated && (isLoading && threads.length === 0);
  const hasLoadError = isHydrated && isError && threads.length === 0;

  // SECTION 8: Debug logging for validation
  useEffect(() => {
    if (import.meta.env.DEV) console.log("[Messages] authReady=" + isHydrated + " userId=" + (user?.id ? "***" : "none") + " status=" + status + " isPageLoading=" + isPageLoading);
  }, [isHydrated, user?.id, status, isPageLoading]);

  // CRITICAL FIX: Log errors but do NOT clear the UI or data
  useEffect(() => {
    if (isError && error) {
      console.error("[Messages] query timed out or failed", error);
      // Only show toast if we have no data at all
      if (threads.length === 0) {
        if (import.meta.env.DEV) console.log("[Messages] rendering error state");
        toast({
          title: "Unable to Load Messages",
          description: stringifyError(error),
          variant: "destructive"
        });
      } else {
        // Show warning toast instead of destructive error
        if (import.meta.env.DEV) console.log("[Messages] rendering data state with cached messages");
        toast({
          title: "Info: Using cached messages",
          description: "Showing previously loaded data. New data could not be fetched.",
          variant: "default"
        });
      }
    }
  }, [isError, error, toast, threads.length]);

  return (
    <div className="grid gap-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <SectionHeading
          eyebrow="Messages"
          title="Technician Conversations"
          description="Direct communication with your service team regarding scheduled visits and property notes."
        />
        <Button className="rounded-xl shadow-brand" asChild>
          <Link to="/dashboard/support">
            <MessageSquare className="mr-2 h-4 w-4" />
            New Message
          </Link>
        </Button>
      </div>

      <div className="grid gap-4">
        {isPageLoading ? (
          <div className="flex flex-col items-center justify-center p-12 bg-muted/20 rounded-[28px] border border-dashed border-border">
            <Loader2 className="h-8 w-8 animate-spin text-primary/40 mb-4" />
            <p className="text-muted-foreground font-medium italic">Loading your conversations...</p>
          </div>
        ) : hasLoadError ? (
          <div className="p-12 text-center bg-red-50 rounded-[28px] border border-red-200 space-y-4">
            <MessageSquare className="h-10 w-10 text-red-600 mx-auto" />
            <div className="space-y-2">
              <p className="font-semibold text-red-900">Unable to Load Messages</p>
              <p className="text-sm text-red-700">{error?.message}</p>
            </div>
            <Button variant="outline" onClick={() => window.location.reload()} className="rounded-xl">
              Reload Page
            </Button>
          </div>
        ) : threads.length > 0 ? (
          threads.map((thread) => (
            <Card key={thread.id} onClick={() => openThread(thread)} className="rounded-[24px] border-border/60 bg-card/95 shadow-soft transition-all hover:shadow-md hover:border-primary/30 cursor-pointer group">
              <CardContent className="p-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <User className="h-6 w-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Job #{thread.jobId}</span>
                        <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(thread.lastActivityAt).toLocaleDateString()}
                        </span>
                      </div>
                      <h4 className="font-bold text-lg truncate">{thread.address}</h4>
                      <p className="text-sm text-muted-foreground line-clamp-1 italic">
                        "{thread.lastMessage}"
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="p-12 text-center bg-muted/20 rounded-[28px] border border-dashed border-border space-y-4">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground/40 mb-4">
              <MessageSquare className="h-8 w-8" />
            </div>
            <p className="text-muted-foreground font-medium italic">No message threads found.</p>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">Conversation threads are created when a technician is assigned to your visit.</p>
          </div>
        )}
      </div>

      {/* Thread Detail Sheet */}
      <Sheet open={!!selectedThread} onOpenChange={(open) => { if (!open) { setSelectedThread(null); setReplyText(""); } }}>
        <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-0">
          <SheetHeader className="px-6 py-4 border-b border-border/40">
            <SheetTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              {selectedThread?.address || "Conversation"}
            </SheetTitle>
          </SheetHeader>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 min-h-0">
            {loadingMessages ? (
              <div className="flex justify-center pt-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary/40" />
              </div>
            ) : threadMessages.length === 0 ? (
              <div className="text-center pt-12 text-muted-foreground text-sm">
                No messages yet. Start the conversation below.
              </div>
            ) : (
              threadMessages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.from === "customer" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                    msg.from === "customer"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-muted text-foreground rounded-bl-sm"
                  }`}>
                    <p>{msg.body}</p>
                    <p className={`text-[10px] mt-1 ${msg.from === "customer" ? "text-primary-foreground/70 text-right" : "text-muted-foreground"}`}>
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Reply Input */}
          <div className="border-t border-border/40 px-6 py-4 space-y-3">
            <Textarea
              placeholder="Type your message…"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendReply(); } }}
              className="resize-none rounded-xl"
              rows={3}
            />
            <Button onClick={handleSendReply} disabled={!replyText.trim() || sending} className="w-full rounded-xl shadow-brand">
              <Send className="mr-2 h-4 w-4" />
              {sending ? "Sending…" : "Send Message"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default Messages;
