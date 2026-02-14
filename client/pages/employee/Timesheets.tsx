import { useEffect, useMemo, useState, Fragment } from "react";
import SectionHeading from "@/components/common/SectionHeading";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getTimesheets } from "@/lib/employee/api";
import { downloadCsv } from "@/lib/csv";
import {
  addDays,
  eachDayOfInterval,
  endOfDay,
  endOfWeek,
  format,
  isSameDay,
  min as dateMin,
  parseISO,
  startOfDay,
  startOfWeek,
} from "date-fns";

const EMPLOYEE_ID = "e_1";

type Event = { id: string; shift_id: string; event_type: string; ts: string; geo?: any; meta?: Record<string, unknown> };

type DayRow = {
  date: string; // yyyy-MM-dd
  clockIn?: string;
  clockOut?: string;
  totals: { work: number; break: number; travel: number };
  segments: Array<{ kind: "work" | "break" | "travel"; start: string; end: string }>;
  events: Event[];
};

const minutes = (ms: number) => Math.max(0, Math.round(ms / 60000));
const fmtHm = (d?: Date | string) => (d ? format(typeof d === "string" ? parseISO(d) : d, "p") : "—");
const fmtDate = (iso: string) => format(parseISO(iso), "EEE MMM d");
const fmtHrs = (mins: number) => `${Math.floor(mins / 60)}h ${mins % 60}m`;

const getWeekRange = (anchor: Date) => {
  const start = startOfWeek(anchor, { weekStartsOn: 0 }); // Sunday
  const end = endOfWeek(anchor, { weekStartsOn: 0 });
  return { start, end };
};

function computeSegments(events: Event[], dateIso: string) {
  const day = parseISO(dateIso);
  const dayStart = startOfDay(day);
  const dayEnd = endOfDay(day);
  const now = new Date();

  const sorted = [...events].sort((a, b) => a.ts.localeCompare(b.ts));
  const segs: Array<{ kind: "work" | "break" | "travel"; start: Date; end: Date }> = [];
  const totals = { work: 0, break: 0, travel: 0 };

  let current: { kind: "work" | "break" | "travel" | null; start: Date | null } = {
    kind: null,
    start: null,
  };

  const close = (endAt: Date) => {
    if (current.kind && current.start) {
      const startAt = current.start;
      const endAtClamped = endAt < startAt ? startAt : endAt;
      const m = minutes(endAtClamped.getTime() - startAt.getTime());
      if (m > 0) {
        segs.push({ kind: current.kind, start: startAt, end: endAtClamped });
        totals[current.kind] += m as number;
      }
    }
    current = { kind: null, start: null };
  };

  for (const e of sorted) {
    const ts = parseISO(e.ts);
    switch (e.event_type) {
      case "clock_in":
        close(ts);
        current = { kind: "work", start: ts };
        break;
      case "break_start":
        close(ts);
        current = { kind: "break", start: ts };
        break;
      case "break_end":
        close(ts);
        current = { kind: "work", start: ts };
        break;
      case "travel_start":
        close(ts);
        current = { kind: "travel", start: ts };
        break;
      case "travel_end":
        close(ts);
        current = { kind: "work", start: ts };
        break;
      case "clock_out":
        close(ts);
        break;
      default:
        // other events do not change the timeline state
        break;
    }
  }

  if (current.kind && current.start) {
    const endAt = isSameDay(day, now) ? dateMin([now, dayEnd]) : dayEnd;
    close(endAt);
  }

  return { segs, totals };
}

