export type CustomerStatus = "active" | "paused" | "canceled";
export type InvoiceStatus = "paid" | "open" | "overdue" | "refunded";
export type TicketStatus = "new" | "in_progress" | "resolved";
export type TicketPriority = "low" | "medium" | "high" | "urgent";

export type Customer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: CustomerStatus;
  createdAt: string; // ISO
};

export type Property = {
  id: string;
  customerId: string;
  label: string;
  address1: string;
  city: string;
  state: string;
  zip: string;
  acreage: number;
  notes?: string;
};

export type Appointment = {
  id: string;
  customerId: string;
  propertyId: string;
  date: string; // ISO date
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  technician: string;
  status: "scheduled" | "completed" | "canceled" | "rescheduled";
  type: "subscription" | "one_time" | "inspection";
};

export type Visit = {
  id: string;
  appointmentId: string;
  propertyId: string;
  customerId: string;
  date: string; // ISO
  technician: string;
  chemicals: string[];
  completed: boolean;
  photos: string[];
  videoUrl?: string;
};

export type MessageThread = {
  id: string;
  customerId: string;
  channel: "email" | "sms" | "web";
  subject: string;
  lastMessageAt: string; // ISO
  unreadCount: number;
  messages: Array<{
    id: string;
    at: string; // ISO
    from: "customer" | "agent";
    body: string;
  }>;
};

export type Ticket = {
  id: string;
  customerId: string;
  propertyId: string;
  subject: string;
  priority: TicketPriority;
  status: TicketStatus;
  createdAt: string; // ISO
  dueAt?: string; // ISO
  assignedTo?: string;
};

export type Invoice = {
  id: string;
  customerId: string;
  total: number;
  status: InvoiceStatus;
  date: string; // ISO
  dueDate: string; // ISO
};

const today = new Date();
const iso = (d: Date) => d.toISOString();
const addDays = (base: Date, days: number) => new Date(base.getTime() + days * 24 * 60 * 60 * 1000);

export const customers: Customer[] = [
  { id: "c_1001", name: "Sarah Lee", email: "sarah.lee@example.com", phone: "(949) 555-0101", status: "active", createdAt: iso(addDays(today, -180)) },
  { id: "c_1002", name: "Ken Rivera", email: "ken.rivera@example.com", phone: "(949) 555-0102", status: "active", createdAt: iso(addDays(today, -90)) },
  { id: "c_1003", name: "Priya Rao", email: "priya.rao@example.com", phone: "(949) 555-0103", status: "paused", createdAt: iso(addDays(today, -240)) },
  { id: "c_1004", name: "Emily Fox", email: "emily.fox@example.com", phone: "(714) 555-0104", status: "active", createdAt: iso(addDays(today, -30)) },
  { id: "c_1005", name: "Dominic Park", email: "dom.park@example.com", phone: "(714) 555-0105", status: "canceled", createdAt: iso(addDays(today, -420)) },
];

export const properties: Property[] = [
  { id: "p_2001", customerId: "c_1001", label: "Home", address1: "18 Ocean Vista", city: "Newport Beach", state: "CA", zip: "92660", acreage: 0.23, notes: "Pool and slope" },
  { id: "p_2002", customerId: "c_1002", label: "Townhome", address1: "2200 Park Ave", city: "Irvine", state: "CA", zip: "92620", acreage: 0.12 },
  { id: "p_2003", customerId: "c_1003", label: "Backyard", address1: "45 Stonegate", city: "Irvine", state: "CA", zip: "92618", acreage: 0.18 },
  { id: "p_2004", customerId: "c_1004", label: "Primary", address1: "710 PCH", city: "Huntington Beach", state: "CA", zip: "92648", acreage: 0.27 },
  { id: "p_2005", customerId: "c_1005", label: "Home", address1: "12 Vista Ridge", city: "Laguna Niguel", state: "CA", zip: "92677", acreage: 0.32 },
];

export const appointments: Appointment[] = [
  { id: "a_3001", customerId: "c_1001", propertyId: "p_2001", date: iso(today).slice(0,10), startTime: "09:00", endTime: "10:00", technician: "Luis M.", status: "scheduled", type: "subscription" },
  { id: "a_3002", customerId: "c_1002", propertyId: "p_2002", date: iso(addDays(today, 1)).slice(0,10), startTime: "11:00", endTime: "12:00", technician: "Ana R.", status: "scheduled", type: "subscription" },
  { id: "a_3003", customerId: "c_1003", propertyId: "p_2003", date: iso(addDays(today, -1)).slice(0,10), startTime: "14:00", endTime: "15:00", technician: "Luis M.", status: "completed", type: "inspection" },
  { id: "a_3004", customerId: "c_1004", propertyId: "p_2004", date: iso(addDays(today, 7)).slice(0,10), startTime: "09:30", endTime: "10:30", technician: "Sam T.", status: "scheduled", type: "one_time" },
];

