import { useEffect, useState } from "react";
import SectionHeading from "@/components/common/SectionHeading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Users2, CalendarDays, MapPinned, RotateCcw, AlertTriangle } from "lucide-react";
import { adminApi } from "@/lib/adminApi";
import { useToast } from "@/hooks/use-toast";

interface TechRow {
  employee_id: string;
  technician_label: string;
  is_test: boolean;
  available_days: number;
  scheduled_appointments: number;
  completed_appointments: number;
  capacity: number;
  utilization_pct: number | null;
  route_miles: number;
  estimated_drive_minutes: number;
  estimated_service_minutes: number;
  overload_warning: boolean;
  overload_reason: string | null;
}

interface ForecastRow {
  date: string;
  available_technicians: number;
  total_stop_capacity: number;
  scheduled_stops: number;
  remaining_capacity: number;
  demand_pressure: string;
  recommendation: string;
  recommendation_reason: string;
}

interface StaffingRow {
  county: string;
  appointment_demand: number;
  technician_coverage: number;
  active_service_zips: number;
  overload_risk: string;
  recommendation: string;
  recommendation_reason: string;
}

interface WorkforceData {
  technician_utilization: TechRow[];
  capacity_forecast: ForecastRow[];
  territory_staffing: StaffingRow[];
  forecast_window: { from: string; to: string };
}

const REC_STYLES: Record<string, string> = {
  add_technician: "bg-red-100 text-red-800",
  reduce_active_zips_temporarily: "bg-orange-100 text-orange-800",
  add_coverage_in_county: "bg-red-100 text-red-800",
  watch_demand: "bg-amber-100 text-amber-800",
  rebalance_routes: "bg-blue-100 text-blue-800",
  no_action_needed: "bg-gray-100 text-gray-600",
};

const REC_LABELS: Record<string, string> = {
  add_technician: "Add Technician",
  reduce_active_zips_temporarily: "Reduce Active ZIPs (Temp)",
  add_coverage_in_county: "Add Coverage in County",
  watch_demand: "Watch Demand",
  rebalance_routes: "Rebalance Routes",
  no_action_needed: "No Action Needed",
};

const PRESSURE_STYLES: Record<string, string> = {
  low: "bg-green-100 text-green-700",
  moderate: "bg-amber-100 text-amber-700",
  high: "bg-orange-100 text-orange-700",
  over_capacity: "bg-red-100 text-red-700",
};

function RecBadge({ rec }: { rec: string }) {
  return <Badge className={`text-[10px] font-bold border-none ${REC_STYLES[rec] || ""}`}>{REC_LABELS[rec] || rec}</Badge>;
}

