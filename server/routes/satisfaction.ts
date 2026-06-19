import { Router } from "express";
import { supabase } from "../lib/supabase";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { requireAdmin } from "../middleware/requireAdmin";
import { requireCustomerService } from "../middleware/requireRole";
import {
  submitSurvey,
  resolveSatisfactionIssue,
  getSatisfactionDashboard,
} from "../services/satisfaction/satisfactionService";

const db = supabaseAdmin ?? supabase;
const router = Router();

async function getAuthenticatedUser(req: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) throw Object.assign(new Error("Missing authorization header"), { status: 401 });
  const token = authHeader.slice(7);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) throw Object.assign(new Error("Invalid session"), { status: 401 });
  return user;
}

// ─── Customer-facing ───────────────────────────────────────────────────────

// GET /api/satisfaction/surveys/:appointmentId — does a survey already exist?
router.get("/satisfaction/surveys/:appointmentId", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    const { data } = await db
      .from("customer_satisfaction_surveys")
      .select("id, rating, satisfaction_type, created_at")
      .eq("appointment_id", req.params.appointmentId)
      .eq("profile_id", user.id)
      .maybeSingle();
    res.json({ survey: data ?? null });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// POST /api/satisfaction/surveys
router.post("/satisfaction/surveys", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    const { appointment_id, rating, comment, issue_category } = req.body ?? {};

    if (!appointment_id || typeof rating !== "number" || rating < 0 || rating > 10) {
      return res.status(400).json({ error: "appointment_id and a rating between 0 and 10 are required" });
    }

    const { data: appt } = await db.from("appointments").select("id, user_id, status").eq("id", appointment_id).maybeSingle();
    if (!appt || appt.user_id !== user.id) {
      return res.status(403).json({ error: "Not authorized to rate this appointment" });
    }
    if (appt.status !== "completed") {
      return res.status(400).json({ error: "Only completed appointments can be rated" });
    }

    const result = await submitSurvey({
      appointmentId: appointment_id,
      profileId: user.id,
      rating,
      comment,
      issueCategory: issue_category,
    });

    if (result.error === "already_submitted") {
      return res.status(409).json({ error: "A satisfaction survey has already been submitted for this appointment" });
    }
    if (!result.survey) return res.status(500).json({ error: result.error || "Failed to submit survey" });

    res.status(201).json({ survey: result.survey });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ─── Admin / Customer Service ──────────────────────────────────────────────

router.get("/admin/satisfaction/dashboard", requireCustomerService, async (_req, res) => {
  try {
    const dashboard = await getSatisfactionDashboard();
    res.json(dashboard);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/admin/satisfaction/:id/resolve", requireCustomerService, async (req: any, res) => {
  const updated = await resolveSatisfactionIssue(req.params.id, req.staffUserId ?? null);
  if (!updated) return res.status(404).json({ error: "Survey not found or update failed" });
  res.json({ success: true, survey: updated });
});

export default router;
