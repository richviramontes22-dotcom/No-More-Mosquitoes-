import { useState } from "react";
import SectionHeading from "@/components/common/SectionHeading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, CheckCircle2, Clock, AlertTriangle, Eye, Settings2 } from "lucide-react";

interface EmailTemplate {
  id: string;
  name: string;
  trigger: string;
  type: "customer" | "employee" | "admin";
  status: "active" | "disabled";
  triggerStatus: "wired" | "pending";
  description: string;
  sentTo: string;
}

const TEMPLATES: EmailTemplate[] = [
  { id: "appointment_confirmation",   name: "Appointment Confirmation",   trigger: "Payment confirmed (checkout)",    type: "customer", status: "active", triggerStatus: "wired",   description: "Sent after a customer completes payment and an appointment is created.", sentTo: "Customer" },
  { id: "reminder_24h",               name: "24-Hour Reminder",           trigger: "Daily 7AM batch",                 type: "customer", status: "active", triggerStatus: "wired",   description: "Sent the day before a scheduled appointment.", sentTo: "Customer" },
  { id: "reminder_same_day",          name: "Same-Day Reminder",          trigger: "Daily 7AM batch",                 type: "customer", status: "active", triggerStatus: "wired",   description: "Sent the morning of an appointment.", sentTo: "Customer" },
  { id: "appointment_canceled",       name: "Appointment Canceled",       trigger: "Appointment cancellation",        type: "customer", status: "active", triggerStatus: "wired",   description: "Sent when an appointment is canceled by admin or customer.", sentTo: "Customer" },
  { id: "appointment_rescheduled",    name: "Appointment Rescheduled",    trigger: "Appointment reschedule",          type: "customer", status: "active", triggerStatus: "wired",   description: "Sent when an appointment is moved to a new date.", sentTo: "Customer" },
  { id: "service_completed",          name: "Service Completed",          trigger: "Technician marks complete",       type: "customer", status: "active", triggerStatus: "wired",   description: "Sent after a technician completes a service visit.", sentTo: "Customer" },
  { id: "payment_failed",             name: "Payment Failed",             trigger: "Stripe invoice.payment_failed",   type: "customer", status: "active", triggerStatus: "wired",   description: "Sent when a subscription payment fails.", sentTo: "Customer" },
  { id: "subscription_activated",     name: "Subscription Activated",     trigger: "Stripe invoice.paid (1st)",       type: "customer", status: "active", triggerStatus: "wired",   description: "Sent when a new subscription is activated.", sentTo: "Customer" },
  { id: "subscription_cancelled",     name: "Subscription Canceled",      trigger: "Stripe subscription.deleted",     type: "customer", status: "active", triggerStatus: "wired",   description: "Sent when a subscription is canceled.", sentTo: "Customer" },
  { id: "subscription_renewed",       name: "Subscription Renewed",       trigger: "Stripe invoice.paid (renewal)",   type: "customer", status: "active", triggerStatus: "wired",   description: "Sent on each successful subscription renewal.", sentTo: "Customer" },
  { id: "annual_plan_expiring",       name: "Annual Plan Expiring",       trigger: "Daily 10AM batch (30d / 7d)",    type: "customer", status: "active", triggerStatus: "wired",   description: "Warning sent 30 days and 7 days before annual plan expiration.", sentTo: "Customer" },
  { id: "annual_plan_expired",        name: "Annual Plan Expired",        trigger: "Daily 10AM batch",                type: "customer", status: "active", triggerStatus: "wired",   description: "Sent when an annual plan expires.", sentTo: "Customer" },
  { id: "lead_acknowledgement",       name: "Lead Acknowledgement",       trigger: "Contact form submission",         type: "customer", status: "active", triggerStatus: "wired",   description: "Sent to prospects who submit the contact/schedule form.", sentTo: "Prospect" },
  { id: "technician_en_route",        name: "Technician En Route",        trigger: "Technician marks en route (no phone)", type: "customer", status: "active", triggerStatus: "wired", description: "Email fallback for customers without a phone number.", sentTo: "Customer" },
  { id: "welcome_email",              name: "Welcome Email",              trigger: "Not yet wired",                   type: "customer", status: "active", triggerStatus: "pending", description: "Sent when a new customer account is created. Trigger pending.", sentTo: "Customer" },
  { id: "employee_assignment",        name: "Employee Assignment",        trigger: "Admin dispatches technician",     type: "employee", status: "active", triggerStatus: "wired",   description: "Sent to technicians when assigned, updated, or removed from a job.", sentTo: "Technician" },
];

const TYPE_COLORS: Record<string, string> = {
  customer: "bg-blue-100 text-blue-800",
  employee: "bg-purple-100 text-purple-800",
  admin:    "bg-amber-100 text-amber-800",
};

