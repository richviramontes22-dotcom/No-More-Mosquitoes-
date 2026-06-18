import { useState, useEffect } from "react";
import SectionHeading from "@/components/common/SectionHeading";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { MapPin, Clock, Navigation, Trash2, Users, AlertTriangle, CheckCircle2, Loader2, Sparkles, X, TrendingDown, Settings2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { adminApi, AdminApiError } from "@/lib/adminApi";

interface RouteAutomationSettings {
  mode: "manual_only" | "review_window" | "fully_automatic";
  review_window_minutes: number;
  auto_publish_cutoff_time: string | null;
  require_smart_optimize: boolean;
  block_low_confidence: boolean;
  block_mock_geo: boolean;
  block_drive_cap_exceeded: boolean;
  enabled: boolean;
  auto_generate_enabled: boolean;
  auto_optimize_enabled: boolean;
  auto_generate_time: string | null;
  auto_generate_days: string[] | null;
  require_admin_review_before_publish: boolean;
  allow_full_auto_publish: boolean;
}

interface AutomationHistoryEntry {
  id: string;
  route_id: string;
  action: string;
  metadata: Record<string, any> | null;
  created_at: string;
}

const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

interface RouteStop {
  id: string;
  sequence_number: number;
  assignment_id: string;
  property_address: string;
  arrival_eta: string;
  departure_eta: string;
  status: "pending" | "arrived" | "completed" | "skipped";
  distance_from_prev_miles: number;
  duration_from_prev_minutes: number;
}

interface Route {
  id: string;
  employee_id: string;
  date: string;
  status: "draft" | "approved" | "assigned" | "published" | "in_progress" | "completed" | "canceled";
  total_distance_miles: number;
  total_duration_minutes: number;
  published_at?: string | null;
  approved_at?: string | null;
  confidence?: string | null;
  conflict_notes?: string[] | null;
  stops: RouteStop[];
}

const RoutePlanning = () => {
  const { toast } = useToast();
  
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [employees, setEmployees] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  
  const [generatingRoute, setGeneratingRoute] = useState(false);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [loadingRoutes, setLoadingRoutes] = useState(false);

  // Day planner state
  const [activeTab, setActiveTab] = useState<"single" | "day">("day");
  const [dayRoutes, setDayRoutes] = useState<Array<{
    id: string; employee_id: string; employee_name: string; employee_email: string;
    status: string; confidence: string | null; conflict_notes: string[] | null;
    stop_count: number; completed_count: number;
    total_distance_miles: number | null; approved_at: string | null; published_at: string | null;
  }>>([]);
  const [dayUnassigned, setDayUnassigned] = useState<any[]>([]);
  const [generatingDay, setGeneratingDay] = useState(false);
  const [loadingDay, setLoadingDay] = useState(false);
  const [approvingAll, setApprovingAll] = useState(false);

  // Smart Optimize modal
  const [optimizeRouteId, setOptimizeRouteId] = useState<string | null>(null);
  const [optimizePreview, setOptimizePreview] = useState<any | null>(null);
  const [loadingOptimize, setLoadingOptimize] = useState(false);
  const [applyingOptimize, setApplyingOptimize] = useState(false);

  // Publish confirmation modal
  const [publishConfirm, setPublishConfirm] = useState<{
    type: "single" | "all";
    routeId?: string;
    confidence?: string | null;
    conflictNotes?: string[];
  } | null>(null);
  const [publishBlocked, setPublishBlocked] = useState<{ warnings?: any; validation?: any; hint?: string } | null>(null);
  const [publishing, setPublishing] = useState(false);

  // Routing automation settings
  const [automationOpen, setAutomationOpen] = useState(false);
  const [automationSettings, setAutomationSettings] = useState<RouteAutomationSettings | null>(null);
  const [loadingAutomation, setLoadingAutomation] = useState(false);
  const [savingAutomation, setSavingAutomation] = useState(false);
  const [runningAutomation, setRunningAutomation] = useState(false);
  const [automationHistory, setAutomationHistory] = useState<AutomationHistoryEntry[]>([]);
  const [showAutomationHistory, setShowAutomationHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Load employees on mount
  useEffect(() => {
    loadEmployees();
  }, []);

  // Load routes when date/employee changes
  useEffect(() => {
    if (selectedEmployeeId && selectedDate) {
      loadRoutes();
    }
  }, [selectedEmployeeId, selectedDate]);

  // Load day plan whenever date changes and day tab is active
  useEffect(() => {
    if (activeTab === "day" && selectedDate) loadDay();
  }, [selectedDate, activeTab]);

  const loadDay = async () => {
    try {
      setLoadingDay(true);
      const [dayData, unassignedData] = await Promise.all([
        adminApi(`/api/admin/routes/day?date=${selectedDate}`),
        adminApi(`/api/admin/routes/day/unassigned?date=${selectedDate}`),
      ]);
      setDayRoutes(dayData.routes || []);
      setDayUnassigned(unassignedData.unassigned || []);
    } catch (err) {
      console.error("Error loading day plan:", err);
    } finally {
      setLoadingDay(false);
    }
  };

  const handleGenerateDayPlan = async () => {
    try {
      setGeneratingDay(true);
      const data = await adminApi("/api/admin/routes/day/generate", "POST", { date: selectedDate });
      toast({ title: data.message || "Day plan generated" });
      await loadDay();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setGeneratingDay(false);
    }
  };

  const handleApproveAll = async () => {
    try {
      setApprovingAll(true);
      const data = await adminApi("/api/admin/routes/day/approve", "POST", { date: selectedDate });
      toast({ title: data.message || "Routes approved" });
      await loadDay();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setApprovingAll(false);
    }
  };

  const doPublish = async (force: boolean) => {
    if (!publishConfirm) return;
    setPublishing(true);
    try {
      if (publishConfirm.type === "single" && publishConfirm.routeId) {
        const data = await adminApi(
          `/api/admin/routes/${publishConfirm.routeId}/publish`,
          "POST",
          force ? { force: true } : {}
        );
        setRoutes(routes.map(r => r.id === publishConfirm.routeId ? { ...r, ...data.route } : r));
        setSelectedRoute(prev => prev?.id === publishConfirm.routeId ? { ...prev, ...data.route } : prev);
        await loadDay().catch(() => {});
        toast({ title: "Route Published", description: data.message });
        setPublishConfirm(null);
        setPublishBlocked(null);
      } else if (publishConfirm.type === "all") {
        const data = await adminApi(
          "/api/admin/routes/day/publish",
          "POST",
          { date: selectedDate, ...(force ? { force: true } : {}) }
        );
        toast({ title: data.message || "Routes published" });
        await loadDay();
        setPublishConfirm(null);
        setPublishBlocked(null);
      }
    } catch (err: any) {
      if (err instanceof AdminApiError && err.details && (err.details.warnings || err.details.validation)) {
        setPublishBlocked(err.details);
      } else {
        toast({ title: "Error", description: err.message, variant: "destructive" });
        setPublishConfirm(null);
        setPublishBlocked(null);
      }
    } finally {
      setPublishing(false);
    }
  };

  const openAutomationSettings = async () => {
    setAutomationOpen(true);
    setLoadingAutomation(true);
    try {
      const data = await adminApi("/api/admin/routes/automation-settings");
      setAutomationSettings(data.settings);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoadingAutomation(false);
    }
  };

  const saveAutomationSettings = async () => {
    if (!automationSettings) return;
    setSavingAutomation(true);
    try {
      const data = await adminApi("/api/admin/routes/automation-settings", "PATCH", automationSettings);
      setAutomationSettings(data.settings);
      toast({ title: "Automation settings saved" });
      setAutomationOpen(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSavingAutomation(false);
    }
  };

  const runAutomationNow = async () => {
    setRunningAutomation(true);
    try {
      const data = await adminApi("/api/admin/routes/automation/run-now", "POST", { date: selectedDate });
      toast({
        title: "Automation run complete",
        description: `Generated ${data.generate.routesGenerated}, optimized ${data.generate.routesOptimized}, published ${data.publish.published}, blocked ${data.publish.blocked}.`,
      });
      await loadDay().catch(() => {});
      if (showAutomationHistory) await loadAutomationHistory();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setRunningAutomation(false);
    }
  };

  const loadAutomationHistory = async () => {
    setLoadingHistory(true);
    try {
      const data = await adminApi("/api/admin/routes/automation/history?limit=100");
      setAutomationHistory(data.history || []);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoadingHistory(false);
    }
  };

  const toggleAutomationHistory = async () => {
    const next = !showAutomationHistory;
    setShowAutomationHistory(next);
    if (next) await loadAutomationHistory();
  };

  const handleRebuildDay = async () => {
    if (!window.confirm("Discard all draft routes for this date and start over?")) return;
    try {
      const data = await adminApi("/api/admin/routes/day/rebuild", "POST", { date: selectedDate });
      toast({ title: data.message || "Routes discarded" });
      await loadDay();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const confidenceBadge = (c: string | null) => {
    if (c === "high") return <Badge className="bg-green-100 text-green-800 text-[10px]">High confidence</Badge>;
    if (c === "medium") return <Badge className="bg-amber-100 text-amber-800 text-[10px]">Medium confidence</Badge>;
    if (c === "low") return <Badge className="bg-red-100 text-red-800 text-[10px]">Low confidence</Badge>;
    return null;
  };

  const loadEmployees = async () => {
    try {
      setLoadingEmployees(true);
      const data = await adminApi("/api/admin/employees");
      const active = (data || []).filter((e: any) => e.status === "active");
      setEmployees(
        active.map((e: any) => ({
          id: e.id,
          name: e.name || "Employee",
          email: e.email || "",
        }))
      );
    } catch (err) {
      toast({ title: "Error", description: "Failed to load employees", variant: "destructive" });
    } finally {
      setLoadingEmployees(false);
    }
  };

  const loadRoutes = async () => {
    try {
      setLoadingRoutes(true);
      const data = await adminApi(`/api/admin/routes?employee_id=${selectedEmployeeId}&date=${selectedDate}`);
      setRoutes(data.routes || []);
      if (data.routes?.length > 0) {
        setSelectedRoute(data.routes[0]);
      }
    } catch (err) {
      console.error("Error loading routes:", err);
    } finally {
      setLoadingRoutes(false);
    }
  };

  const handleGenerateRoute = async () => {
    if (!selectedEmployeeId || !selectedDate) {
      toast({
        title: "Error",
        description: "Please select both employee and date",
        variant: "destructive",
      });
      return;
    }

    try {
      setGeneratingRoute(true);
      
      const data = await adminApi("/api/admin/routes/generate", "POST", {
        employee_id: selectedEmployeeId,
        date: selectedDate,
      });
      
      if (data.route) {
        setRoutes([...routes, data.route]);
        setSelectedRoute(data.route);
        
        toast({
          title: "Success",
          description: `Generated optimized route with ${data.stops.length} stops`,
        });
      } else {
        toast({
          title: "No Assignments",
          description: "No assignments found for this employee on this date",
        });
      }
    } catch (err) {
      console.error("Error generating route:", err);
      toast({
        title: "Error",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setGeneratingRoute(false);
    }
  };

  const handleDiscardRoute = async (routeId: string) => {
    try {
      await adminApi(`/api/admin/routes/${routeId}/discard`, "POST");
      setRoutes(routes.filter(r => r.id !== routeId));
      if (selectedRoute?.id === routeId) {
        setSelectedRoute(null);
      }
      
      toast({
        title: "Route Discarded",
        description: "Route has been removed",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: (err as Error).message,
        variant: "destructive",
      });
    }
  };

  const handleApproveRoute = async (routeId: string) => {
    try {
      const data = await adminApi(`/api/admin/routes/${routeId}/approve`, "POST");
      setRoutes(routes.map(r => r.id === routeId ? { ...r, ...data.route } : r));
      setSelectedRoute(prev => prev?.id === routeId ? { ...prev, ...data.route } : prev);
      toast({ title: "Route Approved", description: "Route approved and ready to publish." });
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    }
  };

  const handleRebuildRoute = async (routeId: string) => {
    if (!window.confirm("Clear all stops for this route? You'll need to generate again.")) return;
    try {
      await adminApi(`/api/admin/routes/${routeId}/rebuild`, "POST");
      toast({ title: "Stops cleared", description: "Generate the route again to rebuild." });
      loadRoutes();
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    }
  };

  const handleSmartOptimize = async (routeId: string) => {
    try {
      setLoadingOptimize(true);
      setOptimizeRouteId(routeId);
      setOptimizePreview(null);
      const data = await adminApi("/api/admin/routes/optimize-preview", "POST", { routeId });
      setOptimizePreview(data.proposed);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      setOptimizeRouteId(null);
    } finally {
      setLoadingOptimize(false);
    }
  };

  const handleApplyOptimization = async () => {
    if (!optimizeRouteId || !optimizePreview) return;
    try {
      setApplyingOptimize(true);
      const orderedAssignmentIds = optimizePreview.stops.map((s: any) => s.assignmentId);
      await adminApi(`/api/admin/routes/${optimizeRouteId}/reorder-stops`, "POST", { orderedAssignmentIds });
      toast({ title: "Optimization applied", description: `Saved ${optimizePreview.improvement.timeSavedMinutes} min` });
      setOptimizeRouteId(null);
      setOptimizePreview(null);
      await Promise.all([loadRoutes(), loadDay()]);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setApplyingOptimize(false);
    }
  };

  const statusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: "bg-yellow-100 text-yellow-800",
      approved: "bg-sky-100 text-sky-800",
      assigned: "bg-blue-100 text-blue-800",
      published: "bg-indigo-100 text-indigo-800",
      in_progress: "bg-purple-100 text-purple-800",
      completed: "bg-green-100 text-green-800",
      canceled: "bg-gray-100 text-gray-600",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  return (
    <div className="grid gap-8 pb-20">
      <SectionHeading
        eyebrow="Operations"
        title="Route Planning"
        description="Generate and manage optimized routes for employees."
      />

      {/* Tab switcher */}
      <div className="flex gap-2 border-b border-border/40 pb-0">
        <button
          onClick={() => setActiveTab("day")}
          className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors ${
            activeTab === "day"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Users className="h-3.5 w-3.5 inline mr-1.5" />
          Day Planner
        </button>
        <button
          onClick={() => setActiveTab("single")}
          className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors ${
            activeTab === "single"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Single Technician
        </button>
      </div>

      {/* Date picker (shared) */}
      <div className="flex items-center gap-3">
        <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground shrink-0">Date</Label>
        <Input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="rounded-xl h-10 w-48"
        />
      </div>

      {/* ── Day Planner Tab ─────────────────────────────────────────────────── */}
      {activeTab === "day" && (
        <div className="space-y-6">
          {/* Actions row */}
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={handleGenerateDayPlan}
              disabled={generatingDay}
              className="rounded-xl shadow-brand"
            >
              {generatingDay ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Generating…</> : "Generate Day Plan"}
            </Button>
            <Button
              variant="outline"
              onClick={handleApproveAll}
              disabled={approvingAll || dayRoutes.filter(r => r.status === "draft").length === 0}
              className="rounded-xl"
            >
              {approvingAll ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Approve All
            </Button>
            <Button
              variant="outline"
              onClick={() => { setPublishBlocked(null); setPublishConfirm({ type: "all" }); }}
              disabled={dayRoutes.filter(r => ["draft","approved"].includes(r.status)).length === 0}
              className="rounded-xl"
            >
              Publish All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={openAutomationSettings}
              className="rounded-xl ml-auto"
            >
              <Settings2 className="h-3.5 w-3.5 mr-1.5" />
              Automation Settings
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRebuildDay}
              className="rounded-xl text-destructive hover:bg-destructive/10 border-destructive/30"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Discard Drafts
            </Button>
          </div>

          {/* Route cards per technician */}
          {loadingDay ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
              <Loader2 className="h-4 w-4 animate-spin" />Loading day plan…
            </div>
          ) : dayRoutes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">
              No routes for {selectedDate}. Click "Generate Day Plan" to create routes for all active technicians.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {dayRoutes.map((r) => (
                <Card key={r.id} className="rounded-2xl border-border/60 bg-card/95">
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-sm">{r.employee_name}</p>
                        <p className="text-xs text-muted-foreground">{r.employee_email}</p>
                      </div>
                      <Badge className={statusColor(r.status)}>{r.status}</Badge>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="font-bold">{r.stop_count}</span>
                      <span className="text-muted-foreground">stops</span>
                      {r.total_distance_miles != null && (
                        <span className="text-muted-foreground">{r.total_distance_miles.toFixed(1)} mi</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {confidenceBadge(r.confidence)}
                      {r.completed_count > 0 && (
                        <span className="text-xs text-green-700 font-medium flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />{r.completed_count}/{r.stop_count}
                        </span>
                      )}
                    </div>
                    {r.conflict_notes && r.conflict_notes.length > 0 && (
                      <div className="rounded-lg bg-amber-50 border border-amber-200 p-2 text-xs text-amber-800 flex items-start gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        <span>{r.conflict_notes.length} coordinate warning{r.conflict_notes.length > 1 ? "s" : ""}</span>
                      </div>
                    )}
                    <div className="flex gap-2 pt-1 flex-wrap">
                      {(r.status === "draft" || r.status === "approved") && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-lg h-8 text-xs border-violet-200 text-violet-700 hover:bg-violet-50"
                          disabled={loadingOptimize && optimizeRouteId === r.id}
                          onClick={() => handleSmartOptimize(r.id)}
                        >
                          {loadingOptimize && optimizeRouteId === r.id
                            ? <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            : <Sparkles className="h-3 w-3 mr-1" />}
                          Smart
                        </Button>
                      )}
                      {r.status === "draft" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 rounded-lg h-8 text-xs"
                          onClick={async () => {
                            await adminApi(`/api/admin/routes/${r.id}/approve`, "POST");
                            await loadDay();
                            toast({ title: "Route approved" });
                          }}
                        >
                          Approve
                        </Button>
                      )}
                      {(r.status === "approved" || r.status === "draft") && (
                        <Button
                          size="sm"
                          className="flex-1 rounded-lg h-8 text-xs shadow-brand"
                          onClick={() => {
                            setPublishBlocked(null);
                            setPublishConfirm({
                              type: "single",
                              routeId: r.id,
                              confidence: r.confidence,
                              conflictNotes: r.conflict_notes ?? [],
                            });
                          }}
                        >
                          Publish
                        </Button>
                      )}
                      {r.status === "published" && (
                        <span className="text-xs text-green-700 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" />Published
                          {r.published_at ? ` ${new Date(r.published_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Unassigned appointments */}
          {dayUnassigned.length > 0 && (
            <Card className="rounded-2xl border-amber-200 bg-amber-50/50">
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-sm font-semibold text-amber-800 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  {dayUnassigned.length} Unassigned Appointment{dayUnassigned.length > 1 ? "s" : ""}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4">
                <div className="space-y-1">
                  {dayUnassigned.map((a: any) => (
                    <div key={a.id} className="text-xs text-amber-900 flex items-center gap-2">
                      <MapPin className="h-3 w-3 shrink-0" />
                      {a.properties?.address ?? "Unknown"}, {a.properties?.city ?? ""}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-amber-700 mt-2">
                  These appointments were not placed due to capacity limits or missing technicians.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── Single Technician Tab ───────────────────────────────────────────── */}
      {activeTab === "single" && (
        <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
          <div className="space-y-8">
          {/* Route Generation Card */}
          <Card className="rounded-[32px] border-border/60 bg-card/95 shadow-soft overflow-hidden">
            <CardHeader className="bg-primary/5 p-8 border-b border-border/40">
              <div className="flex items-center gap-3 text-primary mb-1">
                <Navigation className="h-6 w-6" />
                <CardTitle className="text-2xl font-display font-bold">Generate Route</CardTitle>
              </div>
              <CardDescription className="text-base">
                Create an optimized route for an employee on a specific date.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Date</Label>
                  <Input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="rounded-xl h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Employee</Label>
                  <select
                    value={selectedEmployeeId}
                    onChange={(e) => setSelectedEmployeeId(e.target.value)}
                    className="h-11 w-full rounded-xl border border-input bg-background px-4 text-sm font-medium"
                    disabled={loadingEmployees}
                  >
                    <option value="">Select an employee...</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.email})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <Button
                className="w-full h-12 rounded-xl font-bold shadow-brand"
                onClick={handleGenerateRoute}
                disabled={generatingRoute || !selectedEmployeeId}
              >
                {generatingRoute ? "Generating..." : "Generate Optimized Route"}
              </Button>
            </CardContent>
          </Card>

          {/* Route Details */}
          {selectedRoute && (
            <Card className="rounded-[32px] border-border/60 bg-card/95 shadow-soft overflow-hidden">
              <CardHeader className="bg-primary/5 p-8 border-b border-border/40">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3 text-primary">
                    <MapPin className="h-6 w-6" />
                    <div>
                      <CardTitle className="text-2xl font-display font-bold">Route Details</CardTitle>
                      <CardDescription className="text-base">
                        {selectedRoute.stops?.length || 0} stops • {selectedRoute.total_distance_miles?.toFixed(1) || 0} miles
                      </CardDescription>
                    </div>
                  </div>
                  <Badge className={statusColor(selectedRoute.status)}>
                    {selectedRoute.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-8">
                {selectedRoute.stops && selectedRoute.stops.length > 0 ? (
                  <div className="rounded-2xl border border-border/40 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30 border-none">
                          <TableHead className="font-bold text-[10px] uppercase tracking-widest pl-6 py-4 w-12">Seq</TableHead>
                          <TableHead className="font-bold text-[10px] uppercase tracking-widest py-4">Address</TableHead>
                          <TableHead className="font-bold text-[10px] uppercase tracking-widest py-4 text-right">ETA</TableHead>
                          <TableHead className="font-bold text-[10px] uppercase tracking-widest pr-6 py-4 text-right">Distance</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedRoute.stops.map((stop) => {
                          const eta = new Date(stop.arrival_eta);
                          return (
                            <TableRow key={stop.id} className="border-border/40 group hover:bg-muted/10 transition-colors">
                              <TableCell className="pl-6 py-4 font-bold text-sm">{stop.sequence_number}</TableCell>
                              <TableCell className="py-4 text-sm">{stop.property_address || "Unknown"}</TableCell>
                              <TableCell className="py-4 text-sm text-right">
                                {eta.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </TableCell>
                              <TableCell className="pr-6 py-4 text-sm text-right">
                                {stop.distance_from_prev_miles?.toFixed(1) || 0} mi
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No stops in this route
                  </div>
                )}

                <div className="flex flex-wrap gap-3 mt-8">
                  {selectedRoute.status === "draft" && (
                    <>
                      <Button
                        variant="outline"
                        className="h-11 rounded-xl border-violet-200 text-violet-700 hover:bg-violet-50"
                        disabled={loadingOptimize}
                        onClick={() => handleSmartOptimize(selectedRoute.id)}
                      >
                        {loadingOptimize
                          ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          : <Sparkles className="h-4 w-4 mr-2" />}
                        Smart Optimize
                      </Button>
                      <Button
                        className="flex-1 h-11 rounded-xl font-bold shadow-brand"
                        onClick={() => handleApproveRoute(selectedRoute.id)}
                      >
                        Approve Route
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 h-11 rounded-xl font-bold"
                        onClick={() => handleRebuildRoute(selectedRoute.id)}
                      >
                        Rebuild
                      </Button>
                      <Button
                        variant="outline"
                        className="h-11 rounded-xl font-bold text-red-500 hover:text-red-600 hover:bg-red-50"
                        onClick={() => handleDiscardRoute(selectedRoute.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Discard
                      </Button>
                    </>
                  )}
                  {(selectedRoute.status === "approved" || selectedRoute.status === "assigned") && (
                    <>
                      <Button
                        className="flex-1 h-11 rounded-xl font-bold shadow-brand"
                        onClick={() => {
                          setPublishBlocked(null);
                          setPublishConfirm({
                            type: "single",
                            routeId: selectedRoute.id,
                            confidence: selectedRoute.confidence,
                            conflictNotes: selectedRoute.conflict_notes ?? [],
                          });
                        }}
                      >
                        Publish & Notify Employee
                      </Button>
                      <Button
                        variant="outline"
                        className="h-11 rounded-xl"
                        onClick={() => handleRebuildRoute(selectedRoute.id)}
                      >
                        Rebuild
                      </Button>
                    </>
                  )}
                  {selectedRoute.status === "published" && (
                    <div className="flex items-center gap-2 text-sm text-green-700 font-medium">
                      <span className="h-2 w-2 rounded-full bg-green-500 inline-block" />
                      Published {selectedRoute.published_at ? new Date(selectedRoute.published_at).toLocaleString() : ""}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Routes List Sidebar */}
        <div className="space-y-4">
          <Card className="rounded-[32px] border-border/60 bg-card/95 shadow-soft">
            <CardHeader className="p-6">
              <CardTitle className="text-xl font-display font-bold">Routes for {selectedDate}</CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6 space-y-2 max-h-96 overflow-y-auto">
              {loadingRoutes ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  Loading routes...
                </div>
              ) : routes.length > 0 ? (
                routes.map((route) => (
                  <button
                    key={route.id}
                    onClick={() => setSelectedRoute(route)}
                    className={`w-full p-4 rounded-xl border transition-all text-left ${
                      selectedRoute?.id === route.id
                        ? "border-primary bg-primary/5"
                        : "border-border/40 hover:border-primary/20 hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-sm">{route.stops?.length || 0} stops</span>
                      <Badge className={statusColor(route.status)}>
                        {route.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {route.total_duration_minutes?.toFixed(0) || 0} min
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No routes yet. Generate one above.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      )}

      {/* Smart Optimize Preview Modal */}
      <Dialog open={!!optimizeRouteId} onOpenChange={(open) => { if (!open) { setOptimizeRouteId(null); setOptimizePreview(null); } }}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-violet-600" />
              Smart Route Optimization
            </DialogTitle>
            <DialogDescription>
              Home-base-aware routing with speed zone estimation
            </DialogDescription>
          </DialogHeader>

          {loadingOptimize && (
            <div className="flex items-center justify-center py-10 gap-3 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Analyzing route…
            </div>
          )}

          {!loadingOptimize && optimizePreview && (
            <div className="space-y-4">
              {optimizePreview.improvement.percentImprovement > 0 ? (
                <div className="rounded-xl bg-violet-50 border border-violet-200 p-4 flex items-center gap-3">
                  <TrendingDown className="h-5 w-5 text-violet-600 shrink-0" />
                  <div>
                    <p className="font-semibold text-sm text-violet-900">
                      {optimizePreview.improvement.percentImprovement}% shorter route
                    </p>
                    <p className="text-xs text-violet-700">
                      Saves {optimizePreview.improvement.distanceSavedMiles} mi · {optimizePreview.improvement.timeSavedMinutes} min drive time
                    </p>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl bg-muted/40 border border-border/40 p-4 text-sm text-muted-foreground text-center">
                  Current order is already optimal
                </div>
              )}

              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Proposed stop order</p>
                <div className="max-h-56 overflow-y-auto rounded-xl border border-border/40 divide-y divide-border/30">
                  {optimizePreview.stops.map((s: any, i: number) => (
                    <div key={s.assignmentId} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                      <span className="text-xs font-bold text-muted-foreground w-5 shrink-0">{i + 1}</span>
                      <span className="flex-1 truncate">{s.address || s.assignmentId}</span>
                      {s.isMockGeo && (
                        <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 shrink-0">est. geo</span>
                      )}
                      {s.exceedsDriveCap && (
                        <span className="text-[10px] text-red-600 bg-red-50 border border-red-200 rounded px-1.5 py-0.5 shrink-0">cap</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {optimizePreview.exceedsDriveCap && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 flex items-start gap-2 text-xs text-amber-800">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  Drive time cap exceeded at stop {(optimizePreview.driveCapExceededAtStopIndex ?? 0) + 1}. Consider reducing stops.
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button
                  className="flex-1 rounded-xl shadow-brand"
                  disabled={applyingOptimize || optimizePreview.improvement.percentImprovement <= 0}
                  onClick={handleApplyOptimization}
                >
                  {applyingOptimize ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Apply New Order
                </Button>
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => { setOptimizeRouteId(null); setOptimizePreview(null); }}
                >
                  <X className="h-4 w-4 mr-1" />
                  Keep Current
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Publish Confirmation Modal */}
      <Dialog open={!!publishConfirm} onOpenChange={(open) => { if (!open) { setPublishConfirm(null); setPublishBlocked(null); } }}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              {publishConfirm?.type === "all" ? "Publish All Routes?" : "Publish Route?"}
            </DialogTitle>
            <DialogDescription>
              {publishConfirm?.type === "all"
                ? "Sends every draft/approved route for this day to its assigned employee."
                : "Sends this route to the assigned employee and locks the stop order."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {publishConfirm?.type === "single" && publishConfirm.confidence && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Confidence:</span>
                {confidenceBadge(publishConfirm.confidence)}
              </div>
            )}

            {publishConfirm?.type === "single" && (publishConfirm.conflictNotes?.length ?? 0) > 0 && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {publishConfirm.conflictNotes!.length} warning{publishConfirm.conflictNotes!.length > 1 ? "s" : ""}
                </p>
                <ul className="list-disc pl-4 space-y-0.5">
                  {publishConfirm.conflictNotes!.slice(0, 5).map((note, i) => <li key={i}>{note}</li>)}
                </ul>
              </div>
            )}

            {publishConfirm?.type === "all" && (
              <div className="text-sm text-muted-foreground space-y-2">
                <p>
                  {dayRoutes.filter(r => ["draft", "approved"].includes(r.status)).length} route(s) will be published.
                </p>
                {dayRoutes.some(r => r.confidence === "low" || (r.conflict_notes?.length ?? 0) > 0) && (
                  <p className="text-amber-700 font-medium flex items-start gap-1.5">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    Some routes have low confidence or coordinate warnings — check the Day Planner cards above before publishing.
                  </p>
                )}
              </div>
            )}

            {publishBlocked && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-800 space-y-1.5">
                <p className="font-semibold">
                  {publishBlocked.hint ? "Review required before publishing" : "Publish blocked"}
                </p>
                {publishBlocked.warnings?.conflict_notes?.length > 0 && (
                  <ul className="list-disc pl-4 space-y-0.5">
                    {publishBlocked.warnings.conflict_notes.slice(0, 5).map((n: string, i: number) => <li key={i}>{n}</li>)}
                  </ul>
                )}
                {publishBlocked.validation?.routes?.some((r: any) => r.result.blockers.length > 0) && (
                  <ul className="list-disc pl-4 space-y-0.5">
                    {publishBlocked.validation.routes
                      .flatMap((r: any) => r.result.blockers.map((b: any) => b.message))
                      .slice(0, 5)
                      .map((m: string, i: number) => <li key={i}>{m}</li>)}
                  </ul>
                )}
                {publishBlocked.hint && <p className="italic text-red-700">{publishBlocked.hint}</p>}
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              className="flex-1 rounded-xl shadow-brand"
              disabled={publishing}
              onClick={() => doPublish(!!publishBlocked)}
            >
              {publishing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {publishBlocked ? "Force Publish Anyway" : "Confirm Publish"}
            </Button>
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => { setPublishConfirm(null); setPublishBlocked(null); }}
            >
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Routing Automation Settings */}
      <Dialog open={automationOpen} onOpenChange={setAutomationOpen}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-primary" />
              Routing Automation Settings
            </DialogTitle>
            <DialogDescription>
              Controls whether routes need manual publish, auto-publish after a review window, or auto-publish immediately once safe. Disabled by default.
            </DialogDescription>
          </DialogHeader>

          {loadingAutomation || !automationSettings ? (
            <div className="flex items-center justify-center py-10 gap-3 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading settings…
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex items-center justify-between rounded-xl border border-border/60 p-3">
                <div>
                  <Label className="text-sm font-semibold">Automation enabled</Label>
                  <p className="text-xs text-muted-foreground">Master switch — off means every route still requires manual publish, regardless of mode.</p>
                </div>
                <Switch
                  checked={automationSettings.enabled}
                  onCheckedChange={(checked) => setAutomationSettings({ ...automationSettings, enabled: checked })}
                />
              </div>

              <div className="space-y-2.5 rounded-xl border border-violet-200 bg-violet-50/40 p-3">
                <Label className="text-sm font-semibold">Generation & Optimization</Label>
                <p className="text-xs text-muted-foreground -mt-1">Independent of publish mode below — generating/optimizing a route never publishes it.</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Auto-generate day plans</span>
                  <Switch
                    checked={automationSettings.auto_generate_enabled}
                    onCheckedChange={(checked) => setAutomationSettings({ ...automationSettings, auto_generate_enabled: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Auto-run Smart Optimize on generated routes</span>
                  <Switch
                    checked={automationSettings.auto_optimize_enabled}
                    onCheckedChange={(checked) => setAutomationSettings({ ...automationSettings, auto_optimize_enabled: checked })}
                  />
                </div>
                {automationSettings.auto_generate_enabled && (
                  <>
                    <div className="space-y-1.5 pt-1">
                      <Label className="text-xs">Generate time (optional)</Label>
                      <Input
                        type="time"
                        value={automationSettings.auto_generate_time ?? ""}
                        onChange={(e) => setAutomationSettings({ ...automationSettings, auto_generate_time: e.target.value || null })}
                        className="rounded-xl h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Days allowed (none selected = every day)</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {WEEKDAYS.map((day) => {
                          const selected = automationSettings.auto_generate_days?.includes(day) ?? false;
                          return (
                            <button
                              key={day}
                              type="button"
                              onClick={() => {
                                const current = automationSettings.auto_generate_days ?? [];
                                const next = selected ? current.filter((d) => d !== day) : [...current, day];
                                setAutomationSettings({ ...automationSettings, auto_generate_days: next.length ? next : null });
                              }}
                              className={`rounded-lg px-2 py-1 text-[10px] font-semibold capitalize border ${
                                selected ? "bg-violet-600 text-white border-violet-600" : "bg-background text-muted-foreground border-border/60"
                              }`}
                            >
                              {day.slice(0, 3)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold">Publish Mode</Label>
                <select
                  value={automationSettings.mode}
                  onChange={(e) => setAutomationSettings({ ...automationSettings, mode: e.target.value as RouteAutomationSettings["mode"] })}
                  className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                >
                  <option value="manual_only">Manual only — admin always publishes</option>
                  <option value="review_window">Review window — auto-publish after a delay</option>
                  <option value="fully_automatic">Fully automatic — auto-publish immediately when safe</option>
                </select>
              </div>

              {automationSettings.mode === "review_window" && (
                <div className="space-y-2">
                  <Label className="text-sm">Review window (minutes)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={automationSettings.review_window_minutes}
                    onChange={(e) => setAutomationSettings({ ...automationSettings, review_window_minutes: Number(e.target.value) })}
                    className="rounded-xl"
                  />
                  <p className="text-xs text-muted-foreground">Routes wait this long after generation before becoming eligible for auto-publish.</p>
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-sm">Auto-publish cutoff time (optional)</Label>
                <Input
                  type="time"
                  value={automationSettings.auto_publish_cutoff_time ?? ""}
                  onChange={(e) => setAutomationSettings({ ...automationSettings, auto_publish_cutoff_time: e.target.value || null })}
                  className="rounded-xl"
                />
                <p className="text-xs text-muted-foreground">Don't auto-publish before this time of day. Leave blank for no cutoff.</p>
              </div>

              <div className="space-y-2.5 rounded-xl border border-border/60 p-3">
                <Label className="text-sm font-semibold">Safety checks</Label>
                {[
                  { key: "require_smart_optimize", label: "Require Smart Optimize before auto-publish" },
                  { key: "block_low_confidence", label: "Block low-confidence routes" },
                  { key: "block_mock_geo", label: "Block routes with estimated (mock) coordinates" },
                  { key: "block_drive_cap_exceeded", label: "Block routes exceeding technician drive cap" },
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{label}</span>
                    <Switch
                      checked={(automationSettings as any)[key]}
                      onCheckedChange={(checked) => setAutomationSettings({ ...automationSettings, [key]: checked })}
                    />
                  </div>
                ))}
              </div>

              <div className="space-y-2.5 rounded-xl border border-amber-200 bg-amber-50/40 p-3">
                <Label className="text-sm font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                  Full Auto-Publish Gates
                </Label>
                <p className="text-xs text-muted-foreground -mt-1">Both must be set (review off, full-publish on) for automation to ever publish without you clicking Publish.</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Require admin review before publish</span>
                  <Switch
                    checked={automationSettings.require_admin_review_before_publish}
                    onCheckedChange={(checked) => setAutomationSettings({ ...automationSettings, require_admin_review_before_publish: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Allow full auto-publish</span>
                  <Switch
                    checked={automationSettings.allow_full_auto_publish}
                    onCheckedChange={(checked) => setAutomationSettings({ ...automationSettings, allow_full_auto_publish: checked })}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <Button
                  className="flex-1 rounded-xl shadow-brand"
                  disabled={savingAutomation}
                  onClick={saveAutomationSettings}
                >
                  {savingAutomation ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Save Settings
                </Button>
                <Button variant="outline" className="rounded-xl" onClick={() => setAutomationOpen(false)}>
                  Cancel
                </Button>
              </div>

              <div className="flex gap-3 pt-1 border-t border-border/40">
                <Button
                  variant="outline"
                  className="flex-1 rounded-xl mt-3"
                  disabled={runningAutomation}
                  onClick={runAutomationNow}
                >
                  {runningAutomation ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2 text-violet-600" />}
                  Run Automation Now ({selectedDate})
                </Button>
                <Button variant="ghost" className="rounded-xl mt-3 text-xs" onClick={toggleAutomationHistory}>
                  {showAutomationHistory ? "Hide" : "View"} History
                </Button>
              </div>

              {showAutomationHistory && (
                <div className="rounded-xl border border-border/60 max-h-64 overflow-y-auto">
                  {loadingHistory ? (
                    <div className="flex items-center justify-center py-6 text-muted-foreground text-sm gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading history…
                    </div>
                  ) : automationHistory.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-6">No automation activity yet.</p>
                  ) : (
                    <div className="divide-y divide-border/30">
                      {automationHistory.map((h) => (
                        <div key={h.id} className="px-3 py-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold">{h.action.replace(/_/g, " ")}</span>
                            <span className="text-muted-foreground">{new Date(h.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                          </div>
                          {h.metadata?.blockers?.length > 0 && (
                            <p className="text-muted-foreground mt-0.5">{h.metadata.blockers.join("; ")}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RoutePlanning;
