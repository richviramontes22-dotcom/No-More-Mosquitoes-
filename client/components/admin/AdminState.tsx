import { AlertCircle, Loader2, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

export const AdminLoadingState = ({ label = "Loading..." }: { label?: string }) => (
  <div className="flex min-h-48 items-center justify-center rounded-2xl border border-border/60 bg-card/80 p-8">
    <div className="flex flex-col items-center gap-3 text-center">
      <Loader2 className="h-7 w-7 animate-spin text-primary/60" />
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
    </div>
  </div>
);

export const AdminEmptyState = ({
  title,
  description,
}: {
  title: string;
  description?: string;
}) => (
  <div className="flex min-h-36 items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/10 p-8 text-center">
    <div className="flex max-w-md flex-col items-center gap-2">
      <SearchX className="h-6 w-6 text-muted-foreground/50" />
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
    </div>
  </div>
);

export const AdminErrorState = ({
  title = "Unable to load data",
  description,
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) => (
  <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
        <div>
          <p className="text-sm font-semibold text-destructive">{title}</p>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {onRetry && (
        <Button size="sm" variant="outline" className="rounded-xl" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  </div>
);
