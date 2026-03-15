import { useEffect, useMemo, useState } from "react";
import SectionHeading from "@/components/common/SectionHeading";
import { invoices as seed, Invoice, findCustomer } from "@/data/admin";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/pricing";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CreditCard,
  Search,
  Filter,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCcw,
  DollarSign,
  TrendingUp
} from "lucide-react";

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
    <div className="grid gap-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <SectionHeading
          eyebrow="Financials"
          title="Billing & Invoicing"
          description="Manage customer payments, monitor Stripe synchronization, and handle manual overrides."
        />
        <Button variant="outline" className="rounded-xl shadow-sm bg-background border-border/60" asChild>
          <a href="https://dashboard.stripe.com" target="_blank" rel="noreferrer">
            <CreditCard className="mr-2 h-4 w-4 text-primary" />
            Open Stripe Dashboard
            <ExternalLink className="ml-2 h-3.5 w-3.5 opacity-50" />
          </a>
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="rounded-[28px] border-border/60 bg-card/95 shadow-soft overflow-hidden">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-green-50 text-green-600 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Total Paid</p>
              <p className="text-2xl font-display font-bold">{formatCurrency(totals.paid)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-[28px] border-border/60 bg-card/95 shadow-soft overflow-hidden">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Total Open</p>
              <p className="text-2xl font-display font-bold">{formatCurrency(totals.open)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-[28px] border-border/60 bg-card/95 shadow-soft overflow-hidden">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Total Overdue</p>
              <p className="text-2xl font-display font-bold">{formatCurrency(totals.overdue)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-[32px] border-border/60 bg-card/95 shadow-soft overflow-hidden mb-10">
        <CardHeader className="bg-muted/20 px-8 py-6 border-b border-border/40">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-background px-3 py-1.5 rounded-lg border border-border/60 text-xs font-medium">
                Stripe: {stripeStatus.enabled ? <Badge className="bg-green-100 text-green-700 border-none">Connected</Badge> : <Badge className="bg-amber-100 text-amber-700 border-none">Syncing...</Badge>}
              </div>
              <Button variant="ghost" size="sm" className="text-primary font-bold h-8 px-2" asChild>
                <a href="/admin/revenue">View Analytics <TrendingUp className="ml-1 h-3.5 w-3.5" /></a>
              </Button>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="w-64 pl-9 rounded-xl h-10" placeholder="Search customer..." value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>
              <select className="h-10 rounded-xl border border-border/60 bg-background px-3 text-sm font-medium outline-none" value={status} onChange={(e) => setStatus(e.target.value as any)}>
                <option value="all">All Statuses</option>
                <option value="paid">Paid</option>
                <option value="open">Open</option>
                <option value="overdue">Overdue</option>
                <option value="refunded">Refunded</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 border-none">
                  <TableHead className="pl-8 py-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Date</TableHead>
                  <TableHead className="py-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Customer</TableHead>
                  <TableHead className="py-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Status</TableHead>
                  <TableHead className="py-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Total</TableHead>
                  <TableHead className="py-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Due Date</TableHead>
                  <TableHead className="pr-8 py-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((i) => {
                  const c = findCustomer(i.customerId);
                  return (
                    <TableRow key={i.id} className="hover:bg-muted/20 transition-colors border-border/40 group">
                      <TableCell className="pl-8 py-5 text-sm font-medium">
                        {new Date(i.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </TableCell>
                      <TableCell className="py-5">
                        <div className="flex flex-col">
                          <span className="font-bold text-sm">{c.name}</span>
                          <span className="text-xs text-muted-foreground italic">{c.email}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-5">
                        <Badge
                          variant="outline"
                          className={`capitalize font-bold border-none ${
                            i.status === 'paid' ? 'bg-green-100 text-green-700' :
                            i.status === 'overdue' ? 'bg-red-100 text-red-700' :
                            'bg-muted text-muted-foreground'
                          }`}
                        >
                          {i.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-5 font-bold text-sm">{formatCurrency(i.total)}</TableCell>
                      <TableCell className="py-5 text-xs text-muted-foreground font-medium">
                        {new Date(i.dueDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="pr-8 py-5 text-right space-x-2">
                        {i.status !== "paid" && i.status !== "refunded" && (
                          <Button size="sm" variant="ghost" className="rounded-xl font-bold hover:bg-green-50 hover:text-green-700 h-8" onClick={() => markPaid(i.id)}>
                            Mark Paid
                          </Button>
                        )}
                        {i.status === "paid" && (
                          <Button size="sm" variant="ghost" className="rounded-xl font-bold hover:bg-red-50 hover:text-red-700 h-8" onClick={() => refund(i.id)}>
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
        </CardContent>
      </Card>
    </div>
  );
};

export default Billing;
