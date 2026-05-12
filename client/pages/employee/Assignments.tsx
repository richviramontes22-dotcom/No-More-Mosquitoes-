import { Link } from "react-router-dom";
import { Loader2, MapPin, Clock, ChevronRight } from "lucide-react";
import SectionHeading from "@/components/common/SectionHeading";
import { useEmployee } from "@/hooks/employee/useEmployee";
import { useEmployeeAssignments } from "@/hooks/employee/useEmployeeAssignments";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  completed:  "bg-green-100 text-green-800",
  en_route:   "bg-blue-100 text-blue-800",
  in_progress:"bg-indigo-100 text-indigo-800",
  assigned:   "bg-amber-100 text-amber-800",
  no_show:    "bg-red-100 text-red-800",
  skipped:    "bg-gray-100 text-gray-700",
};

const Assignments = () => {
  const { data: employee, isLoading: empLoading } = useEmployee();
  const { data: items = [], isLoading } = useEmployeeAssignments(employee?.id);

  if (empLoading || isLoading) {
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
        <p className="text-sm text-amber-700 mt-1">Contact your administrator to be added to the employee roster.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-8">
      <SectionHeading
        eyebrow="Assignments"
        title="Today's route"
        description="Tap a stop to view details, navigate, and message the customer."
      />
      <div className="grid gap-3">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-border/70 bg-card/95 p-8 text-center text-sm text-muted-foreground">
            No assignments scheduled for today.
          </div>
        ) : (
          items.map((a) => (
            <Link
              key={a.id}
              to={`/employee/assignments/${a.id}`}
              className="rounded-2xl border border-border/70 bg-card/95 p-4 transition hover:bg-muted/40 flex items-center justify-between gap-4"
            >
              <div className="min-w-0 space-y-1">
                {a.scheduled_at && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {new Date(a.scheduled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                )}
                <div className="font-semibold truncate">{a.customer_name ?? "Customer"}</div>
                {a.address && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground truncate">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {[a.address, a.city].filter(Boolean).join(", ")}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize",
                  STATUS_STYLES[a.status] ?? "bg-gray-100 text-gray-700"
                )}>
                  {a.status.replace("_", " ")}
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
};

export default Assignments;