function buildRowsForWeek(
  weekStart: Date,
  weekEnd: Date,
  shifts: any[],
  events: Event[],
): DayRow[] {
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const byShiftId = new Map<string, any>();
  shifts.forEach((s) => byShiftId.set(s.id, s));

  // Map shift_date to events
  const byDate = new Map<string, Event[]>();
  for (const e of events) {
    const s = byShiftId.get(e.shift_id);
    const key = s?.shift_date as string | undefined;
    if (!key) continue;
    const arr = byDate.get(key) || [];
    arr.push(e);
    byDate.set(key, arr);
  }

  const rows: DayRow[] = days.map((d) => {
    const iso = format(d, "yyyy-MM-dd");
    const shift = shifts.find((s) => s.shift_date === iso);
    const evs = (byDate.get(iso) || []).sort((a, b) => a.ts.localeCompare(b.ts));

    const { segs, totals } = computeSegments(evs, iso);
    const firstClockIn = evs.find((e) => e.event_type === "clock_in");
    const lastClockOut = [...evs].reverse().find((e) => e.event_type === "clock_out");

    const clockIn = shift?.clock_in_at || firstClockIn?.ts;
    const clockOut = shift?.clock_out_at || lastClockOut?.ts;

    return {
      date: iso,
      clockIn,
      clockOut,
      totals,
      segments: segs.map((s) => ({ kind: s.kind, start: s.start.toISOString(), end: s.end.toISOString() })),
      events: evs,
    } as DayRow;
  });

  // Sort descending by date
  return rows.sort((a, b) => b.date.localeCompare(a.date));
}

const Legend = () => (
  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
    <span className="flex items-center gap-1"><i className="h-2 w-2 rounded bg-emerald-500" /> Work</span>
    <span className="flex items-center gap-1"><i className="h-2 w-2 rounded bg-amber-400" /> Break</span>
    <span className="flex items-center gap-1"><i className="h-2 w-2 rounded bg-sky-500" /> Travel</span>
  </div>
);

