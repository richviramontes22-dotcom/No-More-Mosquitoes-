import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import SectionHeading from "@/components/common/SectionHeading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { adminApi } from "@/lib/adminApi";
import { useToast } from "@/hooks/use-toast";
import { DispatchMap } from "@/components/admin/DispatchMap";
import {
  Loader2, Calendar, Users, Truck, Ticket, Frown, CalendarClock,
  AlertTriangle, MapPin, RefreshCw,
} from "lucide-react";

interface DispatchMapData {
  technicians: Array<{
    id: string; name: string; clocked_in: boolean; is_stale: boolean | null;
    location_label: "current" | "last_known" | "unavailable";
    location: { lat: number; lng: number } | null;
  }>;
  stops: Array<{ id: string; status: string; address: string | null; lat: number | null; lng: number | null; is_blocked: boolean }>;
}

interface OperationsSummary {
  generated_at: string;
  today: {
    date: string;
    appointments_today: number;
    active_technicians: number;
    routes_today: number;
    tickets_today: number;
    detractors_today: number;
    reschedules_today: number;
  };
  technician_status: {
    clocked_in: number;
    clocked_out: number;
    on_route: number;
    on_appointment: number;
    completed_today: number;
    blocked_or_unable_to_service: number;
  };
  gps: {
    clocked_in_sharing: number;
    clocked_in_stale_or_silent: number;
    clocked_in_no_consent: number;
    stale_threshold_minutes: number;
    live_tracking_link: string;
  };
  customer_service: {
    open_tickets: number;
    escalations: number;
    detractors: number;
    pending_reschedule_requests: number;
  };
  alerts: {
    routes_awaiting_approval: number;
    routes_pending_publish: number;
    route_automation_enabled: boolean;
    route_automation_mode: string;
    overdue_tickets: number;
    failed_appointments_today: number;
    failed_payments_today: number;
    inactive_technicians: number;
  };
  service_area_insights: {
    uncovered_zip_count: number;
    top_opportunities: Array<{ zip: string; opportunity_score: number; recommendation: string; demand_count: number }>;
  };
}

const StatTile = ({ icon: Icon, label, value, tone = "default" }: { icon: React.ElementType; label: string; value: number | string; tone?: "default" | "warning" | "danger" }) => (
  <Card className="rounded-[24px] border-border/60 bg-card/95">
    <CardContent className="p-5 flex items-center gap-3">
      <Icon className={`h-7 w-7 opacity-70 ${tone === "danger" ? "text-red-600" : tone === "warning" ? "text-amber-600" : "text-primary"}`} />
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </CardContent>
  </Card>
);

