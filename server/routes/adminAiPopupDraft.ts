import { Router } from "express";
import type { Request, Response } from "express";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { generatePopupDraft } from "../services/ai/popupDraftService.js";

const router = Router();

// Simple in-memory rate limiter for AI draft requests (10 per IP per hour).
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
const AI_DRAFT_LIMIT = 10;
const WINDOW_MS = 60 * 60 * 1000;

function getIp(req: Request): string {
  return (
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.ip ||
    "unknown"
  );
}

function checkAiDraftRateLimit(req: Request): { allowed: boolean; retryAfterMs: number } {
  const key = `ai-draft:${getIp(req)}`;
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(key, bucket);
  }
  bucket.count++;
  if (bucket.count > AI_DRAFT_LIMIT) {
    return { allowed: false, retryAfterMs: bucket.resetAt - now };
  }
  return { allowed: true, retryAfterMs: 0 };
}

setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets.entries()) {
    if (now > bucket.resetAt) buckets.delete(key);
  }
}, 10 * 60 * 1000);

/**
 * POST /api/admin/promotional-popups/ai-draft
 *
 * Generates a popup content draft via Claude. Admin provides a plain-language
 * campaign description; Claude returns title/subtitle/body/cta_label/image hints.
 *
 * The draft is NEVER auto-published. active=false is enforced client-side when
 * applying the draft to the create/edit form.
 */
router.post(
  "/promotional-popups/ai-draft",
  requireAdmin,
  async (req: Request, res: Response) => {
    const { allowed, retryAfterMs } = checkAiDraftRateLimit(req);
    if (!allowed) {
      const minutes = Math.ceil(retryAfterMs / 60000);
      return res.status(429).json({
        ok: false,
        error: `Rate limit exceeded. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
      });
    }

    const prompt = req.body?.prompt;
    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return res.status(400).json({ ok: false, error: "prompt is required." });
    }
    if (prompt.length > 1000) {
      return res
        .status(400)
        .json({ ok: false, error: "prompt must be 1000 characters or fewer." });
    }

    try {
      const draft = await generatePopupDraft(prompt.trim());
      return res.json({ ok: true, draft });
    } catch (err) {
      if (err instanceof Error && err.message === "AI_NOT_CONFIGURED") {
        return res
          .status(503)
          .json({ ok: false, error: "AI service not configured on this server." });
      }
      console.error("[adminAiPopupDraft] generation error:", err);
      return res.status(500).json({ ok: false, error: "AI draft generation failed." });
    }
  }
);

export { router as adminAiPopupDraftRouter };
