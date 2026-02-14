import { useEffect, useMemo, useState } from "react";
import SectionHeading from "@/components/common/SectionHeading";
import { ClockWidget } from "@/components/employee/ClockWidget";
import { clockIn, clockOut, getAssignments } from "@/lib/employee/api";

const EMPLOYEE_ID = "e_1";

const Dashboard = () => {
  const [assignments, setAssignments] = useState<Array<any>>([]);
  const [shiftId, setShiftId] = useState<string | null>(null);

  useEffect(() => {
    getAssignments(EMPLOYEE_ID).then(setAssignments).catch(() => setAssignments([]));
  }, []);

  const completed = useMemo(() => assignments.filter((a) => a.status === "completed").length, [assignments]);

  return (
    <div className="grid gap-8">
      <SectionHeading eyebrow="Employee" title="Today on your route" description="Clock in, review your stops, and message dispatch." />
      <ClockWidget
        onClockIn={async (geo) => {
          const res = await clockIn(EMPLOYEE_ID, geo);
          setShiftId(res.shift?.id ?? null);
        }}
        onClockOut={async (geo) => {
          if (!shiftId) return;
          await clockOut(shiftId, geo);
          setShiftId(null);
        }}
      />
      <div className="grid gap-6 sm:grid-cols-3">
        <div className="rounded-2xl border border-border/70 bg-card/95 p-6">
          <p className="text-sm text-muted-foreground">Stops today</p>
          <p className="mt-2 text-3xl font-display">{assignments.length}</p>
        </div>
        <div className="rounded-2xl border border-border/70 bg-card/95 p-6">
          <p className="text-sm text-muted-foreground">Completed</p>
          <p className="mt-2 text-3xl font-display">{completed}</p>
        </div>
        <div className="rounded-2xl border border-border/70 bg-card/95 p-6">
          <p className="text-sm text-muted-foreground">Next stop</p>
          <p className="mt-2 text-3xl font-display">{assignments[0]?.time ?? "—"}</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
