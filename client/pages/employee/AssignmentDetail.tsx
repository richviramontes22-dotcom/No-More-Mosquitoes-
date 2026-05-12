import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import SectionHeading from "@/components/common/SectionHeading";
import MiniMap from "@/components/employee/MiniMap";
import { navUrl } from "@/lib/employee/deepLinks";
import { Button } from "@/components/ui/button";
import { Loader2, Phone, MapPin } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useEmployee } from "@/hooks/employee/useEmployee";
import { useToast } from "@/hooks/use-toast";

interface AssignmentDetail {
  id: string;
  status: string;
  customer_name: string | null;
  customer_phone: string | null;
  address: string | null;
  city: string | null;
  zip: string | null;
  lat: number | null;
  lng: number | null;
  service_type: string | null;
  notes: string | null;
  appointment_id: string | null;
}

interface Message {
  id: string;
  body: string;
  direction: string;
  created_at: string;
}

const AssignmentDetail = () => {
  const { id = "" } = useParams();
  const { data: employee } = useEmployee();
  const { toast } = useToast();
  const [assignment, setAssignment] = useState<AssignmentDetail | null>(null);
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);

  const loadAssignment = async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const { data: row, error } = await supabase
        .from("assignments")
        .select("id, status, appointment_id")
        .eq("id", id)
        .single();

      if (error || !row) return;

      const apptId = row.appointment_id;
      if (!apptId) {
        setAssignment({ id: row.id, status: row.status, customer_name: null, customer_phone: null, address: null, city: null, zip: null, lat: null, lng: null, service_type: null, notes: null, appointment_id: null });
        return;
      }

      const { data: appt } = await supabase
        .from("appointments")
        .select("user_id, property_id, service_type, notes")
        .eq("id", apptId)
        .single();

      const [profileRes, propRes] = await Promise.all([
        appt?.user_id ? supabase.from("profiles").select("name, phone").eq("id", appt.user_id).single() : Promise.resolve({ data: null }),
        appt?.property_id ? supabase.from("properties").select("address, city, zip").eq("id", appt.property_id).single() : Promise.resolve({ data: null }),
      ]);

      setAssignment({
        id: row.id,
        status: row.status,
        appointment_id: apptId,
        customer_name: profileRes.data?.name ?? null,
        customer_phone: profileRes.data?.phone ?? null,
        address: propRes.data?.address ?? null,
        city: propRes.data?.city ?? null,
        zip: propRes.data?.zip ?? null,
        lat: null,
        lng: null,
        service_type: appt?.service_type ?? null,
        notes: appt?.notes ?? null,
      });
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

  useEffect(() => {
    loadAssignment();
    loadMessages();
  }, [id]);

  const updateStatus = async (newStatus: string) => {
    if (!assignment) return;
    const updateData: Record<string, string> = { status: newStatus };
    if (newStatus === "in_progress") updateData.started_at = new Date().toISOString();
    if (newStatus === "completed") updateData.completed_at = new Date().toISOString();

    const { error } = await supabase
      .from("assignments")
      .update(updateData)
      .eq("id", assignment.id);

    if (!error) setAssignment((prev) => prev ? { ...prev, status: newStatus } : prev);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignment || !body.trim() || !employee) return;
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
      toast({ title: "Failed to send message", variant: "destructive" });
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

  return (
    <div className="grid gap-8">
      <SectionHeading
        eyebrow="Assignment"
        title={assignment?.customer_name ?? "Assignment"}
        description="Navigate, message, checklist, and complete the job."
      />

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
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={assignment.status === "en_route"} onClick={() => updateStatus("en_route")}>En Route</Button>
              <Button size="sm" variant="outline" disabled={assignment.status === "in_progress"} onClick={() => updateStatus("in_progress")}>Arrive</Button>
              <Button size="sm" disabled={assignment.status === "completed"} onClick={() => updateStatus("completed")}>Complete</Button>
            </div>
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
            className="flex-1 h-10 rounded-xl border border-input bg-background px-3 text-sm"
            placeholder="Type a message…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            disabled={isSending}
          />
          <Button type="submit" disabled={isSending || !body.trim()}>
            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send"}
          </Button>
        </form>
      </div>

      {/* Checklist */}
      <div className="rounded-2xl border border-border/70 bg-card/95 p-5 space-y-3">
        <p className="text-sm font-semibold">Pre-service checklist</p>
        <ul className="grid gap-2 sm:grid-cols-3 text-sm">
          {["PPE on", "Pets accounted for", "Hazards cleared", "Products loaded", "Customer notified", "Safety zones marked"].map((item) => (
            <li key={item}>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="h-4 w-4 rounded" />
                {item}
              </label>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default AssignmentDetail;
