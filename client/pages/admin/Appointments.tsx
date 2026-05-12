import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import SectionHeading from "@/components/common/SectionHeading";
import FixedCalendar from "@/components/admin/FixedCalendar";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Filter,
  Calendar as CalendarIcon,
  User,
  MapPin,
  Clock,
  ChevronRight,
  UserPlus,
  Trash2,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Loader2
} from "lucide-react";
import { Appointment } from "@/data/admin";
// Note: Removed imports for findCustomer, findProperty - using live maps instead
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { adminApi } from "@/lib/adminApi";
import { AdminOwnershipBadge, AdminOwnershipNote } from "@/components/admin/AdminOwnershipBadge";

const Appointments = () => {
  const { toast } = useToast();
  const [selected, setSelected] = useState<Date | undefined>(new Date());
  const [items, setItems] = useState<Appointment[]>([]);
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [customerMap, setCustomerMap] = useState<Record<string, { name: string; email: string }>>({});
  const [propertyMap, setPropertyMap] = useState<Record<string, { address: string; city: string; zip: string }>>({});
  const [employees, setEmployees] = useState<Array<{ id: string; name: string }>>([]);
  const [assignmentMap, setAssignmentMap] = useState<Record<string, string>>({}); // appointment_id → employee_id

  useEffect(() => {
    fetchAppointments();
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    const { data: empData } = await supabase
      .from("employees")
      .select("id, user_id, status")
      .eq("status", "active");
    if (!empData?.length) return;

    const userIds = empData.map((e: any) => e.user_id).filter(Boolean);
    const { data: profileData } = await supabase
      .from("profiles")
      .select("id, name")
      .in("id", userIds);

    const profileMap: Record<string, string> = {};
    (profileData || []).forEach((p: any) => { profileMap[p.id] = p.name || p.id; });

    setEmployees(empData.map((e: any) => ({ id: e.id, name: profileMap[e.user_id] || "Employee" })));
  };

  const fetchAppointments = async () => {
    setIsLoading(true);
    try {
      // Fetch appointments
      const { data, error } = await supabase
        .from("appointments")
        .select("id, user_id, property_id, scheduled_at, notes, service_type, status")
        .order("scheduled_at", { ascending: true });

      if (error) {
        console.error("[Admin Appointments] Appointments query error:", error);
        setItems([]);
        return;
      }

      if (data && data.length > 0) {
        console.log(`[Admin Appointments] Fetched ${data.length} appointments`);
        // Get unique customer and property IDs
        const uniqueCustomerIds = [...new Set(data.map(a => a.user_id).filter(Boolean))];
        const uniquePropertyIds = [...new Set(data.map(a => a.property_id).filter(Boolean))];

        console.log(`[Admin Appointments] Unique customers: ${uniqueCustomerIds.length}, properties: ${uniquePropertyIds.length}`);

        // Fetch customer data
        if (uniqueCustomerIds.length > 0) {
          const { data: customerData, error: custError } = await supabase
            .from("profiles")
            .select("id, name, email")
            .in("id", uniqueCustomerIds);

          if (custError) {
            console.error("[Admin Appointments] Customer fetch error:", custError);
          } else {
            console.log(`[Admin Appointments] Fetched ${customerData?.length || 0} customer profiles`);
            if (customerData) {
              const map: Record<string, { name: string; email: string }> = {};
              customerData.forEach(c => {
                map[c.id] = { name: c.name || "Unknown", email: c.email || "" };
              });
              setCustomerMap(map);
            }
          }
        }

        // Fetch property data
        if (uniquePropertyIds.length > 0) {
          const { data: propertyData, error: propError } = await supabase
            .from("properties")
            .select("id, address, city, zip")
            .in("id", uniquePropertyIds);

          if (propError) {
            console.error("[Admin Appointments] Property fetch error:", propError);
          } else {
            console.log(`[Admin Appointments] Fetched ${propertyData?.length || 0} properties`);
            if (propertyData) {
              const map: Record<string, { address: string; city: string; zip: string }> = {};
              propertyData.forEach(p => {
                map[p.id] = { address: p.address || "", city: p.city || "", zip: p.zip || "" };
              });
              setPropertyMap(map);
            }
          }
        }

        // Map Supabase appointments to the Admin UI format
        const mapped: Appointment[] = data.map(app => ({
          id: app.id,
          customerId: app.user_id,
          propertyId: app.property_id,
          date: app.scheduled_at.split("T")[0],
          startTime: app.notes?.includes("Slot:") ? (app.notes.split("Slot:")[1] || "").split("|")[0]?.trim() || "08:00" : "08:00",
          endTime: "10:00", // Placeholder
          type: app.service_type === "one_time" ? "one_time" : "subscription",
          status: app.status as any,
          technician: "Unassigned"
        }));
        setItems(mapped);

        // Load existing assignments for these appointments
        const appointmentIds = mapped.map((a: any) => a.id);
        if (appointmentIds.length > 0) {
          const { data: assignData } = await supabase
            .from("assignments")
            .select("appointment_id, employee_id")
            .in("appointment_id", appointmentIds);
          if (assignData) {
            const aMap: Record<string, string> = {};
            assignData.forEach((a: any) => { aMap[a.appointment_id] = a.employee_id; });
            setAssignmentMap(aMap);
          }
        }
      } else {
        console.log(`[Admin Appointments] No appointments found`);
        setItems([]);
      }
    } catch (err) {
      console.error("[Admin Appointments] Exception:", err);
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Filters
  const [query, setQuery] = useState("");
  const [plan, setPlan] = useState<Appointment["type"] | "all">("all");
  const [area, setArea] = useState(""); // city or ZIP
  const [techFilter, setTechFilter] = useState<string | "all">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [assignTech, setAssignTech] = useState<string>("");

  const selectedStr = selected ? selected.toISOString().slice(0, 10) : "";

  const visibleAppointments = useMemo(() => {
    return items
      .filter((a) => {
        // If explicit date range is set (from or to), use that
        // Otherwise, show all appointments regardless of date
        const inDateRange = from || to
          ? (!from || a.date >= from) && (!to || a.date <= to)
          : true; // Show all dates by default
        if (!inDateRange) return false;
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
          const hay = `${property.city} ${property.zip}`.toLowerCase();
          if (!hay.includes(area.toLowerCase())) return false;
        }
        return true;
      })
      .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
  }, [items, selectedStr, from, to, plan, area, techFilter, query, customerMap, propertyMap]);

  const allVisibleSelected = visibleAppointments.length > 0 && visibleAppointments.every((a) => selectedIds.has(a.id));

  const toggleSelectAll = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        visibleAppointments.forEach((a) => next.add(a.id));
      } else {
        visibleAppointments.forEach((a) => next.delete(a.id));
      }
      return next;
    });
  };

  const toggleRow = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const updateAppointment = async (next: Appointment) => {
    try {
      const { error } = await supabase
        .from("appointments")
        .update({
          scheduled_at: next.date,
          status: next.status,
          notes: `Slot: ${next.startTime} | Updated via Admin`
        })
        .eq("id", next.id);

      if (error) throw error;

      setItems((prev) => prev.map((a) => (a.id === next.id ? next : a)));
      setEditing(null);
      toast({ title: "Appointment Updated", description: "Changes persisted to database." });
    } catch (err) {
      toast({ title: "Update Failed", description: "Could not save changes to database.", variant: "destructive" });
    }
  };

  const assignSelected = async () => {
    if (!assignTech || selectedIds.size === 0) return;

    const empName = employees.find((e) => e.id === assignTech)?.name || assignTech;
    const ids = Array.from(selectedIds);

    // Persist each assignment to the database
    const upserts = ids.map((appointmentId) => ({
      appointment_id: appointmentId,
      employee_id: assignTech,
      status: "pending",
    }));

    const { error } = await supabase
      .from("assignments")
      .upsert(upserts, { onConflict: "appointment_id" });

    if (error) {
      toast({ title: "Assignment Failed", description: error.message, variant: "destructive" });
      return;
    }

    // Update local state
    setItems((prev) => prev.map((a) => (selectedIds.has(a.id) ? { ...a, technician: empName } : a)));
    setAssignmentMap((prev) => {
      const next = { ...prev };
      ids.forEach((id) => { next[id] = assignTech; });
      return next;
    });
    setSelectedIds(new Set());
    toast({ title: "Assigned", description: `${ids.length} appointment(s) assigned to ${empName}.` });
  };

  const clearFilters = () => {
    setQuery("");
    setPlan("all");
    setArea("");
    setTechFilter("all");
    setFrom("");
    setTo("");
  };

  return (
    <div className="grid gap-10">
      <SectionHeading
        eyebrow="Scheduling"
        title="Appointment Control"
        description="Assign technicians, optimize routes, and manage service capacity across OC."
      />

      <AdminOwnershipNote
        title="Field operations scheduling workspace"
        description="Appointments remain the operational scheduling surface. Route planning and service areas are linked for dispatch context."
      >
        <AdminOwnershipBadge kind="operational" />
        <Button variant="outline" size="sm" className="rounded-xl" asChild>
          <Link to="/admin/route-planning">Route Planning</Link>
        </Button>
        <Button variant="outline" size="sm" className="rounded-xl" asChild>
          <Link to="/admin/service-areas">Service Areas</Link>
        </Button>
      </AdminOwnershipNote>

      <Card className="rounded-[28px] border-border/60 bg-card/95 shadow-soft overflow-hidden">
        <CardContent className="p-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search name/address" className="pl-9 rounded-xl h-10" value={query} onChange={(e)=>setQuery(e.target.value)} />
            </div>
            <select className="h-10 rounded-xl border border-border/60 bg-background px-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20" value={plan} onChange={(e)=>setPlan(e.target.value as any)}>
              <option value="all">All Plan Types</option>
              <option value="subscription">Subscription</option>
              <option value="one_time">One-time</option>
              <option value="inspection">Inspection</option>
            </select>
            <select className="h-10 rounded-xl border border-border/60 bg-background px-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20" value={techFilter} onChange={(e)=>setTechFilter(e.target.value)}>
              <option value="all">All Technicians</option>
              {employees.map((e) => (<option key={e.id} value={e.name}>{e.name}</option>))}
            </select>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="City or ZIP" className="pl-9 rounded-xl h-10" value={area} onChange={(e)=>setArea(e.target.value)} />
            </div>
            <input type="date" className="h-10 rounded-xl border border-border/60 bg-background px-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20" value={from} onChange={(e)=>setFrom(e.target.value)} />
            <div className="flex items-center gap-2">
              <input type="date" className="h-10 w-full rounded-xl border border-border/60 bg-background px-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20" value={to} onChange={(e)=>setTo(e.target.value)} />
              <Button variant="ghost" size="icon" onClick={clearFilters} className="rounded-xl h-10 w-10 border border-border/60">
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="mt-6 pt-6 border-t border-border/40 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-widest bg-muted/30 px-3 py-1.5 rounded-lg">
              {visibleAppointments.length} matching visits · {selectedIds.size} selected for bulk action
            </div>
            <div className="flex items-center gap-3">
              <select className="h-10 rounded-xl border border-border/60 bg-background px-4 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20" value={assignTech} onChange={(e)=>setAssignTech(e.target.value)}>
                <option value="">Assign technician...</option>
                {employees.map((e) => (<option key={e.id} value={e.id}>{e.name}</option>))}
              </select>
              <Button onClick={assignSelected} disabled={!assignTech || selectedIds.size===0} className="rounded-xl h-10 shadow-brand font-bold px-6">
                <UserPlus className="mr-2 h-4 w-4" />
                Apply Assignment
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-8 xl:grid-cols-[300px_1fr] items-start">
        <Card className="rounded-[32px] border-border/60 bg-card/95 shadow-soft p-6 overflow-hidden flex items-start justify-center h-fit xl:sticky xl:top-4">
          <FixedCalendar selected={selected} onSelect={(d) => {
            if (d instanceof Date) setSelected(d);
          }} />
        </Card>

        <Card className="rounded-[32px] border-border/60 bg-card/95 shadow-soft overflow-hidden mb-10 w-full">
          <CardHeader className="bg-muted/20 px-8 py-6 border-b border-border/40">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-display font-bold flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-primary" />
                {selected ? selected.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : "Select a date"}
              </CardTitle>
              {visibleAppointments.length > 0 && (
                <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">{visibleAppointments.length} Appointments</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0 w-full min-w-0">
            <div className="overflow-x-auto w-full">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 border-none">
                    <TableHead className="w-12 pl-8 py-4">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded-sm border-border/60 text-primary accent-primary"
                        checked={allVisibleSelected}
                        onChange={(e)=> toggleSelectAll(e.target.checked)}
                      />
                    </TableHead>
                    <TableHead className="py-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Time Slot</TableHead>
                    <TableHead className="py-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Customer/Property</TableHead>
                    <TableHead className="py-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Technician</TableHead>
                    <TableHead className="py-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Status</TableHead>
                    <TableHead className="pr-8 py-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleAppointments.length > 0 ? visibleAppointments.map((a) => {
                    const c = customerMap[a.customerId] || { name: "Unknown", email: "" };
                    const p = propertyMap[a.propertyId] || { address: "Unknown", city: "", zip: "" };
                    return (
                      <TableRow key={a.id} className="hover:bg-muted/20 transition-colors border-border/40 group">
                        <TableCell className="pl-8 py-5">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded-sm border-border/60 text-primary accent-primary"
                            checked={selectedIds.has(a.id)}
                            onChange={(e)=> toggleRow(a.id, e.target.checked)}
                          />
                        </TableCell>
                        <TableCell className="py-5">
                          <div className="flex items-center gap-2">
                            <Clock className="h-3.5 w-3.5 text-primary" />
                            <span className="font-bold text-sm">{a.startTime}–{a.endTime}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-5">
                          <div className="flex flex-col">
                            <span className="font-bold text-sm">{c.name}</span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <MapPin className="h-3 w-3" /> {p.address}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="py-5">
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
                              <User className="h-3 w-3 text-muted-foreground" />
                            </div>
                            <span className="text-sm font-medium">{a.technician}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-5">
                          <Badge
                            variant="outline"
                            className={`capitalize font-bold border-none ${
                              a.status === 'scheduled' ? 'bg-blue-100 text-blue-700' :
                              a.status === 'completed' ? 'bg-green-100 text-green-700' :
                              a.status === 'canceled' ? 'bg-red-100 text-red-700' :
                              'bg-muted text-muted-foreground'
                            }`}
                          >
                            {a.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="pr-8 py-5 text-right">
                          <Button variant="ghost" size="sm" className="rounded-xl group-hover:bg-primary group-hover:text-white transition-all font-bold" onClick={() => setEditing(a)}>
                            Modify
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  }) : (
                    <TableRow>
                      <TableCell colSpan={6} className="h-40 text-center text-muted-foreground italic bg-muted/5">
                        No appointments found for the selected filters.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {editing && (
        <RescheduleDialog
          appt={editing}
          employees={employees}
          onClose={() => setEditing(null)}
          onSave={(next) => updateAppointment(next)}
        />
      )}
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
  const [date, setDate] = useState<string>(appt.date);
  const [start, setStart] = useState(appt.startTime);
  const [end, setEnd] = useState(appt.endTime);
  const [tech, setTech] = useState(appt.technician);
  const [linkedOrders, setLinkedOrders] = useState<LinkedOrder[]>([]);

  // Load marketplace orders linked to this appointment (add-ons)
  useEffect(() => {
    adminApi(`/api/admin/marketplace/orders/by-appointment/${appt.id}`)
      .then((res) => {
        const itemsByOrder: Record<string, any[]> = res.items || {};
        const orders: LinkedOrder[] = (res.orders || []).map((o: any) => ({
          id: o.id,
          confirmation_id: o.confirmation_id,
          status: o.status,
          fulfillment_status: o.fulfillment_status,
          total_cents: o.total_cents,
          items: itemsByOrder[o.id] || [],
        }));
        setLinkedOrders(orders);
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
            <DialogDescription className="text-base">
              Update timing or service personnel for this visit.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-8 space-y-6">
          <div className="grid gap-5">
            <div className="space-y-2">
              <label className="text-sm font-bold uppercase tracking-widest text-muted-foreground pl-1">Scheduled Date</label>
              <input className="h-12 w-full rounded-xl border border-border/60 bg-background px-4 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
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
                {employees.map((t) => (
                  <option key={t.id} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Linked add-on orders */}
        {linkedOrders.length > 0 && (
          <div className="px-8 pb-4">
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3">
                Purchased Add-Ons ({linkedOrders.length})
              </p>
              <div className="space-y-2">
                {linkedOrders.map((order) => (
                  <div key={order.id} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-muted-foreground">{order.confirmation_id}</span>
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                        order.fulfillment_status === "fulfilled" ? "bg-green-100 text-green-700" :
                        order.fulfillment_status === "cancelled" ? "bg-gray-100 text-gray-600" :
                        "bg-amber-100 text-amber-700"
                      }`}>
                        {order.fulfillment_status}
                      </span>
                    </div>
                    {order.items.map((item, i) => (
                      <p key={i} className="text-xs text-foreground pl-1">
                        {item.quantity}× {item.item_name}
                      </p>
                    ))}
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-3">
                Update fulfillment status in Admin → Billing → Marketplace Orders.
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="p-8 bg-muted/30 border-t border-border/40 flex gap-3">
          <Button variant="ghost" onClick={onClose} className="rounded-xl h-12 flex-1 font-bold">Cancel</Button>
          <Button
            className="rounded-xl h-12 flex-1 shadow-brand font-bold"
            onClick={() =>
              onSave({ ...appt, date, startTime: start, endTime: end, technician: tech, status: appt.status === "canceled" ? "rescheduled" : appt.status })
            }
          >
            Update Appointment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default Appointments;