const Timesheets = () => {
  const [anchor, setAnchor] = useState<Date>(new Date());
  const { start: weekStart, end: weekEnd } = useMemo(() => getWeekRange(anchor), [anchor]);
  const [rows, setRows] = useState<DayRow[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const fromIso = format(weekStart, "yyyy-MM-dd");
    const toIso = format(weekEnd, "yyyy-MM-dd");
    getTimesheets(EMPLOYEE_ID, fromIso, toIso)
      .then((r) => setRows(buildRowsForWeek(weekStart, weekEnd, r.shifts || [], r.events || [])))
      .catch(() => setRows(buildRowsForWeek(weekStart, weekEnd, [], [])));
  }, [weekStart.getTime(), weekEnd.getTime()]);

  const weeklyTotals = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        acc.work += r.totals.work;
        acc.break += r.totals.break;
        acc.travel += r.totals.travel;
        return acc;
      },
      { work: 0, break: 0, travel: 0 },
    );
  }, [rows]);

  const exportCsv = () => {
    const data = rows
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((r) => {
        const total = r.totals.work + r.totals.travel; // total on shift
        const overtime = Math.max(0, r.totals.work - 8 * 60);
        return {
          date: r.date,
          clock_in: r.clockIn ? fmtHm(r.clockIn) : "",
          clock_out: r.clockOut ? fmtHm(r.clockOut) : "",
          work_minutes: r.totals.work,
          break_minutes: r.totals.break,
          travel_minutes: r.totals.travel,
          total_minutes: total,
          overtime_minutes: overtime,
        };
      });
    downloadCsv(`timesheet_${format(weekStart, "yyyyMMdd")}_${format(weekEnd, "yyyyMMdd")}.csv`, data as any);
  };

  const printPage = () => {
    window.print();
  };

  const toggleAll = (open: boolean) => {
    const next: Record<string, boolean> = {};
    for (const r of rows) next[r.date] = open;
    setExpanded(next);
  };

  const renderTimeline = (r: DayRow) => {
    const day = parseISO(r.date);
    const dayStart = startOfDay(day).getTime();
    const dayEnd = endOfDay(day).getTime();
    const dayMs = dayEnd - dayStart;
    return (
      <div className="mt-3">
        <div className="relative h-2 w-full rounded bg-muted">
          {r.segments.map((s, idx) => {
            const sStart = parseISO(s.start).getTime();
            const sEnd = parseISO(s.end).getTime();
            const left = ((sStart - dayStart) / dayMs) * 100;
            const width = Math.max(0.5, ((sEnd - sStart) / dayMs) * 100);
            const color = s.kind === "work" ? "bg-emerald-500" : s.kind === "break" ? "bg-amber-400" : "bg-sky-500";
            return (
              <div
                key={idx}
                className={`absolute top-0 h-2 rounded ${color}`}
                style={{ left: `${left}%`, width: `${width}%` }}
                title={`${s.kind} ${fmtHm(s.start)}–${fmtHm(s.end)}`}
              />
            );
          })}
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          <Legend />
        </div>
      </div>
    );
  };

  return (
    <div className="grid gap-6">
      <SectionHeading
        eyebrow="Timesheets"
        title="Clock history & adjustments"
        description="Daily timeline and weekly summaries."
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm">
          <Button variant="outline" size="sm" onClick={() => setAnchor(addDays(weekStart, -1))}>{"<"}</Button>
          <div className="px-2 font-medium">
            {format(weekStart, "MMM d")} – {format(weekEnd, "MMM d, yyyy")}
          </div>
          <Button variant="outline" size="sm" onClick={() => setAnchor(new Date())}>This week</Button>
          <Button variant="outline" size="sm" onClick={() => setAnchor(addDays(weekEnd, 1))}>{">"}</Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => toggleAll(true)}>Expand all</Button>
          <Button variant="ghost" size="sm" onClick={() => toggleAll(false)}>Collapse all</Button>
          <Button variant="outline" size="sm" onClick={exportCsv}>Export CSV</Button>
          <Button size="sm" onClick={printPage}>Print</Button>
        </div>
      </div>

      <div className="rounded-2xl border border-border/70 bg-card/95">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[160px]">Date</TableHead>
              <TableHead>In</TableHead>
              <TableHead>Out</TableHead>
              <TableHead>Work</TableHead>
              <TableHead>Break</TableHead>
              <TableHead>Travel</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Overtime</TableHead>
              <TableHead className="w-[110px]">Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const total = r.totals.work + r.totals.travel;
              const overtime = Math.max(0, r.totals.work - 8 * 60);
              const isEmpty = !r.clockIn && !r.clockOut && r.events.length === 0;
              const open = !!expanded[r.date];
              return (
                <Fragment key={r.date}>
                  <TableRow key={r.date}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{fmtDate(r.date)}</span>
                        {isEmpty ? (
                          <span className="text-xs text-muted-foreground">No entries</span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>{fmtHm(r.clockIn)}</TableCell>
                    <TableCell>{fmtHm(r.clockOut)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{fmtHrs(r.totals.work)}</Badge>
                    </TableCell>
                    <TableCell>{fmtHrs(r.totals.break)}</TableCell>
                    <TableCell>{fmtHrs(r.totals.travel)}</TableCell>
                    <TableCell>{fmtHrs(total)}</TableCell>
                    <TableCell>
                      {overtime > 0 ? (
                        <Badge className="bg-amber-500 text-amber-950 hover:bg-amber-500/90">{fmtHrs(overtime)}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpanded((s) => ({ ...s, [r.date]: !s[r.date] }))}
                      >
                        {open ? "Hide" : "Show"}
                      </Button>
                    </TableCell>
                  </TableRow>
                  {open && (
                    <TableRow key={`${r.date}-details`}>
                      <TableCell colSpan={9}>
                        {renderTimeline(r)}
                        <div className="mt-3 grid gap-1 text-xs text-muted-foreground">
                          {r.events.length === 0 ? (
                            <div className="text-muted-foreground">No event details.</div>
                          ) : (
                            r.events.map((e) => (
                              <div key={e.id} className="flex items-center gap-2">
                                <span className="w-[100px] text-foreground">{fmtHm(e.ts)}</span>
                                <Badge variant="outline" className="capitalize">
                                  {e.event_type.replace(/_/g, " ")}
                                </Badge>
                                {e.geo ? (
                                  <span className="hidden sm:inline text-muted-foreground">
                                    ({(e.geo as any).lat?.toFixed?.(3)}, {(e.geo as any).lng?.toFixed?.(3)})
                                  </span>
                                ) : null}
                              </div>
                            ))
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-sm text-muted-foreground">
                  No time entries.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="grid gap-3 rounded-2xl border border-border/70 bg-card/95 p-4 sm:p-6">
        <div className="text-sm text-muted-foreground">Weekly Summary</div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <div className="text-xs text-muted-foreground">Work</div>
            <div className="text-base font-semibold">{fmtHrs(weeklyTotals.work)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Break</div>
            <div className="text-base font-semibold">{fmtHrs(weeklyTotals.break)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Travel</div>
            <div className="text-base font-semibold">{fmtHrs(weeklyTotals.travel)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Total</div>
            <div className="text-base font-semibold">{fmtHrs(weeklyTotals.work + weeklyTotals.travel)}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Timesheets;
