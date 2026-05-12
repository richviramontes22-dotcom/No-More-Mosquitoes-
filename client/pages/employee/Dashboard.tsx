import { useState } from "react";
import { Loader2 } from "lucide-react";
import SectionHeading from "@/components/common/SectionHeading";
import { ClockWidget } from "@/components/employee/ClockWidget";
import { useEmployee } from "@/hooks/employee/useEmployee";
import { useEmployeeAssignments } from "@/hooks/employee/useEmployeeAssignments";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";

const Dashboard = () => {
  const { data: employee, isLoading: empLoading } = useEmployee();
  const { data: assignments = [], isLoading: assignLoading } = useEmployeeAssignments(employee?.id);
  const [shiftId, setShiftId] = useState<string | null>(null);

  const completed = assignments.filter((a) => a.status === "completed").length;
  const next = assignments.find((a) => a.status !== "completed");

  const handleClockIn = async (geo?: GeolocationPosition) => {
    if (!employee) return;
    const today = format(new Date(), "yyyy-MM-dd");
    const { data, error } = await supabase
      .from("shifts")
      .insert({
        employee_id: employee.id,
        shift_date: today,
        clock_in_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (!error && data) setShiftId(data.id);
  };

  const handleClockOut = async (geo?: GeolocationPosition) => {
    if (!shiftId || !employee) return;
    await supabase
      .from("shifts")
      .update({ clock_out_at: new Date().toISOString() })
      .eq("id", shiftId)
      .eq("employee_id", employee.id);
    setShiftId(null);
  };

  if (empLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center space-y-2">
        <p className="font-semibold text-amber-900">No employee record found</p>
        <p className="text-sm text-amber-700">
          Your account hasn't been linked to an employee profile yet. Please contact your administrator.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-8">
      <SectionHeading
        eyebrow="Employee"
        title="Today on your route"
        description="Clock in, review your stops, and message dispatch."
      />
      <ClockWidget onClockIn={handleClockIn} onClockOut={handleClockOut} />
      <div className="grid gap-6 sm:grid-cols-3">
        <div className="rounded-2xl border border-border/70 bg-card/95 p-6">
          <p className="text-sm text-muted-foreground">Stops today</p>
          <p className="mt-2 text-3xl font-display">
            {assignLoading ? "—" : assignments.length}
          </p>
        </div>
        <div className="rounded-2xl border border-border/70 bg-card/95 p-6">
          <p className="text-sm text-muted-foreground">Completed</p>
          <p className="mt-2 text-3xl font-display">
            {assignLoading ? "—" : completed}
          </p>
        </div>
        <div className="rounded-2xl border border-border/70 bg-card/95 p-6">
          <p className="text-sm text-muted-foreground">Next stop</p>
          <p className="mt-2 text-3xl font-display">
            {assignLoading ? "—" : next?.scheduled_at
              ? new Date(next.scheduled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : "—"}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
