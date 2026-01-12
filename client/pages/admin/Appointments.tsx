import { useMemo, useState } from "react";
import SectionHeading from "@/components/common/SectionHeading";
import FixedCalendar from "@/components/admin/FixedCalendar";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { appointments as seed, Appointment, findCustomer, findProperty, technicians } from "@/data/admin";

const Appointments = () => {
  const [selected, setSelected] = useState<Date | undefined>(new Date());
  const [items, setItems] = useState<Appointment[]>(() => seed.slice());
  const [editing, setEditing] = useState<Appointment | null>(null);

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
        const inDateRange = from || to
          ? (!from || a.date >= from) && (!to || a.date <= to)
          : selectedStr
          ? a.date === selectedStr
          : true;
        if (!inDateRange) return false;
        if (plan !== "all" && a.type !== plan) return false;
        if (techFilter !== "all" && a.technician !== techFilter) return false;
        if (query.trim()) {
          const c = findCustomer(a.customerId);
          const p = findProperty(a.propertyId);
          const hay = `${c.name} ${c.email} ${p.address1}`.toLowerCase();
          if (!hay.includes(query.toLowerCase())) return false;
        }
        if (area.trim()) {
          const p = findProperty(a.propertyId);
          const hay = `${p.city} ${p.zip}`.toLowerCase();
          if (!hay.includes(area.toLowerCase())) return false;
        }
        return true;
      })
      .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
  }, [items, selectedStr, from, to, plan, area, techFilter, query]);

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

  const updateAppointment = (next: Appointment) => {
    setItems((prev) => prev.map((a) => (a.id === next.id ? next : a)));
    setEditing(null);
  };

  const assignSelected = () => {
    if (!assignTech || selectedIds.size === 0) return;
    setItems((prev) => prev.map((a) => (selectedIds.has(a.id) ? { ...a, technician: assignTech } : a)));
    setSelectedIds(new Set());
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
    <div className="grid gap-8">
      <SectionHeading
        eyebrow="Appointments"
        title="Calendar and list of appointments"
        description="Assign technicians, reschedule, and manage capacity."
      />

      <div className="rounded-2xl border border-border/70 bg-card/95 p-4">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Input placeholder="Search name/address" value={query} onChange={(e)=>setQuery(e.target.value)} />
          <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={plan} onChange={(e)=>setPlan(e.target.value as any)}>
            <option value="all">All plans</option>
            <option value="subscription">Subscription</option>
            <option value="one_time">One-time</option>
            <option value="inspection">Inspection</option>
          </select>
          <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={techFilter} onChange={(e)=>setTechFilter(e.target.value)}>
            <option value="all">All technicians</option>
            {technicians.map((t)=> (<option key={t} value={t}>{t}</option>))}
          </select>
          <Input placeholder="City or ZIP" value={area} onChange={(e)=>setArea(e.target.value)} />
          <input type="date" className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={from} onChange={(e)=>setFrom(e.target.value)} />
          <div className="flex items-center gap-2">
            <input type="date" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={to} onChange={(e)=>setTo(e.target.value)} />
            <Button variant="outline" onClick={clearFilters}>Clear</Button>
          </div>
        </div>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-muted-foreground">{visibleAppointments.length} matching · {selectedIds.size} selected</div>
          <div className="flex items-center gap-2">
            <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={assignTech} onChange={(e)=>setAssignTech(e.target.value)}>
              <option value="">Assign to…</option>
              {technicians.map((t)=> (<option key={t} value={t}>{t}</option>))}
            </select>
            <Button onClick={assignSelected} disabled={!assignTech || selectedIds.size===0}>Assign selected</Button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border/70 bg-card/95 p-4 min-w-0 overflow-hidden flex items-start justify-center">
          <FixedCalendar selected={selected} onSelect={(d)=> setSelected(d)} />
        </div>
        <div className="rounded-2xl border border-border/70 bg-card/95 p-0 min-w-0 overflow-hidden">
          <div className="flex items-center justify-between border-b p-4">
            <div className="text-sm font-semibold">{selected ? selected.toDateString() : "Select a date"}</div>
          </div>
          <Table className="w-full">
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={allVisibleSelected}
                    onChange={(e)=> toggleSelectAll(e.target.checked)}
                  />
                </TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Property</TableHead>
                <TableHead>Technician</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleAppointments.map((a) => {
                const c = findCustomer(a.customerId);
                const p = findProperty(a.propertyId);
                return (
                  <TableRow key={a.id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-primary"
                        checked={selectedIds.has(a.id)}
                        onChange={(e)=> toggleRow(a.id, e.target.checked)}
                      />
                    </TableCell>
                    <TableCell>
                      {a.startTime}–{a.endTime}
                    </TableCell>
                    <TableCell>{c.name}</TableCell>
                    <TableCell>
                      {p.address1}, {p.city}
                    </TableCell>
                    <TableCell>{a.technician}</TableCell>
                    <TableCell className="capitalize">{a.status}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => setEditing(a)}>
                        Reschedule
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {editing && (
        <RescheduleDialog
          appt={editing}
          onClose={() => setEditing(null)}
          onSave={(next) => updateAppointment(next)}
        />
      )}
    </div>
  );
};

const RescheduleDialog = ({ appt, onClose, onSave }: { appt: Appointment; onClose: () => void; onSave: (a: Appointment) => void }) => {
  const [date, setDate] = useState<string>(appt.date);
  const [start, setStart] = useState(appt.startTime);
  const [end, setEnd] = useState(appt.endTime);
  const [tech, setTech] = useState(appt.technician);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reschedule appointment</DialogTitle>
          <DialogDescription>Update time or technician. Customer will be notified.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <label className="text-sm font-medium">Date</label>
            <input className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Start</label>
              <input className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">End</label>
              <input className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Technician</label>
            <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={tech} onChange={(e) => setTech(e.target.value)}>
              {technicians.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() =>
              onSave({ ...appt, date, startTime: start, endTime: end, technician: tech, status: appt.status === "canceled" ? "rescheduled" : appt.status })
            }
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default Appointments;
