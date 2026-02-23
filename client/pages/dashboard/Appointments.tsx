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
  History as HistoryIcon
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

const Appointments = () => {
  const { open: openScheduleDialog } = useScheduleDialog();
  const { toast } = useToast();

  const upcomingVisits = [
    {
      id: "OC-1280",
      date: "2024-12-14",
      timeWindow: "9:00–11:00 AM",
      program: "Mosquito Subscription",
      technician: "Alicia P.",
      status: "Confirmed",
    },
    {
      id: "OC-1312",
      date: "2025-01-04",
      timeWindow: "2:00–4:00 PM",
      program: "Tick Add-on",
      technician: "Michael R.",
      status: "Tentative",
    },
  ];

  const pastVisits = [
    {
      id: "OC-1244",
      date: "2024-11-30",
      program: "Mosquito Subscription",
      technician: "Alicia P.",
      status: "Completed",
    },
    {
      id: "OC-1201",
      date: "2024-11-09",
      program: "Mosquito Subscription",
      technician: "Michael R.",
      status: "Completed",
    },
  ];

  const handleScheduleNew = () => {
    openScheduleDialog({ source: "dashboard-appointments" });
  };

  const handleAddReminder = () => {
    toast({
      title: "Calendar Sync",
      description: "Successfully added 2 upcoming visits to your device calendar.",
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
          {upcomingVisits.map((visit) => (
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
                      <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        Window: {visit.timeWindow}
                      </p>
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
                      <Button variant="outline" size="sm" className="rounded-xl">Reschedule</Button>
                      <Button variant="ghost" size="icon" className="rounded-full hover:bg-primary/5 hover:text-primary transition-colors">
                        <ChevronRight className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
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
                {pastVisits.map((visit) => (
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
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Appointments;