const Operations = () => {
  const { toast } = useToast();
  const [data, setData] = useState<OperationsSummary | null>(null);
  const [mapData, setMapData] = useState<DispatchMapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [summaryRes, mapRes] = await Promise.all([
        adminApi("/api/admin/operations/summary"),
        adminApi("/api/admin/operations/dispatch-map"),
      ]);
      setData(summaryRes);
      setMapData(mapRes);
    } catch (err: any) {
      toast({ title: "Failed to load operations summary", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading || !data) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary/40" /></div>;
  }

  const alertCount =
    data.alerts.routes_awaiting_approval + data.alerts.routes_pending_publish +
    data.alerts.overdue_tickets + data.alerts.failed_appointments_today +
    data.alerts.failed_payments_today + data.alerts.inactive_technicians;

  return (
    <div className="grid gap-8">
      <div className="flex items-center justify-between gap-4">
        <SectionHeading
          eyebrow="Operations"
          title="Command Center"
          description="Single-pane-of-glass view across today's field operations, technician status, customer service, and service-area expansion signals."
        />
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-2 rounded-xl border border-border/60 px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted/60 hover:text-foreground transition shrink-0"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* ── Today ── */}
      <section className="grid gap-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Today — {data.today.date}</h2>
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <StatTile icon={Calendar} label="Appointments Today" value={data.today.appointments_today} />
          <StatTile icon={Users} label="Active Technicians" value={data.today.active_technicians} />
          <StatTile icon={Truck} label="Routes Today" value={data.today.routes_today} />
          <StatTile icon={Ticket} label="Tickets Today" value={data.today.tickets_today} />
          <StatTile icon={Frown} label="Detractors Today" value={data.today.detractors_today} tone={data.today.detractors_today > 0 ? "warning" : "default"} />
          <StatTile icon={CalendarClock} label="Reschedules Today" value={data.today.reschedules_today} />
        </div>
      </section>

      {/* ── Technician Status ── */}
      <section className="grid gap-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Technician Status</h2>
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <StatTile icon={Users} label="Clocked In" value={data.technician_status.clocked_in} />
          <StatTile icon={Users} label="Clocked Out" value={data.technician_status.clocked_out} />
          <StatTile icon={Truck} label="On Route" value={data.technician_status.on_route} />
          <StatTile icon={MapPin} label="On Appointment" value={data.technician_status.on_appointment} />
          <StatTile icon={Calendar} label="Completed" value={data.technician_status.completed_today} />
          <StatTile icon={AlertTriangle} label="Blocked / Unable" value={data.technician_status.blocked_or_unable_to_service} tone={data.technician_status.blocked_or_unable_to_service > 0 ? "warning" : "default"} />
        </div>
      </section>

      {/* ── GPS Visibility ── */}
      <section className="grid gap-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">GPS Visibility</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <StatTile icon={MapPin} label="Sharing Location" value={data.gps.clocked_in_sharing} />
          <StatTile
            icon={AlertTriangle}
            label="Clocked In, Stale/Silent"
            value={data.gps.clocked_in_stale_or_silent}
            tone={data.gps.clocked_in_stale_or_silent > 0 ? "warning" : "default"}
          />
          <StatTile icon={Users} label="Clocked In, No Consent" value={data.gps.clocked_in_no_consent} />
        </div>
        <p className="text-xs text-muted-foreground">
          Among technicians currently clocked in. "Stale/silent" means no ping in the last{" "}
          {data.gps.stale_threshold_minutes} minutes despite an open shift and granted consent — usually a
          dropped connection or a backgrounded app, worth a check-in call. See{" "}
          <Link to={data.gps.live_tracking_link} className="underline font-medium">Live Tracking</Link> for
          per-technician position and assignment-status detail.
        </p>
        {mapData && <DispatchMap technicians={mapData.technicians} stops={mapData.stops} />}
      </section>

      {/* ── Customer Service ── */}
      <section className="grid gap-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Customer Service</h2>
        <div className="grid gap-4 sm:grid-cols-4">
          <StatTile icon={Ticket} label="Open Tickets" value={data.customer_service.open_tickets} />
          <StatTile icon={AlertTriangle} label="Escalations" value={data.customer_service.escalations} tone={data.customer_service.escalations > 0 ? "danger" : "default"} />
          <StatTile icon={Frown} label="Detractors" value={data.customer_service.detractors} tone={data.customer_service.detractors > 0 ? "warning" : "default"} />
          <StatTile icon={CalendarClock} label="Pending Reschedules" value={data.customer_service.pending_reschedule_requests} />
        </div>
        <div className="flex gap-3">
          <Link to="/admin/tickets" className="text-sm font-semibold text-primary underline-offset-2 hover:underline">Open Tickets →</Link>
          <Link to="/admin/satisfaction" className="text-sm font-semibold text-primary underline-offset-2 hover:underline">Open Satisfaction →</Link>
        </div>
      </section>

      {/* ── Operations Alerts ── */}
      <Card className="rounded-[28px] border-border/60 bg-card/95 shadow-soft overflow-hidden">
        <CardHeader className="bg-muted/20 px-8 py-5 border-b border-border/40 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-display font-bold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> Operations Alerts
          </CardTitle>
          <Badge variant={alertCount > 0 ? "destructive" : "outline"}>{alertCount} active</Badge>
        </CardHeader>
        <CardContent className="p-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <AlertRow label="Routes awaiting approval" value={data.alerts.routes_awaiting_approval} />
          <AlertRow label="Routes pending publish" value={data.alerts.routes_pending_publish} />
          <AlertRow label="Overdue tickets" value={data.alerts.overdue_tickets} />
          <AlertRow label="Failed appointments today" value={data.alerts.failed_appointments_today} />
          <AlertRow label="Failed payments today" value={data.alerts.failed_payments_today} />
          <AlertRow label="Inactive technicians" value={data.alerts.inactive_technicians} />
        </CardContent>
        <div className="px-8 py-3 border-t border-border/40 text-xs text-muted-foreground">
          Route automation: <span className="font-semibold capitalize">{data.alerts.route_automation_mode.replace(/_/g, " ")}</span>{" "}
          ({data.alerts.route_automation_enabled ? "enabled" : "disabled"}) —{" "}
          <Link to="/admin/route-planning" className="underline font-medium">manage in Route Planning</Link>
        </div>
      </Card>

      {/* ── Service Area Insights ── */}
      <Card className="rounded-[28px] border-border/60 bg-card/95 shadow-soft overflow-hidden">
        <CardHeader className="bg-muted/20 px-8 py-5 border-b border-border/40 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-display font-bold flex items-center gap-2">
            <MapPin className="h-4 w-4" /> Service Area Insights
          </CardTitle>
          <span className="text-sm text-muted-foreground">{data.service_area_insights.uncovered_zip_count} uncovered ZIPs with demand</span>
        </CardHeader>
        <CardContent className="p-6 space-y-3">
          {data.service_area_insights.top_opportunities.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No expansion opportunities flagged right now.</p>
          ) : (
            data.service_area_insights.top_opportunities.map((opp) => (
              <div key={opp.zip} className="flex items-center justify-between rounded-xl border border-border/50 px-4 py-3">
                <div>
                  <p className="font-semibold text-sm">{opp.zip}</p>
                  <p className="text-xs text-muted-foreground">{opp.demand_count} demand signal(s)</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="capitalize">{opp.recommendation.replace(/_/g, " ")}</Badge>
                  <span className="text-sm font-bold text-primary">{opp.opportunity_score}</span>
                </div>
              </div>
            ))
          )}
        </CardContent>
        <div className="px-8 py-3 border-t border-border/40">
          <Link to="/admin/territory-intelligence" className="text-xs font-medium text-primary underline-offset-2 hover:underline">
            Open full Territory Intelligence →
          </Link>
        </div>
      </Card>
    </div>
  );
};

const AlertRow = ({ label, value }: { label: string; value: number }) => (
  <div className={`flex items-center justify-between rounded-xl px-4 py-3 ${value > 0 ? "bg-amber-50 border border-amber-200" : "bg-muted/30 border border-border/40"}`}>
    <span className="text-sm text-foreground">{label}</span>
    <span className={`text-sm font-bold ${value > 0 ? "text-amber-700" : "text-muted-foreground"}`}>{value}</span>
  </div>
);

export default Operations;
