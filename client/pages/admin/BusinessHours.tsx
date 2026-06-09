import { useEffect, useState } from "react";
import SectionHeading from "@/components/common/SectionHeading";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Loader2, RotateCcw, AlertCircle, Sun, Sunset, Moon, Plus, Trash2 } from "lucide-react";
import { adminApi } from "@/lib/adminApi";
import { useToast } from "@/hooks/use-toast";

interface BusinessHoursWindow {
  id: string;
  label: string;
  start: string;
  end: string;
  max_jobs_per_tech: number;
  enabled?: boolean;  // client-side toggle for disabled-by-default slots
}

interface BusinessHoursRow {
  id: string;
  day_of_week: number;
  day_name: string;
  is_operational: boolean;
  windows: BusinessHoursWindow[];
  service_area_id: string | null;
  updated_at: string;
}

const DEFAULT_EVENING_WINDOW: BusinessHoursWindow = {
  id: "evening",
  label: "Evening",
  start: "17:00",
  end: "20:00",
  max_jobs_per_tech: 2,
  enabled: false,
};

function WindowIcon({ id }: { id: string }) {
  if (id === "morning")   return <Sun className="h-3.5 w-3.5 text-amber-500" />;
  if (id === "afternoon") return <Sunset className="h-3.5 w-3.5 text-orange-500" />;
  if (id === "evening")   return <Moon className="h-3.5 w-3.5 text-indigo-400" />;
  return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
}

