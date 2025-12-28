import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, isToday, startOfMonth, startOfWeek } from "date-fns";
import { useMemo, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type FixedCalendarProps = {
  mode?: "single" | "multiple";
  selected?: Date | Date[];
  onSelect?: (date: Date | Date[]) => void;
  className?: string;
};

const weekdayLabels = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const FixedCalendar = ({ mode = "single", selected, onSelect, className }: FixedCalendarProps) => {
  const [month, setMonth] = useState<Date>(() => (selected instanceof Date ? selected : Array.isArray(selected) && selected.length ? selected[0] : new Date()));

  const range = useMemo(() => {
    const start = startOfWeek(startOfMonth(month));
    const end = endOfWeek(endOfMonth(month));
    return eachDayOfInterval({ start, end });
  }, [month]);

  return (
    <div className={cn("w-full max-w-[380px] rounded-xl border bg-background p-3 shadow-sm", className)}>
      <div className="flex items-center justify-between">
        <button
          type="button"
          className={cn(buttonVariants({ variant: "outline" }), "h-8 w-8 p-0")}
          aria-label="Previous month"
          onClick={() => setMonth((m) => addMonths(m, -1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-sm font-semibold">{format(month, "LLLL yyyy")}</div>
        <button
          type="button"
          className={cn(buttonVariants({ variant: "outline" }), "h-8 w-8 p-0")}
          aria-label="Next month"
          onClick={() => setMonth((m) => addMonths(m, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1">
        {weekdayLabels.map((d) => (
          <div key={d} className="py-1 text-center text-[0.75rem] font-medium text-muted-foreground">
            {d}
          </div>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {range.map((day) => {
          const outside = !isSameMonth(day, month);
          const selArr = (Array.isArray(selected) ? selected : selected ? [selected] : []) as Date[];
          const isSel = selArr.some((d) => isSameDay(d, day));
          const today = isToday(day);
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => {
                if (!onSelect) return;
                if (mode === "multiple") {
                  const arr = (Array.isArray(selected) ? selected.slice() : []) as Date[];
                  const idx = arr.findIndex((d) => isSameDay(d, day));
                  if (idx >= 0) arr.splice(idx, 1);
                  else arr.push(day);
                  arr.sort((a, b) => a.getTime() - b.getTime());
                  onSelect(arr);
                } else {
                  onSelect(day);
                }
              }}
              className={cn(
                "aspect-square rounded-md text-sm transition focus:outline-none focus:ring-2 focus:ring-ring",
                "flex items-center justify-center",
                outside && "text-muted-foreground/50",
                today && !isSel && "ring-1 ring-ring",
                isSel && "bg-primary text-primary-foreground hover:bg-primary/90"
              )}
            >
              {format(day, "d")}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default FixedCalendar;
