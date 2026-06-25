// Read-only offline cache for the technician portal — localStorage, not
// IndexedDB. Chosen deliberately: the data involved (one technician's one
// day of route/assignment data, plus a couple of identity fields) is small
// and simple enough that localStorage's synchronous API avoids real
// complexity (async transactions, version-upgrade migrations) for no real
// benefit at this scale. If the cached data set ever grows much larger,
// IndexedDB would be worth revisiting.
//
// Every key is namespaced under CACHE_PREFIX so clearEmployeeCache() (called
// on logout) can find and remove all of them without needing a fixed list.
const CACHE_PREFIX = "nmm-employee-cache:";
const EXPIRY_MS = 24 * 60 * 60 * 1000;

interface CacheEnvelope<T> {
  ownerId: string;
  cachedAt: number;
  data: T;
}

export interface CachedRead<T> {
  data: T;
  cachedAt: number;
  isExpired: boolean;
}

function keyFor(kind: string, ownerId: string, subKey?: string): string {
  return `${CACHE_PREFIX}${kind}:${ownerId}${subKey ? `:${subKey}` : ""}`;
}

// ownerId scopes every cache entry to one specific user/employee — never
// shared across accounts, and the read path double-checks the stored
// ownerId matches the id being asked for, not just the localStorage key
// (defense in depth, even though the key itself already encodes it).
function write<T>(kind: string, ownerId: string, data: T, subKey?: string) {
  if (!ownerId) return;
  try {
    const envelope: CacheEnvelope<T> = { ownerId, cachedAt: Date.now(), data };
    localStorage.setItem(keyFor(kind, ownerId, subKey), JSON.stringify(envelope));
  } catch {
    // Storage full, disabled (private browsing), or unavailable — caching is
    // a nice-to-have that must never block the caller's normal online path.
  }
}

function read<T>(kind: string, ownerId: string, subKey?: string): CachedRead<T> | null {
  if (!ownerId) return null;
  try {
    const raw = localStorage.getItem(keyFor(kind, ownerId, subKey));
    if (!raw) return null;
    const envelope: CacheEnvelope<T> = JSON.parse(raw);
    if (envelope.ownerId !== ownerId) return null;
    return { data: envelope.data, cachedAt: envelope.cachedAt, isExpired: Date.now() - envelope.cachedAt > EXPIRY_MS };
  } catch {
    return null;
  }
}

// --- Identity (keyed by auth user id — available from the local session
// even when every network request is failing, unlike the employee table
// row or the live profile, both of which require a successful fetch). ---

export function cacheEmployeeRole(userId: string, role: string) {
  write("role", userId, role);
}
export function getCachedEmployeeRole(userId: string): CachedRead<string> | null {
  return read<string>("role", userId);
}

// --- Employee record (keyed by auth user id, same reasoning — this is what
// every other cache entry below is keyed by once resolved). ---

export function cacheEmployeeRecord(userId: string, employee: unknown) {
  write("employee-record", userId, employee);
}
export function getCachedEmployeeRecord<T>(userId: string): CachedRead<T> | null {
  return read<T>("employee-record", userId);
}

// --- Today's route + stops (keyed by employee id + date, so yesterday's
// cached route never displays as if it were today's). ---

export function cacheRoute(employeeId: string, date: string, payload: unknown) {
  write("route", employeeId, payload, date);
}
export function getCachedRoute<T>(employeeId: string, date: string): CachedRead<T> | null {
  return read<T>("route", employeeId, date);
}

// --- Assignment list (keyed by employee id + date). ---

export function cacheAssignments(employeeId: string, date: string, payload: unknown) {
  write("assignments", employeeId, payload, date);
}
export function getCachedAssignments<T>(employeeId: string, date: string): CachedRead<T> | null {
  return read<T>("assignments", employeeId, date);
}

// --- Individual assignment detail (keyed by employee id + assignment id —
// not date-scoped, since a technician may reasonably reopen a job detail
// page a day or two after the visit while writing up notes). ---

export function cacheAssignmentDetail(employeeId: string, assignmentId: string, payload: unknown) {
  write("assignment-detail", employeeId, payload, assignmentId);
}
export function getCachedAssignmentDetail<T>(employeeId: string, assignmentId: string): CachedRead<T> | null {
  return read<T>("assignment-detail", employeeId, assignmentId);
}

/** Removes every cached entry for every employee — called on logout. Not
 * scoped to one user because logout doesn't reliably retain the outgoing
 * user's id by the time cleanup runs; clearing everything under the
 * namespace is simpler and just as correct (the next sign-in starts cold
 * either way). */
export function clearEmployeeCache() {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_PREFIX)) keysToRemove.push(key);
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    // best effort — logout itself must not fail because of this
  }
}
