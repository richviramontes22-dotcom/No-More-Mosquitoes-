import { Router } from "express";
import { addEvent, db } from "../lib/memory";

const router = Router();

router.get("/assignments", (req, res) => {
  const { employee_id, date } = req.query as Record<string, string>;
  if (!employee_id) return res.status(400).json({ error: "employee_id required" });
  const list = db.assignments.filter((a) => a.employee_id === employee_id);
  const filtered = date ? list.filter((a) => true) : list; // demo: no date on seed
  res.json(filtered.sort((a,b) => a.time.localeCompare(b.time)));
});

router.get("/assignments/:id", (req, res) => {
  const { id } = req.params;
  const a = db.assignments.find((x) => x.id === id);
  if (!a) return res.status(404).json({ error: "not found" });
  res.json(a);
});

router.post("/assignments/:id/status", (req, res) => {
  const { id } = req.params;
  const { status } = req.body ?? {};
  const a = db.assignments.find((x) => x.id === id);
  if (!a) return res.status(404).json({ error: "not found" });
  a.status = status;
  // naive timestamping
  if (status === "en_route") addEvent(db.shifts[0]?.id ?? "", "travel_start");
  if (status === "in_progress") a.start_at = new Date().toISOString();
  if (status === "completed") a.complete_at = new Date().toISOString();
  res.json({ ok: true, assignment: a });
});

router.post("/assignments/:id/arrive", (req, res) => {
  const { id } = req.params;
  const { geo } = req.body ?? {};
  const a = db.assignments.find((x) => x.id === id);
  if (!a) return res.status(404).json({ error: "not found" });
  a.arrive_at = new Date().toISOString();
  addEvent(db.shifts[0]?.id ?? "", "arrive", geo);
  if (a.status === "en_route") a.status = "in_progress";
  res.json({ ok: true, assignment: a });
});

router.post("/assignments/:id/media", (req, res) => {
  const { id } = req.params;
  const { url, media_type, caption } = req.body ?? {};
  if (!url || !media_type) return res.status(400).json({ error: "url and media_type required" });
  const item = { id: Math.random().toString(36).slice(2), assignment_id: id, media_type, url, caption, created_at: new Date().toISOString() };
  db.job_media.push(item);
  res.json({ ok: true, media: item });
});

export default router;
