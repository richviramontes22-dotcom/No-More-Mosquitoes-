import { useEffect, useState } from "react";
import SectionHeading from "@/components/common/SectionHeading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Bell, CheckCircle2, XCircle, Clock, Mail, AlertCircle, RotateCcw } from "lucide-react";
import { adminApi } from "@/lib/adminApi";

interface NotificationRow {
  id: string;
  appointment_id: string | null;
  recipient_email: string | null;
  channel: string;
  notification_type: string;
  subject: string | null;
  status: "pending" | "sent" | "failed" | "skipped";
  provider: string | null;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
}

const STATUS_STYLES: Record<string, string> = {
  sent:    "bg-green-100 text-green-700",
  failed:  "bg-red-100 text-red-700",
  pending: "bg-amber-100 text-amber-700",
  skipped: "bg-gray-100 text-gray-600",
};

const TYPE_LABELS: Record<string, string> = {
  appointment_confirmation:  "Confirmation",
  reminder_24h:              "24h Reminder",
  reminder_same_day:         "Same-Day Reminder",
  appointment_canceled:      "Cancellation",
  appointment_rescheduled:   "Rescheduled",
  technician_enroute:        "Technician En Route",
};

const Notifications = () => {
  const [rows, setRows]         = useState<NotificationRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter]     = useState<string>("all");

  const fetchLogs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await adminApi("/api/admin/notifications");
      setRows(data.notifications || []);
    } catch (err: any) {
      setError(err.message || "Failed to load notification log");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchLogs(); }, []);

  const visible = rows.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (typeFilter   !== "all" && r.notification_type !== typeFilter) return false;
    return true;
  });

  const failedCount  = rows.filter((r) => r.status === "failed").length;
  const sentCount    = rows.filter((r) => r.status === "sent").length;
  const pendingCount = rows.filter((r) => r.status === "pending").length;

  return (
    <div className="grid gap-8">
      <SectionHeading eyebrow="Communications" title="Notification Log" description="Track all outbound emails and future SMS notifications. Useful for diagnosing delivery failures." />

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Sent",    count: sentCount,    icon: CheckCircle2, color: "text-green-600",  bg: "bg-green-50"  },
          { label: "Failed",  count: failedCount,  icon: XCircle,      color: "text-red-600",    bg: "bg-red-50"    },
          { label: "Pending", count: pendingCount, icon: Clock,        color: "text-amber-600",  bg: "bg-amber-50"  },
        ].map(({ label, count, icon: Icon, color, bg }) => (
          <Card key={label} className={`rounded-[24px] border-border/60 ${bg}`}>
            <CardContent className="p-5 flex items-center gap-4">
              <Icon className={`h-8 w-8 ${color} opacity-70`} />
              <div>
                <p className="text-2xl font-bold">{count}</p>
                <p className="text-sm text-muted-foreground font-medium">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="rounded-[28px] border-border/60 bg-card/95 shadow-soft overflow-hidden">
        <CardContent className="p-5 flex flex-wrap items-center gap-4">
          <select
            className="h-10 rounded-xl border border-border/60 bg-background px-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="sent">Sent</option>
            <option value="failed">Failed</option>
            <option value="pending">Pending</option>
            <option value="skipped">Skipped</option>
          </select>
          <select
            className="h-10 rounded-xl border border-border/60 bg-background px-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="all">All Types</option>
            {Object.entries(TYPE_LABELS).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
          </select>
          <Button variant="outline" size="sm" className="rounded-xl h-10" onClick={fetchLogs}>
            <RotateCcw className="h-4 w-4 mr-1.5" /> Refresh
          </Button>
          <span className="text-xs text-muted-foreground font-medium ml-auto">{visible.length} of {rows.length} entries</span>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="rounded-[32px] border-border/60 bg-card/95 shadow-soft overflow-hidden">
        <CardHeader className="bg-muted/20 px-8 py-5 border-b border-border/40">
          <CardTitle className="text-base font-display font-bold flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" /> Recent Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {error && (
            <div className="flex items-center gap-3 px-8 py-4 bg-red-50 border-b border-red-200">
              <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
              <p className="text-sm text-red-800 font-medium">{error}</p>
              <Button variant="outline" size="sm" className="ml-auto rounded-xl" onClick={fetchLogs}>Retry</Button>
            </div>
          )}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/40" />
            </div>
          ) : visible.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground italic">
              {rows.length === 0 ? "No notifications logged yet. They'll appear here after the first appointment confirmation is sent." : "No notifications match the current filters."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-sm">
                <thead>
                  <tr className="bg-muted/30 border-b border-border/40">
                    {["Sent At", "Type", "Channel", "Recipient", "Status", "Error"].map((h) => (
                      <th key={h} className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {visible.slice(0, 100).map((row) => (
                    <tr key={row.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-6 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {row.sent_at
                          ? new Date(row.sent_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                          : new Date(row.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-6 py-3 text-xs font-medium whitespace-nowrap">{TYPE_LABELS[row.notification_type] || row.notification_type}</td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Mail className="h-3.5 w-3.5" /> {row.channel}
                        </div>
                      </td>
                      <td className="px-6 py-3 text-xs text-muted-foreground truncate max-w-[180px]">{row.recipient_email || "—"}</td>
                      <td className="px-6 py-3">
                        <Badge variant="outline" className={`text-[10px] font-bold border-none capitalize ${STATUS_STYLES[row.status] || ""}`}>
                          {row.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-3 text-xs text-red-600 max-w-[200px] truncate" title={row.error_message || ""}>
                        {row.error_message || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {visible.length > 100 && (
                <p className="px-6 py-3 text-xs text-muted-foreground italic border-t border-border/40">Showing first 100 of {visible.length} entries. Use filters to narrow results.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Notifications;
