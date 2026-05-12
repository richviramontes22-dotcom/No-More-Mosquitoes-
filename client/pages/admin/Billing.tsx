import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import SectionHeading from "@/components/common/SectionHeading";
import { supabase, withTimeout } from "@/lib/supabase";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/pricing";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAdminMarketplaceOrders } from "@/hooks/admin/useAdminMarketplaceOrders";
import { AdminOwnershipBadge, AdminOwnershipNote } from "@/components/admin/AdminOwnershipBadge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { adminApi } from "@/lib/adminApi";
import {
  CreditCard,
  Search,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Clock,
  TrendingUp,
  Loader2,
  ShoppingBag,
  Eye,
  Package,
  ArrowUpDown,
  RefreshCw,
} from "lucide-react";

interface Payment {
  id: string;
  user_id: string;
  customer_name: string;
  customer_email: string;
  amount_cents: number;
  currency: string;
  status: string;
  created_at: string;
  method?: string;
}

interface OrderDetail {
  id: string;
  confirmation_id: string;
  status: string;
  fulfillment_status: string;
  total_cents: number;
  subtotal_cents: number;
  tax_cents: number;
  currency: string;
  created_at: string;
  stripe_payment_intent_id?: string;
  profiles?: { name: string; email: string; phone?: string } | null;
  properties?: { address: string; city: string; zip: string } | null;
  appointment_id?: string | null;
}

interface OrderLineItem {
  id: string;
  item_name: string;
  quantity: number;
  unit_price_cents: number;
  line_total_cents: number;
  price_type: string;
}

const FULFILLMENT_STATUSES = ["pending", "processing", "scheduled", "fulfilled", "cancelled"] as const;
type FulfillmentStatus = typeof FULFILLMENT_STATUSES[number];

interface TimelineEntry {
  id: string;
  source: "subscription" | "marketplace";
  date: string;
  customer_name: string;
  customer_email: string;
  amount_cents: number;
  status: string;
  fulfillment_status?: string;
  confirmation_id?: string;
  marketplace_order_id?: string;
}

const FULFILLMENT_COLORS: Record<string, string> = {
  pending: "bg-blue-100 text-blue-700",
  processing: "bg-purple-100 text-purple-700",
  scheduled: "bg-amber-100 text-amber-700",
  fulfilled: "bg-green-100 text-green-700",
  cancelled: "bg-gray-100 text-gray-600",
};

