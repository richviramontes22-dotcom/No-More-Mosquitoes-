import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import SectionHeading from "@/components/common/SectionHeading";
import MiniMap from "@/components/employee/MiniMap";
import { navUrl } from "@/lib/employee/deepLinks";
import { Button } from "@/components/ui/button";
import { arriveAssignment, getAssignment, getMessages, sendMessage, setAssignmentStatus } from "@/lib/employee/api";

const AssignmentDetail = () => {
  const { id = "" } = useParams();
  const [a, setA] = useState<any | null>(null);
  const [msgs, setMsgs] = useState<Array<any>>([]);
  const [body, setBody] = useState("");

  useEffect(() => {
    if (!id) return;
    getAssignment(id).then(setA);
    getMessages(id).then((r) => setMsgs(r.messages));
  }, [id]);

  return (
    <div className="grid gap-8">
      <SectionHeading eyebrow="Assignment" title={a ? a.customer_name : "Assignment"} description="Navigate, message, checklist, and complete the job." />

      {a && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-border/70 bg-card/95 p-4">
            <div className="text-sm font-semibold">Customer</div>
            <div className="mt-1 text-sm text-muted-foreground">{a.address}</div>
            <a className="mt-2 inline-block text-sm font-semibold text-primary underline" href={`tel:${a.customer_phone}`}>{a.customer_phone}</a>
            <div className="mt-3 text-xs text-muted-foreground">Gate code will unlock on arrival.</div>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="outline" onClick={async ()=> { await setAssignmentStatus(a.id, "en_route"); const next = await getAssignment(a.id); setA(next); }}>En Route</Button>
              <Button size="sm" variant="outline" onClick={async ()=> { await arriveAssignment(a.id); const next = await getAssignment(a.id); setA(next); }}>Arrive</Button>
              <Button size="sm" onClick={async ()=> { await setAssignmentStatus(a.id, "completed"); const next = await getAssignment(a.id); setA(next); }}>Complete</Button>
            </div>
          </div>
          <div className="rounded-2xl border border-border/70 bg-card/95 p-4">
            <div className="text-sm font-semibold">Map & Navigation</div>
            <MiniMap lat={a.lat} lng={a.lng} />
            <Button asChild className="mt-3">
              <a href={navUrl(a.lat, a.lng)} target="_blank" rel="noreferrer">Navigate</a>
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-border/70 bg-card/95 p-4">
        <div className="text-sm font-semibold">Messaging</div>
        <div className="mt-3 space-y-2 max-h-64 overflow-auto pr-2">
          {msgs.map((m) => (
            <div key={m.id} className="text-sm"><span className="mr-2 rounded bg-muted px-2 py-0.5 text-muted-foreground">{m.direction}</span>{m.body}</div>
          ))}
        </div>
        <form className="mt-3 flex gap-2" onSubmit={async (e)=>{ e.preventDefault(); if (!a || !body.trim()) return; await sendMessage(a.id, body.trim()); setBody(""); const r = await getMessages(a.id); setMsgs(r.messages); }}>
          <input className="flex-1 h-10 rounded-md border border-input bg-background px-3 text-sm" placeholder="Type a message…" value={body} onChange={(e)=> setBody(e.target.value)} />
          <Button type="submit">Send</Button>
        </form>
      </div>

      <div className="rounded-2xl border border-border/70 bg-card/95 p-4">
        <div className="text-sm font-semibold">Pre‑service checklist</div>
        <ul className="mt-3 grid gap-2 sm:grid-cols-3 text-sm">
          <li><label className="inline-flex items-center gap-2"><input type="checkbox" className="h-4 w-4" /> PPE on</label></li>
          <li><label className="inline-flex items-center gap-2"><input type="checkbox" className="h-4 w-4" /> Pets accounted for</label></li>
          <li><label className="inline-flex items-center gap-2"><input type="checkbox" className="h-4 w-4" /> Hazards cleared</label></li>
        </ul>
      </div>
    </div>
  );
};

export default AssignmentDetail;
