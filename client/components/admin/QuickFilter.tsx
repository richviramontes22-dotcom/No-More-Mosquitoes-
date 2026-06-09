import { useState } from "react";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, addDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * QuickFilter — reusable date period selector for admin tables.
 *
 * Usage:
 *   <QuickFilter
 *     onChange={({ from, to, label }) => { setFrom(from); setTo(to); }}
 *     className="mb-4"
 *   />
 *
 * The consumer owns state — QuickFilter is controlled via the onChange callback.
 * Pass `activeLabel` to highlight the active chip externally.
 */

export interface QuickFilterRange {
  from: string;   // YYYY-MM-DD or ""
  to: string;     // YYYY-MM-DD or ""
  label: string;  // Human-readable label for display
}

type QuickFilterPreset = "today" | "tomorrow" | "this_week" | "next_7_days" | "custom" | "all";

interface QuickFilterProps {
  onChange: (range: QuickFilterRange) => void;
  /** Currently active label — used to highlight the active chip */
  activeLabel?: string;
  /** Show the custom date range inputs inline */
  showCustom?: boolean;
  className?: string;
}

function toDateStr(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

export function QuickFilter({ onChange, activeLabel, showCustom = true, className }: QuickFilterProps) {
  const [preset, setPreset] = useState<QuickFilterPreset>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo]     = useState("");

  const applyPreset = (p: QuickFilterPreset) => {
    setPreset(p);
    const today = new Date();

    switch (p) {
      case "today":
        onChange({ from: toDateStr(today), to: toDateStr(today), label: "Today" });
        break;
      case "tomorrow": {
        const tmr = addDays(today, 1);
        onChange({ from: toDateStr(tmr), to: toDateStr(tmr), label: "Tomorrow" });
        break;
      }
      case "this_week": {
        const weekStart = startOfWeek(today, { weekStartsOn: 1 }); // Mon
        const weekEnd   = endOfWeek(today,   { weekStartsOn: 1 });
        onChange({ from: toDateStr(weekStart), to: toDateStr(weekEnd), label: "This Week" });
        break;
      }
      case "next_7_days":
        onChange({ from: toDateStr(today), to: toDateStr(addDays(today, 6)), label: "Next 7 Days" });
        break;
      case "custom":
        // Leave current range until inputs are filled
        onChange({ from: customFrom, to: customTo, label: "Custom" });
        break;
      case "all":
      default:
        onChange({ from: "", to: "", label: "All" });
        break;
    }
  };

  const handleCustomChange = (from: string, to: string) => {
    setCustomFrom(from);
    setCustomTo(to);
    if (preset === "custom") {
      onChange({ from, to, label: "Custom" });
    }
  };

  const chips: { id: QuickFilterPreset; label: string }[] = [
    { id: "all",        label: "All"        },
    { id: "today",      label: "Today"      },
    { id: "tomorrow",   label: "Tomorrow"   },
    { id: "this_week",  label: "This Week"  },
    { id: "next_7_days",label: "Next 7 Days"},
    { id: "custom",     label: "Custom"     },
  ];

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {chips.map(({ id, label }) => (
        <button
          key={id}
          onClick={() => applyPreset(id)}
          className={cn(
            "h-8 px-3 rounded-full text-xs font-bold border transition-all whitespace-nowrap",
            preset === id
              ? "bg-primary text-primary-foreground border-primary shadow-sm"
              : "border-border/60 bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground",
          )}
        >
          {label}
        </button>
      ))}

      {/* Custom date inputs — shown when Custom is selected */}
      {showCustom && preset === "custom" && (
        <div className="flex items-center gap-2 ml-1">
          <Input
            type="date"
            className="h-8 w-36 rounded-xl text-xs px-2"
            value={customFrom}
            onChange={(e) => handleCustomChange(e.target.value, customTo)}
            placeholder="From"
          />
          <span className="text-xs text-muted-foreground font-medium">–</span>
          <Input
            type="date"
            className="h-8 w-36 rounded-xl text-xs px-2"
            value={customTo}
            onChange={(e) => handleCustomChange(customFrom, e.target.value)}
            placeholder="To"
          />
        </div>
      )}
    </div>
  );
}
