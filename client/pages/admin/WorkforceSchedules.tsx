import { useEffect, useState } from "react";
import SectionHeading from "@/components/common/SectionHeading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Save, Plus, Trash2, CheckCircle2, XCircle } from "lucide-react";
import { adminApi } from "@/lib/adminApi";
import { useToast } from "@/hooks/use-toast";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface Employee { id: string; name: string; email: string; role: string; }
interface DaySchedule { day_of_week: number; is_working: boolean; work_start: string; work_end: string; max_stops: number | null; }
interface DateOverride { id?: string; override_date: string; is_available: boolean; work_start: string; work_end: string; max_stops_override: number | null; reason: string; }

const defaultDay = (dow: number): DaySchedule => ({
  day_of_week: dow,
  is_working: dow >= 1 && dow <= 5, // Mon–Fri default
  work_start: "08:00",
  work_end: "17:00",
  max_stops: null,
});

const WorkforceSchedules = () => {
  const { toast } = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [schedule, setSchedule] = useState<DaySchedule[]>(Array.from({ length: 7 }, (_, i) => defaultDay(i)));
  const [overrides, setOverrides] = useState<DateOverride[]>([]);
  const [effectiveFrom, setEffectiveFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [newOverride, setNewOverride] = useState<DateOverride>({ override_date: "", is_available: false, work_start: "08:00", work_end: "17:00", max_stops_override: null, reason: "" });

  useEffect(() => {
    adminApi("/api/admin/employees").then((data: any) => {
      const active = (data || []).filter((e: any) => e.status === "active" && ["technician", "dispatcher"].includes(e.role));
      setEmployees(active.map((e: any) => ({ id: e.id, name: e.name, email: e.email, role: e.role })));
    });
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setIsLoading(true);
    adminApi(`/api/admin/workforce/schedules/${selectedId}`).then((data: any) => {
      const loaded: DaySchedule[] = Array.from({ length: 7 }, (_, dow) => {
        const t = (data.schedule_template || []).find((r: any) => r.day_of_week === dow);
        if (t) return { day_of_week: dow, is_working: t.is_working, work_start: t.work_start || "08:00", work_end: t.work_end || "17:00", max_stops: t.max_stops ?? null };
        return defaultDay(dow);
      });
      setSchedule(loaded);
      setOverrides(data.upcoming_overrides || []);
    }).catch(console.error).finally(() => setIsLoading(false));
  }, [selectedId]);

  const updateDay = (dow: number, field: keyof DaySchedule, value: any) => {
    setSchedule(prev => prev.map(d => d.day_of_week === dow ? { ...d, [field]: value } : d));
  };

  const handleSaveSchedule = async () => {
    if (!selectedId) return;
    setIsSaving(true);
    try {
      await adminApi(`/api/admin/workforce/schedules/${selectedId}`, "POST", { days: schedule, effective_from: effectiveFrom });
      toast({ title: "Schedule saved" });
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddOverride = async () => {
    if (!selectedId || !newOverride.override_date) return;
    try {
      await adminApi("/api/admin/workforce/overrides", "POST", { employee_id: selectedId, ...newOverride });
      const updated = await adminApi(`/api/admin/workforce/schedules/${selectedId}`);
      setOverrides(updated.upcoming_overrides || []);
      setNewOverride({ override_date: "", is_available: false, work_start: "08:00", work_end: "17:00", max_stops_override: null, reason: "" });
      toast({ title: "Override added" });
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    }
  };

  const handleDeleteOverride = async (id: string) => {
    try {
      await adminApi(`/api/admin/workforce/overrides/${id}`, "DELETE");
      setOverrides(prev => prev.filter(o => o.id !== id));
      toast({ title: "Override removed" });
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="grid gap-8 pb-20">
      <SectionHeading
        eyebrow="Workforce"
        title="Technician Schedules"
        description="Set recurring weekly schedules and date-specific exceptions for each technician."
      />

      <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
        {/* Technician list */}
        <Card className="rounded-2xl border-border/60 bg-card/95 self-start">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Active Technicians</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 space-y-1">
            {employees.length === 0 ? (
              <p className="text-sm text-muted-foreground px-3 py-2">No active technicians.</p>
            ) : employees.map(emp => (
              <button
                key={emp.id}
                onClick={() => setSelectedId(emp.id)}
                className={`w-full rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                  selectedId === emp.id ? "bg-primary/10 text-primary font-semibold" : "hover:bg-muted/40"
                }`}
              >
                <p className="font-medium truncate">{emp.name || emp.email}</p>
                <p className="text-xs text-muted-foreground capitalize">{emp.role}</p>
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Schedule editor */}
        <div className="space-y-6">
          {!selectedId ? (
            <div className="rounded-2xl border border-dashed border-border/60 p-12 text-center text-sm text-muted-foreground">
              Select a technician to configure their schedule.
            </div>
          ) : isLoading ? (
            <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />Loading schedule…
            </div>
          ) : (
            <>
              <Card className="rounded-2xl border-border/60 bg-card/95">
                <CardHeader>
                  <CardTitle className="text-base">Weekly Schedule</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {schedule.map(day => (
                    <div key={day.day_of_week} className={`flex items-center gap-3 rounded-xl p-3 ${day.is_working ? "bg-green-50 border border-green-100" : "bg-muted/30 border border-border/40"}`}>
                      <div className="w-10 text-center">
                        <p className={`text-sm font-bold ${day.is_working ? "text-green-700" : "text-muted-foreground"}`}>{DAYS[day.day_of_week]}</p>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" className="h-4 w-4 rounded" checked={day.is_working}
                          onChange={e => updateDay(day.day_of_week, "is_working", e.target.checked)} />
                        <span className="text-xs text-muted-foreground">{day.is_working ? "Working" : "Day off"}</span>
                      </label>
                      {day.is_working && (
                        <>
                          <Input type="time" value={day.work_start} onChange={e => updateDay(day.day_of_week, "work_start", e.target.value)}
                            className="h-8 w-28 rounded-lg text-sm" />
                          <span className="text-xs text-muted-foreground">to</span>
                          <Input type="time" value={day.work_end} onChange={e => updateDay(day.day_of_week, "work_end", e.target.value)}
                            className="h-8 w-28 rounded-lg text-sm" />
                          <div className="ml-2 flex items-center gap-1.5">
                            <Label className="text-xs text-muted-foreground whitespace-nowrap">Max stops:</Label>
                            <Input type="number" min={1} max={20} value={day.max_stops ?? ""}
                              placeholder="—" onChange={e => updateDay(day.day_of_week, "max_stops", e.target.value ? Number(e.target.value) : null)}
                              className="h-8 w-16 rounded-lg text-sm" />
                          </div>
                        </>
                      )}
                    </div>
                  ))}

                  <div className="flex items-center gap-3 pt-2 border-t border-border/40">
                    <Label className="text-sm text-muted-foreground shrink-0">Effective from:</Label>
                    <Input type="date" value={effectiveFrom} onChange={e => setEffectiveFrom(e.target.value)} className="h-9 w-40 rounded-xl" />
                    <Button onClick={handleSaveSchedule} disabled={isSaving} className="rounded-xl ml-auto">
                      {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                      Save Schedule
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Date overrides */}
              <Card className="rounded-2xl border-border/60 bg-card/95">
                <CardHeader>
                  <CardTitle className="text-base">Date Overrides</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {overrides.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No upcoming date overrides.</p>
                  ) : (
                    <div className="space-y-2">
                      {overrides.map(o => (
                        <div key={o.id} className="flex items-center gap-3 rounded-xl border border-border/40 px-3 py-2">
                          <span className="font-mono text-sm font-semibold">{o.override_date}</span>
                          {o.is_available ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                          )}
                          <span className="text-sm text-muted-foreground flex-1">
                            {o.is_available ? `Available ${o.work_start}–${o.work_end}` : "Unavailable"}
                            {o.reason ? ` — ${o.reason}` : ""}
                          </span>
                          <Button size="sm" variant="outline" className="h-7 rounded-lg text-destructive border-destructive/30 hover:bg-destructive/10"
                            onClick={() => o.id && handleDeleteOverride(o.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="border-t border-border/40 pt-3 grid gap-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Add Override</p>
                    <div className="flex flex-wrap gap-2 items-end">
                      <div>
                        <Label className="text-xs">Date</Label>
                        <Input type="date" value={newOverride.override_date}
                          onChange={e => setNewOverride(p => ({ ...p, override_date: e.target.value }))}
                          className="h-8 w-36 rounded-lg text-sm" />
                      </div>
                      <label className="flex items-center gap-1.5 text-sm cursor-pointer pb-1">
                        <input type="checkbox" className="h-4 w-4 rounded" checked={newOverride.is_available}
                          onChange={e => setNewOverride(p => ({ ...p, is_available: e.target.checked }))} />
                        Available
                      </label>
                      <div>
                        <Label className="text-xs">Reason</Label>
                        <Input value={newOverride.reason} onChange={e => setNewOverride(p => ({ ...p, reason: e.target.value }))}
                          placeholder="e.g., Doctor appointment" className="h-8 w-44 rounded-lg text-sm" />
                      </div>
                      <Button size="sm" onClick={handleAddOverride} className="rounded-lg h-8 shrink-0">
                        <Plus className="h-3.5 w-3.5 mr-1" />Add
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkforceSchedules;
