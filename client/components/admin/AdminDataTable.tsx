import { ReactNode } from "react";
import { Loader2, AlertCircle, InboxIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * AdminDataTable — reusable admin table with loading, error, empty states,
 * horizontal overflow handling, and optional pagination footer.
 *
 * Usage:
 *   const columns: Column<MyRow>[] = [
 *     { key: "name",   header: "Name",   render: (row) => row.name },
 *     { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} />, className: "w-24" },
 *   ];
 *
 *   <AdminDataTable
 *     columns={columns}
 *     data={items}
 *     getRowKey={(row) => row.id}
 *     isLoading={isLoading}
 *     error={error}
 *     emptyMessage="No appointments found."
 *     minWidth={700}
 *   />
 */

// ── Column definition ─────────────────────────────────────────────────────────

export interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T, index: number) => ReactNode;
  /** Optional Tailwind class applied to both <th> and <td> */
  className?: string;
  /** Optional header-only class */
  headerClassName?: string;
}

// ── Pagination props (all optional — table works without pagination) ──────────

export interface PaginationProps {
  currentPage: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

// ── Main props ────────────────────────────────────────────────────────────────

export interface AdminDataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  getRowKey?: (row: T, index: number) => string | number;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyMessage?: ReactNode;
  /** Minimum table width in pixels — triggers horizontal scroll below this width */
  minWidth?: number;
  pagination?: PaginationProps;
  /** Applied to the root wrapper div */
  className?: string;
  /** Applied to each <tr> */
  rowClassName?: string | ((row: T, index: number) => string);
  /** Header section (rendered above the table scroll area) */
  headerSlot?: ReactNode;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AdminDataTable<T>({
  columns,
  data,
  getRowKey,
  isLoading = false,
  error,
  onRetry,
  emptyMessage = "No results found.",
  minWidth = 600,
  pagination,
  className,
  rowClassName,
  headerSlot,
}: AdminDataTableProps<T>) {
  const totalPages = pagination
    ? Math.ceil(pagination.totalCount / pagination.pageSize)
    : null;

  return (
    <div className={cn("rounded-[28px] border border-border/60 bg-card/95 shadow-soft overflow-hidden w-full", className)}>
      {/* Optional header slot (e.g., CardHeader-style title bar) */}
      {headerSlot && (
        <div className="bg-muted/20 border-b border-border/40">
          {headerSlot}
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-3 px-6 py-4 bg-red-50 border-b border-red-200">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-900">Failed to load data</p>
            <p className="text-xs text-red-700 truncate mt-0.5">{error}</p>
          </div>
          {onRetry && (
            <Button variant="outline" size="sm" className="shrink-0 rounded-xl" onClick={onRetry}>
              Retry
            </Button>
          )}
        </div>
      )}

      {/* Scrollable table */}
      <div className="overflow-x-auto w-full">
        <table className="w-full text-sm" style={{ minWidth: `${minWidth}px` }}>
          <thead>
            <tr className="bg-muted/30 border-b border-border/40">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "px-6 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap",
                    col.className,
                    col.headerClassName,
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {isLoading ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-12 text-center">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="text-sm font-medium">Loading...</span>
                  </div>
                </td>
              </tr>
            ) : !error && data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-12 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <InboxIcon className="h-8 w-8 opacity-30" />
                    <span className="text-sm italic">{emptyMessage}</span>
                  </div>
                </td>
              </tr>
            ) : !error ? (
              data.map((row, i) => {
                const key = getRowKey ? getRowKey(row, i) : i;
                const trClass =
                  typeof rowClassName === "function"
                    ? rowClassName(row, i)
                    : rowClassName ?? "";
                return (
                  <tr key={key} className={cn("hover:bg-muted/20 transition-colors group", trClass)}>
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={cn("px-6 py-4 align-middle", col.className)}
                      >
                        {col.render(row, i)}
                      </td>
                    ))}
                  </tr>
                );
              })
            ) : null}
          </tbody>
        </table>
      </div>

      {/* Pagination footer */}
      {pagination && totalPages !== null && totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-3 border-t border-border/40 bg-muted/10">
          <p className="text-xs text-muted-foreground font-medium">
            Page {pagination.currentPage} of {totalPages} · {pagination.totalCount} total
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl h-8 px-3 text-xs"
              disabled={pagination.currentPage <= 1}
              onClick={() => pagination.onPageChange(pagination.currentPage - 1)}
            >
              ← Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl h-8 px-3 text-xs"
              disabled={pagination.currentPage >= totalPages}
              onClick={() => pagination.onPageChange(pagination.currentPage + 1)}
            >
              Next →
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
