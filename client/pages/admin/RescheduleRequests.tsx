import { useEffect, useState } from "react";
import SectionHeading from "@/components/common/SectionHeading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2, CalendarDays, Check, X } from "lucide-react";
import { adminApi } from "@/lib/adminApi";
import { useToast } from "@/hooks/use-toast";

interface RescheduleRequest {
  id: string;
  appointment_id: string;
  customer_id: string;
  current_scheduled_date: string | null;
  preferred_date: string;
  preferred_window_label: string;
  reason: string | null;
  status: "pending" | "approved" | "denied";
  admin_notes: string | null;
  created_at: string;
}

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-green-100 text-green-800",
  denied: "bg-gray-100 text-gray-600",
};

const RescheduleRequests = () => {
  const { toast } = useToast();
  const [requests, setRequests] = useState<RescheduleRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [approveTarget, setApproveTarget] = useState<RescheduleRequest | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const data = await adminApi("/api/admin/reschedule-requests");
      setRequests(data.requests || []);
    } catch (err: any) {
      toast({ title: "Load failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const deny = async (request: RescheduleRequest) => {
    try {
      const res = await adminApi(`/api/admin/reschedule-requests/${request.id}/deny`, "POST", {});
      setRequests((r) => r.map((x) => (x.id === request.id ? res.request : x)));
      toast({ title: "Request denied" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const pending = requests.filter((r) => r.status === "pending");
  const reviewed = requests.filter((r) => r.status !== "pending");

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary/40" /></div>;
  }

  return (
    <div className="grid gap-8">
      <SectionHeading
        eyebrow="Scheduling"
        title="Reschedule Requests"
        description="Customer-requested date changes that need approval. The existing instant self-service reschedule on the dashboard is unaffected — this is the queue for requests customers ask you to review."
      />

      <Card className="rounded-[28px] border-border/60 bg-card/95 shadow-soft overflow-hidden">
        <CardHeader className="bg-muted/20 px-8 py-5 border-b border-border/40">
          <CardTitle className="text-base font-display font-bold flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" /> Pending ({pending.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Current Date</TableHead>
                <TableHead>Preferred</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead className="text-right">Review</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pending.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No pending reschedule requests.</TableCell></TableRow>
              ) : pending.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-sm">{r.current_scheduled_date ? new Date(r.current_scheduled_date).toLocaleDateString() : "—"}</TableCell>
                  <TableCell className="text-sm font-medium">{new Date(r.preferred_date).toLocaleDateString()} — {r.preferred_window_label}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[220px] truncate" title={r.reason || ""}>{r.reason || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button size="sm" variant="outline" className="rounded-lg border-green-300 text-green-700" onClick={() => setApproveTarget(r)}>
                      <Check className="h-3.5 w-3.5 mr-1" /> Approve
                    </Button>
                    <Button size="sm" variant="outline" className="rounded-lg border-red-300 text-red-700" onClick={() => deny(r)}>
                      <X className="h-3.5 w-3.5 mr-1" /> Deny
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {reviewed.length > 0 && (
        <Card className="rounded-[28px] border-border/60 bg-card/95 shadow-soft overflow-hidden">
          <CardHeader className="bg-muted/20 px-8 py-5 border-b border-border/40">
            <CardTitle className="text-base font-display font-bold">Reviewed</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Preferred</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reviewed.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm">{new Date(r.preferred_date).toLocaleDateString()} — {r.preferred_window_label}</TableCell>
                    <TableCell><Badge className={STATUS_BADGE[r.status]}>{r.status}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.admin_notes || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {approveTarget && (
        <ApproveDialog
          request={approveTarget}
          onClose={() => setApproveTarget(null)}
          onApproved={(updated) => {
            setRequests((r) => r.map((x) => (x.id === updated.id ? updated : x)));
            setApproveTarget(null);
          }}
        />
      )}
    </div>
  );
};

const ApproveDialog = ({ request, onClose, onApproved }: { request: RescheduleRequest; onClose: () => void; onApproved: (r: RescheduleRequest) => void }) => {
  const { toast } = useToast();
  const [scheduledDate, setScheduledDate] = useState(request.preferred_date);
  const [windowId, setWindowId] = useState("morning");
  const [windowLabel, setWindowLabel] = useState(request.preferred_window_label);
  const [windowStart, setWindowStart] = useState("08:00");
  const [adminNotes, setAdminNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const handleApprove = async () => {
    setSaving(true);
    try {
      const res = await adminApi(`/api/admin/reschedule-requests/${request.id}/approve`, "POST", {
        scheduledDate, windowId, windowLabel, windowStart, adminNotes: adminNotes || undefined,
      });
      toast({ title: "Reschedule approved", description: "Customer has been notified by email." });
      onApproved(res.request);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Approve Reschedule</DialogTitle>
          <DialogDescription>Sets the appointment's new date/window and emails the customer.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label>Scheduled Date</Label><Input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Window</Label>
              <select
                className="w-full h-10 rounded-xl border border-border/60 bg-background px-3 text-sm"
                value={windowId}
                onChange={(e) => {
                  const v = e.target.value;
                  setWindowId(v);
                  setWindowLabel(v === "morning" ? "Morning (8AM–12PM)" : "Afternoon (12PM–4PM)");
                  setWindowStart(v === "morning" ? "08:00" : "12:00");
                }}
              >
                <option value="morning">Morning (8AM–12PM)</option>
                <option value="afternoon">Afternoon (12PM–4PM)</option>
              </select>
            </div>
            <div><Label>Window Start</Label><Input type="time" value={windowStart} onChange={(e) => setWindowStart(e.target.value)} /></div>
          </div>
          <div><Label>Admin Notes (optional)</Label><Input value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleApprove} disabled={saving} className="shadow-brand">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Approve & Notify
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RescheduleRequests;
