import { useParams, useNavigate } from "react-router-dom";
import SectionHeading from "@/components/common/SectionHeading";
import { AdminOwnershipBadge } from "@/components/admin/AdminOwnershipBadge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft, Loader2, Mail, Phone, MapPin, Ruler, Calendar,
  User, Home, ClipboardList, CreditCard, Clock, AlertTriangle,
} from "lucide-react";
import { useAdminLeadDetail, type AdminLeadActivity } from "@/hooks/admin/useAdminLeads";

const STATUS_BADGE: Record<string, string> = {
  new: "bg-blue-100 text-blue-800",
  manual_review: "bg-amber-100 text-amber-800",
  scheduled: "bg-green-100 text-green-800",
};

const STATUS_LABEL: Record<string, string> = {
  new: "New",
  manual_review: "Manual Review",
  scheduled: "Scheduled",
};

const SOURCE_LABEL: Record<string, string> = {
  quote: "Quote",
  manual_review: "Manual Review",
  schedule_request: "Schedule Request",
};

const ACTIVITY_LABEL: Record<string, string> = {
  created: "Created",
  quote_requested: "Quote requested",
  manual_review: "Manual review",
  schedule_request_received: "Schedule request received",
  merged: "Merged",
};

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

// Fields that are redundant or too noisy to surface in a generic linked-record view.
const HIDDEN_LINKED_FIELDS = new Set([
  "id", "user_id", "profile_id", "property_id", "created_at", "updated_at",
]);

function formatFieldLabel(key: string): string {
  return key
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function LinkedEntityCard({
  title,
  icon: Icon,
  record,
}: {
  title: string;
  icon: React.ElementType;
  record: Record<string, unknown> | null;
}) {
  return (
    <Card className="rounded-2xl border-border/60 bg-card/95">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-bold">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {record ? (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
            {Object.entries(record)
              .filter(([key, value]) => !HIDDEN_LINKED_FIELDS.has(key) && value !== null && value !== undefined && value !== "")
              .map(([key, value]) => (
                <div key={key} className="contents">
                  <dt className="text-muted-foreground font-medium">{formatFieldLabel(key)}</dt>
                  <dd className="font-semibold text-foreground truncate">{formatFieldValue(value)}</dd>
                </div>
              ))}
          </dl>
        ) : (
          <p className="text-xs text-muted-foreground italic">Not linked</p>
        )}
      </CardContent>
    </Card>
  );
}

function ActivityRow({ activity }: { activity: AdminLeadActivity }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-card/80 p-4">
      <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="font-semibold text-foreground text-sm">
            {ACTIVITY_LABEL[activity.activity_type] ?? activity.activity_type}
          </p>
          <span className="text-xs text-muted-foreground">{formatDateTime(activity.created_at)}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 capitalize">{activity.actor}</p>
        {activity.payload && Object.keys(activity.payload).length > 0 && (
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            {Object.entries(activity.payload)
              .filter(([, value]) => value !== null && value !== undefined && value !== "")
              .map(([key, value]) => (
                <div key={key} className="contents">
                  <dt className="text-muted-foreground font-medium">{formatFieldLabel(key)}</dt>
                  <dd className="text-foreground truncate">{formatFieldValue(value)}</dd>
                </div>
              ))}
          </dl>
        )}
      </div>
    </div>
  );
}

const AdminLeadDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { detail, isLoading, error } = useAdminLeadDetail(id);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-24 justify-center">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Loading lead…</span>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="grid gap-6">
        <Button variant="ghost" size="sm" className="self-start rounded-xl" onClick={() => navigate("/admin/leads")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Lead Inbox
        </Button>
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {error ? `Failed to load lead: ${error}` : "Lead not found."}
        </div>
      </div>
    );
  }

  const { lead, activities, linked } = detail;

  return (
    <div className="grid gap-8">
      <Button variant="ghost" size="sm" className="self-start rounded-xl -ml-2" onClick={() => navigate("/admin/leads")}>
        <ArrowLeft className="h-4 w-4 mr-2" /> Back to Lead Inbox
      </Button>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <SectionHeading
          eyebrow="CRM"
          title={lead.name || lead.address || "Lead"}
          description={lead.address ? `${lead.address}${lead.zip ? `, ${lead.zip}` : ""}` : undefined}
        />
        <AdminOwnershipBadge kind="primary" />
      </div>

      {/* Lead summary */}
      <Card className="rounded-2xl border-border/60 bg-card/95">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 flex-wrap mb-4">
            <Badge variant="outline" className={`font-bold border-none ${STATUS_BADGE[lead.status] ?? "bg-muted text-foreground"}`}>
              {STATUS_LABEL[lead.status] ?? lead.status}
            </Badge>
            <Badge variant="secondary" className="font-bold border-none bg-muted text-foreground">
              {SOURCE_LABEL[lead.source] ?? lead.source}
            </Badge>
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 text-sm">
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <dt className="text-xs text-muted-foreground font-medium">Address</dt>
                <dd className="font-semibold">{lead.address || "—"}{lead.zip ? ` ${lead.zip}` : ""}</dd>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <User className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <dt className="text-xs text-muted-foreground font-medium">Name</dt>
                <dd className="font-semibold">{lead.name || "—"}</dd>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Mail className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <dt className="text-xs text-muted-foreground font-medium">Email</dt>
                <dd className="font-semibold">{lead.email || "—"}</dd>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Phone className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <dt className="text-xs text-muted-foreground font-medium">Phone</dt>
                <dd className="font-semibold">{lead.phone || "—"}</dd>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Ruler className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <dt className="text-xs text-muted-foreground font-medium">Acreage</dt>
                <dd className="font-semibold">{lead.acreage != null ? `${lead.acreage} ac` : "—"}</dd>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <ClipboardList className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <dt className="text-xs text-muted-foreground font-medium">Program / Cadence</dt>
                <dd className="font-semibold">{[lead.program, lead.cadence].filter(Boolean).join(" / ") || "—"}</dd>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <dt className="text-xs text-muted-foreground font-medium">First Seen</dt>
                <dd className="font-semibold">{formatDateTime(lead.first_seen_at)}</dd>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <dt className="text-xs text-muted-foreground font-medium">Last Seen</dt>
                <dd className="font-semibold">{formatDateTime(lead.last_seen_at)}</dd>
              </div>
            </div>
          </dl>

          {lead.manual_review_reason && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-bold text-amber-800 uppercase tracking-wide">Manual Review Reason</p>
                <p className="text-sm text-amber-900 mt-0.5">{lead.manual_review_reason}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Linked entities */}
      <div>
        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-3">Linked Records</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <LinkedEntityCard title="Profile" icon={User} record={linked.profile} />
          <LinkedEntityCard title="Property" icon={Home} record={linked.property} />
          <LinkedEntityCard title="Schedule Request" icon={ClipboardList} record={linked.scheduleRequest} />
          <LinkedEntityCard title="Subscription" icon={CreditCard} record={linked.subscription} />
        </div>
      </div>

      {/* Activity timeline */}
      <div>
        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-3">Activity Timeline</h3>
        {activities.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No activity recorded yet.</p>
        ) : (
          <div className="space-y-3">
            {activities.map((activity) => (
              <ActivityRow key={activity.id} activity={activity} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminLeadDetailPage;
