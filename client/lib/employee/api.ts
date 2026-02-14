export async function getAssignments(employeeId: string) {
  const res = await fetch(`/api/employee/assignments?employee_id=${encodeURIComponent(employeeId)}`);
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as Array<{ id: string; time: string; customer_name: string; address: string; status: string; lat: number; lng: number; customer_phone: string }>;
}

export async function getAssignment(id: string) {
  const res = await fetch(`/api/employee/assignments/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as { id: string; time: string; customer_name: string; address: string; status: string; lat: number; lng: number; customer_phone: string };
}

export async function setAssignmentStatus(id: string, status: string) {
  const res = await fetch(`/api/employee/assignments/${encodeURIComponent(id)}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

export async function arriveAssignment(id: string, geo?: GeolocationPosition) {
  const body: any = { geo: geo ? { lat: geo.coords.latitude, lng: geo.coords.longitude } : undefined };
  const res = await fetch(`/api/employee/assignments/${encodeURIComponent(id)}/arrive`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

export async function getMessages(assignmentId: string) {
  const res = await fetch(`/api/employee/messages?assignment_id=${encodeURIComponent(assignmentId)}`);
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as { thread_id: string; messages: Array<{ id: string; body: string; direction: string; created_at: string }> };
}

export async function sendMessage(assignmentId: string, body: string) {
  const res = await fetch(`/api/employee/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assignment_id: assignmentId, body }) });
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

export async function clockIn(employeeId: string, geo?: GeolocationPosition) {
  const res = await fetch(`/api/employee/shifts/clock-in`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ employee_id: employeeId, geo: geo ? { lat: geo.coords.latitude, lng: geo.coords.longitude } : undefined }) });
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

export async function clockOut(shiftId: string, geo?: GeolocationPosition) {
  const res = await fetch(`/api/employee/shifts/clock-out`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ shift_id: shiftId, geo: geo ? { lat: geo.coords.latitude, lng: geo.coords.longitude } : undefined }) });
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

export async function getTimesheets(employeeId: string, from?: string, to?: string) {
  const q = new URLSearchParams({ employee_id: employeeId });
  if (from) q.set("from", from);
  if (to) q.set("to", to);
  const res = await fetch(`/api/employee/timesheets?${q.toString()}`);
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as { shifts: any[]; events: any[] };
}
