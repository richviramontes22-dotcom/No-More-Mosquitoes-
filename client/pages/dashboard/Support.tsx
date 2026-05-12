import { useEffect, useState } from "react";
import SectionHeading from "@/components/common/SectionHeading";
import { isTimeoutError, supabase, withTimeout } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/data/site";
import {
  LifeBuoy,
  Phone,
  MessageCircle,
  History as HistoryIcon,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowRight,
  Loader2
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface SupportTicket {
  id: string;
  subject: string;
  description: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  priority: "low" | "medium" | "high";
  created_at: string;
  updated_at: string;
}

const ticketSelectFields = "id, subject, description, status, priority, created_at, updated_at";

const normalizeTicket = (ticket: any): SupportTicket => ({
  id: ticket.id,
  subject: ticket.subject,
  description: ticket.description || "",
  status: ticket.status || "open",
  priority: ticket.priority || "medium",
  created_at: ticket.created_at,
  updated_at: ticket.updated_at,
});

const Support = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingTickets, setIsLoadingTickets] = useState(true);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTicketSubject, setNewTicketSubject] = useState("");
  const [newTicketBody, setNewTicketBody] = useState("");
  const [ticketLoadError, setTicketLoadError] = useState<string | null>(null);

  // Load customer's support tickets
  // SECTION 5: Guarantee page loader terminates
  useEffect(() => {
    if (!user?.id) {
      if (import.meta.env.DEV) console.log("[Support] No userId, skipping load");
      setIsLoadingTickets(false);
      setTickets([]);
      setTicketLoadError(null);
      return;
    }

    let isMounted = true;

    const loadTickets = async () => {
      try {
        if (import.meta.env.DEV) console.log("[Support] query started");
        setIsLoadingTickets(true);
        setTicketLoadError(null);
        const { data, error } = await withTimeout(
          supabase
            .from("tickets")
            .select(ticketSelectFields)
            .eq("user_id", user.id)
            .order("created_at", { ascending: false }),
          10000,
          "Support tickets"
        );

        if (!isMounted) {
          if (import.meta.env.DEV) console.log("[Support] component unmounted, ignoring results");
          return;
        }

        if (error) {
          const errorMessage = error.message || "Failed to load tickets";
          console.error("[Support] query timed out or failed:", errorMessage);

          // CRITICAL FIX: Don't clear tickets on error, preserve what we have
          // Only show error if we have no tickets at all
          if (tickets.length === 0) {
            if (import.meta.env.DEV) console.log("[Support] rendering error state");
            setTicketLoadError(errorMessage);
          } else {
            if (import.meta.env.DEV) console.log("[Support] rendering data state with cached tickets");
          }
          return;
        }

        if (import.meta.env.DEV) console.log("[Support] query success count=" + (data?.length || 0));
        setTickets((data || []).map(normalizeTicket));
        setTicketLoadError(null);
      } catch (err) {
        if (isMounted) {
          const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred";
          console.error("[Support] query exception:", errorMessage);

          // CRITICAL FIX: Don't clear tickets on error, preserve what we have
          // This ensures isLoading is always set to false
          if (tickets.length === 0) {
            if (import.meta.env.DEV) console.log("[Support] rendering error state");
            setTicketLoadError(errorMessage);
          } else {
            if (import.meta.env.DEV) console.log("[Support] rendering data state with cached tickets");
          }
        }
      } finally {
        // CRITICAL: Always clear loading state, even on error/timeout
        if (isMounted) {
          if (import.meta.env.DEV) console.log("[Support] loading complete");
          setIsLoadingTickets(false);
        }
      }
    };

    loadTickets();

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  const handleReService = async () => {
    if (!user?.id) {
      toast({
        title: "Error",
        description: "You must be logged in to request re-service.",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsSubmitting(true);
      const { data, error } = await withTimeout(
        supabase
          .from("tickets")
          .insert({
            user_id: user.id,
            subject: "Re-service request",
            description: "Please re-service my yard. I noticed mosquitoes returning.",
            priority: "medium",
            status: "open"
          })
          .select(ticketSelectFields),
        10000,
        "Create support ticket"
      );

      if (error) throw error;

      // Add to local state
      if (data && data.length > 0) {
        setTickets((prev) => [normalizeTicket(data[0]), ...prev]);
      }

      toast({
        title: "Request Submitted",
        description: "Your re-service request has been logged. A technician will be dispatched within 48 hours.",
      });
    } catch (err) {
      console.error("[Support] Error creating re-service request:", err);
      toast({
        title: "Error",
        description: "Failed to submit your request. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user?.id) {
      toast({
        title: "Error",
        description: "You must be logged in to create a ticket.",
        variant: "destructive"
      });
      return;
    }

    if (!newTicketSubject.trim() || !newTicketBody.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter both a subject and message.",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsSubmitting(true);
      const { data, error } = await supabase
        .from("tickets")
        .insert({
          user_id: user.id,
          subject: newTicketSubject.trim(),
          description: newTicketBody.trim(),
          priority: "medium",
          status: "open"
        })
        .select();

      if (error) throw error;

      // Add to local state
      if (data && data.length > 0) {
        setTickets((prev) => [normalizeTicket(data[0]), ...prev]);
      }

      setNewTicketSubject("");
      setNewTicketBody("");
      setShowCreateForm(false);

      toast({
        title: "Ticket Created",
        description: "Our team will review your message and respond shortly.",
      });
    } catch (err) {
      console.error("[Support] Error creating ticket:", err);
      toast({
        title: "Error",
        description: "Failed to create ticket. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "resolved":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "in_progress":
        return <Clock className="h-4 w-4 text-blue-500" />;
      case "closed":
        return <CheckCircle2 className="h-4 w-4 text-muted-foreground" />;
      default:
        return <AlertCircle className="h-4 w-4 text-amber-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "resolved":
        return "text-green-600";
      case "in_progress":
        return "text-blue-600";
      case "closed":
        return "text-muted-foreground";
      default:
        return "text-amber-600";
    }
  };

  return (
    <div className="grid gap-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <SectionHeading
          eyebrow="Support"
          title="How can we help you?"
          description="Request a re-service, message our team, or browse your ticket history."
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="rounded-[28px] border-border/60 bg-card/95 shadow-soft overflow-hidden">
          <CardHeader className="bg-primary/5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <AlertCircle className="h-5 w-5" />
              </div>
              <CardTitle className="text-xl">Re-service Promise</CardTitle>
            </div>
            <CardDescription className="pt-2">
              If mosquitoes return between visits, we'll re-treat your yard at no charge.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <Button
              className="w-full rounded-xl shadow-brand"
              onClick={handleReService}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Submitting..." : "Request Free Re-service"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-border/60 bg-card/95 shadow-soft overflow-hidden">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <Phone className="h-5 w-5" />
              </div>
              <CardTitle className="text-xl">Contact Local Team</CardTitle>
            </div>
            <CardDescription className="pt-2">
              Speak with our team regarding your service or billing.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 grid gap-3">
            <Button variant="outline" className="w-full rounded-xl" asChild>
              <a href={siteConfig.phone.link}>
                <Phone className="mr-2 h-4 w-4 text-primary" />
                Call {siteConfig.phone.display}
              </a>
            </Button>
            <Button variant="outline" className="w-full rounded-xl" asChild>
              <a href={`sms:${siteConfig.phone.link.replace("tel:", "")}`}>
                <MessageCircle className="mr-2 h-4 w-4 text-primary" />
                Text {siteConfig.phone.display}
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Create New Ticket Form */}
      {showCreateForm && (
        <Card className="rounded-[28px] border-border/60 bg-card/95 shadow-soft">
          <CardHeader>
            <CardTitle>Create Support Ticket</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateTicket} className="space-y-4">
              <div>
                <label className="text-sm font-medium">Subject</label>
                <input
                  type="text"
                  value={newTicketSubject}
                  onChange={(e) => setNewTicketSubject(e.target.value)}
                  placeholder="Brief description of your issue..."
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-input bg-background"
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Message</label>
                <textarea
                  value={newTicketBody}
                  onChange={(e) => setNewTicketBody(e.target.value)}
                  placeholder="Tell us more details..."
                  rows={4}
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-input bg-background"
                  disabled={isSubmitting}
                />
              </div>
              <div className="flex gap-3">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl"
                >
                  {isSubmitting ? "Submitting..." : "Submit Ticket"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateForm(false)}
                  disabled={isSubmitting}
                  className="rounded-xl"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Ticket History */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HistoryIcon className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-lg font-semibold font-display">Support Tickets</h3>
          </div>
          {!showCreateForm && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCreateForm(true)}
              className="rounded-lg"
            >
              New Ticket
            </Button>
          )}
        </div>

        {isLoadingTickets ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : ticketLoadError && tickets.length === 0 ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 flex gap-3 items-start">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-900">Unable to Load Ticket History</p>
              <p className="text-xs text-red-700 mt-1">
                {isTimeoutError(ticketLoadError)
                  ? "The ticket history query exceeded 15 seconds. The rest of support is still available, so this looks like a slow read path or database policy issue."
                  : ticketLoadError}
              </p>
              <p className="text-xs text-red-600 mt-2">
                Please try refreshing the page or contact support if the issue persists.
              </p>
            </div>
          </div>
        ) : tickets.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/50 p-8 text-center">
            <p className="text-sm text-muted-foreground">No support tickets yet</p>
          </div>
        ) : (
          <>
            {ticketLoadError && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex gap-3 items-start">
                <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-900">Ticket history is delayed</p>
                  <p className="text-xs text-amber-700 mt-1">
                    {isTimeoutError(ticketLoadError)
                      ? "The history query exceeded 15 seconds, but support requests and ticket creation still work."
                      : ticketLoadError}
                  </p>
                </div>
              </div>
            )}
            <div className="grid gap-4">
              {tickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="flex items-center justify-between rounded-2xl border border-border/60 bg-card p-5 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start gap-4">
                    <div className="mt-1">
                      {getStatusIcon(ticket.status)}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">{ticket.subject}</p>
                      <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">
                        <span>#{ticket.id.slice(0, 8)}</span>
                        <span>â€¢</span>
                        <span>{new Date(ticket.created_at).toLocaleDateString()}</span>
                        <span>â€¢</span>
                        <Badge
                          variant="outline"
                          className={`h-auto py-0 text-[9px] uppercase ${
                            ticket.priority === "high"
                              ? "bg-red-50 text-red-700 border-red-200"
                              : ticket.priority === "medium"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-blue-50 text-blue-700 border-blue-200"
                          }`}
                        >
                          {ticket.priority}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <span className={`text-xs font-semibold ${getStatusColor(ticket.status)}`}>
                    {ticket.status.replace("_", " ")}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Support;
