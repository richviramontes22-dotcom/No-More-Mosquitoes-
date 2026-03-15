import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import SectionHeading from "@/components/common/SectionHeading";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { stringifyError } from "@/lib/error-utils";
import { Loader2, MessageSquare, ChevronRight, User, Calendar } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Thread {
  id: string;
  lastActivityAt: string;
  address: string;
  jobId: string;
  lastMessage?: string;
}

const Messages = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [threads, setThreads] = useState<Thread[]>([]);

  const fetchThreads = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      // 1. Fetch appointments for this user
      const { data: appointments, error: appError } = await supabase
        .from("appointments")
        .select(`
          id,
          property_id
        `)
        .eq("user_id", user.id);

      if (appError) throw appError;

      const appointmentIds = appointments?.map(a => a.id) || [];
      if (appointmentIds.length === 0) {
        setThreads([]);
        setIsLoading(false);
        return;
      }

      // 2. Fetch properties for these appointments
      const propertyIds = [...new Set(appointments.map(a => a.property_id).filter(Boolean))];
      let properties: any[] = [];
      if (propertyIds.length > 0) {
        const { data, error } = await supabase
          .from("properties")
          .select("id, address")
          .in("id", propertyIds);

        if (error) {
          console.error("Error fetching properties for messages:", error);
        } else {
          properties = data || [];
        }
      }

      // 3. Fetch assignments for these appointments
      let assignments: any[] = [];
      if (appointmentIds.length > 0) {
        const { data, error } = await supabase
          .from("assignments")
          .select("id, appointment_id")
          .in("appointment_id", appointmentIds);

        if (error) {
          console.error("Error fetching assignments for messages:", error);
        } else {
          assignments = data || [];
        }
      }

      const assignmentIds = assignments?.map(a => a.id) || [];
      if (assignmentIds.length === 0) {
        setThreads([]);
        setIsLoading(false);
        return;
      }

      // 3. Fetch message threads for these assignments
      const { data, error } = await supabase
        .from("message_threads")
        .select("*")
        .in("assignment_id", assignmentIds)
        .eq("customer_visible", true)
        .order("last_activity_at", { ascending: false });

      if (error) throw error;

      // Map threads and fetch last message
      const threadsWithMessages = await Promise.all((data || []).map(async (t: any) => {
        const assignment = assignments.find(a => a.id === t.assignment_id);
        const appointment = appointments.find(a => a.id === assignment?.appointment_id);
        const property = properties?.find(p => p.id === appointment?.property_id);

        const { data: msgData } = await supabase
          .from("messages")
          .select("body")
          .eq("thread_id", t.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        return {
          id: t.id,
          lastActivityAt: t.last_activity_at,
          address: property?.address || "Service Visit",
          jobId: appointment?.id?.split("-")[0].toUpperCase() || "N/A",
          lastMessage: msgData?.body || "No messages yet."
        };
      }));

      setThreads(threadsWithMessages);
    } catch (err: any) {
      console.error("Error fetching messages:", err);
      toast({
        title: "System: Messages Fetch Error",
        description: stringifyError(err),
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchThreads();
  }, [user]);

  return (
    <div className="grid gap-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <SectionHeading
          eyebrow="Messages"
          title="Technician Conversations"
          description="Direct communication with your service team regarding scheduled visits and property notes."
        />
        <Button className="rounded-xl shadow-brand" asChild>
          <Link to="/dashboard/support">
            <MessageSquare className="mr-2 h-4 w-4" />
            New Message
          </Link>
        </Button>
      </div>

      <div className="grid gap-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-12 bg-muted/20 rounded-[28px] border border-dashed border-border">
            <Loader2 className="h-8 w-8 animate-spin text-primary/40 mb-4" />
            <p className="text-muted-foreground font-medium italic">Loading your conversations...</p>
          </div>
        ) : threads.length > 0 ? (
          threads.map((thread) => (
            <Card key={thread.id} className="rounded-[24px] border-border/60 bg-card/95 shadow-soft transition-all hover:shadow-md cursor-pointer group">
              <CardContent className="p-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <User className="h-6 w-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Job #{thread.jobId}</span>
                        <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(thread.lastActivityAt).toLocaleDateString()}
                        </span>
                      </div>
                      <h4 className="font-bold text-lg truncate">{thread.address}</h4>
                      <p className="text-sm text-muted-foreground line-clamp-1 italic">
                        "{thread.lastMessage}"
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="p-12 text-center bg-muted/20 rounded-[28px] border border-dashed border-border space-y-4">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground/40 mb-4">
              <MessageSquare className="h-8 w-8" />
            </div>
            <p className="text-muted-foreground font-medium italic">No message threads found.</p>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">Conversation threads are created when a technician is assigned to your visit.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Messages;
