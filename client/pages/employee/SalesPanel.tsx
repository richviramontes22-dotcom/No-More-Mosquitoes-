import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, UserPlus, Gift, CalendarClock } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import SectionHeading from "@/components/common/SectionHeading";

interface Lead { id: string; status: string; source: string; name: string | null; email: string | null; acreage: number | null; created_at: string }
interface ReferralCode { id: string; code: string; owner_type: string; partner_name: string | null; active: boolean }
interface Referral { id: string; referral_code_id: string; status: string; created_at: string }

interface SalesData {
  recent_leads: Lead[];
  leads_by_status: Record<string, number>;
  quote_request_count: number;
  overdue_followups_count: number;
  referral_codes: ReferralCode[];
  recent_referrals: Referral[];
}

async function authedFetch(path: string) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const res = await fetch(path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Request failed");
  return json;
}

/** Landing dashboard for the sales role within the employee portal. */
export function SalesPanel() {
  const { toast } = useToast();
  const [data, setData] = useState<SalesData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authedFetch("/api/admin/sales/dashboard")
      .then(setData)
      .catch((err) => toast({ title: "Failed to load", description: err.message, variant: "destructive" }))
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary/40" /></div>;
  }

  return (
    <div className="grid gap-8">
      <SectionHeading
        eyebrow="Sales"
        title="Your Dashboard"
        description="Leads, follow-ups, and referrals."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="rounded-[24px] border-border/60 bg-card/95">
          <CardContent className="p-5 flex items-center gap-3">
            <UserPlus className="h-7 w-7 text-primary opacity-70" />
            <div><p className="text-2xl font-bold">{data.recent_leads.length}</p><p className="text-sm text-muted-foreground">Recent Leads</p></div>
          </CardContent>
        </Card>
        <Card className="rounded-[24px] border-border/60 bg-amber-50">
          <CardContent className="p-5 flex items-center gap-3">
            <CalendarClock className="h-7 w-7 text-amber-600 opacity-70" />
            <div><p className="text-2xl font-bold">{data.overdue_followups_count}</p><p className="text-sm text-muted-foreground">Overdue Follow-Ups</p></div>
          </CardContent>
        </Card>
        <Card className="rounded-[24px] border-border/60 bg-card/95">
          <CardContent className="p-5 flex items-center gap-3">
            <Gift className="h-7 w-7 text-primary opacity-70" />
            <div><p className="text-2xl font-bold">{data.referral_codes.length}</p><p className="text-sm text-muted-foreground">Referral Codes</p></div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-[28px] border-border/60 bg-card/95 shadow-soft overflow-hidden">
        <CardHeader className="bg-muted/20 px-8 py-5 border-b border-border/40">
          <CardTitle className="text-base font-display font-bold">Leads by Status</CardTitle>
        </CardHeader>
        <CardContent className="p-6 flex flex-wrap gap-3">
          {Object.entries(data.leads_by_status).map(([status, count]) => (
            <Badge key={status} variant="outline" className="text-sm px-3 py-1.5 capitalize">{status.replace(/_/g, " ")}: {count}</Badge>
          ))}
          <Badge variant="outline" className="text-sm px-3 py-1.5">Quote requests: {data.quote_request_count}</Badge>
        </CardContent>
      </Card>

      <Card className="rounded-[28px] border-border/60 bg-card/95 shadow-soft overflow-hidden">
        <CardHeader className="bg-muted/20 px-8 py-5 border-b border-border/40">
          <CardTitle className="text-base font-display font-bold">Recent Leads</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Source</TableHead><TableHead>Status</TableHead><TableHead>Acreage</TableHead><TableHead>Created</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.recent_leads.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No leads yet.</TableCell></TableRow>
              ) : data.recent_leads.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="text-sm">{l.name || l.email || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground capitalize">{l.source}</TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{l.status}</Badge></TableCell>
                  <TableCell className="text-sm">{l.acreage ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{new Date(l.created_at).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="rounded-[28px] border-border/60 bg-card/95 shadow-soft overflow-hidden">
        <CardHeader className="bg-muted/20 px-8 py-5 border-b border-border/40">
          <CardTitle className="text-base font-display font-bold">Recent Referrals</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Status</TableHead><TableHead>Created</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.recent_referrals.length === 0 ? (
                <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-8">No referrals yet.</TableCell></TableRow>
              ) : data.recent_referrals.map((r) => (
                <TableRow key={r.id}>
                  <TableCell><Badge variant="outline" className="capitalize">{r.status.replace(/_/g, " ")}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
