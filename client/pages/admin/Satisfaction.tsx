import { useEffect, useState } from "react";
import SectionHeading from "@/components/common/SectionHeading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Smile, Meh, Frown, Gauge } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

interface DetractorSurvey {
  id: string;
  appointment_id: string;
  profile_id: string;
  rating: number;
  comment: string | null;
  issue_category: string | null;
  ticket_id: string | null;
  created_at: string;
}

interface SatisfactionDashboard {
  nps_score: number | null;
  total_responses: number;
  promoter_count: number;
  passive_count: number;
  detractor_count: number;
  detractors_pending: DetractorSurvey[];
}

async function authedFetch(path: string, method = "GET", body?: unknown) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const res = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Request failed");
  return json;
}

const Satisfaction = () => {
  const { toast } = useToast();
  const [data, setData] = useState<SatisfactionDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await authedFetch("/api/admin/satisfaction/dashboard");
      setData(res);
    } catch (err: any) {
      toast({ title: "Failed to load satisfaction dashboard", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const resolve = async (id: string) => {
    setResolvingId(id);
    try {
      await authedFetch(`/api/admin/satisfaction/${id}/resolve`, "POST");
      setData((prev) => prev ? { ...prev, detractors_pending: prev.detractors_pending.filter((d) => d.id !== id) } : prev);
      toast({ title: "Marked resolved" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setResolvingId(null);
    }
  };

  if (loading || !data) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary/40" /></div>;
  }

  return (
    <div className="grid gap-8">
      <SectionHeading
        eyebrow="Customer Experience"
        title="Customer Satisfaction"
        description="NPS score and post-service ratings. Detractors are flagged here and in a support ticket for follow-up."
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="rounded-[24px] border-border/60 bg-card/95">
          <CardContent className="p-5 flex items-center gap-3">
            <Gauge className="h-7 w-7 text-primary opacity-70" />
            <div>
              <p className="text-2xl font-bold">{data.nps_score == null ? "—" : data.nps_score}</p>
              <p className="text-sm text-muted-foreground font-medium">NPS Score {data.nps_score == null && "(no data yet)"}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-[24px] border-border/60 bg-green-50">
          <CardContent className="p-5 flex items-center gap-3">
            <Smile className="h-7 w-7 text-green-600 opacity-70" />
            <div>
              <p className="text-2xl font-bold">{data.promoter_count}</p>
              <p className="text-sm text-muted-foreground font-medium">Promoters (9-10)</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-[24px] border-border/60 bg-amber-50">
          <CardContent className="p-5 flex items-center gap-3">
            <Meh className="h-7 w-7 text-amber-600 opacity-70" />
            <div>
              <p className="text-2xl font-bold">{data.passive_count}</p>
              <p className="text-sm text-muted-foreground font-medium">Passives (7-8)</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-[24px] border-border/60 bg-red-50">
          <CardContent className="p-5 flex items-center gap-3">
            <Frown className="h-7 w-7 text-red-600 opacity-70" />
            <div>
              <p className="text-2xl font-bold">{data.detractor_count}</p>
              <p className="text-sm text-muted-foreground font-medium">Detractors (0-6)</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-[32px] border-border/60 bg-card/95 shadow-soft overflow-hidden">
        <CardHeader className="bg-muted/20 px-8 py-5 border-b border-border/40">
          <CardTitle className="text-base font-display font-bold flex items-center gap-2">
            <Frown className="h-5 w-5 text-red-500" /> Detractor Queue ({data.detractors_pending.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rating</TableHead>
                <TableHead>Comment</TableHead>
                <TableHead>Issue Category</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Ticket</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.detractors_pending.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No pending detractor issues.</TableCell></TableRow>
              ) : data.detractors_pending.map((d) => (
                <TableRow key={d.id}>
                  <TableCell><Badge className="bg-red-100 text-red-800 border-none">{d.rating}/10</Badge></TableCell>
                  <TableCell className="text-sm max-w-[280px] truncate" title={d.comment || ""}>{d.comment || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{d.issue_category || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{new Date(d.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{d.ticket_id ? d.ticket_id.slice(0, 8) : "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" disabled={resolvingId === d.id} onClick={() => resolve(d.id)}>
                      {resolvingId === d.id ? "…" : "Mark Resolved"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Satisfaction;
