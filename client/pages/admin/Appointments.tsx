import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import SectionHeading from "@/components/common/SectionHeading";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Calendar as CalendarIcon,
  User,
  MapPin,
  Clock,
  UserPlus,
  Trash2,
  RotateCcw,
  Loader2,
  Ban,
  Plus,
  AlertTriangle,
  Sun,
  Sunset,
  AlertCircle,
  Send,
  XCircle,
} from "lucide-react";
import { Appointment } from "@/data/admin";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { adminApi } from "@/lib/adminApi";
import { AdminOwnershipBadge, AdminOwnershipNote } from "@/components/admin/AdminOwnershipBadge";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { AdminActionMenu } from "@/components/admin/AdminActionMenu";

// ── Date resolution helper ─────────────────────────────────────────────────────
// Priority: scheduled_date → scheduled_at date part → created_at date part → ""
function resolveDate(app: any): string {
  if (app.scheduled_date) return app.scheduled_date as string;
  if (app.scheduled_at) return (app.scheduled_at as string).split("T")[0];
  if (app.created_at)   return (app.created_at as string).split("T")[0];
  return "";
}

// Resolve display time from Phase 1 window label, notes, or scheduled_at
function resolveStartTime(app: any): string {
  if (app.window === "morning")   return "08:00";
  if (app.window === "afternoon") return "12:00";
  if (app.notes?.includes("Slot:")) {
    const extracted = (app.notes.split("Slot:")[1] || "").split("|")[0]?.trim();
    if (extracted) return extracted;
  }
  if (app.scheduled_at) {
    try {
      const d = new Date(app.scheduled_at);
      return d.toTimeString().slice(0, 5);
    } catch { /* fall through */ }
  }
  return "08:00";
}

// ── Blackout date types ──────────────────────────────────────────────────────

interface BlackoutDate {
  id: string;
  date: string;
  reason?: string;
  scope: string;
  service_area_id?: string;
  created_at: string;
}

// ── Blackout Dates Panel ─────────────────────────────────────────────────────

