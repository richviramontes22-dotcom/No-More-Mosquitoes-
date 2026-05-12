import { useEffect, useState, useMemo } from "react";
import SectionHeading from "@/components/common/SectionHeading";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, parseISO } from "date-fns";
import { supabase } from "@/lib/supabase";
import { useEmployee } from "@/hooks/employee/useEmployee";
import { downloadCsv } from "@/lib/csv";

interface Shift {
  id: string;
  shift_date: string;
  clock_in_at: string | null;
  clock_out_at: string | null;
  break_minutes: number;
  notes: string | null;
}

const fmtTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";

const diffMinutes = (a: string | null, b: string | null): number => {
  if (!a || !b) return 0;
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000);
};

const fmtDuration = (mins: number) => {
  if (mins <= 0) return "—";
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
};

const Timesheets = () => {
  const { data: employee, isLoading: empLoading } = useEmployee();
  const [weekAnchor, setWeekAnchor] = useState(new Date());
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const { weekStart, weekEnd } = useMemo(() => ({
    weekStart: startOfWeek(weekAnchor, { weekStartsOn: 0 }),
    weekEnd: endOfWeek(weekAnchor, { weekStartsOn: 0 }),
  }), [weekAnchor]);

  useEffect(() => {
    if (!employee?.id) return;
    const load = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from("shifts")
          .select("id, shift_date, clock_in_at, clock_out_at, break_minutes, notes")
          .eq("employee_id", employee.id)
          .gte("shift_date", format(weekStart, "yyyy-MM-dd"))
          .lte("shift_date", format(weekEnd, "yyyy-MM-dd"))
          .order("shift_date", { ascending: true });

        if (!error) setShifts((data as Shift[]) || []);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [employee?.id, weekStart, weekEnd]);

  const totalWorked = useMemo(() =>
    shifts.reduce((sum, s) => sum + Math.max(0, diffMinutes(s.clock_in_at, s.clock_out_at) - (s.break_minutes || 0)), 0),
  [shifts]);

  const handleExport = () => {
    downloadCsv(`timesheet-${format(weekStart, "yyyy-MM-dd")}.csv`, shifts.map(s => ({
      date: s.shift_date,
      clockIn: fmtTime(s.clock_in_at),
      clockOut: fmtTime(s.clock_out_at),
      breakMinutes: s.break_minutes,
      workedMinutes: Math.max(0, diffMinutes(s.clock_in_at, s.clock_out_at) - (s.break_minutes || 0)),
      notes: s.notes || "",
    })));
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
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center">
        <p className="font-semibold text-amber-900">No employee record found.</p>
        <p className="text-sm text-amber-700 mt-1">Contact your administrator.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <SectionHeading
          eyebrow="Timesheets"
          title="Your hours"
          description="Weekly clock-in/out records and worked hours."
        />
        <Button variant="outline" size="sm" onClick={handleExport} className="rounded-xl self-start sm:self-auto">
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Week navigator */}
      <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-card/95 px-5 py-3">
        <button onClick={() => setWeekAnchor(subWeeks(weekAnchor, 1))} className="p-1 rounded-lg hover:bg-muted transition">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="text-center">
          <p className="font-semibold text-sm">
            {format(weekStart, "MMM d")} – {format(weekEnd, "MMM d, yyyy")}
          </p>
          <p className="text-xs text-muted-foreground">Total: {fmtDuration(totalWorked)}</p>
        </div>
        <button onClick={() => setWeekAnchor(addWeeks(weekAnchor, 1))} className="p-1 rounded-lg hover:bg-muted transition">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : shifts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">
          No shifts recorded this week.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border/60">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Clock In</TableHead>
                <TableHead>Clock Out</TableHead>
                <TableHead>Break</TableHead>
                <TableHead>Worked</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shifts.map((s) => {
                const worked = Math.max(0, diffMinutes(s.clock_in_at, s.clock_out_at) - (s.break_minutes || 0));
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">
                      {format(parseISO(s.shift_date), "EEE, MMM d")}
                    </TableCell>
                    <TableCell>{fmtTime(s.clock_in_at)}</TableCell>
                    <TableCell>{fmtTime(s.clock_out_at)}</TableCell>
                    <TableCell>{s.break_minutes ? `${s.break_minutes}m` : "—"}</TableCell>
                    <TableCell className="font-semibold text-primary">{fmtDuration(worked)}</TableCell>
                  </TableRow>
                );
              })}
              <TableRow className="bg-muted/30 font-semibold">
                <TableCell colSpan={4} className="text-right text-sm">Week total</TableCell>
                <TableCell className="text-primary">{fmtDuration(totalWorked)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default Timesheets;
