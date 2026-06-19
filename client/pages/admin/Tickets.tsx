import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import SectionHeading from "@/components/common/SectionHeading";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, MessageSquare, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AdminOwnershipBadge, AdminOwnershipNote } from "@/components/admin/AdminOwnershipBadge";

type TicketStatus = "open" | "in_progress" | "pending_customer" | "pending_staff" | "escalated" | "resolved" | "closed";
type TicketPriority = "low" | "medium" | "high" | "urgent";
type TicketCategory = "billing" | "scheduling" | "service_quality" | "retreatment_request" | "property_access" | "pesticide_question" | "general";

interface Ticket {
  id: string;
  subject: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  category: TicketCategory;
  user_id: string;
  assigned_to?: string | null;
  created_at: string;
  updated_at: string;
  customer_name?: string;
  assignee_name?: string;
}

interface TicketMessage { id: string; body: string; sender_role: "customer" | "staff"; created_at: string }
interface TicketInternalNote { id: string; body: string; author_id: string | null; created_at: string }
interface StaffProfile { id: string; name: string }

const columns: TicketStatus[] = ["open", "in_progress", "escalated", "resolved"];
const priorities: TicketPriority[] = ["low", "medium", "high", "urgent"];
const categories: TicketCategory[] = ["billing", "scheduling", "service_quality", "retreatment_request", "property_access", "pesticide_question", "general"];
const CATEGORY_LABELS: Record<TicketCategory, string> = {
  billing: "Billing", scheduling: "Scheduling", service_quality: "Service Quality",
  retreatment_request: "Retreatment Request", property_access: "Property Access",
  pesticide_question: "Pesticide Question", general: "General",
};

