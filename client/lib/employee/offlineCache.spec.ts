import { describe, it, expect, beforeEach, vi } from "vitest";

// This suite's only dependency on a browser environment is localStorage.
// Vitest here runs in plain Node (no jsdom/happy-dom dependency in this
// project), so a minimal in-memory polyfill is set up directly rather than
// adding a new dependency just for this one global.
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

import {
  cacheRoute, getCachedRoute,
  cacheAssignments, getCachedAssignments,
  cacheAssignmentDetail, getCachedAssignmentDetail,
  cacheEmployeeRole, getCachedEmployeeRole,
  cacheEmployeeRecord, getCachedEmployeeRecord,
  clearEmployeeCache,
} from "./offlineCache";

beforeEach(() => {
  localStorage.clear();
});

describe("offlineCache — ownership scoping", () => {
  it("never returns another employee's cached route", () => {
    cacheRoute("employee-a", "2026-06-24", { hasRoute: true });
    expect(getCachedRoute("employee-b", "2026-06-24")).toBeNull();
    expect(getCachedRoute("employee-a", "2026-06-24")?.data).toEqual({ hasRoute: true });
  });

  it("never returns another employee's cached assignment list", () => {
    cacheAssignments("employee-a", "2026-06-24", [{ id: "a1" }]);
    expect(getCachedAssignments("employee-b", "2026-06-24")).toBeNull();
  });

  it("never returns another employee's cached assignment detail", () => {
    cacheAssignmentDetail("employee-a", "assignment-1", { notes: "secret" });
    expect(getCachedAssignmentDetail("employee-b", "assignment-1")).toBeNull();
  });

  it("never returns another user's cached role", () => {
    cacheEmployeeRole("user-a", "technician");
    expect(getCachedEmployeeRole("user-b")).toBeNull();
  });
});

describe("offlineCache — date scoping", () => {
  it("does not return yesterday's cached route for today's date", () => {
    cacheRoute("employee-a", "2026-06-23", { stops: ["yesterday"] });
    expect(getCachedRoute("employee-a", "2026-06-24")).toBeNull();
  });

  it("does not return yesterday's cached assignments for today's date", () => {
    cacheAssignments("employee-a", "2026-06-23", [{ id: "old" }]);
    expect(getCachedAssignments("employee-a", "2026-06-24")).toBeNull();
  });
});

describe("offlineCache — 24h expiry", () => {
  it("marks a fresh entry as not expired", () => {
    cacheRoute("employee-a", "2026-06-24", { stops: [] });
    const result = getCachedRoute("employee-a", "2026-06-24");
    expect(result?.isExpired).toBe(false);
  });

  it("marks an entry older than 24h as expired, but still returns the data", () => {
    const realNow = Date.now;
    Date.now = () => realNow() - 25 * 60 * 60 * 1000; // pretend it's 25h in the past when writing
    cacheRoute("employee-a", "2026-06-24", { stops: ["stale"] });
    Date.now = realNow; // back to real "now" when reading

    const result = getCachedRoute<{ stops: string[] }>("employee-a", "2026-06-24");
    expect(result?.isExpired).toBe(true);
    // Still returns the data — callers decide whether stale-but-present
    // data is better than nothing (e.g. Route.tsx only uses it if !isExpired).
    expect(result?.data.stops).toEqual(["stale"]);
  });
});

describe("offlineCache — clearEmployeeCache", () => {
  it("removes every cached entry across every kind and owner", () => {
    cacheRoute("employee-a", "2026-06-24", {});
    cacheAssignments("employee-a", "2026-06-24", []);
    cacheAssignmentDetail("employee-a", "assignment-1", {});
    cacheEmployeeRole("user-a", "technician");
    cacheEmployeeRecord("user-a", { id: "employee-a" });

    clearEmployeeCache();

    expect(getCachedRoute("employee-a", "2026-06-24")).toBeNull();
    expect(getCachedAssignments("employee-a", "2026-06-24")).toBeNull();
    expect(getCachedAssignmentDetail("employee-a", "assignment-1")).toBeNull();
    expect(getCachedEmployeeRole("user-a")).toBeNull();
    expect(getCachedEmployeeRecord("user-a")).toBeNull();
  });

  it("does not throw or remove unrelated localStorage keys", () => {
    localStorage.setItem("some-other-app-key", "should-survive");
    cacheRoute("employee-a", "2026-06-24", {});
    clearEmployeeCache();
    expect(localStorage.getItem("some-other-app-key")).toBe("should-survive");
  });
});

describe("offlineCache — graceful degradation", () => {
  it("does not throw when localStorage.setItem fails (e.g. quota exceeded)", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(() => cacheRoute("employee-a", "2026-06-24", {})).not.toThrow();
    spy.mockRestore();
  });

  it("returns null instead of throwing on corrupted JSON", () => {
    localStorage.setItem("nmm-employee-cache:route:employee-a:2026-06-24", "{not valid json");
    expect(getCachedRoute("employee-a", "2026-06-24")).toBeNull();
  });
});
