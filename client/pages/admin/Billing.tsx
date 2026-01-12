import { useEffect, useMemo, useState } from "react";
import SectionHeading from "@/components/common/SectionHeading";
import { invoices as seed, Invoice, findCustomer } from "@/data/admin";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/pricing";

const Billing = () => {
  const [items, setItems] = useState<Invoice[]>(() => seed.slice());
  const [stripeStatus, setStripeStatus] = useState<{ enabled: boolean; account?: { email?: string } }>({ enabled: false });
  const [status, setStatus] = useState<Invoice["status"] | "all">("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetch("/api/admin/stripe/status").then(async (r) => setStripeStatus(await r.json())).catch(() => setStripeStatus({ enabled: false }));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((i) => {
      const matchesStatus = status === "all" || i.status === status;
      const cust = findCustomer(i.customerId);
      const matchesQuery = !q || `${cust.name} ${cust.email}`.toLowerCase().includes(q);
      return matchesStatus && matchesQuery;
    });
  }, [items, status, query]);

  const totals = useMemo(() => {
    return {
      paid: items.filter((i) => i.status === "paid").reduce((a, b) => a + b.total, 0),
      open: items.filter((i) => i.status === "open").reduce((a, b) => a + b.total, 0),
      overdue: items.filter((i) => i.status === "overdue").reduce((a, b) => a + b.total, 0),
    };
  }, [items]);

  const markPaid = (id: string) => setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status: "paid" } : i)));
  const refund = (id: string) => setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status: "refunded" } : i)));

  return (
    <div className="grid gap-8">
      <SectionHeading
        eyebrow="Billing"
        title="Invoices and payments"
        description="Stripe sync, refunds/credits, and dunning status."
      />

      <div className="grid gap-3 rounded-2xl border border-border/70 bg-card/95 p-4">
        <div className="flex items-center justify-between rounded-xl border bg-background/50 p-3 text-sm">
          <div>
            Stripe connection: {stripeStatus.enabled ? <span className="text-emerald-600">Connected</span> : <span className="text-amber-600">Not connected</span>}
            {stripeStatus.account?.email ? <span className="ml-2">({stripeStatus.account.email})</span> : null}
          </div>
          <div className="space-x-2">
            <a className="text-primary underline" href="/admin/revenue">Revenue</a>
            <a className="text-primary underline" href="https://dashboard.stripe.com" target="_blank" rel="noreferrer">Open Stripe</a>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <div className="text-xs text-muted-foreground">Paid</div>
            <div className="text-xl font-display">{formatCurrency(totals.paid)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Open</div>
            <div className="text-xl font-display">{formatCurrency(totals.open)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Overdue</div>
            <div className="text-xl font-display">{formatCurrency(totals.overdue)}</div>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Input className="w-64" placeholder="Search name or email" value={query} onChange={(e) => setQuery(e.target.value)} />
            <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={status} onChange={(e) => setStatus(e.target.value as any)}>
              <option value="all">All statuses</option>
              <option value="paid">Paid</option>
              <option value="open">Open</option>
              <option value="overdue">Overdue</option>
              <option value="refunded">Refunded</option>
            </select>
          </div>
        </div>

        <div className="rounded-xl border p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Due</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((i) => {
                const c = findCustomer(i.customerId);
                return (
                  <TableRow key={i.id}>
                    <TableCell>{new Date(i.date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-muted-foreground">{c.email}</div>
                    </TableCell>
                    <TableCell className="capitalize">{i.status}</TableCell>
                    <TableCell>{formatCurrency(i.total)}</TableCell>
                    <TableCell>{new Date(i.dueDate).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right space-x-2">
                      {i.status !== "paid" && i.status !== "refunded" && (
                        <Button size="sm" variant="outline" onClick={() => markPaid(i.id)}>
                          Mark paid
                        </Button>
                      )}
                      {i.status === "paid" && (
                        <Button size="sm" variant="destructive" onClick={() => refund(i.id)}>
                          Refund
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};

export default Billing;
