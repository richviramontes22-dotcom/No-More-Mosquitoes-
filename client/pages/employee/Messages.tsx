import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import SectionHeading from "@/components/common/SectionHeading";
import { Loader2, MessageSquare, ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useEmployee } from "@/hooks/employee/useEmployee";

interface Thread {
  id: string;
  assignment_id: string | null;
  last_activity_at: string | null;
  customer_name: string | null;
  address: string | null;
  last_message: string | null;
}

const Messages = () => {
  const { data: employee, isLoading: empLoading } = useEmployee();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!employee?.id) return;

    const load = async () => {
      setIsLoading(true);
      try {
        // Get assignments for this employee
        const { data: assignments } = await supabase
          .from("assignments")
          .select("id, appointment_id")
          .eq("employee_id", employee.id);

        if (!assignments || assignments.length === 0) {
          setThreads([]);
          return;
        }

        const assignmentIds = assignments.map((a: any) => a.id);

        // Get message threads for these assignments
        const { data: rawThreads } = await supabase
          .from("message_threads")
          .select("id, assignment_id, last_activity_at")
          .in("assignment_id", assignmentIds)
          .order("last_activity_at", { ascending: false });

        if (!rawThreads || rawThreads.length === 0) {
          setThreads([]);
          return;
        }

        // Get last message per thread
        const threadIds = rawThreads.map((t: any) => t.id);
        const { data: lastMsgs } = await supabase
          .from("messages")
          .select("thread_id, body, created_at")
          .in("thread_id", threadIds)
          .order("created_at", { ascending: false });

        const lastMsgMap: Record<string, string> = {};
        (lastMsgs || []).forEach((m: any) => {
          if (!lastMsgMap[m.thread_id]) lastMsgMap[m.thread_id] = m.body;
        });

        // Enrich with appointment/property/customer data
        const apptMap: Record<string, string> = {};
        assignments.forEach((a: any) => { apptMap[a.id] = a.appointment_id; });

        setThreads(rawThreads.map((t: any) => ({
          id: t.id,
          assignment_id: t.assignment_id,
          last_activity_at: t.last_activity_at,
          customer_name: null,
          address: null,
          last_message: lastMsgMap[t.id] || null,
        })));
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [employee?.id]);

  if (empLoading || isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="grid gap-8">
      <SectionHeading
        eyebrow="Messages"
        title="Customer & dispatch threads"
        description="Tap a thread to view the conversation from your assignment."
      />
      <div className="grid gap-3">
        {threads.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/60 p-12 text-center">
            <MessageSquare className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No message threads yet.</p>
            <p className="text-xs text-muted-foreground">Threads appear after your first customer message on an assignment.</p>
          </div>
        ) : (
          threads.map((t) => (
            <Link
              key={t.id}
              to={t.assignment_id ? `/employee/assignments/${t.assignment_id}` : "#"}
              className="flex items-center justify-between gap-4 rounded-2xl border border-border/70 bg-card/95 p-4 transition hover:bg-muted/40"
            >
              <div className="min-w-0 space-y-1">
                <p className="font-semibold text-sm truncate">
                  {t.customer_name ?? `Assignment ${t.assignment_id?.slice(0, 8).toUpperCase() ?? "—"}`}
                </p>
                {t.last_message && (
                  <p className="text-xs text-muted-foreground italic truncate">"{t.last_message}"</p>
                )}
                {t.last_activity_at && (
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(t.last_activity_at).toLocaleDateString()}
                  </p>
                )}
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </Link>
          ))
        )}
      </div>
    </div>
  );
};

export default Messages;