const EmailManagement = () => {
  const [filter, setFilter] = useState<"all" | "customer" | "employee">("all");
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);

  const filtered = TEMPLATES.filter(t => filter === "all" || t.type === filter);

  const wiredCount  = TEMPLATES.filter(t => t.triggerStatus === "wired").length;
  const pendingCount = TEMPLATES.filter(t => t.triggerStatus === "pending").length;

  return (
    <div className="grid gap-8 pb-20">
      <SectionHeading
        eyebrow="Communications"
        title="Email Management"
        description="View and manage all automated email templates. Edit templates by updating the code in server/services/notifications/emailTemplates.ts."
      />

      {/* Status bar */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="rounded-2xl border-border/60 bg-card/95">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-display font-bold">{wiredCount}</p>
              <p className="text-xs text-muted-foreground">Active triggers</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/60 bg-card/95">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-display font-bold">{pendingCount}</p>
              <p className="text-xs text-muted-foreground">Pending triggers</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/60 bg-card/95">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <Mail className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-display font-bold">{TEMPLATES.length}</p>
              <p className="text-xs text-muted-foreground">Total templates</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4">
        <Settings2 className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-blue-800">Template editing</p>
          <p className="text-xs text-blue-700 mt-0.5">
            Templates are defined in <code className="font-mono bg-blue-100 px-1 rounded">server/services/notifications/emailTemplates.ts</code>.
            Triggers are wired in route handlers and scheduled functions. The notification log is visible at <a href="/admin/notifications" className="underline">Notifications Log</a>.
          </p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(["all", "customer", "employee"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 text-sm font-semibold rounded-xl transition-colors capitalize ${
              filter === f ? "bg-primary text-primary-foreground" : "bg-muted/40 text-muted-foreground hover:bg-muted"
            }`}
          >
            {f === "all" ? "All Templates" : `${f.charAt(0).toUpperCase() + f.slice(1)} Emails`}
          </button>
        ))}
      </div>

      {/* Template table */}
      <div className="grid gap-3">
        {filtered.map(template => (
          <Card
            key={template.id}
            className={`rounded-2xl border-border/60 bg-card/95 cursor-pointer transition-all hover:border-primary/40 ${
              selectedTemplate?.id === template.id ? "border-primary/60 ring-1 ring-primary/20" : ""
            }`}
            onClick={() => setSelectedTemplate(selectedTemplate?.id === template.id ? null : template)}
          >
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Mail className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm">{template.name}</p>
                      <Badge className={`text-[10px] ${TYPE_COLORS[template.type]}`}>
                        {template.type}
                      </Badge>
                      {template.triggerStatus === "wired" ? (
                        <Badge className="text-[10px] bg-green-100 text-green-800">
                          <CheckCircle2 className="h-2.5 w-2.5 mr-1" />Active
                        </Badge>
                      ) : (
                        <Badge className="text-[10px] bg-amber-100 text-amber-800">
                          <Clock className="h-2.5 w-2.5 mr-1" />Trigger pending
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Sent to: <strong>{template.sentTo}</strong> · Trigger: {template.trigger}
                    </p>
                  </div>
                </div>
                <Eye className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
              </div>

              {/* Expanded detail */}
              {selectedTemplate?.id === template.id && (
                <div className="mt-4 pt-4 border-t border-border/40 space-y-3">
                  <p className="text-sm text-muted-foreground">{template.description}</p>
                  <div className="grid gap-2 sm:grid-cols-2 text-xs">
                    <div className="rounded-xl bg-muted/40 p-3">
                      <p className="font-semibold text-foreground mb-1">Template ID</p>
                      <code className="font-mono text-primary">{template.id}</code>
                    </div>
                    <div className="rounded-xl bg-muted/40 p-3">
                      <p className="font-semibold text-foreground mb-1">Function name</p>
                      <code className="font-mono text-primary">
                        build{template.id.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join('')}Email
                      </code>
                    </div>
                    <div className="rounded-xl bg-muted/40 p-3 sm:col-span-2">
                      <p className="font-semibold text-foreground mb-1">Trigger</p>
                      <p className="text-muted-foreground">{template.trigger}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl text-xs"
                      onClick={(e) => { e.stopPropagation(); window.open('/admin/notifications', '_blank'); }}
                    >
                      View Send History
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Footer note */}
      <Card className="rounded-2xl border-amber-200 bg-amber-50/50">
        <CardContent className="px-6 py-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-semibold">Resend must be configured for emails to send</p>
              <p className="text-xs mt-0.5">Set <code className="bg-amber-100 px-1 rounded font-mono">RESEND_API_KEY</code> and <code className="bg-amber-100 px-1 rounded font-mono">RESEND_FROM_EMAIL</code> in your Netlify environment variables. Without these, emails are logged but not delivered.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EmailManagement;