const BlackoutDatesPanel = () => {
  const { toast } = useToast();
  const [blackoutDates, setBlackoutDates] = useState<BlackoutDate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newReason, setNewReason] = useState("");
  const [newScope, setNewScope] = useState<"all" | "service_area">("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchBlackoutDates = async () => {
    setIsLoading(true);
    try {
      const data = await adminApi("/api/admin/blackout-dates");
      setBlackoutDates(data.blackout_dates || []);
    } catch {
      toast({ title: "Failed to load blackout dates", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchBlackoutDates(); }, []);

  const handleAdd = async () => {
    if (!newDate) {
      toast({ title: "Date required", description: "Please pick a date to block.", variant: "destructive" });
      return;
    }
    try {
      const result = await adminApi("/api/admin/blackout-dates", "POST", { date: newDate, reason: newReason || undefined, scope: newScope });
      toast({
        title: "Date blocked",
        description: result.affected_appointments > 0
          ? `${result.affected_appointments} existing appointment(s) on this date — review them manually.`
          : "Blackout date added. No existing appointments affected.",
      });
      setNewDate(""); setNewReason(""); setNewScope("all"); setIsAdding(false);
      fetchBlackoutDates();
    } catch (err: any) {
      toast({ title: "Failed to add blackout date", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await adminApi(`/api/admin/blackout-dates/${id}`, "DELETE");
      setBlackoutDates((prev) => prev.filter((b) => b.id !== id));
      toast({ title: "Blackout date removed" });
    } catch {
      toast({ title: "Failed to remove blackout date", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Card className="rounded-[28px] border-border/60 bg-card/95 shadow-soft overflow-hidden">
      <CardHeader className="bg-muted/20 px-8 py-5 border-b border-border/40">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-display font-bold flex items-center gap-2">
            <Ban className="h-5 w-5 text-destructive/70" /> Blackout Dates
          </CardTitle>
          <Button size="sm" variant={isAdding ? "outline" : "default"} className="rounded-xl h-9 font-bold" onClick={() => setIsAdding((v) => !v)}>
            {isAdding ? "Cancel" : <><Plus className="h-4 w-4 mr-1" /> Add</>}
          </Button>
        </div>
      </CardHeader>

      {isAdding && (
        <div className="px-8 py-5 border-b border-border/40 bg-amber-50/50">
          <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto]">
            <div className="space-y-1">
              <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Date</Label>
              <input type="date" className="h-10 w-full rounded-xl border border-border/60 bg-background px-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20" value={newDate} onChange={(e) => setNewDate(e.target.value)} min={new Date().toISOString().slice(0, 10)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Reason (optional)</Label>
              <Input placeholder="e.g., Holiday, Maintenance..." className="h-10 rounded-xl" value={newReason} onChange={(e) => setNewReason(e.target.value)} />
            </div>
            <div className="flex items-end">
              <Button className="h-10 rounded-xl shadow-brand font-bold px-6" onClick={handleAdd}>Block Date</Button>
            </div>
          </div>
          <p className="text-xs text-amber-700/70 font-medium mt-3 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" />
            Existing appointments on this date will not be auto-canceled — review them manually.
          </p>
        </div>
      )}

      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground/40" /></div>
        ) : blackoutDates.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground italic">No blackout dates configured. Customers can book any operational day.</div>
        ) : (
          <div className="divide-y divide-border/40">
            {blackoutDates.map((b) => (
              <div key={b.id} className="flex items-center justify-between px-8 py-4">
                <div className="flex items-center gap-4">
                  <div className="h-9 w-9 rounded-xl bg-destructive/10 flex items-center justify-center">
                    <Ban className="h-4 w-4 text-destructive/70" />
                  </div>
                  <div>
                    <p className="font-bold text-sm">{new Date(b.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "long", day: "numeric", year: "numeric" })}</p>
                    <p className="text-xs text-muted-foreground font-medium">{b.reason || "No reason given"} · {b.scope === "all" ? "All areas" : "Specific area"}</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl text-destructive/60 hover:text-destructive hover:bg-destructive/10" disabled={deletingId === b.id} onClick={() => handleDelete(b.id)}>
                  {deletingId === b.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// ── Window badge helper ────────────────────────────────────────────────────────

function WindowBadge({ window: win, windowLabel }: { window: string | null; windowLabel: string | null }) {
  if (!win && !windowLabel) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-primary/70 bg-primary/5 rounded-full px-2 py-0.5">
      {win === "morning" ? <Sun className="h-3 w-3" /> : win === "afternoon" ? <Sunset className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
      {windowLabel || win}
    </span>
  );
}

// ── Scheduling Queue Panel ─────────────────────────────────────────────────────

interface SchedulingQueueItem {
  subscription_id: string;
  user_id: string;
  property_id: string;
  cadence_days: number | null;
  current_period_end: string | null;
  last_payment_at: string | null;
  customer: { id: string; name: string; email: string } | null;
  property: { id: string; address: string; city: string; zip: string } | null;
}

const SchedulingQueuePanel = () => {
  const [queue, setQueue] = useState<SchedulingQueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchQueue = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await adminApi("/api/admin/subscriptions/needs-scheduling");
      setQueue(data.queue || []);
    } catch (err: any) {
      setError(err.message || "Failed to load scheduling queue");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchQueue(); }, []);

  return (
    <Card className="rounded-[28px] border-border/60 bg-card/95 shadow-soft overflow-hidden">
      <CardHeader className="bg-muted/20 px-8 py-5 border-b border-border/40">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-display font-bold flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-primary/70" /> Scheduling Queue
            {queue.length > 0 && (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs ml-1">
                {queue.length} need scheduling
              </Badge>
            )}
          </CardTitle>
          <Button size="sm" variant="outline" className="rounded-xl h-9" onClick={fetchQueue} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">Active subscribers with no upcoming appointment scheduled.</p>
      </CardHeader>

      <CardContent className="p-0">
        {error && (
          <div className="flex items-center gap-3 px-8 py-4 bg-red-50 border-b border-red-200">
            <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
            <p className="text-sm text-red-700 flex-1">{error}</p>
            <Button variant="outline" size="sm" className="rounded-xl shrink-0" onClick={fetchQueue}>Retry</Button>
          </div>
        )}
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/40" />
          </div>
        ) : queue.length === 0 && !error ? (
          <div className="py-10 text-center text-sm text-muted-foreground italic">
            All active subscribers have an upcoming appointment. Queue is clear.
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {queue.map((item) => (
              <div key={item.subscription_id} className="flex items-center justify-between px-8 py-4 hover:bg-muted/20 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="h-9 w-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 text-amber-700" />
                  </div>
                  <div>
                    <p className="font-bold text-sm">{item.customer?.name || "Unknown Customer"}</p>
                    <p className="text-xs text-muted-foreground font-medium">
                      {item.customer?.email}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <MapPin className="h-3 w-3 shrink-0" />
                      {item.property?.address}{item.property?.city ? `, ${item.property.city}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-right">
                  {item.cadence_days && (
                    <div className="hidden sm:block">
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Cadence</p>
                      <p className="text-sm font-semibold">Every {item.cadence_days}d</p>
                    </div>
                  )}
                  {item.current_period_end && (
                    <div className="hidden sm:block">
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Period End</p>
                      <p className="text-sm font-semibold">
                        {new Date(item.current_period_end).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </p>
                    </div>
                  )}
                  <Button size="sm" variant="outline" className="rounded-xl h-9 font-bold" asChild>
                    <Link to={`/admin/appointments?userId=${item.user_id}`}>Schedule</Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// ── Main Appointments page ─────────────────────────────────────────────────────

const Appointments = () => {
  const { toast } = useToast();
  const [items, setItems] = useState<Appointment[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);
  const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [customerMap, setCustomerMap] = useState<Record<string, { name: string; email: string }>>({});
  const [propertyMap, setPropertyMap] = useState<Record<string, { address: string; city: string; zip: string }>>({});
  const [employees, setEmployees] = useState<Array<{ id: string; name: string }>>([]);
  const [assignmentMap, setAssignmentMap] = useState<Record<string, string>>({});

  useEffect(() => { fetchAppointments(); fetchEmployees(); }, []);

  const fetchEmployees = async () => {
    const { data: empData } = await supabase.from("employees").select("id, user_id, status").eq("status", "active");
    if (!empData?.length) return;
    const userIds = empData.map((e: any) => e.user_id).filter(Boolean);
    const { data: profileData } = await supabase.from("profiles").select("id, name").in("id", userIds);
    const pm: Record<string, string> = {};
    (profileData || []).forEach((p: any) => { pm[p.id] = p.name || p.id; });
    setEmployees(empData.map((e: any) => ({ id: e.id, name: pm[e.user_id] || "Employee" })));
  };

  const fetchAppointments = async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const { data, error } = await supabase
        .from("appointments")
        .select("id, user_id, property_id, scheduled_at, scheduled_date, window, window_label, service_area_id, notes, service_type, status, created_at")
        .order("scheduled_at", { ascending: true, nullsFirst: false });

      if (error) {
        setFetchError(`Database error: ${error.message}`);
        setItems([]);
        return;
      }

      if (!data || data.length === 0) { setItems([]); return; }

      const uniqueCustomerIds = [...new Set(data.map((a: any) => a.user_id).filter(Boolean))];
      const uniquePropertyIds = [...new Set(data.map((a: any) => a.property_id).filter(Boolean))];

      const [custResult, propResult] = await Promise.all([
        uniqueCustomerIds.length > 0
          ? supabase.from("profiles").select("id, name, email").in("id", uniqueCustomerIds)
          : { data: [], error: null },
        uniquePropertyIds.length > 0
          ? supabase.from("properties").select("id, address, city, zip").in("id", uniquePropertyIds)
          : { data: [], error: null },
      ]);

      const cMap: Record<string, { name: string; email: string }> = {};
      (custResult.data || []).forEach((c: any) => { cMap[c.id] = { name: c.name || "Unknown", email: c.email || "" }; });
      setCustomerMap(cMap);

      const pMap: Record<string, { address: string; city: string; zip: string }> = {};
      (propResult.data || []).forEach((p: any) => { pMap[p.id] = { address: p.address || "", city: p.city || "", zip: p.zip || "" }; });
      setPropertyMap(pMap);

      // Safe mapping — resolveDate never throws, handles all null cases
      const mapped: Appointment[] = (data as any[]).map((app) => ({
        id:             app.id,
        customerId:     app.user_id,
        propertyId:     app.property_id,
        date:           resolveDate(app) || "unscheduled",
        scheduledDate:  app.scheduled_date ?? null,
        window:         app.window ?? null,
        windowLabel:    app.window_label ?? null,
        startTime:      resolveStartTime(app),
        endTime:        "10:00",
        type:           app.service_type === "one_time" ? "one_time" : "subscription",
        status:         (app.status as any) || "requested",
        technician:     "Unassigned",
      }));
      setItems(mapped);

      const appointmentIds = mapped.map((a) => a.id);
      if (appointmentIds.length > 0) {
        const { data: assignData } = await supabase.from("assignments").select("appointment_id, employee_id").in("appointment_id", appointmentIds);
        if (assignData) {
          const aMap: Record<string, string> = {};
          assignData.forEach((a: any) => { aMap[a.appointment_id] = a.employee_id; });
          setAssignmentMap(aMap);
        }
      }
    } catch (err: any) {
      console.error("[Admin Appointments] Exception:", err);
      setFetchError(`Unexpected error loading appointments: ${err?.message || "Unknown error"}`);
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Filters
  const [query, setQuery]         = useState("");
  const [plan, setPlan]           = useState<Appointment["type"] | "all">("all");
  const [area, setArea]           = useState("");
  const [techFilter, setTechFilter] = useState<string | "all">("all");
  const [from, setFrom]           = useState("");
  const [to, setTo]               = useState("");

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [assignTech, setAssignTech]   = useState<string>("");

  const clearAllFilters = () => {
    setQuery(""); setPlan("all"); setArea(""); setTechFilter("all"); setFrom(""); setTo("");
  };

  const visibleAppointments = useMemo(() => {
    return items
      .filter((a) => {
        if (from || to) {
          const inRange = (!from || a.date >= from) && (!to || a.date <= to);
          if (!inRange) return false;
        }
        if (plan !== "all" && a.type !== plan) return false;
        if (techFilter !== "all" && a.technician !== techFilter) return false;
        if (query.trim()) {
          const customer = customerMap[a.customerId] || { name: "", email: "" };
          const property = propertyMap[a.propertyId] || { address: "" };
          const hay = `${customer.name} ${customer.email} ${property.address}`.toLowerCase();
          if (!hay.includes(query.toLowerCase())) return false;
        }
        if (area.trim()) {
          const property = propertyMap[a.propertyId] || { city: "", zip: "" };
          const hay = `${(property as any).city} ${(property as any).zip}`.toLowerCase();
          if (!hay.includes(area.toLowerCase())) return false;
        }
        return true;
      })
      .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
  }, [items, from, to, plan, area, techFilter, query, customerMap, propertyMap]);

  const allVisibleSelected = visibleAppointments.length > 0 && visibleAppointments.every((a) => selectedIds.has(a.id));

  const toggleSelectAll = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      checked ? visibleAppointments.forEach((a) => next.add(a.id)) : visibleAppointments.forEach((a) => next.delete(a.id));
      return next;
    });
  };

  const toggleRow = (id: string, checked: boolean) => {
    setSelectedIds((prev) => { const next = new Set(prev); checked ? next.add(id) : next.delete(id); return next; });
  };

  const updateAppointment = async (next: Appointment) => {
    try {
      const updatePayload: Record<string, any> = {
        scheduled_date: next.date !== "unscheduled" ? next.date : null,
        scheduled_at:   next.date !== "unscheduled" ? `${next.date}T${next.startTime || "08:00"}:00` : null,
        status:         next.status,
        notes:          `Slot: ${next.startTime} | Updated via Admin`,
      };
      // Preserve window fields if they exist on the original item; admin can clear via setting to null
      // Window fields are not changed by the time-entry reschedule dialog (admin sets exact times)

      const { error } = await supabase.from("appointments").update(updatePayload).eq("id", next.id);
      if (error) throw error;

      setItems((prev) => prev.map((a) => a.id === next.id ? { ...next } : a));
      setEditing(null);
      toast({ title: "Appointment Updated", description: "Changes persisted to database." });
    } catch (err) {
      toast({ title: "Update Failed", description: "Could not save changes to database.", variant: "destructive" });
    }
  };

  const handleDispatch = async (appointmentId: string) => {
    setDispatchingId(appointmentId);
    try {
      const result = await adminApi(`/api/admin/appointments/${appointmentId}/dispatch`, "POST");
      setItems((prev) => prev.map((a) => a.id === appointmentId ? { ...a, status: "en_route" as any } : a));
      toast({
        title: "Dispatched",
        description: result.skipReason
          ? `Technician dispatched. SMS skipped: ${result.skipReason}`
          : "Technician dispatched and customer notified by SMS.",
      });
    } catch (err: any) {
      toast({ title: "Dispatch Failed", description: err.message, variant: "destructive" });
    } finally {
      setDispatchingId(null);
    }
  };

  const handleCancelConfirm = async (appointmentId: string) => {
    setCancelingId(appointmentId);
    try {
      await adminApi(`/api/admin/appointments/${appointmentId}/cancel`, "PATCH");
      setItems((prev) => prev.map((a) => a.id === appointmentId ? { ...a, status: "canceled" as any } : a));
      setCancelConfirmId(null);
      toast({ title: "Appointment Canceled", description: "The customer has been notified by email." });
    } catch (err: any) {
      toast({ title: "Cancel Failed", description: err.message, variant: "destructive" });
    } finally {
      setCancelingId(null);
    }
  };

  const assignSelected = async () => {
    if (!assignTech || selectedIds.size === 0) return;
    const empName = employees.find((e) => e.id === assignTech)?.name || assignTech;
    const ids = Array.from(selectedIds);
    try {
      await adminApi("/api/admin/assignments", "POST", { appointment_ids: ids, employee_id: assignTech });
      setItems((prev) => prev.map((a) => selectedIds.has(a.id) ? { ...a, technician: empName } : a));
      setAssignmentMap((prev) => { const next = { ...prev }; ids.forEach((id) => { next[id] = assignTech; }); return next; });
      setSelectedIds(new Set());
      toast({ title: "Assigned", description: `${ids.length} appointment(s) assigned to ${empName}.` });
    } catch (err: any) {
      toast({ title: "Assignment Failed", description: err.message, variant: "destructive" });
    }
  };

  const activeFilterCount = [from, to, plan !== "all", techFilter !== "all", query.trim(), area.trim()].filter(Boolean).length;

  // Active date label for header
  const dateLabel = from && to && from === to
    ? format(new Date(from + "T00:00:00"), "MMMM d, yyyy")
    : from && to
    ? `${format(new Date(from + "T00:00:00"), "MMM d")} – ${format(new Date(to + "T00:00:00"), "MMM d, yyyy")}`
    : from ? `From ${format(new Date(from + "T00:00:00"), "MMM d, yyyy")}`
    : to   ? `Until ${format(new Date(to   + "T00:00:00"), "MMM d, yyyy")}`
    : null;

  return (
    <div className="grid gap-8">
      <SectionHeading eyebrow="Scheduling" title="Appointment Control" description="Assign technicians, manage scheduling, and monitor service capacity." />

      <AdminOwnershipNote title="Field operations scheduling workspace" description="Appointments remain the operational scheduling surface. Route planning and service areas are linked for dispatch context.">
        <AdminOwnershipBadge kind="operational" />
        <Button variant="outline" size="sm" className="rounded-xl" asChild><Link to="/admin/route-planning">Route Planning</Link></Button>
        <Button variant="outline" size="sm" className="rounded-xl" asChild><Link to="/admin/service-areas">Service Areas</Link></Button>
      </AdminOwnershipNote>

      <SchedulingQueuePanel />

      <BlackoutDatesPanel />

      {/* Filter bar */}
      <Card className="rounded-[28px] border-border/60 bg-card/95 shadow-soft overflow-hidden">
        <CardContent className="p-6 space-y-4">
          {/* Row 1 — search + filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search name or address" className="pl-9 rounded-xl h-10" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <select className="h-10 rounded-xl border border-border/60 bg-background px-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20" value={plan} onChange={(e) => setPlan(e.target.value as any)}>
              <option value="all">All Plans</option>
              <option value="subscription">Subscription</option>
              <option value="one_time">One-time</option>
            </select>
            <select className="h-10 rounded-xl border border-border/60 bg-background px-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20" value={techFilter} onChange={(e) => setTechFilter(e.target.value)}>
              <option value="all">All Technicians</option>
              {employees.map((e) => <option key={e.id} value={e.name}>{e.name}</option>)}
            </select>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="City or ZIP" className="pl-9 rounded-xl h-10 w-36" value={area} onChange={(e) => setArea(e.target.value)} />
            </div>
            {/* Date range */}
            <div className="flex items-center gap-1.5">
              <input type="date" className="h-10 rounded-xl border border-border/60 bg-background px-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 w-36" value={from} onChange={(e) => setFrom(e.target.value)} />
              <span className="text-muted-foreground text-sm">–</span>
              <input type="date" className="h-10 rounded-xl border border-border/60 bg-background px-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 w-36" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" className="rounded-xl h-10 px-3 text-muted-foreground" onClick={clearAllFilters} title="Clear all filters">
                <RotateCcw className="h-4 w-4 mr-1.5" /> Clear
              </Button>
            )}
          </div>
          {/* Row 2 — bulk assignment */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-border/40 pt-4">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest bg-muted/30 px-3 py-1.5 rounded-lg self-start">
              {visibleAppointments.length} {dateLabel ? `on ${dateLabel}` : "appointments"} · {selectedIds.size} selected
            </span>
            <div className="flex items-center gap-3">
              <select className="h-10 rounded-xl border border-border/60 bg-background px-4 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20" value={assignTech} onChange={(e) => setAssignTech(e.target.value)}>
                <option value="">Assign technician...</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
              <Button onClick={assignSelected} disabled={!assignTech || selectedIds.size === 0} className="rounded-xl h-10 shadow-brand font-bold px-6">
                <UserPlus className="mr-2 h-4 w-4" /> Apply
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Full-width appointments table */}
      <div className="rounded-[28px] border border-border/60 bg-card/95 shadow-soft overflow-hidden">
        {/* Header */}
        <div className="bg-muted/20 px-6 py-5 border-b border-border/40 flex items-center justify-between">
          <h3 className="text-base font-display font-bold flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-primary" />
            {dateLabel ?? "All Appointments"}
          </h3>
          {visibleAppointments.length > 0 && (
            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-xs">
              {visibleAppointments.length} appointment{visibleAppointments.length !== 1 ? "s" : ""}
            </Badge>
          )}
        </div>

        {/* Error */}
        {fetchError && (
          <div className="flex items-center gap-3 px-6 py-4 bg-red-50 border-b border-red-200">
            <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-red-900">Failed to load appointments</p>
              <p className="text-xs text-red-700 mt-0.5 truncate">{fetchError}</p>
            </div>
            <Button variant="outline" size="sm" className="shrink-0 rounded-xl" onClick={fetchAppointments}>Retry</Button>
          </div>
        )}

        {/* Table — no overflow-x needed when columns fit naturally */}
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 border-none">
              <TableHead className="w-10 pl-6 py-3">
                <input type="checkbox" className="h-4 w-4 rounded-sm border-border/60 text-primary accent-primary" checked={allVisibleSelected} onChange={(e) => toggleSelectAll(e.target.checked)} />
              </TableHead>
              <TableHead className="py-3 font-bold text-muted-foreground uppercase text-[10px] tracking-widest w-48">When</TableHead>
              <TableHead className="py-3 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Customer / Property</TableHead>
              <TableHead className="py-3 font-bold text-muted-foreground uppercase text-[10px] tracking-widest w-36">Technician</TableHead>
              <TableHead className="py-3 font-bold text-muted-foreground uppercase text-[10px] tracking-widest w-28">Status</TableHead>
              <TableHead className="pr-6 py-3 font-bold text-muted-foreground uppercase text-[10px] tracking-widest text-right w-24">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="text-sm font-medium">Loading appointments...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : visibleAppointments.length > 0 ? (
              visibleAppointments.map((a) => {
                const c = customerMap[a.customerId] || { name: "Unknown", email: "" };
                const p = propertyMap[a.propertyId] || { address: "Unknown", city: "", zip: "" };
                const isUnscheduled = a.date === "unscheduled";
                return (
                  <TableRow key={a.id} className="hover:bg-muted/20 transition-colors border-border/40 group">
                    <TableCell className="pl-6 py-4">
                      <input type="checkbox" className="h-4 w-4 rounded-sm border-border/60 text-primary accent-primary" checked={selectedIds.has(a.id)} onChange={(e) => toggleRow(a.id, e.target.checked)} />
                    </TableCell>
                    {/* Merged When column: date + window */}
                    <TableCell className="py-4">
                      {isUnscheduled ? (
                        <span className="text-xs text-muted-foreground italic">Unscheduled</span>
                      ) : (
                        <div className="space-y-1">
                          <p className="font-bold text-sm">
                            {new Date(a.date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                          </p>
                          {a.windowLabel ? (
                            <WindowBadge window={a.window} windowLabel={a.windowLabel} />
                          ) : (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3 shrink-0" />
                              {a.startTime}
                            </span>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-sm">{c.name}</span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3 shrink-0" /> {p.address}{p.city ? `, ${p.city}` : ""}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center shrink-0">
                          <User className="h-3 w-3 text-muted-foreground" />
                        </div>
                        <span className="text-sm text-muted-foreground">{a.technician}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <StatusBadge status={a.status} />
                    </TableCell>
                    <TableCell className="pr-6 py-4 text-right">
                      <AdminActionMenu
                        items={[
                          {
                            label: "Modify",
                            icon: <RotateCcw className="h-4 w-4" />,
                            onClick: () => setEditing(a),
                          },
                          {
                            label: dispatchingId === a.id ? "Dispatching…" : "Dispatch",
                            icon: <Send className="h-4 w-4" />,
                            onClick: () => handleDispatch(a.id),
                            disabled: dispatchingId === a.id,
                            condition: !["canceled", "cancelled", "completed", "en_route"].includes(a.status),
                          },
                          { separator: true },
                          {
                            label: "Cancel",
                            icon: <XCircle className="h-4 w-4" />,
                            onClick: () => setCancelConfirmId(a.id),
                            destructive: true,
                            condition: !["canceled", "cancelled", "completed"].includes(a.status),
                          },
                        ]}
                      />
                    </TableCell>
                  </TableRow>
                );
              })
            ) : !fetchError ? (
              <TableRow>
                <TableCell colSpan={6} className="h-40 text-center text-muted-foreground italic bg-muted/5">
                  No appointments found for the selected filters.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      {editing && (
        <RescheduleDialog
          appt={editing}
          employees={employees}
          onClose={() => setEditing(null)}
          onSave={(next) => updateAppointment(next)}
        />
      )}

      {cancelConfirmId && (() => {
        const target = items.find((a) => a.id === cancelConfirmId);
        const c = target ? customerMap[target.customerId] : null;
        return (
          <Dialog open onOpenChange={(o) => !o && setCancelConfirmId(null)}>
            <DialogContent className="max-w-sm rounded-[32px] p-0 overflow-hidden border-none shadow-2xl">
              <div className="bg-destructive/5 p-8 border-b border-border/40">
                <DialogHeader className="space-y-2">
                  <DialogTitle className="text-xl font-display font-bold text-destructive flex items-center gap-2">
                    <XCircle className="h-5 w-5" /> Cancel Appointment
                  </DialogTitle>
                  <DialogDescription>
                    Cancel{c?.name ? ` ${c.name}'s` : " this"} appointment
                    {target?.date && target.date !== "unscheduled" ? ` on ${new Date(target.date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}` : ""}?
                    The customer will receive a cancellation email.
                  </DialogDescription>
                </DialogHeader>
              </div>
              <DialogFooter className="p-8 bg-muted/30 border-t border-border/40 flex gap-3">
                <Button variant="ghost" onClick={() => setCancelConfirmId(null)} className="rounded-xl h-12 flex-1 font-bold">Keep</Button>
                <Button
                  variant="destructive"
                  className="rounded-xl h-12 flex-1 font-bold"
                  disabled={cancelingId === cancelConfirmId}
                  onClick={() => handleCancelConfirm(cancelConfirmId)}
                >
                  {cancelingId === cancelConfirmId ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Canceling…</> : "Yes, Cancel"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        );
      })()}
    </div>
  );
};

interface LinkedOrder {
  id: string;
  confirmation_id: string;
  status: string;
  fulfillment_status: string;
  total_cents: number;
  items: Array<{ item_name: string; quantity: number }>;
}

const RescheduleDialog = ({
  appt,
  employees,
  onClose,
  onSave,
}: {
  appt: Appointment;
  employees: Array<{ id: string; name: string }>;
  onClose: () => void;
  onSave: (a: Appointment) => void;
}) => {
  const [date, setDate]   = useState<string>(appt.date === "unscheduled" ? "" : appt.date);
  const [start, setStart] = useState(appt.startTime);
  const [end, setEnd]     = useState(appt.endTime);
  const [tech, setTech]   = useState(appt.technician);
  const [linkedOrders, setLinkedOrders] = useState<LinkedOrder[]>([]);

  useEffect(() => {
    adminApi(`/api/admin/marketplace/orders/by-appointment/${appt.id}`)
      .then((res) => {
        const itemsByOrder: Record<string, any[]> = res.items || {};
        setLinkedOrders((res.orders || []).map((o: any) => ({
          id: o.id, confirmation_id: o.confirmation_id, status: o.status,
          fulfillment_status: o.fulfillment_status, total_cents: o.total_cents,
          items: itemsByOrder[o.id] || [],
        })));
      })
      .catch(() => setLinkedOrders([]));
  }, [appt.id]);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md rounded-[32px] p-0 overflow-hidden border-none shadow-2xl">
        <div className="bg-primary/5 p-8 border-b border-border/40">
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-2xl font-display font-bold text-primary flex items-center gap-2">
              <RotateCcw className="h-6 w-6" /> Modify Appointment
            </DialogTitle>
            <DialogDescription className="text-base">Update timing or service personnel for this visit.</DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-8 space-y-6">
          <div className="grid gap-5">
            <div className="space-y-2">
              <label className="text-sm font-bold uppercase tracking-widest text-muted-foreground pl-1">Scheduled Date</label>
              <input className="h-12 w-full rounded-xl border border-border/60 bg-background px-4 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            {appt.windowLabel && (
              <div className="rounded-xl bg-primary/5 border border-primary/10 px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-widest text-primary/60 mb-1">Current Arrival Window</p>
                <WindowBadge window={appt.window} windowLabel={appt.windowLabel} />
                <p className="text-[10px] text-muted-foreground mt-2">Window label is preserved when modifying date. Use start time to adjust.</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-bold uppercase tracking-widest text-muted-foreground pl-1">Start Time</label>
                <input className="h-12 w-full rounded-xl border border-border/60 bg-background px-4 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold uppercase tracking-widest text-muted-foreground pl-1">End Time</label>
                <input className="h-12 w-full rounded-xl border border-border/60 bg-background px-4 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold uppercase tracking-widest text-muted-foreground pl-1">Assigned Technician</label>
              <select className="h-12 w-full rounded-xl border border-border/60 bg-background px-4 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20" value={tech} onChange={(e) => setTech(e.target.value)}>
                <option value="Unassigned">Unassigned</option>
                {employees.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
              </select>
            </div>
          </div>
        </div>

        {linkedOrders.length > 0 && (
          <div className="px-8 pb-4">
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3">Purchased Add-Ons ({linkedOrders.length})</p>
              <div className="space-y-2">
                {linkedOrders.map((order) => (
                  <div key={order.id} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-muted-foreground">{order.confirmation_id}</span>
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                        order.fulfillment_status === "fulfilled" ? "bg-green-100 text-green-700" :
                        order.fulfillment_status === "cancelled" ? "bg-gray-100 text-gray-600" :
                        "bg-amber-100 text-amber-700"
                      }`}>{order.fulfillment_status}</span>
                    </div>
                    {order.items.map((item, i) => (
                      <p key={i} className="text-xs text-foreground pl-1">{item.quantity}× {item.item_name}</p>
                    ))}
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-3">Update fulfillment status in Admin → Billing → Marketplace Orders.</p>
            </div>
          </div>
        )}

        <DialogFooter className="p-8 bg-muted/30 border-t border-border/40 flex gap-3">
          <Button variant="ghost" onClick={onClose} className="rounded-xl h-12 flex-1 font-bold">Cancel</Button>
          <Button
            className="rounded-xl h-12 flex-1 shadow-brand font-bold"
            onClick={() => onSave({ ...appt, date: date || appt.date, startTime: start, endTime: end, technician: tech, status: appt.status === "canceled" ? "rescheduled" : appt.status })}
          >
            Update Appointment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default Appointments;
