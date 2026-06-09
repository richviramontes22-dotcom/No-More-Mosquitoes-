import { Router } from "express";
import { supabase } from "../lib/supabase";
import { supabaseAdmin } from "../lib/supabaseAdmin";

const router = Router();
const db = supabaseAdmin ?? supabase;

async function getAuthEmployee(req: any): Promise<{ userId: string; employeeId: string } | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  const { data: emp } = await db
    .from("employees")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (!emp) return null;
  return { userId: user.id, employeeId: emp.id };
}

/**
 * GET /api/employee/messages?assignment_id=<id>
 * Returns the message thread and messages for a given assignment.
 */
router.get("/messages", async (req, res) => {
  const actor = await getAuthEmployee(req);
  if (!actor) return res.status(401).json({ error: "Unauthorized" });

  const { assignment_id } = req.query as Record<string, string>;
  if (!assignment_id) return res.status(400).json({ error: "assignment_id required" });

  // Verify the employee owns this assignment
  const { data: assign } = await db
    .from("assignments")
    .select("id")
    .eq("id", assignment_id)
    .eq("employee_id", actor.employeeId)
    .maybeSingle();

  if (!assign) return res.status(403).json({ error: "Not authorized" });

  const { data: thread } = await db
    .from("message_threads")
    .select("id")
    .eq("assignment_id", assignment_id)
    .maybeSingle();

  if (!thread) return res.json({ thread_id: null, messages: [] });

  const { data: messages, error } = await db
    .from("messages")
    .select("id, body, direction, channel, created_at")
    .eq("thread_id", thread.id)
    .order("created_at", { ascending: true });

  if (error) return res.status(500).json({ error: error.message });

  return res.json({ thread_id: thread.id, messages: messages || [] });
});

/**
 * POST /api/employee/messages
 * Creates a message in the thread for a given assignment (creates thread if needed).
 */
router.post("/messages", async (req, res) => {
  const actor = await getAuthEmployee(req);
  if (!actor) return res.status(401).json({ error: "Unauthorized" });

  const { assignment_id, body } = req.body ?? {};
  if (!assignment_id || !body?.trim()) {
    return res.status(400).json({ error: "assignment_id and body required" });
  }

  // Verify ownership
  const { data: assign } = await db
    .from("assignments")
    .select("id")
    .eq("id", assignment_id)
    .eq("employee_id", actor.employeeId)
    .maybeSingle();

  if (!assign) return res.status(403).json({ error: "Not authorized" });

  // Get or create thread
  let { data: thread } = await db
    .from("message_threads")
    .select("id")
    .eq("assignment_id", assignment_id)
    .maybeSingle();

  if (!thread) {
    const { data: newThread, error: threadErr } = await db
      .from("message_threads")
      .insert({ assignment_id, customer_visible: true, last_activity_at: new Date().toISOString() })
      .select("id")
      .single();
    if (threadErr) return res.status(500).json({ error: "Failed to create thread" });
    thread = newThread;
  }

  const now = new Date().toISOString();

  const { data: message, error } = await db
    .from("messages")
    .insert({
      thread_id: thread!.id,
      sender_id: actor.userId,
      body: body.trim(),
      direction: "outbound",
      channel: "in_app",
    })
    .select("id, body, direction, channel, created_at")
    .single();

  if (error) return res.status(500).json({ error: error.message });

  // Update thread last_activity_at
  await db.from("message_threads").update({ last_activity_at: now }).eq("id", thread!.id);

  return res.json({ thread_id: thread!.id, message });
});

export default router;
