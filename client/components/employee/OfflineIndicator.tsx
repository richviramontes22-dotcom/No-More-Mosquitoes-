import { Loader2, WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/hooks/employee/useOnlineStatus";
import { useActionQueue } from "@/hooks/employee/useActionQueue";

/** Sticky banner shown across the technician portal — offline state, plus
 * the action queue's pending-sync count regardless of online state (a
 * sync can still be in flight or stuck on a slow connection right after
 * reconnecting, so this isn't gated on isOnline the way the "you're
 * offline" message is). */
export function OfflineIndicator({ employeeId }: { employeeId: string | undefined }) {
  const isOnline = useOnlineStatus();
  const { pendingCount } = useActionQueue(employeeId);

  if (isOnline && pendingCount === 0) return null;

  return (
    <div className="sticky top-0 z-40 -mx-4 mb-4 flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-xs font-semibold text-white sm:-mx-6 lg:-mx-8">
      {!isOnline ? (
        <>
          <WifiOff className="h-3.5 w-3.5" />
          You're offline — showing cached data. Changes will sync when you're back online.
          {pendingCount > 0 && ` (${pendingCount} pending)`}
        </>
      ) : (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Syncing {pendingCount} pending update{pendingCount > 1 ? "s" : ""}…
        </>
      )}
    </div>
  );
}
