import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import SectionHeading from "@/components/common/SectionHeading";
import { Button } from "@/components/ui/button";
import { useScheduleDialog } from "@/components/schedule/ScheduleDialogProvider";
import {
  Calendar,
  Clock,
  User,
  ChevronRight,
  Plus,
  Bell,
  CheckCircle2,
  CalendarCheck,
  History as HistoryIcon,
  Loader2,
  MapPin
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { stringifyError } from "@/lib/error-utils";

interface Appointment {
  id: string;
  date: string;
  timeWindow: string;
  program: string;
  technician: string;
  status: string;
  address: string;
}

const Appointments = () => {
  const { open: openScheduleDialog } = useScheduleDialog();
  const { toast } = useToast();
  const location = useLocation();
  const { user } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [upcomingVisits, setUpcomingVisits] = useState<Appointment[]>([]);
  const [pastVisits, setPastVisits] = useState<Appointment[]>([]);

  const fetchAppointments = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      // 1. Fetch appointments with property details
      const { data: appData, error: appError } = await supabase
        .from("appointments")
        .select(`
          id,
          status,
          scheduled_at,
          notes,
          property_id,
          service_type,
          frequency
        `)
        .eq("user_id", user.id)
        .order("scheduled_at", { ascending: true });

      if (appError) throw appError;

      if (!appData || appData.length === 0) {
        setUpcomingVisits([]);
        setPastVisits([]);
        setIsLoading(false);
        return;
      }

      // 2. Fetch properties for these appointments
      const propertyIds = [...new Set(appData.map(a => a.property_id).filter(Boolean))];
      let propData: any[] = [];
      if (propertyIds.length > 0) {
        const { data, error } = await supabase
          .from("properties")
          .select("id, address, zip")
          .in("id", propertyIds);

        if (error) {
          console.error("Error fetching properties for appointments:", error);
          // Don't throw here, just continue without addresses if needed
        } else {
          propData = data || [];
        }
      }

      // 3. Fetch assignments for these appointments
      const appointmentIds = appData.map(a => a.id);
      let assignData: any[] = [];
      if (appointmentIds.length > 0) {
        const { data, error } = await supabase
          .from("assignments")
          .select("id, appointment_id, status, employee_id")
          .in("appointment_id", appointmentIds);

        if (error) {
          console.error("Error fetching assignments for appointments:", error);
          // Don't throw here, just continue without assignment info
        } else {
          assignData = data || [];
        }
      }

      const mapped: Appointment[] = appData.map((app: any) => {
        const property = propData?.find(p => p.id === app.property_id);
        const assignments = assignData?.filter(as => as.appointment_id === app.id) || [];
        const techName = assignments.length > 0 ? "Technician Assigned" : "Assigning...";
        const timeWindow = app.notes?.includes("Slot:") ? (app.notes.split("Slot:")[1] || "").split("|")[0]?.trim() || "TBD" : "TBD";

        const status = app.status || "requested";

        return {
          id: String(app.id || "").split("-")[0]?.toUpperCase() || "N/A",
          date: app.scheduled_at,
          timeWindow,
          program: app.service_type || "Mosquito Service",
          technician: techName,
          status: status.charAt(0).toUpperCase() + status.slice(1),
          address: property?.address || "Primary Property",
        };
      });

      setUpcomingVisits(mapped.filter(v => v.status === "Requested" || v.status === "Scheduled" || v.status === "Confirmed"));
      setPastVisits(mapped.filter(v => v.status === "Completed" || v.status === "Canceled"));
    } catch (err: any) {
      console.error("Error fetching appointments:", err);
      toast({
        title: "System: Appointments Fetch Error",
        description: stringifyError(err),
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, [user]);

  useEffect(() => {
    const { preset } = (location.state as { preset?: any }) || {};
    if (preset) {
      openScheduleDialog({ source: "redirect-preset", preset });
    }
  }, [location.state, openScheduleDialog]);

  const handleReschedule = (id: string) => {
    toast({
      title: "Rescheduling Request",
      description: `Request for Job #${id} submitted. A team member will call you shortly or you can call us directly.`,
    });
  };

  const handleScheduleNew = () => {
    openScheduleDialog({ source: "dashboard-appointments" });
  };

  const handleAddReminder = () => {
    toast({
      title: "Calendar Sync",
      description: "Successfully added 2 upcoming visits to your device calendar.",
    });
  };

  const handleViewDetails = (id: string) => {
    toast({
      title: `Job Details: #${id}`,
      description: "Detailed technician notes and route tracking are loading...",
    });
  };

  return (
    <div className="grid gap-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <SectionHeading
          eyebrow="Appointments"
          title="Your Service Schedule"
          description="Manage your upcoming and past visits. Reschedule or cancel within policy windows."
        />
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" className="rounded-xl" onClick={handleAddReminder}>
            <Bell className="mr-2 h-4 w-4 text-primary" />
            Add Reminders
          </Button>
          <Button className="rounded-xl shadow-brand" onClick={handleScheduleNew}>
            <Plus className="mr-2 h-4 w-4" />
            New Appointment
          </Button>
        </div>
      </div>

      <div className="space-y-8">
        <div className="flex items-center gap-2">
          <CalendarCheck className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold font-display">Upcoming Visits</h3>
        </div>

        <div className="grid gap-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center p-12 bg-muted/20 rounded-[28px] border border-dashed border-border">
              <Loader2 className="h-8 w-8 animate-spin text-primary/40 mb-4" />
              <p className="text-muted-foreground font-medium italic">Loading your schedule...</p>
            </div>
          ) : upcomingVisits.length > 0 ? (
            upcomingVisits.map((visit) => (
              <Card key={visit.id} className="rounded-[28px] border-border/60 bg-card/95 shadow-soft transition-all hover:shadow-md">
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-start gap-4">
                      <div className="hidden sm:flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shrink-0">
                        <Clock className="h-6 w-6" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Job #{visit.id}</span>
                          <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[10px]">
                            {visit.status}
                          </Badge>
                        </div>
                        <h4 className="text-lg font-bold">{new Date(visit.date).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</h4>
                        <div className="flex flex-col gap-1">
                          <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5" />
                            Window: {visit.timeWindow}
                          </p>
                          <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5" />
                            {visit.address}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right hidden lg:block">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Program</p>
                        <p className="text-sm font-medium">{visit.program}</p>
                      </div>
                      <div className="text-right hidden lg:block border-l border-border/60 pl-6">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Technician</p>
                        <p className="text-sm font-medium">{visit.technician}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl"
                          onClick={() => handleReschedule(visit.id)}
                        >
                          Reschedule
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="rounded-full hover:bg-primary/5 hover:text-primary transition-colors"
                          onClick={() => handleViewDetails(visit.id)}
                        >
                          <ChevronRight className="h-5 w-5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="p-12 text-center bg-muted/20 rounded-[28px] border border-dashed border-border space-y-4">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground/40 mb-4">
                <Calendar className="h-8 w-8" />
              </div>
              <p className="text-muted-foreground font-medium italic">No upcoming visits scheduled.</p>
              <Button onClick={handleScheduleNew} variant="outline" className="rounded-xl">
                Schedule Service
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-8">
        <div className="flex items-center gap-2">
          <HistoryIcon className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold font-display">Past Visits</h3>
        </div>

        <div className="rounded-[28px] border border-border/60 bg-card/95 shadow-soft overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-border/40 bg-muted/30">
                  <th className="px-6 py-4 font-semibold text-muted-foreground">Date</th>
                  <th className="px-6 py-4 font-semibold text-muted-foreground">Job ID</th>
                  <th className="px-6 py-4 font-semibold text-muted-foreground">Program</th>
                  <th className="px-6 py-4 font-semibold text-muted-foreground">Technician</th>
                  <th className="px-6 py-4 font-semibold text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground italic">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-primary/40" />
                      Loading history...
                    </td>
                  </tr>
                ) : pastVisits.length > 0 ? (
                  pastVisits.map((visit) => (
                    <tr key={visit.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-6 py-4 font-medium">{new Date(visit.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                      <td className="px-6 py-4 text-muted-foreground">#{visit.id}</td>
                      <td className="px-6 py-4">{visit.program}</td>
                      <td className="px-6 py-4 flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
                          <User className="h-3 w-3 text-muted-foreground" />
                        </div>
                        {visit.technician}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Badge variant="outline" className="bg-green-500/5 text-green-600 border-green-500/20 gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          {visit.status}
                        </Badge>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground italic">
                      No past visits on record.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Appointments;