export const visits: Visit[] = [
  { id: "v_4001", appointmentId: "a_3003", propertyId: "p_2003", customerId: "c_1003", date: iso(addDays(today, -1)), technician: "Luis M.", chemicals: ["Bifen IT", "IGR"], completed: true, photos: ["/placeholder.svg"], videoUrl: "https://example.com/videos/v_4001" },
];

export const messages: MessageThread[] = [
  {
    id: "m_5001",
    customerId: "c_1001",
    channel: "sms",
    subject: "Gate code for tomorrow",
    lastMessageAt: iso(addDays(today, -1)),
    unreadCount: 1,
    messages: [
      { id: "msg_1", at: iso(addDays(today, -2)), from: "customer", body: "Hi! Our gate code changed to 1929#" },
      { id: "msg_2", at: iso(addDays(today, -1)), from: "agent", body: "Thanks, updated on our end." },
      { id: "msg_3", at: iso(addDays(today, -1)), from: "customer", body: "Great, see you 9am." },
    ],
  },
  {
    id: "m_5002",
    customerId: "c_1004",
    channel: "email",
    subject: "Video link from last visit",
    lastMessageAt: iso(addDays(today, -5)),
    unreadCount: 0,
    messages: [
      { id: "msg_4", at: iso(addDays(today, -6)), from: "customer", body: "Could you resend the video?" },
      { id: "msg_5", at: iso(addDays(today, -5)), from: "agent", body: "Just sent, let us know if access works." },
    ],
  },
];

export const tickets: Ticket[] = [
  { id: "t_6001", customerId: "c_1001", propertyId: "p_2001", subject: "Increase frequency in July", priority: "low", status: "new", createdAt: iso(addDays(today, -3)) },
  { id: "t_6002", customerId: "c_1002", propertyId: "p_2002", subject: "Standing water behind AC pad", priority: "medium", status: "in_progress", createdAt: iso(addDays(today, -1)), dueAt: iso(addDays(today, 2)), assignedTo: "Ana R." },
  { id: "t_6003", customerId: "c_1003", propertyId: "p_2003", subject: "Ants along foundation", priority: "high", status: "resolved", createdAt: iso(addDays(today, -7)) },
];

export const invoices: Invoice[] = [
  { id: "inv_7001", customerId: "c_1001", total: 119, status: "paid", date: iso(addDays(today, -20)), dueDate: iso(addDays(today, -10)) },
  { id: "inv_7002", customerId: "c_1002", total: 100, status: "open", date: iso(addDays(today, -5)), dueDate: iso(addDays(today, 5)) },
  { id: "inv_7003", customerId: "c_1003", total: 149, status: "overdue", date: iso(addDays(today, -45)), dueDate: iso(addDays(today, -15)) },
  { id: "inv_7004", customerId: "c_1004", total: 179, status: "paid", date: iso(addDays(today, -2)), dueDate: iso(addDays(today, 8)) },
];

export const technicians = ["Luis M.", "Ana R.", "Sam T."];

export const findCustomer = (id: string) => customers.find((c) => c.id === id)!;
export const findProperty = (id: string) => properties.find((p) => p.id === id)!;

export const getCustomerProperties = (customerId: string) => properties.filter((p) => p.customerId === customerId);
export const getCustomerInvoices = (customerId: string) => invoices.filter((i) => i.customerId === customerId);
export const getCustomerMessages = (customerId: string) => messages.filter((m) => m.customerId === customerId);
export const getCustomerAppointments = (customerId: string) => appointments.filter((a) => a.customerId === customerId);

export const monthToDateRevenue = () => {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  return invoices
    .filter((i) => i.status === "paid" && new Date(i.date) >= monthStart)
    .reduce((acc, i) => acc + i.total, 0);
};

export const overdueInvoiceCount = () => invoices.filter((i) => i.status === "overdue").length;
export const openTicketCount = () => tickets.filter((t) => t.status !== "resolved").length;
export const unreadMessagesCount = () => messages.reduce((acc, m) => acc + m.unreadCount, 0);
export const appointmentsTodayCount = () => {
  const todayStr = iso(today).slice(0, 10);
  return appointments.filter((a) => a.date === todayStr).length;
};
export const activeCustomerCount = () => customers.filter((c) => c.status === "active").length;
