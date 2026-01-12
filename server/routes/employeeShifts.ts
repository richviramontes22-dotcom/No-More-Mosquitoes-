import { Router } from "express";
import { addEvent, db, getOrCreateTodayShift } from "../lib/memory";

const router = Router();

router.post("/shifts/clock-in", (req, res) => {
  const { employee_id, geo } = req.body ?? {};
  if (!employee_id) return res.status(400).json({ error: "employee_id required" });
  const s = getOrCreateTodayShift(employee_id);
  s.clock_in_at = new Date().toISOString();
  addEvent(s.id, "clock_in", geo);
  return res.json({ shift: s });
});

router.post("/shifts/clock-out", (req, res) => {
  const { shift_id, geo } = req.body ?? {};
  if (!shift_id) return res.status(400).json({ error: "shift_id required" });
  const s = db.shifts.find((x) => x.id === shift_id);
  if (!s) return res.status(404).json({ error: "shift not found" });
  s.clock_out_at = new Date().toISOString();
  addEvent(s.id, "clock_out", geo);
  return res.json({ shift: s });
});

router.post("/shifts/break/:action", (req, res) => {
  const action = req.params.action;
  const { shift_id } = req.body ?? {};
  if (action !== "start" && action !== "end") return res.status(400).json({ error: "invalid action" });
  const s = db.shifts.find((x) => x.id === shift_id);
  if (!s) return res.status(404).json({ error: "shift not found" });
  addEvent(s.id, action === "start" ? "break_start" : "break_end");
  return res.json({ ok: true });
});

router.get("/timesheets", (req, res) => {
  const { employee_id, from, to } = req.query as Record<string, string>;
  if (!employee_id) return res.status(400).json({ error: "employee_id required" });
  const shifts = db.shifts.filter((s) => s.employee_id === employee_id && (!from || s.shift_date >= from) && (!to || s.shift_date <= to));
  const events = db.time_events.filter((e) => shifts.some((s) => s.id === e.shift_id));
  return res.json({ shifts, events });
});

export default router;
