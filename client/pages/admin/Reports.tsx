import { useState } from "react";
import SectionHeading from "@/components/common/SectionHeading";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { downloadCsv } from "@/lib/csv";
import { useToast } from "@/hooks/use-toast";

const Reports = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);

  const withLoading = async (key: string, fn: () => Promise<void>) => {
    setLoading(key);
    try {
      await fn();
    } catch (err: any) {
      toast({ title: "Export failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(null);
    }
  };

  const exportCustomers = () =>
    withLoading("customers", async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, email, phone, role, created_at")
        .neq("role", "admin")
        .order("created_at", { ascending: false });
      if (error) throw error;
      downloadCsv("customers.csv", (data || []).map(r => ({
        id: r.id, name: r.name, email: r.email, phone: r.phone ?? "",
        role: r.role, createdAt: r.created_at,
      })));
    });

  const exportProperties = () =>
    withLoading("properties", async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("id, user_id, address, city, zip, acreage, plan, cadence, program, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      downloadCsv("properties.csv", (data || []).map(r => ({
        id: r.id, customerId: r.user_id,
        address: [r.address, r.city, r.zip].filter(Boolean).join(", "),
        acreage: r.acreage ?? "", plan: r.plan ?? "", cadence: r.cadence ?? "",
        program: r.program ?? "", createdAt: r.created_at,
      })));
    });

  const exportAppointments = () =>
    withLoading("appointments", async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("id, user_id, property_id, status, scheduled_at, service_type, notes, created_at")
        .order("scheduled_at", { ascending: false });
      if (error) throw error;
      downloadCsv("appointments.csv", (data || []).map(r => ({
        id: r.id, customerId: r.user_id ?? "", propertyId: r.property_id ?? "",
        status: r.status, scheduledAt: r.scheduled_at ?? "",
        serviceType: r.service_type ?? "", notes: r.notes ?? "",
        createdAt: r.created_at,
      })));
    });

  const exportTickets = () =>
    withLoading("tickets", async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("id, user_id, subject, description, priority, status, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      downloadCsv("tickets.csv", (data || []).map(r => ({
        id: r.id, customerId: r.user_id, subject: r.subject,
        description: r.description ?? "", priority: r.priority,
        status: r.status, createdAt: r.created_at,
      })));
    });

  const exportSubscriptions = () =>
    withLoading("subscriptions", async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("id, user_id, stripe_subscription_id, status, current_period_end, cancel_at_period_end, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      downloadCsv("subscriptions.csv", (data || []).map(r => ({
        id: r.id, customerId: r.user_id ?? "",
        stripeSubscriptionId: r.stripe_subscription_id ?? "",
        status: r.status, currentPeriodEnd: r.current_period_end ?? "",
        cancelAtPeriodEnd: r.cancel_at_period_end, createdAt: r.created_at,
      })));
    });

  const btn = (key: string, label: string, onClick: () => void) => (
    <Button key={key} onClick={onClick} disabled={loading !== null} className="flex items-center gap-2">
      {loading === key && <Loader2 className="h-4 w-4 animate-spin" />}
      {label}
    </Button>
  );

  return (
    <div className="grid gap-8">
      <SectionHeading
        eyebrow="Reports"
        title="Exports and analytics"
        description="CSV exports of live data from customers, appointments, tickets, and subscriptions."
      />
      <div className="grid gap-4 rounded-2xl border border-border/70 bg-card/95 p-4 sm:grid-cols-2 lg:grid-cols-3">
        {btn("customers", "Export customers", exportCustomers)}
        {btn("properties", "Export properties", exportProperties)}
        {btn("appointments", "Export appointments", exportAppointments)}
        {btn("tickets", "Export tickets", exportTickets)}
        {btn("subscriptions", "Export subscriptions", exportSubscriptions)}
      </div>
    </div>
  );
};

export default Reports;
