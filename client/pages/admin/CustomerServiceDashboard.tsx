import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, LogOut, Inbox, AlertTriangle, Frown, CalendarClock, Search, History } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

interface TicketRow { id: string; subject: string; category: string; priority: string; status: string; user_id: string; created_at: string }
interface DetractorRow { id: string; rating: number; comment: string | null; issue_category: string | null; created_at: string; ticket_id: string | null }
interface RescheduleRow { id: string; appointment_id: string; preferred_date: string; preferred_window_label: string; status: string; created_at: string }
interface ActivityRow { id: string; subject: string; status: string; updated_at: string }
interface CustomerRow { id: string; name: string; email: string; phone: string | null }

interface DashboardData {
  open_tickets: TicketRow[];
  escalated_tickets: TicketRow[];
  pending_detractors: DetractorRow[];
  pending_reschedule_requests: RescheduleRow[];
  recent_activity: ActivityRow[];
}

async function authedFetch(path: string) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const res = await fetch(path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Request failed");
  return json;
}

/**
 * Minimal, self-contained shell (no AdminLayout) — customer_service is not
 * an admin role and must not see the admin nav or any admin-only links.
 */
const CustomerServiceDashboard = () => {
  const { toast } = useToast();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [searching, setSearching] = useState(false);

  const fetchData = async () => {
    try {
      const res = await authedFetch("/api/admin/customer-service/dashboard");
      setData(res);
    } catch (err: any) {
      toast({ title: "Failed to load", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const runSearch = async () => {
    if (!search.trim()) { setCustomers([]); return; }
    setSearching(true);
    try {
      const res = await authedFetch(`/api/admin/customer-service/customers?search=${encodeURIComponent(search.trim())}`);
      setCustomers(res.customers || []);
    } catch (err: any) {
      toast({ title: "Search failed", description: err.message, variant: "destructive" });
    } finally {
      setSearching(false);
    }
  };

  const signOut = async () => { await supabase.auth.signOut(); window.location.href = "/admin/login"; };

  if (loading || !data) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary/40" /></div>;
  }

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="bg-card border-b border-border/60 px-8 py-4 flex items-center justify-between">
        <h1 className="text-lg font-display font-bold">Customer Service Dashboard</h1>
        <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="h-4 w-4 mr-1.5" /> Sign Out</Button>
      </header>

      <div className="p-8 grid gap-8 max-w-6xl mx-auto">
        <div className="grid gap-4 sm:grid-cols-4">
          <Card className="rounded-[24px] border-border/60 bg-card/95">
            <CardContent className="p-5 flex items-center gap-3">
              <Inbox className="h-7 w-7 text-primary opacity-70" />
              <div><p className="text-2xl font-bold">{data.open_tickets.length}</p><p className="text-sm text-muted-foreground">Open Tickets</p></div>
            </CardContent>
          </Card>
          <Card className="rounded-[24px] border-border/60 bg-red-50">
            <CardContent className="p-5 flex items-center gap-3">
              <AlertTriangle className="h-7 w-7 text-red-600 opacity-70" />
              <div><p className="text-2xl font-bold">{data.escalated_tickets.length}</p><p className="text-sm text-muted-foreground">Escalated</p></div>
            </CardContent>
          </Card>
          <Card className="rounded-[24px] border-border/60 bg-red-50">
            <CardContent className="p-5 flex items-center gap-3">
              <Frown className="h-7 w-7 text-red-600 opacity-70" />
              <div><p className="text-2xl font-bold">{data.pending_detractors.length}</p><p className="text-sm text-muted-foreground">Detractors</p></div>
            </CardContent>
          </Card>
          <Card className="rounded-[24px] border-border/60 bg-amber-50">
            <CardContent className="p-5 flex items-center gap-3">
              <CalendarClock className="h-7 w-7 text-amber-600 opacity-70" />
              <div><p className="text-2xl font-bold">{data.pending_reschedule_requests.length}</p><p className="text-sm text-muted-foreground">Reschedule Requests</p></div>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-[28px] border-border/60 bg-card/95 shadow-soft overflow-hidden">
          <CardHeader className="bg-muted/20 px-8 py-5 border-b border-border/40">
            <CardTitle className="text-base font-display font-bold flex items-center gap-2"><Search className="h-4 w-4" /> Customer Lookup</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="flex gap-2">
              <Input placeholder="Search by name or email…" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && runSearch()} />
              <Button onClick={runSearch} disabled={searching}>{searching ? "…" : "Search"}</Button>
            </div>
            {customers.length > 0 && (
              <Table>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Phone</TableHead></TableRow></TableHeader>
                <TableBody>
                  {customers.map((c) => (
                    <TableRow key={c.id}><TableCell className="text-sm">{c.name}</TableCell><TableCell className="text-sm">{c.email}</TableCell><TableCell className="text-sm">{c.phone || "—"}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-border/60 bg-card/95 shadow-soft overflow-hidden">
          <CardHeader className="bg-muted/20 px-8 py-5 border-b border-border/40">
            <CardTitle className="text-base font-display font-bold">Open &amp; Escalated Tickets</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Subject</TableHead><TableHead>Category</TableHead><TableHead>Priority</TableHead><TableHead>Status</TableHead><TableHead>Created</TableHead></TableRow></TableHeader>
              <TableBody>
                {[...data.escalated_tickets, ...data.open_tickets].length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No open or escalated tickets.</TableCell></TableRow>
                ) : [...data.escalated_tickets, ...data.open_tickets].map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-sm font-medium">{t.subject}</TableCell>
                    <TableCell className="text-sm text-muted-foreground capitalize">{t.category.replace(/_/g, " ")}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{t.priority}</Badge></TableCell>
                    <TableCell><Badge className={t.status === "escalated" ? "bg-red-100 text-red-800 border-none" : "bg-amber-100 text-amber-800 border-none"}>{t.status}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{new Date(t.created_at).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-border/60 bg-card/95 shadow-soft overflow-hidden">
          <CardHeader className="bg-muted/20 px-8 py-5 border-b border-border/40">
            <CardTitle className="text-base font-display font-bold">Pending Reschedule Requests</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Preferred Date</TableHead><TableHead>Window</TableHead><TableHead>Requested</TableHead></TableRow></TableHeader>
              <TableBody>
                {data.pending_reschedule_requests.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">No pending reschedule requests.</TableCell></TableRow>
                ) : data.pending_reschedule_requests.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm">{new Date(r.preferred_date).toLocaleDateString()}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.preferred_window_label}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-border/60 bg-card/95 shadow-soft overflow-hidden">
          <CardHeader className="bg-muted/20 px-8 py-5 border-b border-border/40">
            <CardTitle className="text-base font-display font-bold flex items-center gap-2"><History className="h-4 w-4" /> Recent Support Activity</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Subject</TableHead><TableHead>Status</TableHead><TableHead>Updated</TableHead></TableRow></TableHeader>
              <TableBody>
                {data.recent_activity.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">No recent activity.</TableCell></TableRow>
                ) : data.recent_activity.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="text-sm">{a.subject}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{a.status.replace(/_/g, " ")}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{new Date(a.updated_at).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CustomerServiceDashboard;
