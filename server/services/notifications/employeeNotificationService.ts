/**
 * Employee Notification Service
 *
 * Sends assignment notifications to employees when they are assigned,
 * updated, or when their assignments are cancelled.
 *
 * Design:
 *  - Always checks employee.status = 'active' before sending
 *  - Respects employee notification preferences (emailAssignmentAlerts, smsAssignmentAlerts)
 *  - Fire-and-forget safe (never throws, all errors logged)
 *  - Uses provider abstraction for email; direct Twilio client for SMS (SID logging)
 *  - Logs all sends/skips to notification_log
 */

import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { supabase } from "../../lib/supabase";
import { getEmailProvider, getSmsProvider, getSmsFromNumber, getFromEmail } from "./providers/index";
import { buildEmployeeAssignmentEmail } from "./emailTemplates";
import { buildEmployeeAssignmentSms } from "./smsTemplates";
import { logNotification } from "./notificationLogger";

const db = supabaseAdmin ?? supabase;

// ─── Types ────────────────────────────────────────────────────────────────────

type AssignmentChangeType = "created" | "updated" | "cancelled";

interface AssignmentContext {
  employee: {
    id: string;
    user_id: string | null;
    name: string | null;
    email: string | null;
    phone: string | null;
    status: string;
    notification_preferences: Record<string, unknown> | null;
  };
  appointment: {
    id: string;
    scheduled_date: string | null;
    window_label: string | null;
    window: string | null;
    notes: string | null;
  } | null;
  property: {
    address: string | null;
    city: string | null;
    state: string | null;
  } | null;
}

// ─── Data Fetching ────────────────────────────────────────────────────────────

