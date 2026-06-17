import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import SectionHeading from "@/components/common/SectionHeading";
import { AdminOwnershipBadge } from "@/components/admin/AdminOwnershipBadge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft, Loader2, Mail, Phone, MapPin, Ruler, Calendar,
  User, Home, ClipboardList, CreditCard, Clock, AlertTriangle,
  StickyNote, ChevronDown, UserPlus, CalendarClock, Gift, Check, X as XIcon,
} from "lucide-react";
import {
  useAdminLeadDetail,
  useAdminLeadStaff,
  patchLeadStatus,
  postLeadNote,
  assignLeadTo,
  postLeadFollowUp,
  patchFollowUpStatus,
  type AdminLeadActivity,
  type AdminLeadNote,
  type AdminLeadFollowUp,
} from "@/hooks/admin/useAdminLeads";

const VALID_STATUSES = [
  { value: "new", label: "New" },
  { value: "out_of_area", label: "Out of Area" },
  { value: "contacted", label: "Contacted" },
  { value: "quoted", label: "Quoted" },
  { value: "manual_review", label: "Manual Review" },
  { value: "scheduled", label: "Scheduled" },
  { value: "lost", label: "Lost" },
];

const STATUS_BADGE: Record<string, string> = {
  new: "bg-blue-100 text-blue-800",
  manual_review: "bg-amber-100 text-amber-800",
  scheduled: "bg-green-100 text-green-800",
  out_of_area: "bg-slate-100 text-slate-700",
  contacted: "bg-indigo-100 text-indigo-800",
  quoted: "bg-violet-100 text-violet-800",
  lost: "bg-red-100 text-red-700",
};

const STATUS_LABEL: Record<string, string> = {
  new: "New",
  manual_review: "Manual Review",
  scheduled: "Scheduled",
  out_of_area: "Out of Area",
  contacted: "Contacted",
  quoted: "Quoted",
  lost: "Lost",
};

const SOURCE_LABEL: Record<string, string> = {
  quote: "Quote",
  manual_review: "Manual Review",
  schedule_request: "Schedule Request",
  waitlist: "Waitlist",
};

