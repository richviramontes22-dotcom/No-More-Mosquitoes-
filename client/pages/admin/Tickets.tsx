import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import SectionHeading from "@/components/common/SectionHeading";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { AdminOwnershipBadge, AdminOwnershipNote } from "@/components/admin/AdminOwnershipBadge";

type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
type TicketPriority = "low" | "medium" | "high";

interface Ticket {
  id: string;
  subject: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  user_id: string;
  assigned_to?: string;
  created_at: string;
  updated_at: string;
  customer_name?: string;
}

const columns: TicketStatus[] = ["open", "in_progress", "resolved"];
const priorities: TicketPriority[] = ["low", "medium", "high"];

const Tickets = () => {
  const [items, setItems] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Load tickets from Supabase
  useEffect(() => {
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
        const { data: profiles } = userIds.length > 0
          ? await supabase
              .from("profiles")
              .select("id, name")
              .in("id", userIds)
          : { data: [] as { id: string; name: string }[] };
        const profileMap = new Map((profiles || []).map((profile: any) => [profile.id, profile.name]));

        const mapped = (tickets || []).map((t: any) => ({
          id: t.id,
          subject: t.subject,
          description: t.description || "",
          priority: t.priority || "medium",
          status: t.status || "open",
          user_id: t.user_id,
          assigned_to: t.assigned_to,
          created_at: t.created_at,
          updated_at: t.updated_at,
          customer_name: profileMap.get(t.user_id) || "Unknown Customer"
        }));

        setItems(mapped);
      } catch (err) {
        console.error("[Tickets] Exception:", err);
        setItems([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadTickets();
  }, []);

  const grouped = useMemo(() =>
    columns.map((s) => ({ status: s, items: items.filter((t) => t.status === s) })),
    [items]
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
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs capitalize font-bold ${
                        t.priority === "high"
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
                            {s.replace("_", " ")}
                          </Button>
                        ))}
                      </div>
                      <select
                        className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                        value={t.priority}
                        onChange={(e) => reprio(t.id, e.target.value as TicketPriority)}
                        disabled={updatingId === t.id}
                      >
                        {priorities.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
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
    </div>
  );
};

export default Tickets;