async function getAssignmentContext(assignmentId: string): Promise<AssignmentContext | null> {
  try {
    const { data: assignment } = await db
      .from("assignments")
      .select("id, employee_id, appointment_id")
      .eq("id", assignmentId)
      .maybeSingle();

    if (!assignment) return null;

    const [employeeResult, apptResult] = await Promise.all([
      db.from("employees")
        .select("id, user_id, name, email, phone, status, notification_preferences")
        .eq("id", assignment.employee_id)
        .maybeSingle(),
      assignment.appointment_id
        ? db.from("appointments")
            .select("id, scheduled_date, window_label, window, notes, property_id")
            .eq("id", assignment.appointment_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const employee = employeeResult.data;
    if (!employee) return null;

    const appt = (apptResult as any).data;
    let property = null;

    if (appt?.property_id) {
      const { data: propData } = await db
        .from("properties")
        .select("address, city, state")
        .eq("id", appt.property_id)
        .maybeSingle();
      property = propData;
    }

    return {
      employee: {
        id:                       employee.id,
        user_id:                  employee.user_id ?? null,
        name:                     employee.name ?? null,
        email:                    employee.email ?? null,
        phone:                    employee.phone ?? null,
        status:                   employee.status,
        notification_preferences: (employee.notification_preferences as Record<string, unknown>) ?? null,
      },
      appointment: appt
        ? {
            id:             appt.id,
            scheduled_date: appt.scheduled_date ?? null,
            window_label:   appt.window_label ?? null,
            window:         appt.window ?? null,
            notes:          appt.notes ?? null,
          }
        : null,
      property: property
        ? {
            address: (property as any).address ?? null,
            city:    (property as any).city ?? null,
            state:   (property as any).state ?? null,
          }
        : null,
    };
  } catch (err: any) {
    console.error("[EmployeeNotify] Failed to fetch assignment context:", err.message);
    return null;
  }
}

// ─── Preference Checks ────────────────────────────────────────────────────────

function shouldSendEmail(prefs: Record<string, unknown> | null): boolean {
  if (!prefs) return true; // default: send
  return prefs.emailAssignmentAlerts !== false;
}

function shouldSendSms(prefs: Record<string, unknown> | null): boolean {
  if (!prefs) return true; // default: send
  return prefs.smsAssignmentAlerts !== false && prefs.smsOptedOut !== true;
}

// ─── Notification Type Mapping ────────────────────────────────────────────────

function notificationTypeFor(changeType: AssignmentChangeType) {
  if (changeType === "created")   return "employee_assignment_created"   as const;
  if (changeType === "cancelled") return "employee_assignment_cancelled" as const;
  return "employee_assignment_updated" as const;
}

// ─── Core Send Function ───────────────────────────────────────────────────────

async function sendEmployeeNotification(
  assignmentId: string,
  changeType: AssignmentChangeType,
): Promise<void> {
  const ctx = await getAssignmentContext(assignmentId);
  if (!ctx) {
    console.log(`[EmployeeNotify] No context for assignment ${assignmentId} — skipping`);
    return;
  }

  const { employee, appointment, property } = ctx;
  const notifType = notificationTypeFor(changeType);

  // Only notify active employees
  if (employee.status !== "active") {
    console.log(`[EmployeeNotify] Employee ${employee.id} is not active (${employee.status}) — skipping`);
    return;
  }

  const prefs = employee.notification_preferences;
  const dashboardUrl = `${process.env.APP_BASE_URL || "https://nomoremosquitoes.us"}/employee`;

  // Format date
  const appointmentDate = appointment?.scheduled_date
    ? (() => {
        try {
          return new Date(appointment.scheduled_date + "T00:00:00").toLocaleDateString("en-US", {
            weekday: "long", month: "long", day: "numeric", year: "numeric",
          });
        } catch {
          return appointment.scheduled_date;
        }
      })()
    : "your scheduled date";

  const windowLabel = appointment?.window_label || appointment?.window || "your arrival window";
  const propertyAddress = [property?.address, property?.city, property?.state]
    .filter(Boolean)
    .join(", ") || "the service location";
  const employeeName = employee.name || "Team Member";

  // ── Email ──────────────────────────────────────────────────────────────────

  if (employee.email && shouldSendEmail(prefs)) {
    try {
      const { subject, html, text } = buildEmployeeAssignmentEmail({
        employeeName,
        changeType,
        appointmentDate,
        windowLabel,
        propertyAddress,
        notes: appointment?.notes ?? null,
        dashboardUrl,
      });

      const emailProvider = getEmailProvider();
      await emailProvider.send({ to: employee.email, from: getFromEmail(), subject, html, text });

      await logNotification({
        appointmentId:    appointment?.id ?? null,
        profileId:        employee.user_id ?? null,
        recipientEmail:   employee.email,
        channel:          "email",
        notificationType: notifType,
        subject,
        status:           "sent",
        provider:         "resend",
        sentAt:           new Date().toISOString(),
      });

      console.log(`[EmployeeNotify] ${changeType} email sent to ${employee.email} for assignment ${assignmentId}`);
    } catch (emailErr: any) {
      console.error(`[EmployeeNotify] Email failed for assignment ${assignmentId}:`, emailErr.message);
      await logNotification({
        appointmentId:    appointment?.id ?? null,
        profileId:        employee.user_id ?? null,
        recipientEmail:   employee.email,
        channel:          "email",
        notificationType: notifType,
        status:           "failed",
        provider:         "resend",
        errorMessage:     emailErr.message,
      });
    }
  } else if (employee.email && !shouldSendEmail(prefs)) {
    console.log(`[EmployeeNotify] emailAssignmentAlerts=false for employee ${employee.id} — skipping email`);
    await logNotification({
      appointmentId:    appointment?.id ?? null,
      profileId:        employee.user_id ?? null,
      recipientEmail:   employee.email,
      channel:          "email",
      notificationType: notifType,
      status:           "skipped",
      errorMessage:     "emailAssignmentAlerts preference is false",
    });
  }

  // ── SMS ────────────────────────────────────────────────────────────────────

  if (employee.phone && shouldSendSms(prefs)) {
    const smsProviderName = process.env.SMS_PROVIDER || "twilio";
    try {
      const smsBody = buildEmployeeAssignmentSms({
        employeeName,
        changeType,
        appointmentDate,
        windowLabel,
        propertyAddress,
      });

      const smsProvider = getSmsProvider();
      const fromNumber = getSmsFromNumber();

      if (!fromNumber) {
        console.log(`[EmployeeNotify] SMS from-number not configured — skipping SMS for assignment ${assignmentId}`);
        await logNotification({
          appointmentId:    appointment?.id ?? null,
          profileId:        employee.user_id ?? null,
          recipientPhone:   employee.phone,
          channel:          "sms",
          notificationType: notifType,
          status:           "skipped",
          provider:         smsProviderName,
          errorMessage:     "SMS_FROM_NUMBER / TWILIO_FROM_NUMBER not configured",
        });
      } else {
        await smsProvider.send({ to: employee.phone, from: fromNumber, body: smsBody });

        await logNotification({
          appointmentId:    appointment?.id ?? null,
          profileId:        employee.user_id ?? null,
          recipientPhone:   employee.phone,
          channel:          "sms",
          notificationType: notifType,
          status:           "sent",
          provider:         smsProviderName,
          sentAt:           new Date().toISOString(),
        });

        console.log(`[EmployeeNotify] ${changeType} SMS sent to ${employee.phone} for assignment ${assignmentId}`);
      }
    } catch (smsErr: any) {
      console.error(`[EmployeeNotify] SMS failed for assignment ${assignmentId}:`, smsErr.message);
      await logNotification({
        appointmentId:    appointment?.id ?? null,
        profileId:        employee.user_id ?? null,
        recipientPhone:   employee.phone,
        channel:          "sms",
        notificationType: notifType,
        status:           "failed",
        provider:         smsProviderName,
        errorMessage:     smsErr.message,
      });
    }
  } else if (employee.phone && !shouldSendSms(prefs)) {
    console.log(`[EmployeeNotify] SMS pref disabled for employee ${employee.id} — skipping SMS`);
    await logNotification({
      appointmentId:    appointment?.id ?? null,
      profileId:        employee.user_id ?? null,
      recipientPhone:   employee.phone,
      channel:          "sms",
      notificationType: notifType,
      status:           "skipped",
      errorMessage:     "smsAssignmentAlerts or smsOptedOut preference",
    });
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fire-and-forget: notify employee of new assignment.
 * Call after upsert in adminAppointments.ts.
 */
export function notifyEmployeeAssigned(assignmentId: string): void {
  void sendEmployeeNotification(assignmentId, "created").catch((err: any) => {
    console.error("[EmployeeNotify] notifyEmployeeAssigned error:", err.message);
  });
}

/**
 * Fire-and-forget: notify employee of assignment update.
 */
export function notifyEmployeeAssignmentChanged(assignmentId: string, changeType: string): void {
  const normalized: AssignmentChangeType = changeType === "cancelled" ? "cancelled" : "updated";
  void sendEmployeeNotification(assignmentId, normalized).catch((err: any) => {
    console.error("[EmployeeNotify] notifyEmployeeAssignmentChanged error:", err.message);
  });
}

/**
 * Fire-and-forget: notify employee that their assignment was cancelled.
 */
export function notifyEmployeeAssignmentCancelled(assignmentId: string): void {
  void sendEmployeeNotification(assignmentId, "cancelled").catch((err: any) => {
    console.error("[EmployeeNotify] notifyEmployeeAssignmentCancelled error:", err.message);
  });
}
