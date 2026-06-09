import { ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * AdminActionMenu — compact per-row action dropdown for admin tables.
 * Replaces multiple inline buttons with a ⋯ icon that opens a menu.
 *
 * Usage:
 *   <AdminActionMenu
 *     items={[
 *       { label: "Modify",   icon: <RotateCcw className="h-4 w-4" />, onClick: () => setEditing(row) },
 *       { label: "Dispatch", icon: <Send className="h-4 w-4" />,      onClick: () => dispatch(row), condition: canDispatch },
 *       { separator: true },
 *       { label: "Cancel",   onClick: () => cancel(row), destructive: true },
 *     ]}
 *   />
 */

export type ActionItem =
  | {
      separator?: false;
      label: string;
      icon?: ReactNode;
      onClick: () => void;
      disabled?: boolean;
      destructive?: boolean;
      /** Hide this item entirely when false */
      condition?: boolean;
    }
  | { separator: true };

interface AdminActionMenuProps {
  items: ActionItem[];
  /** Trigger button tooltip */
  label?: string;
  className?: string;
}

export function AdminActionMenu({ items, label = "Actions", className }: AdminActionMenuProps) {
  const visibleItems = items.filter(
    (item) => item.separator || (item as any).condition !== false,
  );

  if (visibleItems.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-8 w-8 rounded-xl hover:bg-muted focus-visible:ring-1", className)}
          aria-label={label}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[140px] rounded-xl shadow-lg">
        {visibleItems.map((item, i) => {
          if (item.separator === true) {
            return <DropdownMenuSeparator key={`sep-${i}`} />;
          }
          const action = item as Exclude<ActionItem, { separator: true }>;
          return (
            <DropdownMenuItem
              key={action.label}
              onClick={action.disabled ? undefined : action.onClick}
              disabled={action.disabled}
              className={cn(
                "flex items-center gap-2 rounded-lg text-sm font-medium cursor-pointer",
                action.destructive && "text-destructive focus:text-destructive focus:bg-destructive/10",
                action.disabled && "opacity-50 cursor-not-allowed",
              )}
            >
              {action.icon && (
                <span className="shrink-0 opacity-70">{action.icon}</span>
              )}
              {action.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
