import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import SectionHeading from "@/components/common/SectionHeading";
import { getAssignments } from "@/lib/employee/api";

const EMPLOYEE_ID = "e_1";

const Assignments = () => {
  const [items, setItems] = useState<Array<any>>([]);

  useEffect(() => {
    getAssignments(EMPLOYEE_ID).then(setItems).catch(() => setItems([]));
  }, []);

  return (
    <div className="grid gap-8">
      <SectionHeading eyebrow="Assignments" title="Today’s route" description="Tap a stop to view details, navigate, and message the customer." />
      <div className="grid gap-3">
        {items.map((a) => (
          <Link key={a.id} to={`/employee/assignments/${a.id}`} className="rounded-2xl border border-border/70 bg-card/95 p-4 transition hover:bg-muted/40">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">{a.time}</div>
                <div className="font-medium">{a.customer_name}</div>
                <div className="text-sm text-muted-foreground">{a.address}</div>
              </div>
              <span className="text-xs rounded-full bg-amber-100 px-2 py-1 text-amber-900 capitalize">{a.status.replace("_"," ")}</span>
            </div>
          </Link>
        ))}
        {items.length === 0 && (
          <div className="rounded-2xl border border-border/70 bg-card/95 p-6 text-sm text-muted-foreground">No assignments.</div>
        )}
      </div>
    </div>
  );
};

export default Assignments;
