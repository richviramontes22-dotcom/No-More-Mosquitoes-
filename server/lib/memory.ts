import { randomUUID } from "node:crypto";

export type Employee = { id: string; name: string; phone?: string; role: "technician" | "dispatcher" | "admin" };
export type AssignmentStatus = "scheduled" | "en_route" | "in_progress" | "completed" | "no_show" | "skipped";
export type GeoPoint = { lat: number; lng: number };
export type Assignment = {
  id: string;
  employee_id: string;
  customer_name: string;
  customer_phone: string;
  address: string;
  lat: number;
  lng: number;
  time: string; // display time window start e.g. "10:30 AM"
  status: AssignmentStatus;
  notes?: string;
  gate_code?: string;
  arrive_at?: string;
  start_at?: string;
  complete_at?: string;
};
export type JobMedia = { id: string; assignment_id: string; media_type: "photo" | "video" | "doc"; url: string; caption?: string; created_at: string };

export type Shift = { id: string; employee_id: string; shift_date: string; clock_in_at?: string; clock_out_at?: string; break_minutes: number; notes?: string };
export type TimeEventType = "clock_in" | "clock_out" | "break_start" | "break_end" | "travel_start" | "travel_end" | "arrive" | "start_job" | "complete_job";
export type TimeEvent = { id: string; shift_id: string; event_type: TimeEventType; ts: string; geo?: GeoPoint; meta?: Record<string, unknown> };

export type Message = { id: string; thread_id: string; sender_id: string | null; body: string; channel: "in_app" | "sms"; direction: "outbound" | "inbound"; created_at: string; delivered_at?: string; read_at?: string };
export type MessageThread = { id: string; assignment_id: string; last_activity_at: string };

export const db = {
  employees: [] as Employee[],
  assignments: [] as Assignment[],
  job_media: [] as JobMedia[],
  shifts: [] as Shift[],
  time_events: [] as TimeEvent[],
  message_threads: [] as MessageThread[],
  messages: [] as Message[],
};

const todayIso = () => new Date().toISOString().slice(0, 10);

export function seedIfEmpty() {
  if (db.employees.length > 0) return;
  const e1: Employee = { id: "e_1", name: "Luis M.", role: "technician", phone: "+19495550101" };
  const e2: Employee = { id: "e_2", name: "Ana R.", role: "technician", phone: "+19495550102" };
  db.employees.push(e1, e2);

  const makeA = (id: string, employee_id: string, customer_name: string, phone: string, address: string, lat: number, lng: number, time: string): Assignment => ({
    id,
    employee_id,
    customer_name,
    customer_phone: phone,
    address,
    lat,
    lng,
    time,
    status: "scheduled",
    notes: "Backyard slope; dog in yard.",
    gate_code: "1929#",
  });
  db.assignments.push(
    makeA("a1", e1.id, "Sarah Lee", "(949) 555-0101", "18 Ocean Vista, Newport Beach, CA", 33.596, -117.876, "09:30 AM"),
    makeA("a2", e1.id, "Ken Rivera", "(949) 555-0102", "2200 Park Ave, Irvine, CA", 33.683, -117.823, "11:00 AM"),
    makeA("a3", e2.id, "Emily Fox", "(714) 555-0104", "710 PCH, Huntington Beach, CA", 33.655, -118.005, "10:15 AM"),
  );

  // Seed a shift for today (no clock in yet)
  db.shifts.push({ id: "s_1", employee_id: e1.id, shift_date: todayIso(), break_minutes: 0 });
}

export function getOrCreateTodayShift(employee_id: string): Shift {
  const today = todayIso();
  let s = db.shifts.find((x) => x.employee_id === employee_id && x.shift_date === today);
  if (!s) {
    s = { id: randomUUID(), employee_id, shift_date: today, break_minutes: 0 };
    db.shifts.push(s);
  }
  return s;
}

export function addEvent(shift_id: string, event_type: TimeEventType, geo?: GeoPoint, meta?: Record<string, unknown>) {
  const ev: TimeEvent = { id: randomUUID(), shift_id, event_type, ts: new Date().toISOString(), geo, meta };
  db.time_events.push(ev);
  return ev;
}
