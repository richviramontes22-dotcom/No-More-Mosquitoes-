import { useState } from "react";
import SectionHeading from "@/components/common/SectionHeading";
import { Button } from "@/components/ui/button";
import {
  LifeBuoy,
  Phone,
  MessageCircle,
  History as HistoryIcon,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowRight
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

const Support = () => {
  const { toast } = useToast();
  const [isRequesting, setIsSubmitting] = useState(false);

  const tickets = [
    {
      id: "TKT-4421",
      subject: "Re-service request: Back slope",
      status: "Resolved",
      date: "2024-11-15",
      type: "Re-service"
    },
    {
      id: "TKT-4390",
      subject: "Billing question: Annual prepay",
      status: "Closed",
      date: "2024-10-05",
      type: "General"
    },
  ];

  const handleReService = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      toast({
        title: "Request Submitted",
        description: "Your re-service request has been logged. A technician will be dispatched within 48 hours.",
      });
    }, 1500);
  };

  return (
    <div className="grid gap-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <SectionHeading
          eyebrow="Support"
          title="How can we help you?"
          description="Request a re‑service, message our local team, or browse your ticket history."
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
              disabled={isRequesting}
            >
              {isRequesting ? "Submitting..." : "Request Free Re-service"}
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
              Speak with Richard or Maya regarding your service or billing.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 grid gap-3">
            <Button variant="outline" className="w-full rounded-xl" asChild>
              <a href="tel:+19497630492">
                <Phone className="mr-2 h-4 w-4 text-primary" />
                Call (949) 763‑0492
              </a>
            </Button>
            <Button variant="outline" className="w-full rounded-xl" asChild>
              <a href="sms:+19497630492">
                <MessageCircle className="mr-2 h-4 w-4 text-primary" />
                Text (949) 763‑0492
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <HistoryIcon className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold font-display">Recent Tickets</h3>
        </div>

        <div className="grid gap-4">
          {tickets.map((ticket) => (
            <div
              key={ticket.id}
              className="flex items-center justify-between rounded-2xl border border-border/60 bg-card p-5 shadow-sm"
            >
              <div className="flex items-start gap-4">
                <div className={`mt-1 flex h-2 w-2 rounded-full ${ticket.status === 'Resolved' ? 'bg-green-500' : 'bg-muted-foreground'}`} />
                <div>
                  <p className="text-sm font-bold text-foreground">{ticket.subject}</p>
                  <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">
                    <span>#{ticket.id}</span>
                    <span>•</span>
                    <span>{new Date(ticket.date).toLocaleDateString()}</span>
                    <span>•</span>
                    <Badge variant="outline" className="h-auto py-0 text-[9px] uppercase">{ticket.type}</Badge>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {ticket.status === 'Resolved' ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <Clock className="h-4 w-4 text-muted-foreground" />
                )}
                <span className={`text-xs font-semibold ${ticket.status === 'Resolved' ? 'text-green-600' : 'text-muted-foreground'}`}>
                  {ticket.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Support;
