import { useEffect, useState } from "react";
import SectionHeading from "@/components/common/SectionHeading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Gift, Navigation, Users2 } from "lucide-react";
import { adminApi } from "@/lib/adminApi";
import { useToast } from "@/hooks/use-toast";

interface PlatformAnalytics {
  referrals: {
    by_code: { code: string; owner_type: string; partner_name: string | null; lead_count: number; conversion_count: number }[];
    pending_rewards_count: number;
    pending_rewards_value_cents: number;
    partner_performance: { code: string; partner_name: string | null; lead_count: number; conversion_count: number }[];
  };
  routes: {
    window_days: number;
    total_routes: number;
    total_estimated_miles: number;
    total_estimated_drive_minutes: number;
    published_with_warnings_count: number;
    auto_generated_count: number;
    auto_published_count: number;
    smart_optimize: { runs: number; total_distance_saved_miles: number; total_time_saved_minutes: number };
  };
  crm: {
    leads_by_status: Record<string, number>;
    assigned_leads_by_staff: { staff_id: string; staff_name: string; count: number }[];
    overdue_followups_count: number;
    conversion_candidates_count: number;
  };
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card className="rounded-[24px] border-border/60 bg-card/95">
      <CardContent className="p-5">
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-sm text-muted-foreground font-medium">{label}</p>
        {sub && <p className="text-xs text-muted-foreground/70 mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

const Analytics = () => {
  const { toast } = useToast();
  const [data, setData] = useState<PlatformAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await adminApi("/api/admin/metrics/platform-analytics");
        setData(res);
      } catch (err: any) {
        toast({ title: "Failed to load analytics", description: err.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading || !data) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary/40" /></div>;
  }

  return (
    <div className="grid gap-10">
      <SectionHeading
        eyebrow="Insights"
        title="Platform Analytics"
        description="Lightweight referral, routing, and CRM dashboards — foundation view, not a full reporting suite."
      />

      {/* Referrals */}
      <div className="grid gap-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2"><Gift className="h-4 w-4" /> Referrals</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Pending Rewards" value={data.referrals.pending_rewards_count} sub={`$${(data.referrals.pending_rewards_value_cents / 100).toFixed(2)} total`} />
          <StatCard label="Active Codes" value={data.referrals.by_code.length} />
          <StatCard label="Partner Codes" value={data.referrals.partner_performance.length} />
        </div>
        <Card className="rounded-[28px] border-border/60 bg-card/95 shadow-soft overflow-hidden">
          <CardHeader className="bg-muted/20 px-8 py-5 border-b border-border/40">
            <CardTitle className="text-base font-display font-bold">Leads &amp; Conversions by Code</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">Conversions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.referrals.by_code.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No referral activity yet.</TableCell></TableRow>
                ) : data.referrals.by_code.map((c) => (
                  <TableRow key={c.code}>
                    <TableCell className="font-mono font-bold">{c.code}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.owner_type === "partner" ? c.partner_name : "Customer"}</TableCell>
                    <TableCell className="text-right">{c.lead_count}</TableCell>
                    <TableCell className="text-right">{c.conversion_count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Routes */}
      <div className="grid gap-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2"><Navigation className="h-4 w-4" /> Routing ({data.routes.window_days}d window)</h2>
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Total Routes" value={data.routes.total_routes} />
          <StatCard label="Est. Miles" value={data.routes.total_estimated_miles} />
          <StatCard label="Est. Drive Min" value={data.routes.total_estimated_drive_minutes} />
          <StatCard label="Published w/ Warnings" value={data.routes.published_with_warnings_count} />
          <StatCard label="Auto-Generated" value={data.routes.auto_generated_count} />
          <StatCard label="Auto-Published" value={data.routes.auto_published_count} />
        </div>
        <Card className="rounded-[28px] border-border/60 bg-card/95 shadow-soft">
          <CardContent className="p-6 grid sm:grid-cols-3 gap-4">
            <StatCard label="Smart Optimize Runs" value={data.routes.smart_optimize.runs} />
            <StatCard label="Distance Saved (mi)" value={data.routes.smart_optimize.total_distance_saved_miles} />
            <StatCard label="Time Saved (min)" value={data.routes.smart_optimize.total_time_saved_minutes} />
          </CardContent>
        </Card>
      </div>

      {/* CRM */}
      <div className="grid gap-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2"><Users2 className="h-4 w-4" /> CRM</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard label="Overdue Follow-Ups" value={data.crm.overdue_followups_count} />
          <StatCard label="Conversion Candidates" value={data.crm.conversion_candidates_count} />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="rounded-[28px] border-border/60 bg-card/95 shadow-soft overflow-hidden">
            <CardHeader className="bg-muted/20 px-8 py-5 border-b border-border/40">
              <CardTitle className="text-base font-display font-bold">Leads by Status</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableBody>
                  {Object.entries(data.crm.leads_by_status).length === 0 ? (
                    <TableRow><TableCell className="text-center text-muted-foreground py-8">No leads yet.</TableCell></TableRow>
                  ) : Object.entries(data.crm.leads_by_status).map(([status, count]) => (
                    <TableRow key={status}>
                      <TableCell className="capitalize text-sm">{status.replace(/_/g, " ")}</TableCell>
                      <TableCell className="text-right font-bold">{count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <Card className="rounded-[28px] border-border/60 bg-card/95 shadow-soft overflow-hidden">
            <CardHeader className="bg-muted/20 px-8 py-5 border-b border-border/40">
              <CardTitle className="text-base font-display font-bold">Assigned Leads by Staff</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableBody>
                  {data.crm.assigned_leads_by_staff.length === 0 ? (
                    <TableRow><TableCell className="text-center text-muted-foreground py-8">No leads assigned yet.</TableCell></TableRow>
                  ) : data.crm.assigned_leads_by_staff.map((s) => (
                    <TableRow key={s.staff_id}>
                      <TableCell className="text-sm">{s.staff_name}</TableCell>
                      <TableCell className="text-right font-bold">{s.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
