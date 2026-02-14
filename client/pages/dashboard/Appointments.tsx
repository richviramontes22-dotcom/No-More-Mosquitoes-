import SectionHeading from "@/components/common/SectionHeading";
import { Button } from "@/components/ui/button";

const Appointments = () => {
  return (
    <div className="grid gap-8">
      <SectionHeading
        eyebrow="Appointments"
        title="Manage your upcoming and past visits"
        description="Reschedule or cancel within policy windows. Add new visits whenever you need."
      />
      <div className="flex flex-wrap gap-3">
        <Button className="rounded-full">Schedule New Appointment</Button>
        <Button variant="secondary" className="rounded-full">Add Calendar Reminder</Button>
      </div>
      <div className="rounded-2xl border border-border/70 bg-card/95 p-6 text-sm text-muted-foreground">
        Your upcoming and past visits will appear here once connected to your account data.
      </div>
    </div>
  );
};

export default Appointments;
