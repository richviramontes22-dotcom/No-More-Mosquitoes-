import { Router } from "express";
import { db } from "../lib/memory";

const router = Router();

function getOrCreateThread(assignment_id: string) {
  let t = db.message_threads.find((x) => x.assignment_id === assignment_id);
  if (!t) {
    t = { id: Math.random().toString(36).slice(2), assignment_id, last_activity_at: new Date().toISOString() };
    db.message_threads.push(t);
  }
  return t;
}

router.get("/messages", (req, res) => {
  const { assignment_id } = req.query as Record<string, string>;
  if (!assignment_id) return res.status(400).json({ error: "assignment_id required" });
  const t = getOrCreateThread(assignment_id);
  const msgs = db.messages.filter((m) => m.thread_id === t.id).sort((a,b) => a.created_at.localeCompare(b.created_at));
  res.json({ thread_id: t.id, messages: msgs });
});

router.post("/messages", (req, res) => {
  const { assignment_id, body } = req.body ?? {};
  if (!assignment_id || !body) return res.status(400).json({ error: "assignment_id and body required" });
  const t = getOrCreateThread(assignment_id);
  const m = { id: Math.random().toString(36).slice(2), thread_id: t.id, sender_id: "employee", body, channel: "in_app" as const, direction: "outbound" as const, created_at: new Date().toISOString() };
  db.messages.push(m);
  t.last_activity_at = m.created_at;
  res.json({ thread_id: t.id, message: m });
});

export default router;
