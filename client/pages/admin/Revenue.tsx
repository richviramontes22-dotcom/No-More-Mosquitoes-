import { useEffect, useMemo, useState } from "react";
import SectionHeading from "@/components/common/SectionHeading";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/pricing";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type StripeStatus = { enabled: boolean; account?: { id: string; email?: string }; balance?: any; error?: string };

const Revenue = () => {
  const [status, setStatus] = useState<StripeStatus>({ enabled: false });
  const [series, setSeries] = useState<Array<{ date: string; amount: number }>>([]);
  const [invoices, setInvoices] = useState<Array<any>>([]);

  useEffect(() => {
    fetch("/api/admin/stripe/status").then(async (r) => setStatus(await r.json())).catch(() => setStatus({ enabled: false }));
    fetch("/api/admin/stripe/revenue?days=30").then(async (r) => setSeries(((await r.json()).series || []) as any)).catch(() => setSeries([]));
    fetch("/api/admin/stripe/invoices?limit=20").then(async (r) => setInvoices(((await r.json()).invoices || []) as any)).catch(() => setInvoices([]));
  }, []);

  const totals = useMemo(() => {
    const last7 = series.slice(-7).reduce((a, b) => a + b.amount, 0);
    const last30 = series.reduce((a, b) => a + b.amount, 0);
    return { last7, last30 };
  }, [series]);

  return (
    <div className="grid gap-8">
      <SectionHeading eyebrow="Revenue" title="Revenue & income" description="Live earnings from Stripe with 30-day trends." />

      <div className="rounded-2xl border border-border/70 bg-card/95 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm text-muted-foreground">
            Connection: {status.enabled ? <span className="text-emerald-600">Connected</span> : <span className="text-amber-600">Not connected</span>}
            {status.account?.email ? <span className="ml-2">({status.account.email})</span> : null}
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <a href="https://dashboard.stripe.com" target="_blank" rel="noreferrer">Open Stripe</a>
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="text-xs text-muted-foreground">Last 7 days</div>
            <div className="text-xl font-display">{formatCurrency(totals.last7)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Last 30 days</div>
            <div className="text-xl font-display">{formatCurrency(totals.last30)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Available balance</div>
            <div className="text-xl font-display">{status.balance?.available?.length ? formatCurrency((status.balance.available[0].amount || 0) / 100) : "—"}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Pending payouts</div>
            <div className="text-xl font-display">{status.balance?.pending?.length ? formatCurrency((status.balance.pending[0].amount || 0) / 100) : "—"}</div>
          </div>
        </div>

        <div className="mt-6 h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series.map((d) => ({ ...d, dateLabel: new Date(d.date).toLocaleDateString() }))} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="dateLabel" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(v) => `$${v}` } width={60} />
              <Tooltip formatter={(v: any) => formatCurrency(Number(v))} labelFormatter={(l) => l} />
              <Area type="monotone" dataKey="amount" stroke="#16a34a" fill="url(#rev)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-3 rounded-2xl border border-border/70 bg-card/95 p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">Recent Stripe invoices</div>
          <Button asChild size="sm" variant="outline"><a href="https://dashboard.stripe.com/invoices" target="_blank" rel="noreferrer">View in Stripe</a></Button>
        </div>
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((i) => (
                <TableRow key={i.id}>
                  <TableCell>{i.created ? new Date(i.created).toLocaleDateString() : "—"}</TableCell>
                  <TableCell>
                    <div className="font-medium">{i.customer_name || i.customer_email || i.number || i.id}</div>
                    {i.hosted_invoice_url ? (
                      <a className="text-xs text-primary underline" href={i.hosted_invoice_url} target="_blank" rel="noreferrer">Open invoice</a>
                    ) : null}
                  </TableCell>
                  <TableCell className="capitalize">{i.status}</TableCell>
                  <TableCell className="text-right">{formatCurrency((i.total || 0) / 100)}</TableCell>
                </TableRow>
              ))}
              {invoices.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-sm text-muted-foreground">No invoices or Stripe not connected.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};

export default Revenue;
