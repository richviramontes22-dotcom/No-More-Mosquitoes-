const SUPPORT_PHONE = process.env.SUPPORT_PHONE || "(949) 555-0100";
const APP_URL = process.env.APP_BASE_URL || "https://nomoremosquitoes.us";

/** Appended to every outbound SMS for TCPA compliance */
const OPT_OUT_FOOTER = "\nReply STOP to opt out | HELP for help";

export interface EnRouteSmsData {
  customerName: string;
  windowLabel: string;   // "Morning (8AM–12PM)"
  propertyAddress: string;
  scheduledDate: string; // "Monday, June 2, 2026"
}

export function buildEnRouteSms(data: EnRouteSmsData): string {
  return [
    `No More Mosquitoes: Your technician is on the way!`,
    `Arrival window: ${data.windowLabel} at ${data.propertyAddress}.`,
    `Questions? Call us at ${SUPPORT_PHONE} or visit ${APP_URL}`,
  ].join(" ") + OPT_OUT_FOOTER;
}

/** Alias for provider-based callers */
export const buildEnRouteSmsTemplate = buildEnRouteSms;

export interface ArrivalSmsData {
  customerName: string;
  propertyAddress: string;
}

export function buildArrivalSms(data: ArrivalSmsData): string {
  return `No More Mosquitoes: Your technician has arrived at ${data.propertyAddress} and is beginning your treatment.` + OPT_OUT_FOOTER;
}

/** Alias for provider-based callers */
export const buildArrivalSmsTemplate = buildArrivalSms;

export interface ServiceCompleteSmsData {
  customerName: string;
  scheduledDate?: string;
  dashboardUrl?: string;
}

export function buildServiceCompleteSms(data: ServiceCompleteSmsData): string {
  const dateText = data.scheduledDate ? ` for ${data.scheduledDate}` : "";
  const url = data.dashboardUrl || APP_URL;
  return `No More Mosquitoes: Your mosquito treatment${dateText} is complete! View details at ${url}` + OPT_OUT_FOOTER;
}

/** Alias for provider-based callers */
export const buildServiceCompleteSmsTemplate = buildServiceCompleteSms;

export interface ReminderSmsData {
  customerName: string;
  windowLabel:  string;   // "Morning (8AM–12PM)"
  propertyAddress: string;
  scheduledDate: string;  // "Monday, June 2, 2026"
  notificationType: "reminder_24h" | "reminder_same_day";
}

export function buildReminderSms(data: ReminderSmsData): string {
  const prefix = data.notificationType === "reminder_24h" ? "tomorrow" : "today";
  return [
    `No More Mosquitoes: Reminder — your service is scheduled ${prefix},`,
    `${data.windowLabel} at ${data.propertyAddress}.`,
    `Questions? Call ${SUPPORT_PHONE}`,
  ].join(" ") + OPT_OUT_FOOTER;
}

/** Alias for provider-based callers */
export const buildAppointmentReminderSmsTemplate = buildReminderSms;

export interface CancellationSmsData {
  customerName: string;
  scheduledDate: string;
}

export function buildCancellationSms(data: CancellationSmsData): string {
  return [
    `No More Mosquitoes: Your appointment on ${data.scheduledDate} has been canceled.`,
    `To rebook, visit ${APP_URL} or call ${SUPPORT_PHONE}.`,
  ].join(" ") + OPT_OUT_FOOTER;
}

export interface AdminQuoteSmsData {
  propertyAddress: string;
  priceLabel: string;     // e.g. "$80 every 3 weeks"
  quoteLinkUrl: string;
}

export function buildAdminQuoteSms(data: AdminQuoteSmsData): string {
  return [
    `No More Mosquitoes: Your quote for ${data.propertyAddress} is ready — ${data.priceLabel}.`,
    `Set up your account: ${data.quoteLinkUrl}`,
  ].join(" ") + OPT_OUT_FOOTER;
}

// ─── Employee Assignment SMS (internal — no STOP footer for staff) ────────────

export interface EmployeeAssignmentSmsData {
  employeeName: string;
  changeType: "created" | "updated" | "cancelled";
  appointmentDate: string;   // "Monday, June 2, 2026"
  windowLabel: string;       // "Morning (8AM–12PM)"
  propertyAddress: string;
}

export function buildEmployeeAssignmentSms(data: EmployeeAssignmentSmsData): string {
  const prefix = data.changeType === "created"
    ? "New assignment"
    : data.changeType === "cancelled"
    ? "Assignment cancelled"
    : "Assignment updated";

  return `[NMM Ops] ${prefix}: ${data.appointmentDate}, ${data.windowLabel} at ${data.propertyAddress}. Check your portal: ${APP_URL}/employee`;
}