const Billing = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stripeStatus, setStripeStatus] = useState<{ enabled: boolean; account?: { email?: string } }>({ enabled: false });
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const { orders: marketplaceOrders, isLoading: ordersLoading, searchQuery, setSearchQuery } = useAdminMarketplaceOrders();

  // Unified timeline filters
  const [timelineSource, setTimelineSource] = useState<"all" | "subscription" | "marketplace">("all");
  const [timelineQuery, setTimelineQuery] = useState("");

  // Order detail dialog state
  const [selectedOrder, setSelectedOrder] = useState<OrderDetail | null>(null);
  const [selectedItems, setSelectedItems] = useState<OrderLineItem[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [updatingFulfillment, setUpdatingFulfillment] = useState(false);
  const { toast } = useToast();

  const openOrderDetail = async (orderId: string) => {
    setDetailLoading(true);
    setSelectedOrder(null);
    setSelectedItems([]);
    try {
      const res = await adminApi(`/api/admin/marketplace/orders/${orderId}`);
      setSelectedOrder(res.order);
      setSelectedItems(res.items || []);
    } catch (err: any) {
      toast({ title: "Failed to load order details", description: err.message, variant: "destructive" });
    } finally {
      setDetailLoading(false);
    }
  };

  const updateFulfillmentStatus = async (orderId: string, status: FulfillmentStatus) => {
    setUpdatingFulfillment(true);
    try {
      await adminApi(`/api/admin/marketplace/orders/${orderId}/fulfillment`, "PATCH", {
        fulfillment_status: status,
      });
      setSelectedOrder((prev) => prev ? { ...prev, fulfillment_status: status } : prev);
      toast({ title: "Fulfillment status updated", description: `Order marked as ${status}.` });
    } catch (err: any) {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    } finally {
      setUpdatingFulfillment(false);
    }
  };

  // Load stripe status
  useEffect(() => {
    withTimeout(fetch("/api/admin/stripe/status"), 10000, "Stripe status")
      .then(async (r) => setStripeStatus(await r.json()))
      .catch(() => setStripeStatus({ enabled: false }));
  }, []);

  // Load payments from Supabase
  useEffect(() => {
    const loadPayments = async () => {
      try {
        setIsLoading(true);

        // Query payments with null-safe profile joins
        const { data: paymentData, error } = await withTimeout(
          supabase
            .from("payments")
            .select(`
              id,
              user_id,
              amount_cents,
              currency,
              status,
              method,
              created_at,
              profiles:user_id (id, name, email)
            `)
            .order("created_at", { ascending: false }),
          10000,
          "Admin payments"
        );

        if (error) {
          console.error("[Billing] Query error - payments may not exist:", {
            code: error.code,
            message: error.message,
            details: error.details
          });
          setPayments([]);
          return;
        }

        // Safely map payment data with null-checks
        if (!Array.isArray(paymentData)) {
          console.warn("[Billing] Invalid payment data format, expected array");
          setPayments([]);
          return;
        }

        const mapped = paymentData.map((p: any) => {
          // Validate required fields
          if (!p?.id || p.user_id === null || p.amount_cents === null) {
            console.warn("[Billing] Skipping malformed payment row:", p?.id);
            return null;
          }

          return {
            id: p.id,
            user_id: p.user_id,
            customer_name: p.profiles?.name || "Unknown Customer",
            customer_email: p.profiles?.email || "No email",
            amount_cents: p.amount_cents,
            currency: p.currency || "USD",
            status: p.status || "pending",
            created_at: p.created_at,
            method: p.method || "card"
          };
        }).filter((p: any) => p !== null);

        setPayments(mapped);
        console.log(`[Billing] Successfully loaded ${mapped.length} payments`);
      } catch (err) {
        console.error("[Billing] Exception loading payments:", {
          message: err instanceof Error ? err.message : String(err),
          type: typeof err
        });
        setPayments([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadPayments();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return payments.filter((p) => {
      const matchesStatus = statusFilter === "all" || p.status === statusFilter;
      const matchesQuery = !q || `${p.customer_name} ${p.customer_email}`.toLowerCase().includes(q);
      return matchesStatus && matchesQuery;
    });
  }, [payments, statusFilter, query]);

  const totals = useMemo(() => {
    return {
      succeeded: payments
        .filter((p) => p.status === "succeeded")
        .reduce((a, b) => a + b.amount_cents, 0) / 100,
      pending: payments
        .filter((p) => p.status === "pending")
        .reduce((a, b) => a + b.amount_cents, 0) / 100,
      failed: payments
        .filter((p) => p.status === "failed")
        .reduce((a, b) => a + b.amount_cents, 0) / 100,
    };
  }, [payments]);

  // Unified payment timeline — merges subscription payments + marketplace orders
  const timeline = useMemo((): TimelineEntry[] => {
    const subEntries: TimelineEntry[] = payments.map((p) => ({
      id: p.id,
      source: "subscription" as const,
      date: p.created_at,
      customer_name: p.customer_name,
      customer_email: p.customer_email,
      amount_cents: p.amount_cents,
      status: p.status,
    }));

    const mktEntries: TimelineEntry[] = marketplaceOrders.map((o) => ({
      id: o.id,
      source: "marketplace" as const,
      date: o.created_at,
      customer_name: o.customer_name || "Unknown",
      customer_email: o.customer_email || "",
      amount_cents: o.total_cents,
      status: o.status,
      fulfillment_status: o.fulfillment_status,
      confirmation_id: o.confirmation_id,
      marketplace_order_id: o.id,
    }));

    return [...subEntries, ...mktEntries]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [payments, marketplaceOrders]);

  const filteredTimeline = useMemo(() => {
    const q = timelineQuery.trim().toLowerCase();
    return timeline.filter((entry) => {
      if (timelineSource !== "all" && entry.source !== timelineSource) return false;
      if (q) {
        const hay = `${entry.customer_name} ${entry.customer_email} ${entry.confirmation_id ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [timeline, timelineSource, timelineQuery]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading billing data...</p>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="grid gap-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <SectionHeading
          eyebrow="Financials"
          title="Billing & Payments"
          description="View all customer payments and transaction history."
        />
        <Button variant="outline" className="rounded-xl shadow-sm bg-background border-border/60" asChild>
          <a href="https://dashboard.stripe.com" target="_blank" rel="noreferrer">
            <CreditCard className="mr-2 h-4 w-4 text-primary" />
            Stripe Dashboard
            <ExternalLink className="ml-2 h-3.5 w-3.5 opacity-50" />
          </a>
        </Button>
      </div>

      {/* ── Unified Payment Timeline ── */}
      <Card className="rounded-[32px] border-border/60 bg-card/95 shadow-soft overflow-hidden">
        <CardHeader className="border-b border-border/40 bg-muted/20 px-8 py-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <ArrowUpDown className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-lg font-display">Payment Timeline</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">All subscription payments and marketplace orders, newest first</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search customer, email, order…"
                  value={timelineQuery}
                  onChange={(e) => setTimelineQuery(e.target.value)}
                  className="pl-8 h-8 rounded-xl text-xs w-52"
                />
              </div>
              <Select value={timelineSource} onValueChange={(v) => setTimelineSource(v as typeof timelineSource)}>
                <SelectTrigger className="h-8 rounded-xl text-xs w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  <SelectItem value="subscription">Subscription</SelectItem>
                  <SelectItem value="marketplace">Marketplace</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && ordersLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : filteredTimeline.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">No payment records match your filters.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 border-none">
                    <TableHead className="pl-8 py-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Date</TableHead>
                    <TableHead className="py-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Customer</TableHead>
                    <TableHead className="py-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Source</TableHead>
                    <TableHead className="py-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Amount</TableHead>
                    <TableHead className="py-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Status</TableHead>
                    <TableHead className="pr-6 py-4"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTimeline.slice(0, 50).map((entry) => (
                    <TableRow key={`${entry.source}-${entry.id}`} className="hover:bg-muted/20 transition-colors border-border/40">
                      <TableCell className="pl-8 py-4 text-sm font-medium">
                        {new Date(entry.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-sm">{entry.customer_name}</span>
                          <span className="text-xs text-muted-foreground">{entry.customer_email}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <Badge variant="outline" className={`text-[10px] font-bold border-none capitalize ${
                          entry.source === "subscription" ? "bg-blue-100 text-blue-700" : "bg-violet-100 text-violet-700"
                        }`}>
                          {entry.source === "subscription" ? "Subscription" : "Marketplace"}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-4 font-bold text-sm">
                        {formatCurrency(entry.amount_cents / 100)}
                      </TableCell>
                      <TableCell className="py-4">
                        <Badge variant="outline" className={`capitalize font-bold border-none text-[10px] ${
                          entry.status === "succeeded" || entry.status === "completed" ? "bg-green-100 text-green-700" :
                          entry.status === "failed" || entry.status === "expired" ? "bg-red-100 text-red-700" :
                          entry.status === "refunded" ? "bg-gray-100 text-gray-600" :
                          "bg-amber-100 text-amber-700"
                        }`}>
                          {entry.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="pr-6 py-4 text-right">
                        {entry.marketplace_order_id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 rounded-xl text-xs"
                            onClick={() => openOrderDetail(entry.marketplace_order_id!)}
                          >
                            <Eye className="h-3 w-3 mr-1" />View
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {filteredTimeline.length > 50 && (
                <div className="px-8 py-3 text-xs text-muted-foreground border-t border-border/40">
                  Showing 50 of {filteredTimeline.length} entries. Use search to narrow results.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <AdminOwnershipNote
        title="Finance tool — Detail sections below"
        description="The timeline above merges all payment sources. Sections below provide category-specific detail and filtering."
      >
        <AdminOwnershipBadge kind="finance" />
        <AdminOwnershipBadge kind="future" label="Orders foundation" />
      </AdminOwnershipNote>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="rounded-[28px] border-border/60 bg-card/95 shadow-soft overflow-hidden">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-green-50 text-green-600 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Succeeded</p>
              <p className="text-2xl font-display font-bold">{formatCurrency(totals.succeeded)}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-border/60 bg-card/95 shadow-soft overflow-hidden">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Pending</p>
              <p className="text-2xl font-display font-bold">{formatCurrency(totals.pending)}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-border/60 bg-card/95 shadow-soft overflow-hidden">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Failed</p>
              <p className="text-2xl font-display font-bold">{formatCurrency(totals.failed)}</p>
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
                <Input
                  className="w-64 pl-9 rounded-xl h-10"
                  placeholder="Search customer..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <select
                className="h-10 rounded-xl border border-border/60 bg-background px-3 text-sm font-medium outline-none"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="succeeded">Succeeded</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-sm text-muted-foreground">No payments found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 border-none">
                    <TableHead className="pl-8 py-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Date</TableHead>
                    <TableHead className="py-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Customer</TableHead>
                    <TableHead className="py-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Status</TableHead>
                    <TableHead className="py-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Amount</TableHead>
                    <TableHead className="py-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Method</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => (
                    <TableRow key={p.id} className="hover:bg-muted/20 transition-colors border-border/40">
                      <TableCell className="pl-8 py-5 text-sm font-medium">
                        {new Date(p.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </TableCell>
                      <TableCell className="py-5">
                        <div className="flex flex-col">
                          <span className="font-bold text-sm">{p.customer_name}</span>
                          <span className="text-xs text-muted-foreground italic">{p.customer_email}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-5">
                        <Badge
                          variant="outline"
                          className={`capitalize font-bold border-none ${
                            p.status === 'succeeded' ? 'bg-green-100 text-green-700' :
                            p.status === 'failed' ? 'bg-red-100 text-red-700' :
                            'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {p.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-5 font-bold text-sm">
                        {formatCurrency(p.amount_cents / 100)}
                      </TableCell>
                      <TableCell className="py-5 text-xs font-medium text-muted-foreground capitalize">
                        {p.method}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Marketplace Orders Section */}
      <div className="space-y-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-display font-semibold">Recent Marketplace Orders</h2>
            <AdminOwnershipBadge kind="future" label="Current Orders Home" />
          </div>
          <p className="text-sm text-muted-foreground">Customer marketplace purchases and fulfillment status</p>
        </div>

        {ordersLoading ? (
          <Card className="rounded-[28px] border-border/60 bg-card/95 shadow-soft">
            <CardContent className="p-12 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading marketplace orders...</p>
              </div>
            </CardContent>
          </Card>
        ) : marketplaceOrders.length === 0 ? (
          <Card className="rounded-[28px] border-border/60 bg-card/95 shadow-soft">
            <CardContent className="p-12 text-center">
              <p className="text-sm text-muted-foreground">No marketplace orders found</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-[28px] border-border/60 bg-card/95 shadow-soft">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 border-none">
                      <TableHead className="pl-8 py-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Date</TableHead>
                      <TableHead className="py-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Customer</TableHead>
                      <TableHead className="py-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Order ID</TableHead>
                      <TableHead className="py-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Items</TableHead>
                      <TableHead className="py-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Amount</TableHead>
                      <TableHead className="py-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Fulfillment</TableHead>
                      <TableHead className="pr-6 py-4"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {marketplaceOrders.map((order) => (
                      <TableRow key={order.id} className="hover:bg-muted/20 transition-colors border-border/40">
                        <TableCell className="pl-8 py-5 text-sm font-medium">
                          {new Date(order.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </TableCell>
                        <TableCell className="py-5">
                          <div className="flex flex-col">
                            <span className="font-bold text-sm">{order.customer_name}</span>
                            <span className="text-xs text-muted-foreground italic">{order.customer_email}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-5 font-mono text-xs">{order.confirmation_id}</TableCell>
                        <TableCell className="py-5 text-sm">{order.item_count} {order.item_count === 1 ? 'item' : 'items'}</TableCell>
                        <TableCell className="py-5 font-bold text-sm">
                          {formatCurrency(order.total_cents / 100)}
                        </TableCell>
                        <TableCell className="py-5">
                          <Badge
                            variant="outline"
                            className={`capitalize font-bold border-none ${
                              FULFILLMENT_COLORS[order.fulfillment_status] ?? "bg-blue-100 text-blue-700"
                            }`}
                          >
                            {order.fulfillment_status}
                          </Badge>
                        </TableCell>
                        <TableCell className="pr-6 py-5 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 rounded-xl text-xs"
                            onClick={() => openOrderDetail(order.id)}
                          >
                            <Eye className="h-3.5 w-3.5 mr-1" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>

    {/* ── Order Detail Dialog ── */}

    <Dialog open={!!selectedOrder || detailLoading} onOpenChange={(open) => { if (!open) { setSelectedOrder(null); setSelectedItems([]); } }}>
      <DialogContent className="sm:max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Order Details
          </DialogTitle>
        </DialogHeader>

        {detailLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : selectedOrder ? (
          <div className="space-y-5 pb-2">
            {/* Header info */}
            <div className="rounded-xl bg-muted/20 border border-border/40 p-4 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-bold">{selectedOrder.confirmation_id}</span>
                <Badge variant="outline" className={`capitalize font-bold border-none text-xs ${FULFILLMENT_COLORS[selectedOrder.fulfillment_status] ?? ""}`}>
                  {selectedOrder.fulfillment_status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {new Date(selectedOrder.created_at).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
              </p>
              {selectedOrder.profiles && (
                <p className="text-sm font-semibold">{selectedOrder.profiles.name}
                  <span className="text-xs font-normal text-muted-foreground ml-2">{selectedOrder.profiles.email}</span>
                </p>
              )}
              {selectedOrder.properties && (
                <p className="text-xs text-muted-foreground">
                  {selectedOrder.properties.address}, {selectedOrder.properties.city} {selectedOrder.properties.zip}
                </p>
              )}
              {selectedOrder.appointment_id && (
                <p className="text-xs text-primary font-medium">Linked to appointment</p>
              )}
            </div>

            {/* Line items */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Line Items</p>
              {selectedItems.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No line items found</p>
              ) : (
                <div className="space-y-2">
                  {selectedItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between rounded-xl border border-border/40 bg-muted/10 px-3 py-2.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.item_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.quantity} × {formatCurrency(item.unit_price_cents / 100)}
                        </p>
                      </div>
                      <p className="text-sm font-bold">{formatCurrency(item.line_total_cents / 100)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* Totals */}
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>{formatCurrency(selectedOrder.subtotal_cents / 100)}</span>
              </div>
              {selectedOrder.tax_cents > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Tax</span>
                  <span>{formatCurrency(selectedOrder.tax_cents / 100)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-foreground">
                <span>Total</span>
                <span>{formatCurrency(selectedOrder.total_cents / 100)}</span>
              </div>
            </div>

            <Separator />

            {/* Fulfillment status update */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Update Fulfillment Status</p>
              <div className="flex items-center gap-3">
                <Select
                  value={selectedOrder.fulfillment_status}
                  onValueChange={(val) => updateFulfillmentStatus(selectedOrder.id, val as FulfillmentStatus)}
                  disabled={updatingFulfillment || selectedOrder.status === "failed" || selectedOrder.status === "expired" || selectedOrder.status === "refunded"}
                >
                  <SelectTrigger className="rounded-xl flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FULFILLMENT_STATUSES.map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {updatingFulfillment && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </div>
              {(selectedOrder.status === "failed" || selectedOrder.status === "expired" || selectedOrder.status === "refunded") && (
                <p className="text-xs text-muted-foreground mt-1.5">
                  Cannot update fulfillment — order payment is {selectedOrder.status}.
                </p>
              )}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
    </>
  );
};

export default Billing;