/** Convert 24h "HH:MM" to 12h display: "8:00 AM" */
function fmt24to12(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

const BusinessHours = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<BusinessHoursRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  // Track local edits to window times before saving
  const [pendingEdits, setPendingEdits] = useState<Record<string, BusinessHoursWindow[]>>({});

  const fetchHours = async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const data = await adminApi("/api/admin/business-hours");
      const loaded: BusinessHoursRow[] = (data.business_hours || []).map((r: BusinessHoursRow) => ({
        ...r,
        windows: r.windows || [],
      }));
      setRows(loaded);
      setPendingEdits({});
    } catch (err: any) {
      setFetchError(err.message || "Failed to load business hours");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchHours(); }, []);

  // Get effective windows for a row (pending edits take priority)
  const getWindows = (row: BusinessHoursRow): BusinessHoursWindow[] =>
    pendingEdits[row.id] ?? row.windows;

  const toggleOperational = async (row: BusinessHoursRow) => {
    setSavingId(row.id);
    try {
      const updated = await adminApi(`/api/admin/business-hours/${row.id}`, "PATCH", {
        is_operational: !row.is_operational,
      });
      setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, ...updated.business_hours } : r));
      toast({ title: row.is_operational ? "Day closed" : "Day opened", description: `${row.day_name} updated.` });
    } catch (err: any) {
      toast({ title: "Update Failed", description: err.message, variant: "destructive" });
    } finally {
      setSavingId(null);
    }
  };

  /** Save a single window field change */
  const updateWindowField = (rowId: string, row: BusinessHoursRow, windowId: string, field: keyof BusinessHoursWindow, value: string | number | boolean) => {
    const current = getWindows(row);
    const updated = current.map((w) => w.id === windowId ? { ...w, [field]: value } : w);
    setPendingEdits((prev) => ({ ...prev, [rowId]: updated }));
  };

  const saveWindows = async (row: BusinessHoursRow) => {
    const windows = getWindows(row);
    // Only send enabled windows (filter out evening if disabled)
    const toSave = windows.filter((w) => w.enabled !== false);
    setSavingId(row.id + "-windows");
    try {
      const updated = await adminApi(`/api/admin/business-hours/${row.id}`, "PATCH", { windows: toSave });
      setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, ...updated.business_hours } : r));
      setPendingEdits((prev) => { const n = { ...prev }; delete n[row.id]; return n; });
      toast({ title: "Windows saved", description: `${row.day_name} arrival windows updated.` });
    } catch (err: any) {
      toast({ title: "Save Failed", description: err.message, variant: "destructive" });
    } finally {
      setSavingId(null);
    }
  };

  const addEveningWindow = (row: BusinessHoursRow) => {
    const current = getWindows(row);
    if (current.some((w) => w.id === "evening")) return;
    setPendingEdits((prev) => ({
      ...prev,
      [row.id]: [...current, { ...DEFAULT_EVENING_WINDOW, enabled: false }],
    }));
  };

  const removeWindow = (row: BusinessHoursRow, windowId: string) => {
    const current = getWindows(row);
    setPendingEdits((prev) => ({ ...prev, [row.id]: current.filter((w) => w.id !== windowId) }));
  };

  const hasPendingEdits = (rowId: string) => !!pendingEdits[rowId];

  return (
    <div className="grid gap-8">
      <SectionHeading
        eyebrow="Configuration"
        title="Business Hours"
        description="Control which days and arrival windows are available for customer booking."
      />

      <Card className="rounded-[28px] border-border/60 bg-card/95 shadow-soft overflow-hidden">
        <CardHeader className="bg-muted/20 px-8 py-5 border-b border-border/40">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-display font-bold flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary/70" /> Weekly Schedule
            </CardTitle>
            <Button size="sm" variant="outline" className="rounded-xl h-9" onClick={fetchHours} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Edit window times inline — click "Save Windows" to apply. Changes take effect immediately for new bookings.
          </p>
        </CardHeader>

        <CardContent className="p-0">
          {fetchError && (
            <div className="flex items-center gap-3 px-8 py-4 bg-red-50 border-b border-red-200">
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
              <p className="text-sm text-red-700 flex-1">{fetchError}</p>
              <Button variant="outline" size="sm" className="rounded-xl shrink-0" onClick={fetchHours}>Retry</Button>
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/40" />
            </div>
          ) : rows.length === 0 && !fetchError ? (
            <div className="py-12 text-center text-sm text-muted-foreground italic">
              No business hours configured. Run the Phase 1 migration to seed defaults.
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {rows.map((row) => {
                const windows = getWindows(row);
                const isDirty = hasPendingEdits(row.id);

                return (
                  <div key={row.id} className={`px-8 py-5 transition-colors ${row.is_operational ? "" : "bg-muted/20"}`}>
                    {/* Day header row */}
                    <div className="flex items-center justify-between gap-4 mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                          row.is_operational ? "bg-primary/10" : "bg-muted"
                        }`}>
                          {row.is_operational
                            ? <Sun className="h-5 w-5 text-primary" />
                            : <Moon className="h-5 w-5 text-muted-foreground/50" />
                          }
                        </div>
                        <div>
                          <p className="font-bold text-sm">{row.day_name}</p>
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-bold ${row.is_operational
                              ? "bg-green-50 text-green-700 border-green-200"
                              : "bg-muted text-muted-foreground border-muted-foreground/20"
                            }`}
                          >
                            {row.is_operational ? "Open" : "Closed"}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isDirty && row.is_operational && (
                          <Button
                            size="sm"
                            className="rounded-xl h-9 font-bold shadow-brand"
                            disabled={savingId === row.id + "-windows"}
                            onClick={() => saveWindows(row)}
                          >
                            {savingId === row.id + "-windows"
                              ? <Loader2 className="h-4 w-4 animate-spin mr-1" />
                              : null}
                            Save Windows
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant={row.is_operational ? "outline" : "default"}
                          className="rounded-xl h-9 shrink-0 font-bold min-w-[80px]"
                          disabled={savingId === row.id}
                          onClick={() => toggleOperational(row)}
                        >
                          {savingId === row.id
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : row.is_operational ? "Close Day" : "Open Day"
                          }
                        </Button>
                      </div>
                    </div>

                    {/* Windows — editable */}
                    {row.is_operational && (
                      <div className="space-y-2 pl-13 mt-1">
                        {windows.length === 0 && (
                          <p className="text-xs text-muted-foreground italic">No windows configured</p>
                        )}
                        {windows.map((w) => {
                          const isDisabledSlot = w.enabled === false;
                          return (
                            <div
                              key={w.id}
                              className={`flex flex-wrap items-center gap-3 rounded-xl px-3 py-2 border transition-colors ${
                                isDisabledSlot
                                  ? "bg-muted/30 border-border/40 opacity-60"
                                  : "bg-muted/40 border-transparent"
                              }`}
                            >
                              {/* Window label + icon */}
                              <div className="flex items-center gap-1.5 shrink-0 min-w-[90px]">
                                <WindowIcon id={w.id} />
                                <span className="text-xs font-bold">{w.label}</span>
                                {isDisabledSlot && (
                                  <Badge className="text-[9px] bg-gray-100 text-gray-500 border-gray-200 ml-1">Disabled</Badge>
                                )}
                              </div>

                              {/* Start time */}
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <span>From</span>
                                <input
                                  type="time"
                                  value={w.start}
                                  disabled={isDisabledSlot}
                                  onChange={(e) => updateWindowField(row.id, row, w.id, "start", e.target.value)}
                                  className="h-7 rounded-lg border border-border/60 bg-background px-2 text-xs font-medium outline-none focus:ring-1 focus:ring-primary/30 disabled:opacity-50"
                                />
                                <span className="text-muted-foreground/50 text-[10px]">{fmt24to12(w.start)}</span>
                              </div>

                              {/* End time */}
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <span>To</span>
                                <input
                                  type="time"
                                  value={w.end}
                                  disabled={isDisabledSlot}
                                  onChange={(e) => updateWindowField(row.id, row, w.id, "end", e.target.value)}
                                  className="h-7 rounded-lg border border-border/60 bg-background px-2 text-xs font-medium outline-none focus:ring-1 focus:ring-primary/30 disabled:opacity-50"
                                />
                                <span className="text-muted-foreground/50 text-[10px]">{fmt24to12(w.end)}</span>
                              </div>

                              {/* Capacity */}
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] text-muted-foreground">Cap:</span>
                                <input
                                  type="number"
                                  min={1}
                                  max={20}
                                  disabled={isDisabledSlot}
                                  className="h-6 w-10 text-center text-xs font-bold rounded-lg border border-border/60 bg-background outline-none focus:ring-1 focus:ring-primary/30 disabled:opacity-50"
                                  defaultValue={w.max_jobs_per_tech}
                                  onBlur={(e) => {
                                    const val = parseInt(e.target.value, 10);
                                    if (!isNaN(val) && val !== w.max_jobs_per_tech) {
                                      updateWindowField(row.id, row, w.id, "max_jobs_per_tech", val);
                                    }
                                  }}
                                />
                              </div>

                              {/* Enable/disable toggle for optional slots (evening) */}
                              {w.id === "evening" && (
                                <button
                                  className={`text-[10px] font-semibold px-2 py-1 rounded-lg border transition-colors ${
                                    isDisabledSlot
                                      ? "border-green-300 text-green-700 hover:bg-green-50"
                                      : "border-amber-300 text-amber-700 hover:bg-amber-50"
                                  }`}
                                  onClick={() => updateWindowField(row.id, row, w.id, "enabled", isDisabledSlot)}
                                >
                                  {isDisabledSlot ? "Enable" : "Disable"}
                                </button>
                              )}

                              {/* Remove custom windows */}
                              {w.id !== "morning" && w.id !== "afternoon" && (
                                <button
                                  className="text-destructive/60 hover:text-destructive ml-auto"
                                  onClick={() => removeWindow(row, w.id)}
                                  title="Remove window"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          );
                        })}

                        {/* Add evening slot */}
                        {!windows.some((w) => w.id === "evening") && (
                          <button
                            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1"
                            onClick={() => addEveningWindow(row)}
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Add Evening Window (disabled by default)
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-[28px] border-border/60 bg-amber-50/50 shadow-soft overflow-hidden">
        <CardContent className="px-8 py-5 space-y-2">
          <p className="text-sm font-bold text-amber-800">How windows work</p>
          <ul className="text-sm text-amber-700 space-y-1 list-disc list-inside">
            <li><strong>Start / End</strong> — the arrival window shown to customers when booking (e.g., 8:00 AM–12:00 PM)</li>
            <li><strong>Cap</strong> — max appointments per technician per window (limits how many customers can book that slot)</li>
            <li><strong>Evening window</strong> — disabled by default; enable per day as needed, then click "Save Windows"</li>
            <li>Changes apply to future bookings only. Existing appointments are not affected.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

export default BusinessHours;
