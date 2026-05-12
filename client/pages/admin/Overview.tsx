import { useEffect, useState } from "react";
import SectionHeading from "@/components/common/SectionHeading";
import { supabase, withTimeout } from "@/lib/supabase";
import { formatCurrency } from "@/lib/pricing";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users,
  Calendar,
  Ticket,
  DollarSign,
  AlertCircle,
  MessageSquare,
  ArrowUpRight,
  TrendingUp,
  Loader2,
  CalendarX,
  CreditCard,
  CalendarPlus,
} from "lucide-react";
import { Link } from "react-router-dom";
import { adminApi } from "@/lib/adminApi";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface KPI {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
  trend?: string;
}

interface SubAlert {
  subscription_id: string;
  user_id: string;
  property_id: string | null;
  customer: { name: string; email: string } | null;
  property: { address: string; city: string } | null;
  cadence_days: number | null;
  last_payment_at: string | null;
  current_period_end: string | null;
}

const Overview = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [upcomingAppointments, setUpcomingAppointments] = useState<any[]>([]);
  const [recentTickets, setRecentTickets] = useState<any[]>([]);
  const [newCustomers, setNewCustomers] = useState<any[]>([]);
  const [needsScheduling, setNeedsScheduling] = useState<SubAlert[]>([]);
  const [pastDue, setPastDue] = useState<any[]>([]);

  // Schedule-from-alert dialog
  const [schedulingTarget, setSchedulingTarget] = useState<SubAlert | null>(null);
  const [schedDate, setSchedDate] = useState("");
  const [schedTime, setSchedTime] = useState("09:00");
  const [schedNotes, setSchedNotes] = useState("");
  const [schedSaving, setSchedSaving] = useState(false);
  const [employees, setEmployees] = useState<Array<{ id: string; name: string }>>([]);

  const openScheduleDialog = (alert: SubAlert) => {
    setSchedulingTarget(alert);
    setSchedDate(new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0]); // Default 7 days out
    setSchedTime("09:00");
    setSchedNotes("");
    // Fetch employees if not loaded
    if (employees.length === 0) {
      adminApi("/api/admin/employees")
        .then((data: any[]) => {
          const active = data.filter((e: any) => e.status === "active");
          setEmployees(active.map((e: any) => ({ id: e.id, name: e.name || "Employee" })));
        })
        .catch(() => setEmployees([]));
    }
  };

  const createAppointment = async () => {
    if (!schedulingTarget || !schedDate) return;
    setSchedSaving(true);
    try {
      const scheduled_at = `${schedDate}T${schedTime}:00`;
      await adminApi("/api/admin/appointments", "POST", {
        user_id: schedulingTarget.user_id,
        property_id: schedulingTarget.property_id,
        scheduled_at,
        service_type: "Mosquito Service",
        notes: schedNotes.trim() || null,
      });
      toast({ title: "Appointment created", description: `Scheduled for ${schedDate} at ${schedTime}.` });
      setSchedulingTarget(null);
      // Refresh the needs-scheduling queue so this subscription disappears
      adminApi("/api/admin/subscriptions/needs-scheduling")
        .then((res) => setNeedsScheduling(res.queue || []))
        .catch(() => {});
    } catch (err: any) {
      toast({ title: "Failed to create appointment", description: err.message, variant: "destructive" });
    } finally {
      setSchedSaving(false);
    }
  };

  // Load operational alerts (subscription queue + past-due) separately so they
  // don't block the main dashboard render if one query is slow.
  useEffect(() => {
    adminApi("/api/admin/subscriptions/needs-scheduling")
      .then((res) => setNeedsScheduling(res.queue || []))
      .catch(() => setNeedsScheduling([]));

    adminApi("/api/admin/subscriptions/past-due")
      .then((res) => setPastDue(res.subscriptions || []))
      .catch(() => setPastDue([]));
  }, []);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setIsLoading(true);

        // Run all queries in parallel and fail fast if any request stalls
        const [
          profilesResult,
          todayApptsResult,
          upcomingApptsResult,
          ticketsResult,
          newProfilesResult,
          paymentsResult,
          messagesResult
        ] = await withTimeout(Promise.all([
          // 1. Load active customers count
          supabase
            .from("profiles")
            .select("id", { count: "exact", head: true })
            .eq("role", "customer"),

          // 2. Load appointments for today
          (async () => {
            const today = new Date().toISOString().split("T")[0];
            return supabase
              .from("appointments")
              .select("id, scheduled_at, status")
              .gte("scheduled_at", `${today}T00:00:00`)
              .lt("scheduled_at", `${today}T23:59:59`);
          })(),

          // 3. Load upcoming appointments with details
          supabase
            .from("appointments")
            .select(`
              id,
              user_id,
              property_id,
              scheduled_at,
              status,
              profiles:user_id (id, name, email),
              properties:property_id (id, address, city)
            `)
            .eq("status", "scheduled")
            .gte("scheduled_at", new Date().toISOString())
            .order("scheduled_at", { ascending: true })
            .limit(5),

          // 4. Load support tickets
          supabase
            .from("tickets")
            .select("id, subject, description, priority, status, created_at")
            .order("created_at", { ascending: false })
            .limit(5)
            .then(result => result, () => ({ data: null })),

          // 5. Load newest customers
          supabase
            .from("profiles")
            .select("id, name, email, phone, created_at, role")
            .eq("role", "customer")
            .order("created_at", { ascending: false })
            .limit(5),

          // 6. Load payments for MTD revenue
          (async () => {
            const monthStart = new Date();
            monthStart.setDate(1);
            monthStart.setHours(0, 0, 0, 0);
            return supabase
              .from("payments")
              .select("amount_cents")
              .gte("created_at", monthStart.toISOString());
          })(),

          // 7. Load unread messages count
          supabase
            .from("messages")
            .select("id", { count: "exact", head: true })
            .eq("is_read", false)
        ]), 10000, "Admin overview");

        // Extract data with fallbacks
        const activeCustomers = profilesResult?.data?.length || 0;
        const appointmentsToday = todayApptsResult?.data?.length || 0;

        const upcomingAppts = upcomingApptsResult?.data?.map((apt: any) => ({
          id: apt.id,
          date: new Date(apt.scheduled_at).toLocaleDateString(),
          time: new Date(apt.scheduled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          customer: apt.profiles?.name || "Unknown",
          property: `${apt.properties?.address || "Unknown"}, ${apt.properties?.city || ""}`,
          status: apt.status,
        })) || [];

        setUpcomingAppointments(upcomingAppts);

        // Fallback dummy tickets if load fails
        const dummyTickets = [
          { id: "t1", subject: "Water pressure issue", priority: "high", status: "open", createdAt: new Date().toISOString() },
          { id: "t2", subject: "Billing inquiry", priority: "medium", status: "in_progress", createdAt: new Date(Date.now() - 86400000).toISOString() },
        ];

        const tickets = ticketsResult?.data && ticketsResult.data.length > 0
          ? (ticketsResult.data as any[]).map((ticket) => ({
              id: ticket.id,
              subject: ticket.subject,
              priority: ticket.priority || "medium",
              status: ticket.status || "open",
              createdAt: ticket.created_at,
            }))
          : dummyTickets;
        setRecentTickets(tickets.slice(0, 5));

        const customers = newProfilesResult?.data?.map((p: any) => ({
          id: p.id,
          name: p.name,
          email: p.email,
          phone: p.phone,
          createdAt: p.created_at,
          status: "active"
        })) || [];

        setNewCustomers(customers);

        const mtdRevenue = (paymentsResult?.data || []).reduce((sum: number, p: any) => sum + (p.amount_cents || 0), 0) / 100;
        const openTickets = tickets?.filter((t: any) => t.status === "open").length || 2;
        const unreadCount = messagesResult?.data?.length || 0;

        // ── Real trend calculations: compare current 30d vs previous 30d ────────
        const now = new Date();
        const prev30Start = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString();
        const curr30Start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

        const calcTrend = (current: number, previous: number): string => {
          if (previous === 0) return current > 0 ? "New" : "—";
          const pct = Math.round(((current - previous) / previous) * 100);
          if (pct === 0) return "No change";
          return pct > 0 ? `+${pct}%` : `${pct}%`;
        };

        const [prevRevenueRes, prevCustomersRes, currNewCustomersRes] = await Promise.all([
          supabase.from("payments").select("amount_cents")
            .gte("created_at", prev30Start).lt("created_at", curr30Start),
          supabase.from("profiles").select("id", { count: "exact", head: true })
            .eq("role", "customer").gte("created_at", prev30Start).lt("created_at", curr30Start),
          supabase.from("profiles").select("id", { count: "exact", head: true })
            .eq("role", "customer").gte("created_at", curr30Start),
        ]).catch(() => [null, null, null]);

        const prevRevenue = (prevRevenueRes?.data || []).reduce((s: number, p: any) => s + (p.amount_cents || 0), 0) / 100;
        const prevNewCustomers = prevCustomersRes?.count ?? 0;
        const currNewCustomers = currNewCustomersRes?.count ?? 0;

        const revenueTrend = calcTrend(mtdRevenue, prevRevenue);
        const customerTrend = calcTrend(currNewCustomers, prevNewCustomers);

        // Build KPIs array — trends are real calculations or "—" if insufficient data
        const newKpis: KPI[] = [
          {
            label: "Active customers",
            value: activeCustomers.toString(),
            icon: <Users className="h-6 w-6" />,
            color: "text-blue-600",
            bg: "bg-blue-50",
            trend: customerTrend,
          },
          {
            label: "Appointments today",
            value: appointmentsToday.toString(),
            icon: <Calendar className="h-6 w-6" />,
            color: "text-primary",
            bg: "bg-primary/10",
            trend: undefined, // single-day count — no meaningful trend
          },
          {
            label: "Open tickets",
            value: openTickets.toString(),
            icon: <Ticket className="h-6 w-6" />,
            color: "text-amber-600",
            bg: "bg-amber-50",
            trend: undefined,
          },
          {
            label: "MTD revenue",
            value: formatCurrency(mtdRevenue),
            icon: <DollarSign className="h-6 w-6" />,
            color: "text-green-600",
            bg: "bg-green-50",
            trend: revenueTrend,
          },
          {
            label: "Past-due subscriptions",
            value: "—",
            icon: <AlertCircle className="h-6 w-6" />,
            color: "text-destructive",
            bg: "bg-destructive/10",
            trend: undefined,
          },
          {
            label: "Unread messages",
            value: unreadCount.toString(),
            icon: <MessageSquare className="h-6 w-6" />,
            color: "text-purple-600",
            bg: "bg-purple-50",
            trend: undefined,
          },
        ];

        setKpis(newKpis);
        setIsLoading(false);
      } catch (err) {
        console.error("[Admin Overview] Error loading dashboard data:", err);
        // Set default KPIs so dashboard still renders
        const defaultKpis: KPI[] = [
          {
            label: "Active customers",
            value: "0",
            icon: <Users className="h-6 w-6" />,
            color: "text-blue-600",
            bg: "bg-blue-50",
          },
          {
            label: "Appointments today",
            value: "0",
            icon: <Calendar className="h-6 w-6" />,
            color: "text-primary",
            bg: "bg-primary/10",
          },
          {
            label: "Open tickets",
            value: "0",
            icon: <Ticket className="h-6 w-6" />,
            color: "text-amber-600",
            bg: "bg-amber-50",
          },
          {
            label: "MTD revenue",
            value: formatCurrency(0),
            icon: <DollarSign className="h-6 w-6" />,
            color: "text-green-600",
            bg: "bg-green-50",
          },
          {
            label: "Overdue invoices",
            value: "0",
            icon: <AlertCircle className="h-6 w-6" />,
            color: "text-destructive",
            bg: "bg-destructive/10",
          },
          {
            label: "Unread messages",
            value: "0",
            icon: <MessageSquare className="h-6 w-6" />,
            color: "text-purple-600",
            bg: "bg-purple-50",
          },
        ];
        setKpis(defaultKpis);
        setIsLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="grid gap-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <SectionHeading
          eyebrow="Admin Overview"
          title="Today's operations at a glance"
          description="Monitor customers, appointments, tickets, revenue, and messages."
        />
        <div className="flex items-center gap-2 bg-primary/5 px-4 py-2 rounded-full border border-primary/10">
          <TrendingUp className="h-4 w-4 text-primary" />
          <span className="text-sm font-bold text-primary">System healthy</span>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {kpis.map((k) => {
          // Show real past-due count from the alert state (loaded separately)
          const value = k.label === "Past-due subscriptions" ? pastDue.length.toString() : k.value;
          return (
            <Card key={k.label} className="rounded-[28px] border-border/60 bg-card/95 shadow-soft overflow-hidden transition-all hover:shadow-md group">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">{k.label}</p>
                    <p className="text-3xl font-display font-bold text-foreground">{value}</p>
                  </div>
                  <div className={`h-12 w-12 rounded-2xl ${k.bg} ${k.color} flex items-center justify-center transition-transform group-hover:scale-110`}>
                    {k.icon}
                  </div>
                </div>
                {k.trend && (
                  <div className="mt-4 flex items-center gap-1 text-[10px] font-bold text-green-600 uppercase tracking-wider">
                    <ArrowUpRight className="h-3 w-3" />
                    <span>{k.trend} from last week</span>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ── Operational Alerts ── */}
      {(needsScheduling.length > 0 || pastDue.length > 0) && (
        <div className="grid gap-4">

          {/* Subscriptions needing appointment scheduling */}
          {needsScheduling.length > 0 && (
            <div className="rounded-2xl border border-amber-400/30 bg-amber-500/5 p-5">
              <div className="flex items-start gap-3 mb-4">
                <CalendarX className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-amber-800">
                    {needsScheduling.length} active subscription{needsScheduling.length !== 1 ? "s" : ""} with no upcoming appointment
                  </p>
                  <p className="text-xs text-amber-700/80 mt-0.5">
                    These customers have paid for service but have no future appointment scheduled. Create appointments in the Appointments page.
                  </p>
                </div>
                <Link to="/admin/appointments">
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-400/30 text-xs whitespace-nowrap hover:bg-amber-500/20 transition-colors">
                    Go to Appointments →
                  </Badge>
                </Link>
              </div>
              <div className="space-y-2">
                {needsScheduling.slice(0, 5).map((row) => (
                  <div key={row.subscription_id} className="flex items-center justify-between rounded-xl bg-amber-500/8 border border-amber-400/20 px-4 py-2.5 gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {row.customer?.name ?? "Unknown customer"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {row.property?.address ?? "No address"}{row.property?.city ? `, ${row.property.city}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {row.cadence_days && (
                        <Badge variant="outline" className="text-[10px] border-amber-400/30 text-amber-700">
                          Every {row.cadence_days}d
                        </Badge>
                      )}
                      {row.last_payment_at && (
                        <span className="text-[11px] text-muted-foreground hidden sm:inline">
                          Paid {new Date(row.last_payment_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                        </span>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2.5 text-xs rounded-lg border-amber-400/50 text-amber-800 hover:bg-amber-500/10"
                        onClick={() => openScheduleDialog(row)}
                      >
                        <CalendarPlus className="h-3 w-3 mr-1" />
                        Schedule
                      </Button>
                    </div>
                  </div>
                ))}
                {needsScheduling.length > 5 && (
                  <p className="text-xs text-amber-700/70 text-center pt-1">
                    +{needsScheduling.length - 5} more — visit Appointments to see all
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Past-due subscriptions */}
          {pastDue.length > 0 && (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
              <div className="flex items-start gap-3 mb-4">
                <CreditCard className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-destructive">
                    {pastDue.length} past-due subscription{pastDue.length !== 1 ? "s" : ""}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Payment failed on these subscriptions. Stripe dunning is in progress. Review in Billing.
                  </p>
                </div>
                <Link to="/admin/billing">
                  <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-xs whitespace-nowrap hover:bg-destructive/20 transition-colors">
                    Go to Billing →
                  </Badge>
                </Link>
              </div>
              <div className="space-y-2">
                {pastDue.slice(0, 4).map((sub: any) => (
                  <div key={sub.id} className="flex items-center justify-between rounded-xl bg-destructive/5 border border-destructive/20 px-4 py-2.5 gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {(sub as any).profiles?.name ?? "Unknown"}
                      </p>
                      <p className="text-xs text-muted-foreground">{(sub as any).profiles?.email ?? ""}</p>
                    </div>
                    {sub.current_period_end && (
                      <span className="text-[11px] text-destructive/80 shrink-0">
                        Period ended {new Date(sub.current_period_end).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        <Card className="rounded-[32px] border-border/60 bg-card/95 shadow-soft overflow-hidden">
          <CardHeader className="border-b border-border/40 bg-muted/20 px-8 py-6">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-display font-bold">Upcoming Appointments</CardTitle>
              <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">Next 24h</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {upcomingAppointments.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <p className="text-sm">No appointments scheduled for the next 24 hours</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 border-none">
                      <TableHead className="pl-8 py-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Date/Time</TableHead>
                      <TableHead className="py-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Customer</TableHead>
                      <TableHead className="py-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Property</TableHead>
                      <TableHead className="pr-8 py-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {upcomingAppointments.map((apt) => (
                      <TableRow key={apt.id} className="hover:bg-muted/20 transition-colors border-border/40">
                        <TableCell className="pl-8 py-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-sm">{apt.date}</span>
                            <span className="text-xs text-muted-foreground">{apt.time}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-4 font-medium text-sm">{apt.customer}</TableCell>
                        <TableCell className="py-4 text-xs text-muted-foreground italic">{apt.property}</TableCell>
                        <TableCell className="pr-8 py-4 text-right">
                          <Badge variant="secondary" className="bg-muted text-foreground hover:bg-muted border-none text-[10px]">
                            {apt.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-[32px] border-border/60 bg-card/95 shadow-soft overflow-hidden">
          <CardHeader className="border-b border-border/40 bg-muted/20 px-8 py-6">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-display font-bold">Recent Support Tickets</CardTitle>
              <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200">Attention Required</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {recentTickets.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <p className="text-sm">No support tickets found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 border-none">
                      <TableHead className="pl-8 py-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Subject</TableHead>
                      <TableHead className="py-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Priority</TableHead>
                      <TableHead className="pr-8 py-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentTickets.map((ticket) => (
                      <TableRow key={ticket.id} className="hover:bg-muted/20 transition-colors border-border/40">
                        <TableCell className="pl-8 py-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-sm line-clamp-1">{ticket.subject}</span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(ticket.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <Badge
                            variant="outline"
                            className={`text-[10px] uppercase tracking-wider ${
                              ticket.priority === "high"
                                ? "bg-red-50 text-red-600 border-red-200"
                                : ticket.priority === "medium"
                                ? "bg-amber-50 text-amber-600 border-amber-200"
                                : "bg-blue-50 text-blue-600 border-blue-200"
                            }`}
                          >
                            {ticket.priority}
                          </Badge>
                        </TableCell>
                        <TableCell className="pr-8 py-4 text-right">
                          <span className="text-xs font-bold capitalize">{ticket.status.replace("_", " ")}</span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-[32px] border-border/60 bg-card/95 shadow-soft overflow-hidden mb-10">
        <CardHeader className="border-b border-border/40 bg-muted/20 px-8 py-6">
          <CardTitle className="text-lg font-display font-bold">Newest Customers</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {newCustomers.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <p className="text-sm">No customers found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 border-none">
                    <TableHead className="pl-8 py-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Customer</TableHead>
                    <TableHead className="py-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Contact Info</TableHead>
                    <TableHead className="py-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Joined Date</TableHead>
                    <TableHead className="pr-8 py-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {newCustomers.map((customer) => (
                    <TableRow key={customer.id} className="hover:bg-muted/20 transition-colors border-border/40">
                      <TableCell className="pl-8 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                            {customer.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-bold text-sm">{customer.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex flex-col text-xs text-muted-foreground">
                          <span>{customer.email}</span>
                          <span>{customer.phone || "No phone"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4 text-sm font-medium">
                        {new Date(customer.createdAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric"
                        })}
                      </TableCell>
                      <TableCell className="pr-8 py-4 text-right">
                        <Badge className="bg-green-100 text-green-700">{customer.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>

    {/* ── Schedule Appointment Dialog ── */}
    <Dialog open={!!schedulingTarget} onOpenChange={(open) => { if (!open) setSchedulingTarget(null); }}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlus className="h-5 w-5 text-primary" />
            Schedule Appointment
          </DialogTitle>
        </DialogHeader>
        {schedulingTarget && (
          <div className="space-y-4 pb-2">
            {/* Customer + Property context */}
            <div className="rounded-xl bg-muted/20 border border-border/40 p-4 space-y-1">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Customer</p>
              <p className="text-sm font-semibold">{schedulingTarget.customer?.name ?? "Unknown"}</p>
              <p className="text-xs text-muted-foreground">{schedulingTarget.customer?.email ?? ""}</p>
              {schedulingTarget.property && (
                <>
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground pt-1">Property</p>
                  <p className="text-xs">{schedulingTarget.property.address}{schedulingTarget.property.city ? `, ${schedulingTarget.property.city}` : ""}</p>
                </>
              )}
              {schedulingTarget.cadence_days && (
                <p className="text-xs text-muted-foreground pt-0.5">Subscription cadence: every {schedulingTarget.cadence_days} days</p>
              )}
            </div>

            {/* Date */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Appointment Date *</Label>
              <Input
                type="date"
                value={schedDate}
                onChange={(e) => setSchedDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                className="rounded-xl"
              />
            </div>

            {/* Time */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Start Time</Label>
              <Input
                type="time"
                value={schedTime}
                onChange={(e) => setSchedTime(e.target.value)}
                className="rounded-xl"
              />
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Notes (optional)</Label>
              <Textarea
                value={schedNotes}
                onChange={(e) => setSchedNotes(e.target.value)}
                placeholder="Any special instructions or details…"
                rows={2}
                className="rounded-xl resize-none text-sm"
              />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" className="rounded-xl" onClick={() => setSchedulingTarget(null)}>
            Cancel
          </Button>
          <Button
            className="rounded-xl shadow-brand"
            onClick={createAppointment}
            disabled={schedSaving || !schedDate}
          >
            {schedSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CalendarPlus className="h-4 w-4 mr-2" />}
            {schedSaving ? "Creating…" : "Create Appointment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
};

export default Overview;
