export type PendingItem = { id: string; type: "event" | "message" | "media"; payload: unknown; createdAt: string };

const KEY = "employee-offline-queue";

export function enqueue(item: Omit<PendingItem, "id" | "createdAt">) {
  const next: PendingItem = { id: Math.random().toString(36).slice(2), createdAt: new Date().toISOString(), ...item } as PendingItem;
  const list = load();
  list.push(next);
  save(list);
  return next.id;
}

export function load(): PendingItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PendingItem[]) : [];
  } catch {
    return [];
  }
}

export function save(list: PendingItem[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function clear() { save([]); }
