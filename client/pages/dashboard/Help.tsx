import { useEffect, useState } from "react";
import SectionHeading from "@/components/common/SectionHeading";
import { isTimeoutError, supabase, withTimeout } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { siteConfig } from "@/data/site";
import {
  LifeBuoy,
  Phone,
  MessageCircle,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowRight,
  Loader2,
  MessageSquare,
  ChevronRight,
  User,
  Calendar,
  Send,
  History as HistoryIcon,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { useMessages, Thread } from "@/hooks/dashboard/useMessages";
import { cn } from "@/lib/utils";

type TicketCategory = "billing" | "scheduling" | "service_quality" | "retreatment_request" | "property_access" | "pesticide_question" | "general";
type TicketStatus = "open" | "in_progress" | "pending_customer" | "pending_staff" | "escalated" | "resolved" | "closed";
type TicketPriority = "low" | "medium" | "high" | "urgent";

interface SupportTicket {
  id: string;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: TicketCategory;
  created_at: string;
}

interface TicketMessage {
  id: string;
  body: string;
  sender_role: "customer" | "staff";
  created_at: string;
}

const ticketSelectFields = "id, subject, description, status, priority, category, created_at, updated_at";

const CATEGORY_LABELS: Record<TicketCategory, string> = {
  billing: "Billing",
  scheduling: "Scheduling",
  service_quality: "Service Quality",
  retreatment_request: "Retreatment Request",
  property_access: "Property Access",
  pesticide_question: "Pesticide Question",
  general: "General",
};

const normalizeTicket = (t: any): SupportTicket => ({
  id: t.id,
  subject: t.subject,
  description: t.description || "",
  status: t.status || "open",
  priority: t.priority || "medium",
  category: t.category || "general",
  created_at: t.created_at,
});

const statusIcon = (status: string) => {
  if (status === "resolved" || status === "closed") return <CheckCircle2 className="h-4 w-4 text-green-500" />;
  if (status === "escalated") return <AlertCircle className="h-4 w-4 text-red-500" />;
  if (status === "in_progress" || status === "pending_staff") return <Clock className="h-4 w-4 text-blue-500" />;
  return <AlertCircle className="h-4 w-4 text-amber-500" />;
};

const statusColor = (status: string) => {
  if (status === "resolved") return "text-green-600";
  if (status === "escalated") return "text-red-600";
  if (status === "in_progress" || status === "pending_staff") return "text-blue-600";
  if (status === "closed") return "text-muted-foreground";
  return "text-amber-600";
};

// ── Tab bar ──────────────────────────────────────────────────────────────────

const TabBar = ({
  active,
  onChange,
}: {
  active: "support" | "messages";
  onChange: (t: "support" | "messages") => void;
}) => (
  <div className="flex gap-1 p-1 bg-muted/30 rounded-xl border border-border/60 w-fit">
    {(["support", "messages"] as const).map((t) => (
      <button
        key={t}
        type="button"
        onClick={() => onChange(t)}
        className={cn(
          "px-5 py-2 rounded-lg text-sm font-semibold transition-all capitalize",
          active === t
            ? "bg-card shadow-sm text-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        {t === "support" ? "Support" : "Messages"}
      </button>
    ))}
  </div>
);

// ── Main ─────────────────────────────────────────────────────────────────────

const Help = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"support" | "messages">("support");

  // ── Support state ─────────────────────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [isLoadingTickets, setIsLoadingTickets] = useState(true);
  const [ticketLoadError, setTicketLoadError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<TicketCategory>("general");
  const [priority, setPriority] = useState<TicketPriority>("medium");

  // ── Ticket detail/reply state ─────────────────────────────────────────────
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [ticketMessages, setTicketMessages] = useState<TicketMessage[]>([]);
  const [loadingTicketMessages, setLoadingTicketMessages] = useState(false);
  const [ticketReplyText, setTicketReplyText] = useState("");
  const [sendingTicketReply, setSendingTicketReply] = useState(false);

  // ── Messages state ────────────────────────────────────────────────────────
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [threadMessages, setThreadMessages] = useState<
    Array<{ id: string; body: string; direction: "inbound" | "outbound"; created_at: string }>
  >([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  // ── Load tickets ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) {
      setIsLoadingTickets(false);
      return;
    }
    let mounted = true;
    const load = async () => {
      setIsLoadingTickets(true);
      setTicketLoadError(null);
      try {
        const { data, error } = await withTimeout(
          supabase
            .from("tickets")
            .select(ticketSelectFields)
            .eq("user_id", user.id)
            .order("created_at", { ascending: false }),
          10000,
          "Support tickets"
        );
        if (!mounted) return;
        if (error) { setTicketLoadError(error.message); return; }
        setTickets((data || []).map(normalizeTicket));
      } catch (err: any) {
        if (mounted) setTicketLoadError(err.message);
      } finally {
        if (mounted) setIsLoadingTickets(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [user?.id]);

  // ── Messages hook ─────────────────────────────────────────────────────────
  const { data: threads = [], isLoading: threadsLoading } = useMessages(user?.id);

  const openThread = async (thread: Thread) => {
    setSelectedThread(thread);
    setLoadingMessages(true);
    setThreadMessages([]);
    try {
      const { data } = await supabase
        .from("messages")
        .select("id, body, direction, created_at")
        .eq("thread_id", thread.id)
        .order("created_at", { ascending: true });
      setThreadMessages(data || []);
    } catch {
      // non-fatal
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
        .insert({ thread_id: selectedThread.id, sender_id: user.id, body: replyText.trim(), direction: "inbound" })
        .select()
        .single();
      if (error) throw error;
      setThreadMessages((prev) => [...prev, data]);
      setReplyText("");
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

  // ── Support actions ───────────────────────────────────────────────────────
  const handleReService = async () => {
    if (!user?.id) return;
    setIsSubmitting(true);
    try {
      const { data, error } = await withTimeout(
        supabase
          .from("tickets")
          .insert({
            user_id: user.id,
            subject: "Re-service request",
            description: "Please re-service my yard. I noticed mosquitoes returning.",
            priority: "medium",
            status: "open",
          })
          .select(ticketSelectFields),
        10000,
        "Create re-service ticket"
      );
      if (error) throw error;
      if (data?.[0]) setTickets((prev) => [normalizeTicket(data[0]), ...prev]);
      toast({
        title: "Request Submitted",
        description: "A technician will be dispatched within 48 hours.",
      });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !subject.trim() || !body.trim()) return;
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase
        .from("tickets")
        .insert({ user_id: user.id, subject: subject.trim(), description: body.trim(), priority, category, status: "open" })
        .select();
      if (error) throw error;
      if (data?.[0]) setTickets((prev) => [normalizeTicket(data[0]), ...prev]);
      setSubject(""); setBody(""); setCategory("general"); setPriority("medium"); setShowCreateForm(false);
      toast({ title: "Ticket Created", description: "Our team will respond shortly." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Ticket detail/reply actions ───────────────────────────────────────────
  const openTicket = async (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    setLoadingTicketMessages(true);
    setTicketMessages([]);
    try {
      const { data } = await supabase
        .from("ticket_messages")
        .select("id, body, sender_role, created_at")
        .eq("ticket_id", ticket.id)
        .order("created_at", { ascending: true });
      setTicketMessages(data || []);
    } catch {
      // non-fatal — ticket detail still shows subject/description/status
    } finally {
      setLoadingTicketMessages(false);
    }
  };

  const sendTicketReply = async () => {
    if (!ticketReplyText.trim() || !selectedTicket || !user) return;
    setSendingTicketReply(true);
    try {
      const { data, error } = await supabase
        .from("ticket_messages")
        .insert({ ticket_id: selectedTicket.id, body: ticketReplyText.trim(), sender_role: "customer", sender_id: user.id })
        .select()
        .single();
      if (error) throw error;
      setTicketMessages((prev) => [...prev, data]);
      setTicketReplyText("");
    } catch (err: any) {
      toast({ title: "Failed to send", description: err.message, variant: "destructive" });
    } finally {
      setSendingTicketReply(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="grid gap-8">
      <SectionHeading
        eyebrow="Help"
        title="Help & Contact"
        description="Request a re-service, message our team, or browse your support history."
      />

      <TabBar active={activeTab} onChange={setActiveTab} />

      {/* ── Support Tab ──────────────────────────────────────────────────── */}
      {activeTab === "support" && (
        <div className="grid gap-8">
          {/* Quick-action cards */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="rounded-[28px] border-border/60 bg-card/95 shadow-soft overflow-hidden">
              <CardHeader className="bg-primary/5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <AlertCircle className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-xl">Re-service Promise</CardTitle>
                </div>
                <CardDescription className="pt-2">
                  If mosquitoes return between visits, we'll re-treat at no charge.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <Button
                  className="w-full rounded-xl shadow-brand"
                  onClick={handleReService}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Submitting…" : "Request Free Re-service"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>

            <Card className="rounded-[28px] border-border/60 bg-card/95 shadow-soft overflow-hidden">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                    <Phone className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-xl">Contact Local Team</CardTitle>
                </div>
                <CardDescription className="pt-2">
                  Speak with our team about your service or billing.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6 grid gap-3">
                <Button variant="outline" className="w-full rounded-xl" asChild>
                  <a href={siteConfig.phone.link}>
                    <Phone className="mr-2 h-4 w-4 text-primary" />
                    Call {siteConfig.phone.display}
                  </a>
                </Button>
                <Button variant="outline" className="w-full rounded-xl" asChild>
                  <a href={`sms:${siteConfig.phone.link.replace("tel:", "")}`}>
                    <MessageCircle className="mr-2 h-4 w-4 text-primary" />
                    Text {siteConfig.phone.display}
                  </a>
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Create ticket form */}
          {showCreateForm && (
            <Card className="rounded-[28px] border-border/60 bg-card/95 shadow-soft">
              <CardHeader>
                <CardTitle>New Support Ticket</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateTicket} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="ticket-subject">Subject</Label>
                    <Input
                      id="ticket-subject"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="Brief description of your issue…"
                      className="rounded-xl"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ticket-body">Message</Label>
                    <Textarea
                      id="ticket-body"
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      placeholder="Tell us more details…"
                      rows={4}
                      className="rounded-xl resize-none"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="ticket-category">Category</Label>
                      <select
                        id="ticket-category"
                        value={category}
                        onChange={(e) => setCategory(e.target.value as TicketCategory)}
                        disabled={isSubmitting}
                        className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm"
                      >
                        {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="ticket-priority">Priority (optional)</Label>
                      <select
                        id="ticket-priority"
                        value={priority}
                        onChange={(e) => setPriority(e.target.value as TicketPriority)}
                        disabled={isSubmitting}
                        className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Button type="submit" disabled={isSubmitting || !subject.trim() || !body.trim()} className="rounded-xl">
                      {isSubmitting ? "Submitting…" : "Submit Ticket"}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setShowCreateForm(false)} className="rounded-xl">
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Ticket history */}
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HistoryIcon className="h-5 w-5 text-muted-foreground" />
                <h3 className="text-lg font-semibold font-display">Support Tickets</h3>
              </div>
              {!showCreateForm && (
                <Button variant="outline" size="sm" onClick={() => setShowCreateForm(true)} className="rounded-lg">
                  New Ticket
                </Button>
              )}
            </div>

            {isLoadingTickets ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : ticketLoadError && tickets.length === 0 ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-6 flex gap-3 items-start">
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-900">Unable to Load Ticket History</p>
                  <p className="text-xs text-red-700 mt-1">
                    {isTimeoutError(ticketLoadError)
                      ? "Query exceeded 15 seconds. Re-service and contact still available."
                      : ticketLoadError}
                  </p>
                </div>
              </div>
            ) : tickets.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/50 p-8 text-center">
                <p className="text-sm text-muted-foreground">No support tickets yet.</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {tickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    onClick={() => openTicket(ticket)}
                    className="flex items-center justify-between rounded-2xl border border-border/60 bg-card p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                  >
                    <div className="flex items-start gap-4">
                      <div className="mt-1">{statusIcon(ticket.status)}</div>
                      <div>
                        <p className="text-sm font-bold text-foreground">{ticket.subject}</p>
                        <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">
                          <span>#{ticket.id.slice(0, 8)}</span>
                          <span>•</span>
                          <span>{new Date(ticket.created_at).toLocaleDateString()}</span>
                          <span>•</span>
                          <Badge variant="outline" className="h-auto py-0 text-[9px] uppercase bg-muted">
                            {CATEGORY_LABELS[ticket.category] || ticket.category}
                          </Badge>
                          <span>•</span>
                          <Badge
                            variant="outline"
                            className={cn(
                              "h-auto py-0 text-[9px] uppercase",
                              ticket.priority === "urgent" ? "bg-red-50 text-red-700 border-red-200"
                              : ticket.priority === "high" ? "bg-red-50 text-red-700 border-red-200"
                              : ticket.priority === "medium" ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-blue-50 text-blue-700 border-blue-200"
                            )}
                          >
                            {ticket.priority}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <span className={cn("text-xs font-semibold", statusColor(ticket.status))}>
                      {ticket.status.replace(/_/g, " ")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Messages Tab ─────────────────────────────────────────────────── */}
      {activeTab === "messages" && (
        <div className="grid gap-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Conversation threads are created when a technician is assigned to your visit.
            </p>
          </div>

          {threadsLoading ? (
            <div className="flex flex-col items-center justify-center p-12 bg-muted/20 rounded-[28px] border border-dashed border-border">
              <Loader2 className="h-8 w-8 animate-spin text-primary/40 mb-4" />
              <p className="text-muted-foreground font-medium italic">Loading conversations…</p>
            </div>
          ) : threads.length === 0 ? (
            <div className="p-12 text-center bg-muted/20 rounded-[28px] border border-dashed border-border space-y-3">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground/40">
                <MessageSquare className="h-8 w-8" />
              </div>
              <p className="text-muted-foreground font-medium italic">No message threads found.</p>
            </div>
          ) : (
            threads.map((thread) => (
              <Card
                key={thread.id}
                onClick={() => openThread(thread)}
                className="rounded-[24px] border-border/60 bg-card/95 shadow-soft transition-all hover:shadow-md hover:border-primary/30 cursor-pointer group"
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <User className="h-6 w-6" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            Job #{thread.jobId}
                          </span>
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
          )}
        </div>
      )}

      {/* ── Ticket detail/reply sheet ────────────────────────────────────── */}
      <Sheet
        open={!!selectedTicket}
        onOpenChange={(open) => {
          if (!open) { setSelectedTicket(null); setTicketReplyText(""); }
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-0">
          <SheetHeader className="px-6 py-4 border-b border-border/40">
            <SheetTitle className="flex items-center gap-2">
              <LifeBuoy className="h-5 w-5 text-primary" />
              {selectedTicket?.subject || "Ticket"}
            </SheetTitle>
          </SheetHeader>

          {selectedTicket && (
            <div className="px-6 py-4 border-b border-border/40 space-y-2">
              <p className="text-sm text-muted-foreground">{selectedTicket.description}</p>
              <div className="flex items-center gap-2 text-[11px] uppercase font-semibold tracking-wider">
                <span className={statusColor(selectedTicket.status)}>{selectedTicket.status.replace(/_/g, " ")}</span>
                <span className="text-muted-foreground">•</span>
                <span className="text-muted-foreground">{CATEGORY_LABELS[selectedTicket.category]}</span>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 min-h-0">
            {loadingTicketMessages ? (
              <div className="flex justify-center pt-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary/40" />
              </div>
            ) : ticketMessages.length === 0 ? (
              <div className="text-center pt-12 text-muted-foreground text-sm">
                No replies yet. Our team will respond here.
              </div>
            ) : (
              ticketMessages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.sender_role === "customer" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                      msg.sender_role === "customer"
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-muted text-foreground rounded-bl-sm"
                    }`}
                  >
                    <p>{msg.body}</p>
                    <p className={`text-[10px] mt-1 ${msg.sender_role === "customer" ? "text-primary-foreground/70 text-right" : "text-muted-foreground"}`}>
                      {new Date(msg.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          {selectedTicket && !["closed", "resolved"].includes(selectedTicket.status) && (
            <div className="border-t border-border/40 px-6 py-4 space-y-3">
              <Textarea
                placeholder="Add a reply…"
                value={ticketReplyText}
                onChange={(e) => setTicketReplyText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendTicketReply(); } }}
                className="resize-none rounded-xl"
                rows={3}
              />
              <Button
                onClick={sendTicketReply}
                disabled={!ticketReplyText.trim() || sendingTicketReply}
                className="w-full rounded-xl shadow-brand"
              >
                <Send className="mr-2 h-4 w-4" />
                {sendingTicketReply ? "Sending…" : "Send Reply"}
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Thread sheet ─────────────────────────────────────────────────── */}
      <Sheet
        open={!!selectedThread}
        onOpenChange={(open) => {
          if (!open) { setSelectedThread(null); setReplyText(""); }
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-0">
          <SheetHeader className="px-6 py-4 border-b border-border/40">
            <SheetTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              {selectedThread?.address || "Conversation"}
            </SheetTitle>
          </SheetHeader>

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
                <div key={msg.id} className={`flex ${msg.direction === "inbound" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                      msg.direction === "inbound"
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-muted text-foreground rounded-bl-sm"
                    }`}
                  >
                    <p>{msg.body}</p>
                    <p className={`text-[10px] mt-1 ${msg.direction === "inbound" ? "text-primary-foreground/70 text-right" : "text-muted-foreground"}`}>
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="border-t border-border/40 px-6 py-4 space-y-3">
            <Textarea
              placeholder="Type your message…"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendReply(); } }}
              className="resize-none rounded-xl"
              rows={3}
            />
            <Button
              onClick={handleSendReply}
              disabled={!replyText.trim() || sending}
              className="w-full rounded-xl shadow-brand"
            >
              <Send className="mr-2 h-4 w-4" />
              {sending ? "Sending…" : "Send Message"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default Help;
