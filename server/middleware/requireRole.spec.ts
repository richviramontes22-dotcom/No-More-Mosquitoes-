import { describe, it, expect, beforeEach, vi } from "vitest";

const FIXED_USER = { id: "user-1" };

vi.mock("../lib/supabase", () => ({
  supabase: { auth: { getUser: vi.fn(async () => ({ data: { user: FIXED_USER }, error: null })) } },
}));
vi.mock("../lib/supabaseAdmin", async () => {
  const { createFakeSupabase } = await import("../testUtils/fakeSupabase");
  return { supabaseAdmin: createFakeSupabase() };
});

import { supabaseAdmin } from "../lib/supabaseAdmin";
import type { FakeSupabase } from "../testUtils/fakeSupabase";
import { requireCustomerService, requireSales } from "./requireRole";
import { requireAdmin } from "./requireAdmin";

const fakeDb = supabaseAdmin as unknown as FakeSupabase;

function mockReqRes(role: string | null) {
  const req: any = { headers: { authorization: "Bearer faketoken" } };
  const res: any = {
    statusCode: null,
    body: null,
    status(code: number) { this.statusCode = code; return this; },
    json(body: any) { this.body = body; return this; },
  };
  const next = vi.fn();
  return { req, res, next, role };
}

beforeEach(async () => {
  for (const table of Object.keys(fakeDb.tables)) fakeDb.tables[table] = [];
});

async function setRole(role: string | null) {
  if (role) await fakeDb.from("profiles").insert({ id: "user-1", role });
}

describe("requireCustomerService — customer_service dashboard access", () => {
  it("allows a customer_service profile through", async () => {
    await setRole("customer_service");
    const { req, res, next } = mockReqRes("customer_service");
    await requireCustomerService(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.staffRole).toBe("customer_service");
  });

  it("allows an admin profile through (oversight access)", async () => {
    await setRole("admin");
    const { req, res, next } = mockReqRes("admin");
    await requireCustomerService(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("blocks a sales profile", async () => {
    await setRole("sales");
    const { req, res, next } = mockReqRes("sales");
    await requireCustomerService(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it("blocks a customer profile — customer cannot reach staff data", async () => {
    await setRole("customer");
    const { req, res, next } = mockReqRes("customer");
    await requireCustomerService(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it("returns 401 when no authorization header is present", async () => {
    const { res, next } = mockReqRes(null);
    const reqNoAuth: any = { headers: {} };
    await requireCustomerService(reqNoAuth, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });
});

describe("requireSales — sales dashboard access", () => {
  it("allows a sales profile through", async () => {
    await setRole("sales");
    const { req, res, next } = mockReqRes("sales");
    await requireSales(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("blocks a customer_service profile", async () => {
    await setRole("customer_service");
    const { req, res, next } = mockReqRes("customer_service");
    await requireSales(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });
});

describe("requireAdmin — customer blocked from admin data (existing middleware, re-verified)", () => {
  it("blocks customer_service and sales just like any other non-admin role", async () => {
    await setRole("customer_service");
    const { req, res, next } = mockReqRes("customer_service");
    await requireAdmin(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it("blocks a plain customer profile", async () => {
    await setRole("customer");
    const { req, res, next } = mockReqRes("customer");
    await requireAdmin(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it("allows admin through unaffected by the new roles existing", async () => {
    await setRole("admin");
    const { req, res, next } = mockReqRes("admin");
    await requireAdmin(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