const ACTIVITY_LABEL: Record<string, string> = {
  created: "Created",
  quote_requested: "Quote requested",
  manual_review: "Manual review",
  schedule_request_received: "Schedule request received",
  merged: "Merged",
  status_changed: "Status changed",
  note_added: "Note added",
  lead_assigned: "Assigned",
  followup_created: "Follow-up scheduled",
  followup_completed: "Follow-up completed",
  followup_skipped: "Follow-up skipped",
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

function formatRelative(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
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

function NoteCard({ note }: { note: AdminLeadNote }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/80 p-4">
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Admin note</span>
        <span className="text-xs text-muted-foreground" title={note.created_at}>{formatRelative(note.created_at)}</span>
      </div>
      <p className="text-sm text-foreground whitespace-pre-wrap">{note.body}</p>
    </div>
  );
}

const AdminLeadDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { detail, isLoading, error, refetch } = useAdminLeadDetail(id);
  const { staff } = useAdminLeadStaff();

  // Status editor state
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [lostReason, setLostReason] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Note composer state
  const [noteBody, setNoteBody] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  // Assignment state
  const [savingAssign, setSavingAssign] = useState(false);

  // Follow-up composer state
  const [followUpDueAt, setFollowUpDueAt] = useState("");
  const [followUpAssignee, setFollowUpAssignee] = useState("");
  const [followUpNotes, setFollowUpNotes] = useState("");
  const [savingFollowUp, setSavingFollowUp] = useState(false);
  const [followUpError, setFollowUpError] = useState<string | null>(null);
  const [updatingFollowUpId, setUpdatingFollowUpId] = useState<string | null>(null);

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

  const { lead, activities, notes, followups, linked } = detail;

  const currentStatus = selectedStatus || lead.status;
  const staffById: Record<string, string> = {};
  staff.forEach((s) => { staffById[s.id] = s.name || s.email; });

  async function handleSaveStatus() {
    if (!id || !selectedStatus || selectedStatus === lead.status) return;
    if (selectedStatus === "lost" && !lostReason.trim()) {
      setStatusError("Lost reason is required.");
      return;
    }
    setSavingStatus(true);
    setStatusError(null);
    try {
      await patchLeadStatus(id, selectedStatus, selectedStatus === "lost" ? lostReason : undefined);
      await refetch();
      setSelectedStatus("");
      setLostReason("");
    } catch (err: any) {
      setStatusError(err.message ?? "Failed to save status.");
    } finally {
      setSavingStatus(false);
    }
  }

  async function handleAddNote() {
    if (!id || !noteBody.trim()) return;
    setSavingNote(true);
    setNoteError(null);
    try {
      await postLeadNote(id, noteBody);
      setNoteBody("");
      await refetch();
    } catch (err: any) {
      setNoteError(err.message ?? "Failed to add note.");
    } finally {
      setSavingNote(false);
    }
  }

  const statusChanged = selectedStatus && selectedStatus !== lead.status;

  async function handleAssign(assignedTo: string) {
    if (!id || !assignedTo) return;
    setSavingAssign(true);
    try {
      await assignLeadTo(id, assignedTo);
      await refetch();
    } catch (err: any) {
      console.error("Failed to assign lead:", err.message);
    } finally {
      setSavingAssign(false);
    }
  }

  async function handleCreateFollowUp() {
    if (!id || !followUpDueAt) {
      setFollowUpError("Due date is required.");
      return;
    }
    setSavingFollowUp(true);
    setFollowUpError(null);
    try {
      await postLeadFollowUp(id, {
        dueAt: new Date(followUpDueAt).toISOString(),
        assignedTo: followUpAssignee || undefined,
        notes: followUpNotes || undefined,
      });
      setFollowUpDueAt("");
      setFollowUpAssignee("");
      setFollowUpNotes("");
      await refetch();
    } catch (err: any) {
      setFollowUpError(err.message ?? "Failed to create follow-up.");
    } finally {
      setSavingFollowUp(false);
    }
  }

  async function handleFollowUpStatus(followUpId: string, status: "completed" | "skipped") {
    setUpdatingFollowUpId(followUpId);
    try {
      await patchFollowUpStatus(followUpId, status);
      await refetch();
    } catch (err: any) {
      console.error("Failed to update follow-up:", err.message);
    } finally {
      setUpdatingFollowUpId(null);
    }
  }

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
            {lead.assigned_to && (
              <Badge variant="outline" className="font-bold border-none bg-sky-100 text-sky-800 flex items-center gap-1">
                <UserPlus className="h-3 w-3" />
                {staffById[lead.assigned_to] ?? "Assigned"}
              </Badge>
            )}
            {linked.referral && (
              <Badge variant="outline" className="font-bold border-none bg-violet-100 text-violet-800 flex items-center gap-1">
                <Gift className="h-3 w-3" />
                Referred via {linked.referral.code}
                {linked.referral.owner_type === "partner" && linked.referral.partner_name ? ` (${linked.referral.partner_name})` : ""}
              </Badge>
            )}
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

          {lead.out_of_area_reason && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <MapPin className="h-4 w-4 text-slate-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Out of Area</p>
                <p className="text-sm text-slate-700 mt-0.5">{lead.out_of_area_reason}</p>
              </div>
            </div>
          )}

          {lead.lost_reason && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3">
              <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-bold text-red-700 uppercase tracking-wide">Lost Reason</p>
                <p className="text-sm text-red-800 mt-0.5">{lead.lost_reason}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Status editor */}
      <Card className="rounded-2xl border-border/60 bg-card/95">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-bold">
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
            Update Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Status</label>
              <select
                className="h-10 w-full rounded-xl border border-border/60 bg-background px-4 text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none"
                value={currentStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value);
                  if (e.target.value !== "lost") setLostReason("");
                  setStatusError(null);
                }}
              >
                {VALID_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            {statusChanged && (
              <Button
                className="rounded-xl h-10 shrink-0"
                onClick={handleSaveStatus}
                disabled={savingStatus}
              >
                {savingStatus ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save Status
              </Button>
            )}
          </div>
          {currentStatus === "lost" && (
            <div className="mt-3">
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Lost Reason <span className="text-destructive">*</span>
              </label>
              <Input
                placeholder="Why is this lead lost? (required)"
                value={lostReason}
                onChange={(e) => { setLostReason(e.target.value); setStatusError(null); }}
                className="rounded-xl border-border/60"
              />
            </div>
          )}
          {statusError && (
            <p className="text-xs text-destructive mt-2">{statusError}</p>
          )}
        </CardContent>
      </Card>

      {/* Assignment */}
      <Card className="rounded-2xl border-border/60 bg-card/95">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-bold">
            <UserPlus className="h-4 w-4 text-muted-foreground" />
            Assign Lead
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Assigned to</label>
              <select
                className="h-10 w-full rounded-xl border border-border/60 bg-background px-4 text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none"
                value={lead.assigned_to ?? ""}
                disabled={savingAssign}
                onChange={(e) => handleAssign(e.target.value)}
              >
                <option value="">Unassigned</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>{s.name || s.email}</option>
                ))}
              </select>
            </div>
            {savingAssign && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
        </CardContent>
      </Card>

      {/* Follow-ups */}
      <div>
        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
          <CalendarClock className="h-3.5 w-3.5" />
          Follow-ups {followups.length > 0 && <span className="font-normal normal-case tracking-normal">({followups.length})</span>}
        </h3>

        <div className="space-y-3 mb-4">
          {followups.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No follow-ups scheduled.</p>
          ) : (
            followups.map((f: AdminLeadFollowUp) => (
              <div key={f.id} className="flex items-start justify-between gap-3 rounded-xl border border-border/60 bg-card/80 p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-bold uppercase tracking-wide ${
                      f.status === "completed" ? "text-green-700" : f.status === "skipped" ? "text-muted-foreground" : "text-amber-700"
                    }`}>
                      {f.status}
                    </span>
                    <span className="text-xs text-muted-foreground">Due {formatDateTime(f.due_at)}</span>
                    {f.assigned_to && (
                      <span className="text-xs text-muted-foreground">· {staffById[f.assigned_to] ?? "Assigned"}</span>
                    )}
                  </div>
                  {f.notes && <p className="text-sm text-foreground mt-1 whitespace-pre-wrap">{f.notes}</p>}
                </div>
                {f.status === "pending" && (
                  <div className="flex gap-1.5 shrink-0">
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-7 w-7 rounded-lg text-green-700 hover:bg-green-50"
                      disabled={updatingFollowUpId === f.id}
                      onClick={() => handleFollowUpStatus(f.id, "completed")}
                      title="Mark completed"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-7 w-7 rounded-lg text-muted-foreground"
                      disabled={updatingFollowUpId === f.id}
                      onClick={() => handleFollowUpStatus(f.id, "skipped")}
                      title="Skip"
                    >
                      <XIcon className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="rounded-2xl border border-border/60 bg-card/95 p-4 flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Due date *</label>
              <Input
                type="datetime-local"
                value={followUpDueAt}
                onChange={(e) => { setFollowUpDueAt(e.target.value); setFollowUpError(null); }}
                className="rounded-xl border-border/60"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Assign to (optional)</label>
              <select
                className="h-10 w-full rounded-xl border border-border/60 bg-background px-4 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                value={followUpAssignee}
                onChange={(e) => setFollowUpAssignee(e.target.value)}
              >
                <option value="">Unassigned</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>{s.name || s.email}</option>
                ))}
              </select>
            </div>
          </div>
          <Textarea
            placeholder="What needs to happen? (optional)"
            value={followUpNotes}
            onChange={(e) => setFollowUpNotes(e.target.value)}
            className="rounded-xl border-border/60 resize-none min-h-[60px] text-sm"
          />
          {followUpError && <p className="text-xs text-destructive">{followUpError}</p>}
          <Button
            className="self-end rounded-xl h-9 text-sm"
            disabled={!followUpDueAt || savingFollowUp}
            onClick={handleCreateFollowUp}
          >
            {savingFollowUp ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Schedule Follow-up
          </Button>
        </div>
      </div>

      {/* Notes section */}
      <div>
        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
          <StickyNote className="h-3.5 w-3.5" />
          Staff Notes {notes.length > 0 && <span className="font-normal normal-case tracking-normal">({notes.length})</span>}
        </h3>

        <div className="space-y-3 mb-4">
          {notes.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No notes yet.</p>
          ) : (
            notes.map((note) => <NoteCard key={note.id} note={note} />)
          )}
        </div>

        <div className="rounded-2xl border border-border/60 bg-card/95 p-4 flex flex-col gap-3">
          <Textarea
            placeholder="Add a note about this lead…"
            value={noteBody}
            onChange={(e) => { setNoteBody(e.target.value); setNoteError(null); }}
            className="rounded-xl border-border/60 resize-none min-h-[80px] text-sm"
          />
          {noteError && <p className="text-xs text-destructive">{noteError}</p>}
          <Button
            className="self-end rounded-xl h-9 text-sm"
            disabled={!noteBody.trim() || savingNote}
            onClick={handleAddNote}
          >
            {savingNote ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Add Note
          </Button>
        </div>
      </div>

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
