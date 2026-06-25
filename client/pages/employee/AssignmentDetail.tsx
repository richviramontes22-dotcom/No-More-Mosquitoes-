import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import SectionHeading from "@/components/common/SectionHeading";
import MiniMap from "@/components/employee/MiniMap";
import { navUrl } from "@/lib/employee/deepLinks";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Phone, MapPin, Camera, Video, X, Navigation, Ban, WifiOff } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useEmployee } from "@/hooks/employee/useEmployee";
import { useToast } from "@/hooks/use-toast";
import { cacheAssignmentDetail, getCachedAssignmentDetail } from "@/lib/employee/offlineCache";
import { useActionQueue } from "@/hooks/employee/useActionQueue";
import type { SyncResult } from "@/lib/employee/actionQueue";

const JOB_MEDIA_BUCKET = "job-media";

interface AssignmentDetail {
  id: string;
  status: string;
  en_route_at: string | null;
  arrived_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  address: string | null;
  city: string | null;
  zip: string | null;
  lat: number | null;
  lng: number | null;
  service_type: string | null;
  notes: string | null;
  technician_notes: string | null;
  appointment_id: string | null;
}

interface Message {
  id: string;
  body: string;
  direction: string;
  created_at: string;
}

interface JobMedia {
  id: string;
  url: string;
  media_type: "photo" | "video" | "doc";
  caption: string | null;
  created_at: string;
}

const CHECKLIST_LABELS = [
  "PPE on",
  "Pets accounted for",
  "Hazards cleared",
  "Products loaded",
  "Customer notified",
  "Safety zones marked",
];

async function capturePosition(): Promise<{ latitude: number; longitude: number; accuracy: number } | null> {
  if (!navigator.geolocation) return null;
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      () => resolve(null),
      { timeout: 6000, enableHighAccuracy: true }
    );
  });
}

