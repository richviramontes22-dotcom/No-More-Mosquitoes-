import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import http from "node:http";
import type net from "node:net";
import express from "express";

// Hoisted mocks — must appear before the imports they intercept.
vi.mock("../middleware/requireAdmin", () => ({
  requireAdmin: (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../services/ai/popupDraftService", () => ({
  generatePopupDraft: vi.fn(),
}));

// Supabase is referenced transitively; silence it.
vi.mock("../lib/supabase", () => ({ supabase: null }));
vi.mock("../lib/supabaseAdmin", () => ({ supabaseAdmin: null }));

import { adminAiPopupDraftRouter } from "./adminAiPopupDraft";
import { generatePopupDraft } from "../services/ai/popupDraftService";

const mockGenerate = generatePopupDraft as ReturnType<typeof vi.fn>;

const VALID_DRAFT = {
  title: "Beat the Buzz",
  subtitle: "End-of-summer protection",
  body: "Keep your yard mosquito-free through fall with one last treatment.",
  cta_label: "Book Now",
  image_prompt: "Family enjoying a backyard barbecue in late summer.",
  image_alt: "Happy family relaxing outdoors free from mosquitoes",
};

let server: http.Server;
let baseUrl: string;

beforeAll(
  () =>
    new Promise<void>((resolve) => {
      const app = express();
      app.use(express.json());
      app.use("/api/admin", adminAiPopupDraftRouter);
      server = http.createServer(app);
      server.listen(0, "127.0.0.1", () => {
        const addr = server.address() as net.AddressInfo;
        baseUrl = `http://127.0.0.1:${addr.port}/api/admin`;
        resolve();
      });
    }),
);

afterAll(
  () =>
    new Promise<void>((resolve) => {
      server.close(() => resolve());
    }),
);

beforeEach(() => {
  mockGenerate.mockReset();
});

let _ipSeq = 0;
function uniqueIp() {
  _ipSeq++;
  return `10.${Math.floor(_ipSeq / 254)}.${(_ipSeq % 254) + 1}.1`;
}

async function postDraft(body: unknown, ip = uniqueIp()) {
  const res = await fetch(`${baseUrl}/promotional-popups/ai-draft`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": ip,
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as Record<string, any> };
}

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------
describe("input validation", () => {
  it("returns 400 when prompt field is absent", async () => {
    const { status, body } = await postDraft({});
    expect(status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/required/i);
  });

  it("returns 400 when prompt is an empty string", async () => {
    const { status, body } = await postDraft({ prompt: "" });
    expect(status).toBe(400);
    expect(body.ok).toBe(false);
  });

  it("returns 400 when prompt is whitespace only", async () => {
    const { status, body } = await postDraft({ prompt: "   " });
    expect(status).toBe(400);
    expect(body.ok).toBe(false);
  });

  it("returns 400 when prompt is not a string", async () => {
    const { status, body } = await postDraft({ prompt: 42 });
    expect(status).toBe(400);
    expect(body.ok).toBe(false);
  });

  it("returns 400 when prompt exceeds 1000 characters", async () => {
    const { status, body } = await postDraft({ prompt: "x".repeat(1001) });
    expect(status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/1000/);
  });

  it("accepts a prompt exactly 1000 characters long", async () => {
    mockGenerate.mockResolvedValueOnce(VALID_DRAFT);
    const { status } = await postDraft({ prompt: "y".repeat(1000) });
    expect(status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// AI service responses
// ---------------------------------------------------------------------------
describe("AI service responses", () => {
  it("returns 503 when the AI client is not configured", async () => {
    mockGenerate.mockRejectedValueOnce(new Error("AI_NOT_CONFIGURED"));
    const { status, body } = await postDraft({ prompt: "Summer sale campaign" });
    expect(status).toBe(503);
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/not configured/i);
  });

  it("returns 500 when generation throws an unexpected error", async () => {
    mockGenerate.mockRejectedValueOnce(new Error("Upstream API error"));
    const { status, body } = await postDraft({ prompt: "Back to school promo" });
    expect(status).toBe(500);
    expect(body.ok).toBe(false);
  });

  it("returns 200 with the draft on success", async () => {
    mockGenerate.mockResolvedValueOnce(VALID_DRAFT);
    const { status, body } = await postDraft({ prompt: "End of summer, friendly tone" });
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.draft.title).toBe(VALID_DRAFT.title);
    expect(body.draft.body).toBe(VALID_DRAFT.body);
    expect(body.draft.cta_label).toBe(VALID_DRAFT.cta_label);
    expect(body.draft.image_prompt).toBe(VALID_DRAFT.image_prompt);
    expect(body.draft.image_alt).toBe(VALID_DRAFT.image_alt);
  });

  it("strips forbidden fields from the draft response", async () => {
    // Even if the service somehow returns forbidden keys, the response shape must not include them.
    mockGenerate.mockResolvedValueOnce(VALID_DRAFT);
    const { body } = await postDraft({ prompt: "Safety check" });
    const forbidden = ["active", "cta_url", "start_at", "end_at", "priority", "frequency"];
    for (const key of forbidden) {
      expect(body.draft).not.toHaveProperty(key);
    }
  });

  it("passes the trimmed prompt to generatePopupDraft", async () => {
    mockGenerate.mockResolvedValueOnce(VALID_DRAFT);
    await postDraft({ prompt: "  spring campaign  " });
    expect(mockGenerate).toHaveBeenCalledWith("spring campaign");
  });
});

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------
describe("rate limiting", () => {
  it("returns 429 after 10 requests from the same IP within the hour", async () => {
    mockGenerate.mockResolvedValue(VALID_DRAFT);
    const RL_IP = "10.200.200.200";

    for (let i = 0; i < 10; i++) {
      const { status } = await postDraft({ prompt: `Campaign ${i}` }, RL_IP);
      expect(status).toBe(200);
    }

    const { status, body } = await postDraft({ prompt: "Over the limit" }, RL_IP);
    expect(status).toBe(429);
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/rate limit/i);
  });

  it("different IPs have independent rate-limit buckets", async () => {
    mockGenerate.mockResolvedValue(VALID_DRAFT);
    const IP_A = "10.202.202.202";
    const IP_B = "10.203.203.203";

    // Exhaust IP_A's budget.
    for (let i = 0; i < 10; i++) {
      await postDraft({ prompt: `Campaign ${i}` }, IP_A);
    }
    const { status: aStatus } = await postDraft({ prompt: "Over limit" }, IP_A);
    expect(aStatus).toBe(429);

    // IP_B's budget is still fresh.
    const { status: bStatus } = await postDraft({ prompt: "Fresh IP" }, IP_B);
    expect(bStatus).toBe(200);
  });
});
