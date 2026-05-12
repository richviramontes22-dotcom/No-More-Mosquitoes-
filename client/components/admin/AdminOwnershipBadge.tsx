import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";

type OwnershipKind =
  | "primary"
  | "legacy"
  | "visibility"
  | "operational"
  | "finance"
  | "future";

const styles: Record<OwnershipKind, string> = {
  primary: "bg-green-500/10 text-green-700 border-green-400/30",
  legacy: "bg-amber-500/10 text-amber-700 border-amber-400/30",
  visibility: "bg-blue-500/10 text-blue-700 border-blue-400/30",
  operational: "bg-primary/10 text-primary border-primary/30",
  finance: "bg-emerald-500/10 text-emerald-700 border-emerald-400/30",
  future: "bg-muted text-muted-foreground border-border",
};

const labels: Record<OwnershipKind, string> = {
  primary: "Primary Manager",
  legacy: "Legacy Tool",
  visibility: "Visibility Only",
  operational: "Operational Tool",
  finance: "Finance Tool",
  future: "Foundation",
};

export const AdminOwnershipBadge = ({
  kind,
  label,
}: {
  kind: OwnershipKind;
  label?: string;
}) => (
  <Badge variant="outline" className={`text-[10px] font-bold uppercase tracking-wider ${styles[kind]}`}>
    {label || labels[kind]}
  </Badge>
);

export const AdminOwnershipNote = ({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) => (
  <div className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-3">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  </div>
);