const WorkforceOptimization = () => {
  const { toast } = useToast();
  const [data, setData] = useState<WorkforceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      const res = await adminApi(`/api/admin/workforce-optimization?${params.toString()}`);
      setData(res);
    } catch (err: any) {
      toast({ title: "Failed to load workforce optimization", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  return (
    <div className="grid gap-8">
      <SectionHeading
        eyebrow="Analytics"
        title="Workforce Optimization"
        description="Read-only utilization, capacity forecast, and staffing recommendations. Nothing here changes an employee's schedule, a service area, or an assignment automatically."
      />

      <Card className="rounded-[28px] border-border/60 bg-card/95 shadow-soft">
        <CardContent className="p-5 flex flex-wrap items-end gap-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">From</label>
            <input type="date" className="h-9 rounded-lg border border-border/60 bg-background px-2 text-sm" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">To</label>
            <input type="date" className="h-9 rounded-lg border border-border/60 bg-background px-2 text-sm" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <button onClick={fetchData} className="h-9 rounded-lg bg-primary text-primary-foreground px-4 text-sm font-bold flex items-center gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" /> Apply
          </button>
          {data && <span className="text-xs text-muted-foreground ml-auto">Forecast window: {data.forecast_window.from} → {data.forecast_window.to}</span>}
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground/40" /></div>
      ) : (
        <>
          <Card className="rounded-[32px] border-border/60 bg-card/95 shadow-soft overflow-hidden">
            <CardHeader className="bg-muted/20 px-8 py-5 border-b border-border/40">
              <CardTitle className="text-base font-display font-bold flex items-center gap-2">
                <Users2 className="h-5 w-5 text-primary" /> Technician Utilization ({data?.technician_utilization.length ?? 0})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Technician</TableHead>
                    <TableHead className="text-right">Available Days</TableHead>
                    <TableHead className="text-right">Scheduled</TableHead>
                    <TableHead className="text-right">Completed</TableHead>
                    <TableHead className="text-right">Capacity</TableHead>
                    <TableHead className="text-right">Utilization</TableHead>
                    <TableHead className="text-right">Route Miles</TableHead>
                    <TableHead className="text-right">Drive Min</TableHead>
                    <TableHead className="text-right">Service Min</TableHead>
                    <TableHead>Warning</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.technician_utilization ?? []).length === 0 ? (
                    <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">No active technicians found.</TableCell></TableRow>
                  ) : data!.technician_utilization.map((t) => (
                    <TableRow key={t.employee_id}>
                      <TableCell className="text-sm font-medium">{t.technician_label}{t.is_test && <Badge variant="outline" className="ml-2 text-[9px]">test</Badge>}</TableCell>
                      <TableCell className="text-right text-sm">{t.available_days}</TableCell>
                      <TableCell className="text-right text-sm">{t.scheduled_appointments}</TableCell>
                      <TableCell className="text-right text-sm">{t.completed_appointments}</TableCell>
                      <TableCell className="text-right text-sm">{t.capacity}</TableCell>
                      <TableCell className="text-right text-sm">{t.utilization_pct == null ? "—" : `${t.utilization_pct}%`}</TableCell>
                      <TableCell className="text-right text-sm">{t.route_miles}</TableCell>
                      <TableCell className="text-right text-sm">{t.estimated_drive_minutes}</TableCell>
                      <TableCell className="text-right text-sm">{t.estimated_service_minutes}</TableCell>
                      <TableCell>
                        {t.overload_warning ? (
                          <Badge className="bg-red-100 text-red-800 border-none text-[10px] font-bold flex items-center gap-1 w-fit" title={t.overload_reason ?? ""}>
                            <AlertTriangle className="h-3 w-3" /> Overloaded
                          </Badge>
                        ) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="rounded-[32px] border-border/60 bg-card/95 shadow-soft overflow-hidden">
            <CardHeader className="bg-muted/20 px-8 py-5 border-b border-border/40">
              <CardTitle className="text-base font-display font-bold flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-primary" /> Capacity Forecast
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Available Techs</TableHead>
                    <TableHead className="text-right">Total Capacity</TableHead>
                    <TableHead className="text-right">Scheduled</TableHead>
                    <TableHead className="text-right">Remaining</TableHead>
                    <TableHead>Pressure</TableHead>
                    <TableHead>Recommendation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.capacity_forecast ?? []).length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No forecast data.</TableCell></TableRow>
                  ) : data!.capacity_forecast.map((f) => (
                    <TableRow key={f.date} title={f.recommendation_reason}>
                      <TableCell className="text-sm font-medium">{f.date}</TableCell>
                      <TableCell className="text-right text-sm">{f.available_technicians}</TableCell>
                      <TableCell className="text-right text-sm">{f.total_stop_capacity}</TableCell>
                      <TableCell className="text-right text-sm">{f.scheduled_stops}</TableCell>
                      <TableCell className="text-right text-sm">{f.remaining_capacity}</TableCell>
                      <TableCell><Badge className={`text-[10px] font-bold border-none capitalize ${PRESSURE_STYLES[f.demand_pressure]}`}>{f.demand_pressure.replace(/_/g, " ")}</Badge></TableCell>
                      <TableCell><RecBadge rec={f.recommendation} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="rounded-[32px] border-border/60 bg-card/95 shadow-soft overflow-hidden">
            <CardHeader className="bg-muted/20 px-8 py-5 border-b border-border/40">
              <CardTitle className="text-base font-display font-bold flex items-center gap-2">
                <MapPinned className="h-5 w-5 text-primary" /> Territory Staffing
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>County</TableHead>
                    <TableHead className="text-right">Appointment Demand</TableHead>
                    <TableHead className="text-right">Technician Coverage</TableHead>
                    <TableHead className="text-right">Active ZIPs</TableHead>
                    <TableHead>Overload Risk</TableHead>
                    <TableHead>Recommendation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.territory_staffing ?? []).length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No territory staffing data.</TableCell></TableRow>
                  ) : data!.territory_staffing.map((s) => (
                    <TableRow key={s.county} title={s.recommendation_reason}>
                      <TableCell className="text-sm font-bold">{s.county}</TableCell>
                      <TableCell className="text-right text-sm">{s.appointment_demand}</TableCell>
                      <TableCell className="text-right text-sm">{s.technician_coverage}</TableCell>
                      <TableCell className="text-right text-sm">{s.active_service_zips}</TableCell>
                      <TableCell><Badge className={`text-[10px] font-bold border-none capitalize ${PRESSURE_STYLES[s.overload_risk] || ""}`}>{s.overload_risk}</Badge></TableCell>
                      <TableCell><RecBadge rec={s.recommendation} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default WorkforceOptimization;
