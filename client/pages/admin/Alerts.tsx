import { useState } from "react";
import { useAdminAlerts, acknowledgeAlert, resolveAlert } from "@/hooks/admin/useAdminAlerts";
import type { AdminAlert } from "@/hooks/admin/useAdminAlerts";
import { Button } from "@/components/ui/button";
import SectionHeading from "@/components/common/SectionHeading";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

type SeverityFilter = "all" | "critical" | "warning" | "info";

function relativeTime(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  } catch {
    return iso;
  }
}

const SEVERITY_BADGE: Record<string, string> = {
  info:     "bg-blue-100 text-blue-800",
  warning:  "bg-amber-100 text-amber-800",
  critical: "bg-red-100 text-red-800",
};

interface AlertRowProps {
  alert: AdminAlert;
  onAck: (id: string) => void;
  onResolve: (id: string) => void;
}

function AlertRow({ alert, onAck, onResolve }: AlertRowProps) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-card/80 p-4">
      <span className={`mt-0.5 shrink-0 inline-flex items-center rounded px-2 py-0.5 text-xs font-bold uppercase ${SEVERITY_BADGE[alert.severity] ?? "bg-muted text-foreground"}`}>
        {alert.severity}
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-foreground text-sm">{alert.title}</p>
        {alert.body && (
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{alert.body}</p>
        )}
        <div className="flex items-center gap-3 mt-1.5 flex-wrap text-xs text-muted-foreground">
          <span>{relativeTime(alert.created_at)}</span>
          {alert.entity_type && <span className="capitalize">{alert.entity_type}{alert.entity_id ? `: ${alert.entity_id.slice(0, 8)}…` : ""}</span>}
          {alert.acknowledged_at && <span className="text-green-600">Acknowledged {relativeTime(alert.acknowledged_at)}</span>}
          {alert.notified_email && <span>Email sent</span>}
          {alert.notified_sms && <span>SMS sent</span>}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {!alert.acknowledged_at && (
          <Button size="sm" variant="outline" onClick={() => onAck(alert.id)} className="h-8 text-xs">
            Ack
          </Button>
        )}
        {!alert.resolved_at && (
          <Button size="sm" variant="outline" onClick={() => onResolve(alert.id)} className="h-8 text-xs text-green-700 border-green-300 hover:bg-green-50">
            Resolve
          </Button>
        )}
      </div>
    </div>
  );
}

const AdminAlertsPage = () => {
  const [filter, setFilter] = useState<SeverityFilter>("all");
  const [showResolved, setShowResolved] = useState(false);

  const { alerts, isLoading, error, refetch } = useAdminAlerts({
    severity: filter === "all" ? undefined : filter,
    limit: 200,
    unresolvedOnly: !showResolved,
  });

  const { alerts: resolvedAlerts, isLoading: resolvedLoading, refetch: refetchResolved } = useAdminAlerts({
    limit: 50,
    unresolvedOnly: false,
    enabled: showResolved,
  });

  // For the resolved section we only want resolved ones
  const resolvedOnly = resolvedAlerts.filter((a) => !!a.resolved_at);

  const handleAck = async (id: string) => {
    await acknowledgeAlert(id);
    void refetch();
  };

  const handleResolve = async (id: string) => {
    await resolveAlert(id);
    void refetch();
    if (showResolved) void refetchResolved();
  };

  const TABS: { label: string; value: SeverityFilter }[] = [
    { label: "All", value: "all" },
    { label: "Critical", value: "critical" },
    { label: "Warning", value: "warning" },
    { label: "Info", value: "info" },
  ];

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Admin"
        title="Alerts"
        description="Unresolved operational alerts. Acknowledge when seen, resolve when addressed."
      />

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setFilter(tab.value)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
              filter === tab.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Unresolved alerts */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading alerts…</span>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          Failed to load alerts: {error}
        </div>
      ) : alerts.length === 0 ? (
        <div className="rounded-xl border border-border/60 bg-card/80 p-8 text-center text-muted-foreground">
          <CheckCircle className="h-8 w-8 mx-auto mb-3 text-green-500" />
          <p className="font-semibold text-foreground">No unresolved alerts</p>
          <p className="text-sm mt-1">All clear — the system is operating normally.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <AlertRow key={alert.id} alert={alert} onAck={handleAck} onResolve={handleResolve} />
          ))}
        </div>
      )}

      {/* Resolved section */}
      <div>
        <button
          type="button"
          className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setShowResolved(!showResolved)}
        >
          <XCircle className="h-4 w-4" />
          {showResolved ? "Hide" : "Show"} resolved alerts
        </button>

        {showResolved && (
          <div className="mt-4 space-y-3">
            {resolvedLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Loading…</span>
              </div>
            ) : resolvedOnly.length === 0 ? (
              <p className="text-sm text-muted-foreground">No resolved alerts yet.</p>
            ) : (
              resolvedOnly.map((alert) => (
                <div key={alert.id} className="flex items-start gap-3 rounded-xl border border-border/40 bg-muted/30 p-4 opacity-70">
                  <span className={`mt-0.5 shrink-0 inline-flex items-center rounded px-2 py-0.5 text-xs font-bold uppercase ${SEVERITY_BADGE[alert.severity] ?? "bg-muted text-foreground"}`}>
                    {alert.severity}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground text-sm line-through">{alert.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Resolved {alert.resolved_at ? relativeTime(alert.resolved_at) : ""}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminAlertsPage;
