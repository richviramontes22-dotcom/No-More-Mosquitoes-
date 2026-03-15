import { useEffect, useMemo, useState } from "react";
import SectionHeading from "@/components/common/SectionHeading";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/pricing";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  CreditCard,
  ExternalLink,
  TrendingUp,
  DollarSign,
  Clock,
  ArrowUpRight,
  ArrowRight,
  CheckCircle2
} from "lucide-react";

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
    <div className="grid gap-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <SectionHeading
          eyebrow="Intelligence"
          title="Revenue & Analytics"
          description="Live earnings monitoring from Stripe with 30-day performance trends."
        />
        <Button variant="outline" className="rounded-xl shadow-sm bg-background border-border/60" asChild>
          <a href="https://dashboard.stripe.com" target="_blank" rel="noreferrer">
            <CreditCard className="mr-2 h-4 w-4 text-primary" />
            Stripe Dashboard
            <ExternalLink className="ml-2 h-3.5 w-3.5 opacity-50" />
          </a>
        </Button>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-[28px] border-border/60 bg-card/95 shadow-soft">
          <CardContent className="p-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-1">Last 7 Days</p>
            <p className="text-2xl font-display font-bold text-foreground">{formatCurrency(totals.last7)}</p>
            <div className="mt-2 flex items-center gap-1 text-[10px] font-bold text-green-600 uppercase tracking-wider">
              <ArrowUpRight className="h-3 w-3" /> +8.4%
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-[28px] border-border/60 bg-card/95 shadow-soft">
          <CardContent className="p-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-1">Last 30 Days</p>
            <p className="text-2xl font-display font-bold text-foreground">{formatCurrency(totals.last30)}</p>
            <div className="mt-2 flex items-center gap-1 text-[10px] font-bold text-green-600 uppercase tracking-wider">
              <ArrowUpRight className="h-3 w-3" /> +12.1%
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-[28px] border-border/60 bg-card/95 shadow-soft">
          <CardContent className="p-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-1">Available Balance</p>
            <p className="text-2xl font-display font-bold text-foreground">
              {status.balance?.available?.length ? formatCurrency((status.balance.available[0].amount || 0) / 100) : "—"}
            </p>
            <div className="mt-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-500" /> Instant Payout Ready
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-[28px] border-border/60 bg-card/95 shadow-soft">
          <CardContent className="p-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-1">Pending Payouts</p>
            <p className="text-2xl font-display font-bold text-foreground">
              {status.balance?.pending?.length ? formatCurrency((status.balance.pending[0].amount || 0) / 100) : "—"}
            </p>
            <div className="mt-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
              <Clock className="h-3 w-3 text-blue-500" /> Estimated 2-3 Days
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-[32px] border-border/60 bg-card/95 shadow-soft overflow-hidden">
        <CardHeader className="bg-muted/20 px-8 py-6 border-b border-border/40">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-display font-bold flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Revenue Growth
            </CardTitle>
            <Badge variant="secondary" className="bg-background border-border/60 font-bold text-[10px] uppercase tracking-widest">30-Day Series</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-8">
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series.map((d) => ({ ...d, dateLabel: new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) }))} margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} dy={10} />
                <YAxis tickFormatter={(v) => `$${v}` } width={50} tick={{ fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                  formatter={(v: any) => [formatCurrency(Number(v)), 'Revenue']}
                  labelFormatter={(l) => `Date: ${l}`}
                />
                <Area type="monotone" dataKey="amount" stroke="#16a34a" strokeWidth={3} fill="url(#rev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[32px] border-border/60 bg-card/95 shadow-soft overflow-hidden mb-10">
        <CardHeader className="bg-muted/20 px-8 py-6 border-b border-border/40">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-display font-bold">Recent Stripe Invoices</CardTitle>
            <Button variant="ghost" size="sm" className="text-primary font-bold" asChild>
              <a href="https://dashboard.stripe.com/invoices" target="_blank" rel="noreferrer">
                Full History <ArrowRight className="ml-1 h-4 w-4" />
              </a>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 border-none">
                  <TableHead className="pl-8 py-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Processing Date</TableHead>
                  <TableHead className="py-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Customer Reference</TableHead>
                  <TableHead className="py-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Transaction Status</TableHead>
                  <TableHead className="pr-8 py-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest text-right">Settlement Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.length > 0 ? invoices.map((i) => (
                  <TableRow key={i.id} className="hover:bg-muted/20 transition-colors border-border/40 group">
                    <TableCell className="pl-8 py-5 text-sm font-medium">
                      {i.created ? new Date(i.created).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : "—"}
                    </TableCell>
                    <TableCell className="py-5">
                      <div className="flex flex-col">
                        <span className="font-bold text-sm text-foreground">{i.customer_name || i.customer_email || i.number || i.id}</span>
                        {i.hosted_invoice_url && (
                          <a className="text-[10px] text-primary font-bold hover:underline flex items-center gap-1" href={i.hosted_invoice_url} target="_blank" rel="noreferrer">
                            View Receipt <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-5">
                      <Badge variant="outline" className="capitalize font-bold border-none bg-green-50 text-green-700">{i.status}</Badge>
                    </TableCell>
                    <TableCell className="pr-8 py-5 text-right font-display font-bold text-base">
                      {formatCurrency((i.total || 0) / 100)}
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={4} className="h-40 text-center text-muted-foreground italic bg-muted/5">
                      No recent Stripe transactions or connection pending.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Revenue;
