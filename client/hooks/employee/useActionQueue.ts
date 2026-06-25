import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useOnlineStatus } from "./useOnlineStatus";
import {
  enqueueAction, getPendingCount, syncQueue,
  type QueuedActionType, type SyncResult,
} from "@/lib/employee/actionQueue";

const getToken = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
};

/** Drives the technician portal's offline action queue for one employee.
 * Syncs automatically the moment the browser reports it's back online (a
 * foreground reconnect sync — not the Background Sync API, per this
 * sprint's explicit scope) and exposes a live pending count so the UI can
 * show it without polling. */
export function useActionQueue(employeeId: string | undefined, onSyncResult?: (result: SyncResult) => void) {
  const isOnline = useOnlineStatus();
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const syncingRef = useRef(false);

  const refreshCount = useCallback(() => {
    if (employeeId) setPendingCount(getPendingCount(employeeId));
  }, [employeeId]);

  useEffect(() => { refreshCount(); }, [refreshCount]);

  const syncNow = useCallback(async () => {
    if (!employeeId || syncingRef.current) return;
    syncingRef.current = true;
    setIsSyncing(true);
    try {
      const result = await syncQueue(employeeId, getToken);
      refreshCount();
      onSyncResult?.(result);
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
    }
  }, [employeeId, onSyncResult, refreshCount]);

  // Foreground reconnect sync: the moment the browser flips back online,
  // try to drain the queue. Also tried once on mount in case the queue was
  // already populated from a previous offline session that ended without
  // ever coming back online before the tab closed.
  useEffect(() => {
    if (isOnline && employeeId) syncNow();
  }, [isOnline, employeeId, syncNow]);

  const enqueue = useCallback((type: QueuedActionType, assignmentId: string, payload: Record<string, unknown>) => {
    if (!employeeId) return;
    enqueueAction(employeeId, type, assignmentId, payload);
    refreshCount();
    // Opportunistic immediate attempt — if we're actually online (the
    // earlier fetch attempt that led here may have failed for a
    // non-connectivity reason, or connectivity may have returned a moment
    // ago without an "online" event having fired yet), don't make the
    // technician wait for the next reconnect event.
    if (navigator.onLine) syncNow();
  }, [employeeId, refreshCount, syncNow]);

  return { pendingCount, isSyncing, isOnline, enqueue, syncNow };
}
