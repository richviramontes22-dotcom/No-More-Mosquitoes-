import { describe, it, expect, beforeEach, vi } from "vitest";

class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string) { return this.store.has(key) ? this.store.get(key)! : null; }
  setItem(key: string, value: string) { this.store.set(key, String(value)); }
  removeItem(key: string) { this.store.delete(key); }
  clear() { this.store.clear(); }
  key(index: number) { return Array.from(this.store.keys())[index] ?? null; }
  get length() { return this.store.size; }
}
(globalThis as any).localStorage = new MemoryStorage();
(globalThis as any).Storage = MemoryStorage;
(globalThis as any).fetch = vi.fn();

import { enqueueAction, getQueue, getPendingCount, syncQueue } from "./actionQueue";

beforeEach(() => {
  localStorage.clear();
  vi.mocked(fetch).mockReset();
});

const getToken = async () => "fake-token";

describe("actionQueue — enqueue", () => {
  it("adds an action to the queue", () => {
    enqueueAction("emp-1", "status_update", "assign-1", { status: "en_route" });
    expect(getQueue("emp-1")).toHaveLength(1);
    expect(getPendingCount("emp-1")).toBe(1);
  });

  it("preserves submission order across different actions", () => {
    enqueueAction("emp-1", "status_update", "assign-1", { status: "en_route" });
    enqueueAction("emp-1", "status_update", "assign-1", { status: "arrived" });
    enqueueAction("emp-1", "status_update", "assign-1", { status: "completed" });
    const queue = getQueue("emp-1");
    expect(queue.map((a) => a.payload.status)).toEqual(["en_route", "arrived", "completed"]);
  });

  it("does not enqueue an exact duplicate of the most recently queued action for the same target", () => {
    enqueueAction("emp-1", "status_update", "assign-1", { status: "completed" });
    enqueueAction("emp-1", "status_update", "assign-1", { status: "completed" });
    expect(getQueue("emp-1")).toHaveLength(1);
  });

  it("does enqueue a genuinely different status for the same assignment", () => {
    enqueueAction("emp-1", "status_update", "assign-1", { status: "en_route" });
    enqueueAction("emp-1", "status_update", "assign-1", { status: "arrived" });
    expect(getQueue("emp-1")).toHaveLength(2);
  });

  it("scopes the queue per employee — one employee never sees another's pending actions", () => {
    enqueueAction("emp-1", "status_update", "assign-1", { status: "en_route" });
    enqueueAction("emp-2", "status_update", "assign-2", { status: "arrived" });
    expect(getQueue("emp-1")).toHaveLength(1);
    expect(getQueue("emp-2")).toHaveLength(1);
    expect(getPendingCount("emp-1")).toBe(1);
  });
});

describe("actionQueue — syncQueue", () => {
  it("sends queued actions in order and removes each on success", async () => {
    enqueueAction("emp-1", "status_update", "assign-1", { status: "en_route" });
    enqueueAction("emp-1", "status_update", "assign-1", { status: "arrived" });
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({}) } as Response);

    const result = await syncQueue("emp-1", getToken);

    expect(result.succeeded).toHaveLength(2);
    expect(result.stillPending).toBe(0);
    expect(getQueue("emp-1")).toHaveLength(0);
    // Order preserved: arrived's request must have gone out after en_route's.
    const calls = vi.mocked(fetch).mock.calls;
    expect(JSON.parse(calls[0][1]!.body as string).status).toBe("en_route");
    expect(JSON.parse(calls[1][1]!.body as string).status).toBe("arrived");
  });

  it("stops at the first network failure and leaves the rest queued (preserves order, no partial reordering)", async () => {
    enqueueAction("emp-1", "status_update", "assign-1", { status: "en_route" });
    enqueueAction("emp-1", "status_update", "assign-1", { status: "arrived" });
    vi.mocked(fetch).mockRejectedValue(new Error("network down"));

    const result = await syncQueue("emp-1", getToken);

    expect(result.succeeded).toHaveLength(0);
    expect(result.stillPending).toBe(2);
    expect(getQueue("emp-1")).toHaveLength(2);
  });

  it("drops a server-rejected action (a real conflict) and continues with the rest, rather than blocking the queue forever", async () => {
    enqueueAction("emp-1", "status_update", "assign-1", { status: "completed" });
    enqueueAction("emp-1", "treatment_notes", "assign-2", { technician_notes: "all good" });
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({ error: "Invalid transition" }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) } as Response);

    const result = await syncQueue("emp-1", getToken);

    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].error).toBe("Invalid transition");
    expect(result.succeeded).toHaveLength(1);
    expect(getQueue("emp-1")).toHaveLength(0);
  });

  it("only syncs the requesting employee's own queued actions", async () => {
    enqueueAction("emp-1", "status_update", "assign-1", { status: "en_route" });
    enqueueAction("emp-2", "status_update", "assign-2", { status: "arrived" });
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({}) } as Response);

    await syncQueue("emp-1", getToken);

    expect(getQueue("emp-1")).toHaveLength(0);
    expect(getQueue("emp-2")).toHaveLength(1); // untouched — a different employee's session triggered this sync
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