const Tickets = () => {
  const [items, setItems] = useState<Ticket[]>([]);
  const [staffProfiles, setStaffProfiles] = useState<StaffProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [detailTicket, setDetailTicket] = useState<Ticket | null>(null);

  const loadTickets = async () => {
    try {
      setIsLoading(true);
      const { data: tickets, error } = await supabase
        .from("tickets")
        .select(`
          id,
          subject,
          description,
          priority,
          status,
          category,
          user_id,
          assigned_to,
          created_at,
          updated_at
        `)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[Tickets] Error loading:", error);
        setItems([]);
        return;
      }

      const userIds = [...new Set((tickets || []).map((ticket: any) => ticket.user_id).filter(Boolean))];
      const assigneeIds = [...new Set((tickets || []).map((ticket: any) => ticket.assigned_to).filter(Boolean))];
      const allProfileIds = [...new Set([...userIds, ...assigneeIds])];
      const { data: profiles } = allProfileIds.length > 0
        ? await supabase.from("profiles").select("id, name").in("id", allProfileIds)
        : { data: [] as { id: string; name: string }[] };
      const profileMap = new Map((profiles || []).map((profile: any) => [profile.id, profile.name]));

      const mapped = (tickets || []).map((t: any) => ({
        id: t.id,
        subject: t.subject,
        description: t.description || "",
        priority: t.priority || "medium",
        status: t.status || "open",
        category: t.category || "general",
        user_id: t.user_id,
        assigned_to: t.assigned_to,
        created_at: t.created_at,
        updated_at: t.updated_at,
        customer_name: profileMap.get(t.user_id) || "Unknown Customer",
        assignee_name: t.assigned_to ? (profileMap.get(t.assigned_to) || "Unknown Staff") : undefined,
      }));

      setItems(mapped);
    } catch (err) {
      console.error("[Tickets] Exception:", err);
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadStaff = async () => {
    const { data } = await supabase.from("profiles").select("id, name").in("role", ["admin", "customer_service"]);
    setStaffProfiles(data || []);
  };

  useEffect(() => { loadTickets(); loadStaff(); }, []);

  const filteredItems = useMemo(
    () => (categoryFilter === "all" ? items : items.filter((t) => t.category === categoryFilter)),
    [items, categoryFilter]
  );

  const grouped = useMemo(() =>
    columns.map((s) => ({ status: s, items: filteredItems.filter((t) => t.status === s) })),
    [filteredItems]
  );

  const updateTicket = async (id: string, updates: Partial<Ticket>) => {
    try {
      setUpdatingId(id);
      const { error } = await supabase
        .from("tickets")
        .update(updates)
        .eq("id", id);

      if (error) throw error;

      // Update local state
      setItems((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
      );
    } catch (err) {
      console.error("[Tickets] Error updating:", err);
    } finally {
      setUpdatingId(null);
    }
  };

  const move = (id: string, to: TicketStatus) => {
    updateTicket(id, { status: to });
  };

  const reprio = (id: string, pr: TicketPriority) => {
    updateTicket(id, { priority: pr });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading tickets...</p>
        </div>
      </div>
    );
  }

  const totalTickets = items.length;
  const openCount = items.filter((t) => t.status === "open").length;

  return (
    <div className="grid gap-8">
      <div className="flex items-center justify-between">
        <SectionHeading
          eyebrow="Tickets"
          title="Customer requests and re‑service"
          description="Track priorities and assignments."
        />
        <div className="text-right">
          <div className="text-3xl font-bold">{totalTickets}</div>
          <div className="text-sm text-muted-foreground">{openCount} open</div>
        </div>
      </div>

      <AdminOwnershipNote
        title="Support ticket board"
        description="Tickets remain the operational support queue. Customer records are linked for account and property context."
      >
        <AdminOwnershipBadge kind="operational" />
        <select
          className="h-9 rounded-xl border border-border/60 bg-background px-3 text-sm"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="all">All Categories</option>
          {categories.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
        </select>
        <Button variant="outline" size="sm" className="rounded-xl" asChild>
          <Link to="/admin/customers">Customer Database</Link>
        </Button>
      </AdminOwnershipNote>

      {totalTickets === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/50 p-12 text-center">
          <p className="text-sm text-muted-foreground">No support tickets yet</p>
        </div>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-3">
          {grouped.map((col) => (
            <div key={col.status} className="rounded-2xl border border-border/70 bg-card/95 p-4 min-w-0">
              <div className="mb-4 flex items-center justify-between">
                <div className="text-sm font-semibold capitalize">{col.status.replace("_", " ")}</div>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold text-muted-foreground">
                  {col.items.length}
                </span>
              </div>
              <div className="space-y-3">
                {col.items.map((t) => (
                  <div key={t.id} className="rounded-xl border bg-background p-3 text-sm break-words transition-opacity" style={{ opacity: updatingId === t.id ? 0.6 : 1 }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium line-clamp-2">{t.subject}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {t.customer_name}
                        </div>
                        <div className="mt-1 flex items-center gap-1">
                          <Badge variant="outline" className="h-auto py-0 text-[9px] uppercase bg-muted">{CATEGORY_LABELS[t.category]}</Badge>
                          {t.assignee_name && <Badge variant="outline" className="h-auto py-0 text-[9px] uppercase">{t.assignee_name}</Badge>}
                        </div>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs capitalize font-bold ${
                        t.priority === "urgent" || t.priority === "high"
                          ? "bg-red-100 text-red-700"
                          : t.priority === "medium"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-blue-100 text-blue-700"
                      }`}>
                        {t.priority}
                      </span>
                    </div>
                    <div className="mt-3 space-y-2">
                      <div className="flex flex-wrap items-center gap-1">
                        {columns.map((s) => (
                          <Button
                            key={s}
                            size="sm"
                            variant={s === t.status ? "secondary" : "outline"}
                            onClick={() => move(t.id, s)}
                            disabled={updatingId === t.id}
                            className="text-xs h-7"
                          >
                            {s.replace(/_/g, " ")}
                          </Button>
                        ))}
                      </div>
                      <Button size="sm" variant="outline" className="w-full text-xs h-7" onClick={() => setDetailTicket(t)}>
                        <MessageSquare className="h-3 w-3 mr-1" /> Manage / Reply
                      </Button>
                    </div>
                    <div className="mt-2 text-[10px] text-muted-foreground">
                      Created {new Date(t.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
                {col.items.length === 0 && (
                  <div className="py-4 text-center text-xs text-muted-foreground/50">
                    No tickets
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {detailTicket && (
        <TicketDetailDialog
          ticket={detailTicket}
          staffProfiles={staffProfiles}
          onClose={() => setDetailTicket(null)}
          onUpdated={(updated) => {
            setItems((prev) => prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)));
            setDetailTicket((prev) => (prev ? { ...prev, ...updated } : prev));
          }}
        />
      )}
    </div>
  );
};

// ── Ticket detail / reply / internal notes dialog ────────────────────────────

const TicketDetailDialog = ({
  ticket, staffProfiles, onClose, onUpdated,
}: {
  ticket: Ticket;
  staffProfiles: StaffProfile[];
  onClose: () => void;
  onUpdated: (updates: Partial<Ticket>) => void;
}) => {
  const { toast } = useToast();
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [notes, setNotes] = useState<TicketInternalNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState("");
  const [noteText, setNoteText] = useState("");
  const [sending, setSending] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [msgRes, noteRes] = await Promise.all([
        supabase.from("ticket_messages").select("id, body, sender_role, created_at").eq("ticket_id", ticket.id).order("created_at"),
        supabase.from("ticket_internal_notes").select("id, body, author_id, created_at").eq("ticket_id", ticket.id).order("created_at"),
      ]);
      setMessages(msgRes.data || []);
      setNotes(noteRes.data || []);
      setLoading(false);
    })();
  }, [ticket.id]);

  const sendReply = async () => {
    if (!replyText.trim()) return;
    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("ticket_messages")
        .insert({ ticket_id: ticket.id, body: replyText.trim(), sender_role: "staff", sender_id: user?.id })
        .select().single();
      if (error) throw error;
      setMessages((prev) => [...prev, data]);
      setReplyText("");
      // A staff reply implies the ball is back in the customer's court.
      if (ticket.status !== "closed" && ticket.status !== "resolved") {
        await updateField({ status: "pending_customer" });
      }
    } catch (err: any) {
      toast({ title: "Failed to reply", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const addNote = async () => {
    if (!noteText.trim()) return;
    setSavingNote(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("ticket_internal_notes")
        .insert({ ticket_id: ticket.id, body: noteText.trim(), author_id: user?.id })
        .select().single();
      if (error) throw error;
      setNotes((prev) => [...prev, data]);
      setNoteText("");
    } catch (err: any) {
      toast({ title: "Failed to save note", description: err.message, variant: "destructive" });
    } finally {
      setSavingNote(false);
    }
  };

  const updateField = async (updates: Partial<Ticket>) => {
    setSaving(true);
    try {
      const { error } = await supabase.from("tickets").update(updates).eq("id", ticket.id);
      if (error) throw error;
      onUpdated(updates);
    } catch (err: any) {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{ticket.subject}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{ticket.description}</p>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Status</Label>
              <select
                className="w-full h-9 rounded-lg border border-input bg-background px-2 text-sm"
                value={ticket.status}
                disabled={saving}
                onChange={(e) => updateField({ status: e.target.value as TicketStatus })}
              >
                {["open", "in_progress", "pending_customer", "pending_staff", "escalated", "resolved", "closed"].map((s) => (
                  <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">Category</Label>
              <select
                className="w-full h-9 rounded-lg border border-input bg-background px-2 text-sm"
                value={ticket.category}
                disabled={saving}
                onChange={(e) => updateField({ category: e.target.value as TicketCategory })}
              >
                {categories.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs">Assigned To</Label>
              <select
                className="w-full h-9 rounded-lg border border-input bg-background px-2 text-sm"
                value={ticket.assigned_to || ""}
                disabled={saving}
                onChange={(e) => updateField({ assigned_to: e.target.value || null })}
              >
                <option value="">Unassigned</option>
                {staffProfiles.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={saving || ticket.status === "escalated"} onClick={() => updateField({ status: "escalated" })}>
              Escalate
            </Button>
            <Button size="sm" variant="outline" disabled={saving || ticket.status === "closed"} onClick={() => updateField({ status: "closed" })}>
              Close
            </Button>
            <Button size="sm" variant="outline" disabled={saving || ticket.status !== "closed"} onClick={() => updateField({ status: "open" })}>
              Reopen
            </Button>
          </div>

          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground/50" /></div>
          ) : (
            <>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-widest">Customer Thread</Label>
                <div className="rounded-xl border border-border/60 p-3 max-h-48 overflow-y-auto space-y-2 bg-muted/20">
                  {messages.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No replies yet.</p>
                  ) : messages.map((m) => (
                    <div key={m.id} className={`text-sm rounded-lg px-3 py-2 max-w-[85%] ${m.sender_role === "staff" ? "bg-primary text-primary-foreground ml-auto" : "bg-card border"}`}>
                      {m.body}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Textarea rows={2} value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Reply to customer (visible to them)…" className="resize-none" />
                  <Button onClick={sendReply} disabled={sending || !replyText.trim()}>{sending ? "…" : "Send"}</Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-widest flex items-center gap-1.5"><Lock className="h-3 w-3" /> Internal Notes (staff only)</Label>
                <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 max-h-40 overflow-y-auto space-y-2">
                  {notes.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No internal notes yet.</p>
                  ) : notes.map((n) => (
                    <div key={n.id} className="text-sm rounded-lg bg-white border px-3 py-2">{n.body}</div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Textarea rows={2} value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Internal note — never visible to the customer…" className="resize-none" />
                  <Button variant="outline" onClick={addNote} disabled={savingNote || !noteText.trim()}>{savingNote ? "…" : "Add"}</Button>
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default Tickets;
