import { useEffect, useState } from "react";
import SectionHeading from "@/components/common/SectionHeading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, MapPin, RotateCcw } from "lucide-react";
import { adminApi } from "@/lib/adminApi";
import { useToast } from "@/hooks/use-toast";

interface ZipRow {
  zip: string;
  city: string | null;
  county: string | null;
  state: string | null;
  service_status: "active" | "inactive" | "unmapped";
  capacity: number | null;
  demand_count: number;
  out_of_area_count: number;
  customer_count: number;
  appointment_count: number;
  subscription_count: number;
  estimated_revenue_cents: number;
  conversion_rate: number | null;
  opportunity_score: number;
  recommendation: string;
  recommendation_reason: string;
}

interface CountyRow {
  county: string;
  active_zip_count: number;
  total_zip_count: number;
  demand_count: number;
  out_of_area_count: number;
  customer_count: number;
  appointment_count: number;
  estimated_revenue_cents: number;
  opportunity_score: number;
  recommendation: string;
  recommendation_reason: string;
}

interface TerritoryData {
  zips: ZipRow[];
  counties: CountyRow[];
}

const RECOMMENDATION_STYLES: Record<string, string> = {
  activate_zip: "bg-blue-100 text-blue-800",
  add_technician_capacity: "bg-red-100 text-red-800",
  watchlist: "bg-amber-100 text-amber-800",
  expansion_candidate: "bg-green-100 text-green-800",
  low_priority: "bg-gray-100 text-gray-600",
  review_manually: "bg-purple-100 text-purple-800",
};

const RECOMMENDATION_LABELS: Record<string, string> = {
  activate_zip: "Activate ZIP",
  add_technician_capacity: "Add Technician Capacity",
  watchlist: "Watchlist",
  expansion_candidate: "Expansion Candidate",
  low_priority: "Low Priority",
  review_manually: "Review Manually",
};

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  inactive: "bg-gray-100 text-gray-600",
  unmapped: "bg-amber-100 text-amber-700",
};

function RecBadge({ rec }: { rec: string }) {
  return <Badge className={`text-[10px] font-bold border-none ${RECOMMENDATION_STYLES[rec] || ""}`}>{RECOMMENDATION_LABELS[rec] || rec}</Badge>;
}

