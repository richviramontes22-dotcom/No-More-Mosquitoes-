import { useMemo, useState } from "react";
import SectionHeading from "@/components/common/SectionHeading";
import { tickets as seed, Ticket, TicketStatus, TicketPriority, findCustomer, findProperty } from "@/data/admin";
import { Button } from "@/components/ui/button";

const columns: TicketStatus[] = ["new", "in_progress", "resolved"];
const priorities: TicketPriority[] = ["low", "medium", "high", "urgent"];

const Tickets = () => {
  const [items, setItems] = useState<Ticket[]>(() => seed.slice());
  const grouped = useMemo(() =>
    columns.map((s) => ({ status: s, items: items.filter((t) => t.status === s) })),
  [items]);

  const move = (id: string, to: TicketStatus) => setItems((prev) => prev.map((t) => (t.id === id ? { ...t, status: to } : t)));
  const reprio = (id: string, pr: TicketPriority) => setItems((prev) => prev.map((t) => (t.id === id ? { ...t, priority: pr } : t)));

  return (
    <div className="grid gap-8">
      <SectionHeading
        eyebrow="Tickets"
        title="Customer requests and re‑service"
        description="Track SLAs, priorities, and assignments."
      />

      <div className="grid items-start gap-4 lg:grid-cols-3">
        {grouped.map((col) => (
          <div key={col.status} className="rounded-2xl border border-border/70 bg-card/95 p-4 min-w-0">
            <div className="mb-2 text-sm font-semibold capitalize">{col.status.replace("_", " ")}</div>
            <div className="space-y-3">
              {col.items.map((t) => (
                <div key={t.id} className="rounded-xl border p-3 text-sm break-words">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{t.subject}</div>
                    <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${
                      t.priority === "urgent" ? "bg-destructive text-destructive-foreground" :
                      t.priority === "high" ? "bg-primary/10 text-primary" :
                      t.priority === "medium" ? "bg-secondary" : "bg-muted"
                    }`}>{t.priority}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {findCustomer(t.customerId).name} · {findProperty(t.propertyId).city}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {columns.map((s) => (
                      <Button key={s} size="sm" variant={s === t.status ? "secondary" : "outline"} onClick={() => move(t.id, s)}>
                        {s.replace("_", " ")}
                      </Button>
                    ))}
                    <select
                      className="ml-auto h-8 shrink-0 rounded-md border border-input bg-background px-2 text-xs"
                      value={t.priority}
                      onChange={(e) => reprio(t.id, e.target.value as TicketPriority)}
                    >
                      {priorities.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Tickets;
