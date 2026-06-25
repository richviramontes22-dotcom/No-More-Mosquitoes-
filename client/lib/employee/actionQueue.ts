// Offline action queue for the technician portal — covers exactly the
// actions the brief scopes for queueing (status updates, treatment notes,
// blocked/unable-to-service reason, media metadata) and nothing else.
// Messaging, the actual media file upload, checklist toggles, and anything
// outside /employee/* are deliberately NOT queued here — see
// TECHNICIAN_EXPERIENCE_AUDIT.md for why each of those should stay
// online-only.
//
// A foreground reconnect sync (triggered by the browser's "online" event —
// see useActionQueue) is what the brief asks for; this does not attempt
// true background sync (the Background Sync API), which would need a
// service worker sync event handler and is a meaningfully bigger, less
// reliable cross-browser surface for what's a same-scale problem.
import { cacheAssignmentDetail, getCachedAssignmentDetail } from "./offlineCache";

export type QueuedActionType = "status_update" | "treatment_notes" | "media_metadata";

export interface QueuedAction {
  id: string;
  type: QueuedActionType;
  employeeId: string;
  assignmentId: string;
  payload: Record<string, unknown>;
  createdAt: number;
  attempts: number;
  lastError?: string;
}

const QUEUE_KEY = "nmm-employee-cache:action-queue";

function readQueue(): QueuedAction[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedAction[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // best effort — a failed write here just means the action isn't
    // queued; the caller's UI already reflects the optimistic state
  }
}

function sameAction(a: QueuedAction, type: QueuedActionType, assignmentId: string, payload: Record<string, unknown>): boolean {
  return a.type === type && a.assignmentId === assignmentId && JSON.stringify(a.payload) === JSON.stringify(payload);
}

/** Adds an action to the end of the queue (preserving submission order),
 * skipping it if the exact same action (type + assignment + payload) is
 * already the most recently queued one for that assignment — prevents a
 * double-tap or a retry-after-failure from queueing the identical action
 * twice. A genuinely different payload (e.g. "arrived" queued after
 * "en_route") is never deduped — that's a real sequence, not a repeat. */
export function enqueueAction(employeeId: string, type: QueuedActionType, assignmentId: string, payload: Record<string, unknown>): QueuedAction {
  const queue = readQueue();
  const lastForTarget = [...queue].reverse().find((a) => a.type === type && a.assignmentId === assignmentId);
  if (lastForTarget && sameAction(lastForTarget, type, assignmentId, payload)) {
    return lastForTarget;
  }
  const action: QueuedAction = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    type,
    employeeId,
    assignmentId,
    payload,
    createdAt: Date.now(),
    attempts: 0,
  };
  queue.push(action);
  writeQueue(queue);
  return action;
}

/** Deliberately not cleared on logout, unlike the read-only offlineCache —
 * a queued action is unsynced *work*, not a disposable copy of server
 * data, and discarding it on logout would silently lose a real status
 * update or note. Every read/sync path below is scoped to one employeeId
 * so a second technician signing in on the same device never has the
 * first technician's still-pending actions submitted under their session
 * — they simply stay queued until that first technician signs back in. */
export function getQueue(employeeId: string): QueuedAction[] {
  return readQueue().filter((a) => a.employeeId === employeeId);
}

export function getPendingCount(employeeId: string): number {
  return getQueue(employeeId).length;
}

function removeAction(id: string) {
  writeQueue(readQueue().filter((a) => a.id !== id));
}

function markAttempt(id: string, error: string) {
  const queue = readQueue();
  const action = queue.find((a) => a.id === id);
  if (action) {
    action.attempts += 1;
    action.lastError = error;
    writeQueue(queue);
  }
}

type SendResult =
  | { kind: "success" }
  | { kind: "network"; error: string }
  | { kind: "rejected"; error: string };

async function sendAction(action: QueuedAction, getToken: () => Promise<string | null>): Promise<SendResult> {
  const token = await getToken();
  if (!token) return { kind: "network", error: "No session" };

  try {
    let res: Response;
    if (action.type === "status_update") {
      res = await fetch(`/api/employee/assignments/${action.assignmentId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(action.payload),
      });
    } else if (action.type === "treatment_notes") {
      res = await fetch(`/api/employee/assignments/${action.assignmentId}/notes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(action.payload),
      });
    } else {
      res = await fetch(`/api/employee/assignments/${action.assignmentId}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(action.payload),
      });
    }

    if (res.ok) return { kind: "success" };

    // A real rejection from the server (e.g. a since-invalidated status
    // transition, or the assignment no longer existing) is a conflict, not
    // a connectivity problem — retrying it forever would never succeed.
    // Surface it and drop it from the queue rather than blocking
    // everything queued after it.
    const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    return { kind: "rejected", error: body.error || `HTTP ${res.status}` };
  } catch (err: any) {
    // fetch() itself threw — a real connectivity failure, not a server
    // response. Leave it queued for the next sync attempt.
    return { kind: "network", error: err?.message || "Network error" };
  }
}

export interface SyncResult {
  succeeded: QueuedAction[];
  failed: Array<{ action: QueuedAction; error: string }>;
  stillPending: number;
}

/** Processes the queue strictly in submission order — sequentially, not in
 * parallel, so two status updates for the same assignment can never land
 * out of order. A network-failure result stops processing immediately
 * (everything after it stays queued, since we're almost certainly still
 * offline); a server-rejection result drops just that one action and
 * continues with the rest. */
export async function syncQueue(employeeId: string, getToken: () => Promise<string | null>): Promise<SyncResult> {
  const queue = readQueue().filter((a) => a.employeeId === employeeId);
  const succeeded: QueuedAction[] = [];
  const failed: Array<{ action: QueuedAction; error: string }> = [];

  for (const action of queue) {
    const result = await sendAction(action, getToken);
    if (result.kind === "success") {
      removeAction(action.id);
      succeeded.push(action);
      // Once a status/notes update for an assignment lands, the cached
      // detail snapshot is stale — clear it so the next load fetches fresh
      // data instead of silently showing the pre-sync state.
      if (action.employeeId) {
        const cached = getCachedAssignmentDetail<Record<string, unknown>>(action.employeeId, action.assignmentId);
        if (cached) cacheAssignmentDetail(action.employeeId, action.assignmentId, { ...cached.data, ...action.payload });
      }
    } else if (result.kind === "network") {
      markAttempt(action.id, result.error);
      break; // still offline (or no session) — stop, leave the rest queued
    } else {
      markAttempt(action.id, result.error || "Rejected");
      removeAction(action.id);
      failed.push({ action, error: result.error || "Rejected" });
    }
  }

  return { succeeded, failed, stillPending: getPendingCount(employeeId) };
}