const TerritoryIntelligence = () => {
  const { toast } = useToast();
  const [data, setData] = useState<TerritoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [stateFilter, setStateFilter] = useState("");
  const [countyFilter, setCountyFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [areaFilter, setAreaFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (stateFilter) params.set("state", stateFilter);
      if (countyFilter) params.set("county", countyFilter);
      if (statusFilter) params.set("service_status", statusFilter);
      if (areaFilter) params.set("area_filter", areaFilter);
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      const res = await adminApi(`/api/admin/territory-intelligence?${params.toString()}`);
      setData(res);
    } catch (err: any) {
      toast({ title: "Failed to load territory intelligence", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const counties = Array.from(new Set((data?.zips ?? []).map((z) => z.county).filter(Boolean))) as string[];

  return (
    <div className="grid gap-8">
      <SectionHeading
        eyebrow="Analytics"
        title="Territory Intelligence"
        description="Read-only opportunity scoring by ZIP and county — decision support only. Nothing here changes a service area, schedule, or assignment automatically."
      />

      <Card className="rounded-[28px] border-border/60 bg-card/95 shadow-soft">
        <CardContent className="p-5 flex flex-wrap items-end gap-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">State</label>
            <input className="h-9 rounded-lg border border-border/60 bg-background px-2 text-sm w-20" value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} placeholder="CA" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">County</label>
            <select className="h-9 rounded-lg border border-border/60 bg-background px-2 text-sm" value={countyFilter} onChange={(e) => setCountyFilter(e.target.value)}>
              <option value="">All</option>
              {counties.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Service Status</label>
            <select className="h-9 rounded-lg border border-border/60 bg-background px-2 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="unmapped">Unmapped</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Area</label>
            <select className="h-9 rounded-lg border border-border/60 bg-background px-2 text-sm" value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)}>
              <option value="">All</option>
              <option value="in_area">In-Area</option>
              <option value="out_of_area">Out-of-Area</option>
            </select>
          </div>
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
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground/40" /></div>
      ) : (
        <>
          <Card className="rounded-[32px] border-border/60 bg-card/95 shadow-soft overflow-hidden">
            <CardHeader className="bg-muted/20 px-8 py-5 border-b border-border/40">
              <CardTitle className="text-base font-display font-bold flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" /> County Opportunity ({data?.counties.length ?? 0})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>County</TableHead>
                    <TableHead className="text-right">Active ZIPs</TableHead>
                    <TableHead className="text-right">Demand</TableHead>
                    <TableHead className="text-right">Out-of-Area</TableHead>
                    <TableHead className="text-right">Customers</TableHead>
                    <TableHead className="text-right">Appointments</TableHead>
                    <TableHead className="text-right">Est. Revenue</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                    <TableHead>Recommendation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.counties ?? []).length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No territory data matches these filters.</TableCell></TableRow>
                  ) : data!.counties.map((c) => (
                    <TableRow key={c.county} title={c.recommendation_reason}>
                      <TableCell className="font-bold text-sm">{c.county}</TableCell>
                      <TableCell className="text-right text-sm">{c.active_zip_count} / {c.total_zip_count}</TableCell>
                      <TableCell className="text-right text-sm">{c.demand_count}</TableCell>
                      <TableCell className="text-right text-sm">{c.out_of_area_count}</TableCell>
                      <TableCell className="text-right text-sm">{c.customer_count}</TableCell>
                      <TableCell className="text-right text-sm">{c.appointment_count}</TableCell>
                      <TableCell className="text-right text-sm">${(c.estimated_revenue_cents / 100).toFixed(0)}</TableCell>
                      <TableCell className="text-right text-sm font-bold">{c.opportunity_score}</TableCell>
                      <TableCell><RecBadge rec={c.recommendation} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="rounded-[32px] border-border/60 bg-card/95 shadow-soft overflow-hidden">
            <CardHeader className="bg-muted/20 px-8 py-5 border-b border-border/40">
              <CardTitle className="text-base font-display font-bold flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" /> ZIP Opportunity ({data?.zips.length ?? 0})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ZIP</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>County</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Demand</TableHead>
                    <TableHead className="text-right">Out-of-Area</TableHead>
                    <TableHead className="text-right">Customers</TableHead>
                    <TableHead className="text-right">Appts</TableHead>
                    <TableHead className="text-right">Subs</TableHead>
                    <TableHead className="text-right">Est. Revenue</TableHead>
                    <TableHead className="text-right">Conv. Rate</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                    <TableHead>Recommendation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.zips ?? []).length === 0 ? (
                    <TableRow><TableCell colSpan={14} className="text-center text-muted-foreground py-8">No territory data matches these filters.</TableCell></TableRow>
                  ) : data!.zips.slice(0, 200).map((z) => (
                    <TableRow key={z.zip} title={z.recommendation_reason}>
                      <TableCell className="font-mono font-bold text-sm">{z.zip}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{z.city || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{z.county || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{z.state || "—"}</TableCell>
                      <TableCell><Badge className={`text-[10px] font-bold border-none capitalize ${STATUS_STYLES[z.service_status]}`}>{z.service_status}</Badge></TableCell>
                      <TableCell className="text-right text-sm">{z.demand_count}</TableCell>
                      <TableCell className="text-right text-sm">{z.out_of_area_count}</TableCell>
                      <TableCell className="text-right text-sm">{z.customer_count}</TableCell>
                      <TableCell className="text-right text-sm">{z.appointment_count}</TableCell>
                      <TableCell className="text-right text-sm">{z.subscription_count}</TableCell>
                      <TableCell className="text-right text-sm">${(z.estimated_revenue_cents / 100).toFixed(0)}</TableCell>
                      <TableCell className="text-right text-sm">{z.conversion_rate == null ? "—" : `${(z.conversion_rate * 100).toFixed(0)}%`}</TableCell>
                      <TableCell className="text-right text-sm font-bold">{z.opportunity_score}</TableCell>
                      <TableCell><RecBadge rec={z.recommendation} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {(data?.zips.length ?? 0) > 200 && (
                <p className="px-6 py-3 text-xs text-muted-foreground italic border-t border-border/40">Showing top 200 of {data!.zips.length} ZIPs by opportunity score. Use filters to narrow further.</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default TerritoryIntelligence;