const AssignmentDetail = () => {
  const { id = "" } = useParams();
  const { data: employee } = useEmployee();
  const { toast } = useToast();
  const [assignment, setAssignment] = useState<AssignmentDetail | null>(null);
  const [isFromCache, setIsFromCache] = useState(false);
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [media, setMedia] = useState<JobMedia[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [checklist, setChecklist] = useState<boolean[]>(CHECKLIST_LABELS.map(() => false));
  const [checklistSaving, setChecklistSaving] = useState(false);
  const [blockingForms, setBlockingForms] = useState<string[] | null>(null);
  const [showBlockedForm, setShowBlockedForm] = useState(false);
  const [blockedReason, setBlockedReason] = useState("");
  const [treatmentNotes, setTreatmentNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  const handleSyncResult = (result: SyncResult) => {
    if (result.succeeded.length > 0) {
      toast({ title: `Synced ${result.succeeded.length} update${result.succeeded.length > 1 ? "s" : ""}`, description: "Queued changes are now saved." });
    }
    for (const { error } of result.failed) {
      toast({ title: "A queued update was rejected", description: error, variant: "destructive" });
    }
  };
  const { pendingCount, enqueue: enqueueQueuedAction } = useActionQueue(employee?.id, handleSyncResult);

  // Sync the notes textarea once per assignment load — does not re-sync on
  // every partial update from updateStatus(), so it never clobbers
  // in-progress typing.
  useEffect(() => {
    if (assignment) setTreatmentNotes(assignment.technician_notes || "");
  }, [assignment?.id]);

  const loadAssignment = async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      // Check authorization + blocking forms via API first
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (token) {
        const authCheck = await fetch(`/api/employee/assignments/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (authCheck.status === 403) {
          const body = await authCheck.json().catch(() => ({}));
          if (body.blocking_forms) {
            setBlockingForms(body.blocking_forms);
            setIsLoading(false);
            return;
          }
        }
      }

      const { data: row, error } = await supabase
        .from("assignments")
        .select("id, status, en_route_at, arrived_at, started_at, completed_at, appointment_id, technician_notes")
        .eq("id", id)
        .single();

      if (error || !row) {
        // Network failure (or any other fetch error): fall back to the
        // last cached copy of this exact assignment rather than leaving
        // the page blank — this is a job a technician may well be
        // standing at right now with no signal.
        if (employee?.id) {
          const cached = getCachedAssignmentDetail<AssignmentDetail>(employee.id, id);
          if (cached) {
            setAssignment(cached.data);
            setIsFromCache(true);
          }
        }
        return;
      }

      const apptId = row.appointment_id;
      if (!apptId) {
        const minimal: AssignmentDetail = { id: row.id, status: row.status, en_route_at: row.en_route_at ?? null, arrived_at: row.arrived_at ?? null, started_at: row.started_at ?? null, completed_at: row.completed_at ?? null, customer_name: null, customer_phone: null, address: null, city: null, zip: null, lat: null, lng: null, service_type: null, notes: null, technician_notes: row.technician_notes ?? null, appointment_id: null };
        setAssignment(minimal);
        setIsFromCache(false);
        if (employee?.id) cacheAssignmentDetail(employee.id, id, minimal);
        return;
      }

      const { data: appt } = await supabase
        .from("appointments")
        .select("user_id, property_id, service_type, notes")
        .eq("id", apptId)
        .single();

      const [profileRes, propRes] = await Promise.all([
        appt?.user_id ? supabase.from("profiles").select("name, phone").eq("id", appt.user_id).single() : Promise.resolve({ data: null }),
        appt?.property_id ? supabase.from("properties").select("address, city, zip, lat, lng").eq("id", appt.property_id).single() : Promise.resolve({ data: null }),
      ]);

      const full: AssignmentDetail = {
        id: row.id,
        status: row.status,
        en_route_at:    row.en_route_at ?? null,
        arrived_at:     row.arrived_at ?? null,
        started_at:     row.started_at ?? null,
        completed_at:   row.completed_at ?? null,
        appointment_id: apptId,
        customer_name: profileRes.data?.name ?? null,
        customer_phone: profileRes.data?.phone ?? null,
        address: propRes.data?.address ?? null,
        city: propRes.data?.city ?? null,
        zip: propRes.data?.zip ?? null,
        lat: typeof propRes.data?.lat === "number" ? propRes.data.lat : null,
        lng: typeof propRes.data?.lng === "number" ? propRes.data.lng : null,
        service_type: appt?.service_type ?? null,
        notes: appt?.notes ?? null,
        technician_notes: row.technician_notes ?? null,
      };
      setAssignment(full);
      setIsFromCache(false);
      // Own data only (employee.id), keyed by this specific assignment.
      if (employee?.id) cacheAssignmentDetail(employee.id, id, full);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMessages = async () => {
    if (!id) return;
    const { data: thread } = await supabase
      .from("message_threads")
      .select("id")
      .eq("assignment_id", id)
      .maybeSingle();

    if (!thread) return;

    const { data: messages } = await supabase
      .from("messages")
      .select("id, body, direction, created_at")
      .eq("thread_id", thread.id)
      .order("created_at", { ascending: true });

    setMsgs((messages as Message[]) || []);
  };

  const loadMedia = async () => {
    if (!id) return;
    const { data } = await supabase
      .from("job_media")
      .select("id, url, media_type, caption, created_at")
      .eq("assignment_id", id)
      .order("created_at", { ascending: false });
    setMedia((data as JobMedia[]) || []);
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !assignment) return;

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      toast({ title: "Session expired — please sign in again", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    try {
      // The file upload itself stays online-only by design (see
      // TECHNICIAN_EXPERIENCE_AUDIT.md / OFFLINE_ACTION_QUEUE_REPORT.md) —
      // queueing a binary blob in localStorage indefinitely risks quietly
      // filling a technician's phone storage with no clear "did this
      // actually upload" signal. If there's no connection at all, fail
      // here, before ever touching Storage.
      if (!navigator.onLine) {
        toast({ title: "Upload requires a connection", description: "Try again once you have signal — your notes and status updates will still sync.", variant: "destructive" });
        return;
      }

      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `assignments/${assignment.id}/${Date.now()}.${ext}`;
      const { error: storageErr } = await supabase.storage
        .from(JOB_MEDIA_BUCKET)
        .upload(path, file, { upsert: false });

      if (storageErr) throw storageErr;

      const { data: urlData } = supabase.storage.from(JOB_MEDIA_BUCKET).getPublicUrl(path);
      const mediaType: "photo" | "video" = file.type.startsWith("video/") ? "video" : "photo";
      const metadata = { url: urlData.publicUrl, media_type: mediaType };

      try {
        const res = await fetch(`/api/employee/assignments/${assignment.id}/media`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(metadata),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Unknown error" }));
          throw new Error(err.error);
        }
        toast({ title: `${mediaType === "video" ? "Video" : "Photo"} uploaded` });
        await loadMedia();
      } catch (metaErr: any) {
        // The file itself is already safely in Storage — only the
        // metadata record (which job it belongs to, photo vs. video)
        // failed to save. That's exactly the kind of small, safe, idempotent
        // write worth queueing rather than losing, per this sprint's scope.
        if (employee?.id) {
          enqueueQueuedAction("media_metadata", assignment.id, metadata);
          toast({ title: `${mediaType === "video" ? "Video" : "Photo"} uploaded — saving record offline`, description: "Will finish syncing once you're back online." });
        } else {
          throw metaErr;
        }
      }
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const loadChecklist = async () => {
    if (!id) return;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    try {
      const res = await fetch(`/api/employee/assignments/${id}/checklist`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const { items } = await res.json();
        if (Array.isArray(items)) {
          setChecklist(CHECKLIST_LABELS.map((_, i) => Boolean(items[i]?.checked)));
        }
      }
    } catch {
      // Non-fatal — checklist defaults to all unchecked
    }
  };

  const saveChecklist = async (next: boolean[]) => {
    if (!id) return;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    setChecklistSaving(true);
    try {
      const items = CHECKLIST_LABELS.map((label, i) => ({ label, checked: next[i] }));
      await fetch(`/api/employee/assignments/${id}/checklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ items }),
      });
    } catch {
      // Non-fatal — UI state is still correct
    } finally {
      setChecklistSaving(false);
    }
  };

  const toggleChecklist = (i: number) => {
    const next = [...checklist];
    next[i] = !next[i];
    setChecklist(next);
    saveChecklist(next);
  };

  useEffect(() => {
    loadAssignment();
    loadMessages();
    loadMedia();
    loadChecklist();
  }, [id]);

  const updateStatus = async (newStatus: string, reason?: string) => {
    if (!assignment) return;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      toast({ title: "Session expired — please sign in again", variant: "destructive" });
      return;
    }

    // Capture GPS snapshot (non-blocking — GPS denied does not prevent status update)
    const geo = await capturePosition();
    const payload = { status: newStatus, ...geo, ...(reason ? { technician_notes: reason } : {}) };

    const queueIt = () => {
      if (!employee?.id) return;
      enqueueQueuedAction("status_update", assignment.id, payload);
      // Optimistic update — the technician needs to see the status they
      // just set, not the pre-update one, while it's pending sync.
      setAssignment((prev) => prev ? { ...prev, status: newStatus, ...(reason ? { technician_notes: reason } : {}) } : prev);
      if (newStatus === "no_show" || newStatus === "skipped") {
        setShowBlockedForm(false);
        setBlockedReason("");
      }
      toast({ title: "Saved offline", description: "Will sync automatically once you're back online." });
    };

    if (!navigator.onLine) {
      queueIt();
      return;
    }

    try {
      const res = await fetch(`/api/employee/assignments/${assignment.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        toast({ title: "Status update failed", description: err.error, variant: "destructive" });
        return;
      }
      const { assignment: updated } = await res.json();
      setAssignment((prev) => prev ? { ...prev, ...updated } : prev);
      if (newStatus === "completed") {
        toast({ title: "Job completed", description: "Appointment marked complete." });
      }
      if (newStatus === "no_show" || newStatus === "skipped") {
        setShowBlockedForm(false);
        setBlockedReason("");
        toast({ title: "Marked as blocked", description: "Office has been notified." });
      }
    } catch {
      // fetch itself threw — a real connectivity failure, not a server
      // rejection (those resolve with !res.ok above, not a throw).
      queueIt();
    }
  };

  const saveTreatmentNotes = async () => {
    if (!assignment) return;
    setSavingNotes(true);

    const queueIt = () => {
      if (!employee?.id) return;
      enqueueQueuedAction("treatment_notes", assignment.id, { technician_notes: treatmentNotes });
      toast({ title: "Notes saved offline", description: "Will sync automatically once you're back online." });
    };

    if (!navigator.onLine) {
      queueIt();
      setSavingNotes(false);
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch(`/api/employee/assignments/${assignment.id}/notes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ technician_notes: treatmentNotes }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        toast({ title: "Failed to save notes", description: err.error, variant: "destructive" });
        return;
      }
      toast({ title: "Treatment notes saved" });
    } catch {
      queueIt();
    } finally {
      setSavingNotes(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignment || !body.trim() || !employee) return;

    // Messaging stays online-only by design (see
    // TECHNICIAN_EXPERIENCE_AUDIT.md / OFFLINE_ACTION_QUEUE_REPORT.md) — a
    // message that silently sends hours later could look like the
    // technician ignored dispatch or the customer. Fail clearly and
    // immediately instead, so there's no ambiguity about whether it sent.
    if (!navigator.onLine) {
      toast({ title: "No signal", description: "Messages need a connection to send — try again once you're back online.", variant: "destructive" });
      return;
    }

    setIsSending(true);

    try {
      let { data: thread } = await supabase
        .from("message_threads")
        .select("id")
        .eq("assignment_id", assignment.id)
        .maybeSingle();

      if (!thread) {
        const { data: newThread } = await supabase
          .from("message_threads")
          .insert({ assignment_id: assignment.id, customer_visible: true })
          .select("id")
          .single();
        thread = newThread;
      }

      if (!thread) return;

      await supabase.from("messages").insert({
        thread_id: thread.id,
        sender_id: employee.user_id,
        body: body.trim(),
        direction: "outbound",
        channel: "in_app",
      });

      setBody("");
      await loadMessages();
    } catch {
      toast({
        title: navigator.onLine ? "Failed to send message" : "No signal",
        description: navigator.onLine ? undefined : "Try again once you're back online.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (blockingForms) {
    return (
      <div className="grid gap-6 max-w-lg">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center space-y-4">
          <div className="flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
              <X className="h-6 w-6 text-red-600" />
            </div>
          </div>
          <div>
            <p className="text-lg font-bold text-red-900">Onboarding Required</p>
            <p className="text-sm text-red-700 mt-1">
              You must complete required onboarding documents before accessing assignment details.
            </p>
          </div>
          <div className="text-left rounded-xl bg-white border border-red-200 p-4 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-red-600 mb-2">Required Forms</p>
            {blockingForms.map((form, i) => (
              <p key={i} className="text-sm text-red-800 flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                {form}
              </p>
            ))}
          </div>
          <a
            href="/employee/onboarding"
            className="inline-flex items-center justify-center w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition"
          >
            Complete Onboarding
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-8">
      <SectionHeading
        eyebrow="Assignment"
        title={assignment?.customer_name ?? "Assignment"}
        description="Navigate, message, checklist, and complete the job."
      />

      {isFromCache && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs font-semibold text-amber-800">
          <WifiOff className="h-3.5 w-3.5 shrink-0" />
          Offline / Cached Data — showing this job's last-known details. Status updates and notes will sync
          once you're back online.
        </div>
      )}

      {pendingCount > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-blue-300 bg-blue-50 px-4 py-2.5 text-xs font-semibold text-blue-800">
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
          {pendingCount} update{pendingCount > 1 ? "s" : ""} waiting to sync — will send automatically once you're back online.
        </div>
      )}

      {assignment && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Customer & Status */}
          <div className="rounded-2xl border border-border/70 bg-card/95 p-5 space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Customer</p>
              {assignment.address && (
                <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  {[assignment.address, assignment.city, assignment.zip].filter(Boolean).join(", ")}
                </div>
              )}
              {assignment.customer_phone && (
                <a href={`tel:${assignment.customer_phone}`} className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-primary">
                  <Phone className="h-3.5 w-3.5" />
                  {assignment.customer_phone}
                </a>
              )}
              {assignment.service_type && (
                <p className="mt-2 text-sm text-muted-foreground">Service: {assignment.service_type}</p>
              )}
            </div>
            {/* min-h-11 (44px) on every action here — these are tapped
                standing up, often one-handed, sometimes gloved. */}
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              <Button className="min-h-11" variant="outline" disabled={assignment.status === "en_route"} onClick={() => updateStatus("en_route")}>En Route</Button>
              <Button className="min-h-11" variant="outline" disabled={assignment.status === "in_progress"} onClick={() => updateStatus("in_progress")}>Arrive</Button>
              <Button className="min-h-11" disabled={assignment.status === "completed"} onClick={() => updateStatus("completed")}>Complete</Button>
              <Button
                variant="outline"
                className="min-h-11 border-red-300 text-red-700 hover:bg-red-50"
                disabled={assignment.status === "no_show" || assignment.status === "skipped"}
                onClick={() => setShowBlockedForm((v) => !v)}
              >
                <Ban className="h-3.5 w-3.5 mr-1.5" /> Blocked / Unable to Service
              </Button>
            </div>
          </div>

          {showBlockedForm && (
            <div className="rounded-2xl border border-red-200 bg-red-50/60 p-5 space-y-3">
              <p className="text-sm font-semibold text-red-800">Can't complete this job?</p>
              <Textarea
                placeholder="Reason (e.g. locked gate, dog in yard, no one home)…"
                value={blockedReason}
                onChange={(e) => setBlockedReason(e.target.value)}
                rows={2}
                className="resize-none bg-white"
              />
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" className="min-h-11 border-red-300" onClick={() => updateStatus("no_show", blockedReason)}>
                  Mark No-Show
                </Button>
                <Button variant="outline" className="min-h-11 border-red-300" onClick={() => updateStatus("skipped", blockedReason)}>
                  Mark Skipped
                </Button>
                <Button variant="ghost" className="min-h-11" onClick={() => { setShowBlockedForm(false); setBlockedReason(""); }}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Treatment Notes */}
          <div className="rounded-2xl border border-border/70 bg-card/95 p-5 space-y-3">
            <p className="text-sm font-semibold">Treatment Notes</p>
            <p className="text-xs text-muted-foreground">Your own notes about this visit — what you treated, conditions found, anything for the next technician.</p>
            <Textarea
              placeholder="e.g. Treated front and back yard, standing water near fence removed…"
              value={treatmentNotes}
              onChange={(e) => setTreatmentNotes(e.target.value)}
              rows={3}
              className="resize-none"
            />
            <Button size="sm" variant="outline" disabled={savingNotes} onClick={saveTreatmentNotes}>
              {savingNotes ? "Saving…" : "Save Notes"}
            </Button>
          </div>

          {/* Map */}
          <div className="rounded-2xl border border-border/70 bg-card/95 p-5 space-y-3">
            <p className="text-sm font-semibold">Map & Navigation</p>
            {assignment.lat && assignment.lng ? (
              <>
                <MiniMap lat={assignment.lat} lng={assignment.lng} />
                <Button asChild className="w-full">
                  <a href={navUrl(assignment.lat, assignment.lng)} target="_blank" rel="noreferrer">Open Navigation</a>
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No GPS coordinates on file for this property.</p>
            )}
          </div>
        </div>
      )}

      {/* Messaging */}
      <div className="rounded-2xl border border-border/70 bg-card/95 p-5 space-y-3">
        <p className="text-sm font-semibold">Messages</p>
        <div className="space-y-2 max-h-56 overflow-auto pr-1">
          {msgs.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No messages yet.</p>
          ) : (
            msgs.map((m) => (
              <div key={m.id} className={`flex gap-2 text-sm ${m.direction === "outbound" ? "flex-row-reverse" : ""}`}>
                <div className={`rounded-xl px-3 py-1.5 max-w-[80%] ${m.direction === "outbound" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                  {m.body}
                </div>
              </div>
            ))
          )}
        </div>
        <form className="flex gap-2" onSubmit={handleSendMessage}>
          <input
            className="flex-1 h-11 rounded-xl border border-input bg-background px-3 text-sm"
            placeholder="Type a message…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            disabled={isSending}
          />
          <Button className="min-h-11" type="submit" disabled={isSending || !body.trim()}>
            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send"}
          </Button>
        </form>
      </div>

      {/* Recent Updates / Status Timeline */}
      {assignment && (
        <div className="rounded-2xl border border-border/70 bg-card/95 p-5 space-y-3">
          <p className="text-sm font-semibold">Recent Updates</p>
          <div className="space-y-2">
            {[
              { label: "Completed",    timestamp: assignment.completed_at,  color: "bg-green-500" },
              { label: "In Progress",  timestamp: assignment.started_at,    color: "bg-blue-500" },
              { label: "En Route",     timestamp: assignment.en_route_at,   color: "bg-amber-500" },
              { label: "Arrived",      timestamp: assignment.arrived_at,    color: "bg-purple-500" },
            ]
              .filter((s) => !!s.timestamp)
              .map((s) => (
                <div key={s.label} className="flex items-center gap-3 text-sm">
                  <span className={`h-2 w-2 rounded-full shrink-0 ${s.color}`} />
                  <span className="font-medium text-foreground">{s.label}</span>
                  <span className="text-muted-foreground text-xs">
                    {(() => {
                      try {
                        return new Date(s.timestamp!).toLocaleString("en-US", {
                          month: "short", day: "numeric",
                          hour: "numeric", minute: "2-digit",
                        });
                      } catch { return s.timestamp; }
                    })()}
                  </span>
                </div>
              ))}
            {/* Current status if no timestamps yet */}
            {!assignment.en_route_at && !assignment.started_at && !assignment.completed_at && (
              <div className="flex items-center gap-3 text-sm">
                <span className="h-2 w-2 rounded-full shrink-0 bg-muted-foreground/50" />
                <span className="text-muted-foreground">
                  Status: <span className="capitalize font-medium text-foreground">{assignment.status}</span>
                </span>
              </div>
            )}
            {/* Show if cancelled/skipped */}
            {(assignment.status === "no_show" || assignment.status === "skipped") && (
              <div className="flex items-center gap-3 text-sm">
                <span className="h-2 w-2 rounded-full shrink-0 bg-red-400" />
                <span className="font-medium text-red-600 capitalize">{assignment.status.replace("_", " ")}</span>
              </div>
            )}
          </div>
          {assignment.notes && (
            <div className="mt-3 rounded-lg bg-muted/50 px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Notes</p>
              <p className="text-sm text-foreground">{assignment.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Checklist */}
      <div className="rounded-2xl border border-border/70 bg-card/95 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Pre-service checklist</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {checklistSaving && <Loader2 className="h-3 w-3 animate-spin" />}
            <span>{checklist.filter(Boolean).length}/{CHECKLIST_LABELS.length} complete</span>
          </div>
        </div>
        <ul className="grid gap-1 sm:grid-cols-3 text-sm">
          {CHECKLIST_LABELS.map((label, i) => (
            <li key={label}>
              {/* The whole row is the tap target (min-h-11), not just the
                  16px checkbox itself — the smallest tap target on this
                  page before this change. */}
              <label className="flex min-h-11 items-center gap-2.5 cursor-pointer select-none rounded-lg px-1 active:bg-muted/40">
                <input
                  type="checkbox"
                  className="h-5 w-5 shrink-0 rounded"
                  checked={checklist[i]}
                  onChange={() => toggleChecklist(i)}
                />
                <span className={checklist[i] ? "line-through text-muted-foreground" : ""}>{label}</span>
              </label>
            </li>
          ))}
        </ul>
      </div>

      {/* Job Media */}
      <div className="rounded-2xl border border-border/70 bg-card/95 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Job Photos & Videos</p>
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              id="media-photo"
              onChange={handleMediaUpload}
              disabled={isUploading}
            />
            <input
              type="file"
              accept="image/*,video/*"
              className="hidden"
              id="media-file"
              onChange={handleMediaUpload}
              disabled={isUploading}
            />
            {/* Photo is the primary action — most job documentation is a
                quick camera shot, not picking an existing file. min-h-11
                throughout for one-handed, gloved-hands use. */}
            <Button
              className="min-h-11"
              disabled={isUploading}
              onClick={() => document.getElementById("media-photo")?.click()}
            >
              {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              <span className="ml-1.5">Photo</span>
            </Button>
            <Button
              className="min-h-11"
              variant="outline"
              disabled={isUploading}
              onClick={() => document.getElementById("media-file")?.click()}
            >
              <Video className="h-4 w-4" />
              <span className="ml-1.5">File</span>
            </Button>
          </div>
        </div>

        {media.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No photos or videos yet. Add documentation for this job.</p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {media.map((m) => (
              <div key={m.id} className="relative aspect-square rounded-xl overflow-hidden border border-border/60 bg-muted/30">
                {m.media_type === "video" ? (
                  <video src={m.url} className="w-full h-full object-cover" controls={false} />
                ) : (
                  <img src={m.url} alt="Job photo" className="w-full h-full object-cover" />
                )}
                {m.media_type === "video" && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <Video className="h-6 w-6 text-white drop-shadow" />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AssignmentDetail;
