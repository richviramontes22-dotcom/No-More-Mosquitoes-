import { Router } from "express";
import { db } from "../lib/memory";

const router = Router();

router.get("/tracking/employees", (req, res) => {
  const employees = db.employees.map((emp) => {
    const assignments = db.assignments.filter(
      (a) => a.employee_id === emp.id && (a.status === "en_route" || a.status === "in_progress")
    );

    const activeAssignment = assignments[0];
    const location = activeAssignment ? { lat: activeAssignment.lat, lng: activeAssignment.lng } : null;

    const lastEvent = db.time_events
      .filter((e) => {
        const shift = db.shifts.find((s) => s.id === e.shift_id);
        return shift && shift.employee_id === emp.id;
      })
      .sort((a, b) => b.ts.localeCompare(a.ts))[0];

    return {
      id: emp.id,
      name: emp.name,
      role: emp.role,
      phone: emp.phone,
      status: activeAssignment?.status || "idle",
      location,
      assignment: activeAssignment
        ? {
            id: activeAssignment.id,
            customer_name: activeAssignment.customer_name,
            address: activeAssignment.address,
          }
        : null,
      lastUpdate: lastEvent?.ts || null,
    };
  });

  res.json(employees);
});

router.get("/tracking/employees/:id", (req, res) => {
  const { id } = req.params;
  const emp = db.employees.find((e) => e.id === id);
  if (!emp) return res.status(404).json({ error: "Employee not found" });

  const assignments = db.assignments.filter((a) => a.employee_id === emp.id);
  const activeAssignment = assignments.find((a) => a.status === "en_route" || a.status === "in_progress");
  const recentAssignments = assignments.slice(-5).reverse();

  const events = db.time_events.filter((e) => {
    const shift = db.shifts.find((s) => s.id === e.shift_id);
    return shift && shift.employee_id === emp.id;
  });

  res.json({
    id: emp.id,
    name: emp.name,
    role: emp.role,
    phone: emp.phone,
    activeAssignment,
    recentAssignments,
    events: events.sort((a, b) => b.ts.localeCompare(a.ts)),
  });
});

export default router;
