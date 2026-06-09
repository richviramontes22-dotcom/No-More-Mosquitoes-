import { cn } from "@/lib/utils";

/**
 * StatusBadge — centralized status color + label system for all admin tables.
 *
 * Usage:
 *   <StatusBadge status="scheduled" />
 *   <StatusBadge status="en_route" className="text-xs" />
 *   <StatusBadge status={order.fulfillment_status} />
 */

export type AdminStatus =
  | "requested"
  | "scheduled"
  | "confirmed"
  | "dispatched"
  | "en_route"
  | "in_progress"
  | "completed"
  | "canceled"
  | "cancelled"
  | "pending"
  | "failed"
  | "fulfilled"
  | "past_due"
  | "active"
  | "inactive"
  | "skipped"
  | "no_show"
  | "open"
  | "resolved"
  | "unknown"
  | string; // allow pass-through for unknown values

interface StatusConfig {
  label: string;
  className: string;
}

const STATUS_MAP: Record<string, StatusConfig> = {
  requested:   { label: "Requested",   className: "bg-amber-100 text-amber-800"    },
  scheduled:   { label: "Scheduled",   className: "bg-blue-100 text-blue-800"      },
  confirmed:   { label: "Confirmed",   className: "bg-indigo-100 text-indigo-800"  },
  dispatched:  { label: "Dispatched",  className: "bg-purple-100 text-purple-800"  },
  en_route:    { label: "En Route",    className: "bg-violet-100 text-violet-800"  },
  in_progress: { label: "In Progress", className: "bg-sky-100 text-sky-800"        },
  completed:   { label: "Completed",   className: "bg-green-100 text-green-800"    },
  canceled:    { label: "Canceled",    className: "bg-red-100 text-red-800"        },
  cancelled:   { label: "Canceled",    className: "bg-red-100 text-red-800"        },
  pending:     { label: "Pending",     className: "bg-amber-100 text-amber-800"    },
  failed:      { label: "Failed",      className: "bg-red-100 text-red-800"        },
  fulfilled:   { label: "Fulfilled",   className: "bg-green-100 text-green-800"    },
  past_due:    { label: "Past Due",    className: "bg-orange-100 text-orange-800"  },
  active:      { label: "Active",      className: "bg-green-100 text-green-800"    },
  inactive:    { label: "Inactive",    className: "bg-gray-100 text-gray-700"      },
  skipped:     { label: "Skipped",     className: "bg-gray-100 text-gray-700"      },
  no_show:     { label: "No Show",     className: "bg-red-100 text-red-700"        },
  open:        { label: "Open",        className: "bg-blue-100 text-blue-800"      },
  resolved:    { label: "Resolved",    className: "bg-green-100 text-green-800"    },
  unknown:     { label: "Unknown",     className: "bg-gray-100 text-gray-600"      },
};

function resolveConfig(status: string): StatusConfig {
  const key = status?.toLowerCase().replace(/\s+/g, "_") ?? "unknown";
  return STATUS_MAP[key] ?? { label: status || "Unknown", className: "bg-gray-100 text-gray-600" };
}

interface StatusBadgeProps {
  status: AdminStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const { label, className: colorClass } = resolveConfig(status);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold capitalize whitespace-nowrap",
        colorClass,
        className,
      )}
    >
      {label}
    </span>
  );
}
