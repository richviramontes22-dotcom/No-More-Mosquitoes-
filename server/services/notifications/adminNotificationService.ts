/**
 * Admin / Owner Notification Service
 *
 * Sends internal alerts to the business owner and admin users when
 * operationally significant events occur (new bookings, payment failures,
 * service completions, lead submissions, etc.).
 *
 * Design goals:
 *  - Fire-and-forget: never blocks an HTTP response
 *  - Fail-safe: provider errors are caught and logged, never re-thrown
 *  - Deduplication: identical open alerts are not duplicated within 1 hour
 *  - NullProvider-compatible: works even if email / SMS creds are absent
 */

import { getEmailProvider, getSmsProvider, getFromEmail } from "./providers/index";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { supabase } from "../../lib/supabase";

const db = supabaseAdmin ?? supabase;

// ─── Types ────────────────────────────────────────────────────────────────────

export type AdminAlertSeverity = "info" | "warning" | "critical";

export interface AdminAlertEvent {
  /** Dot-namespaced event key, e.g. "billing.payment_failed" */
  event_type: string;
  severity: AdminAlertSeverity;
  /** Short one-liner shown in alert bell / email subject */
  title: string;
  /** Optional longer description */
  body?: string;
  /** "appointment" | "subscription" | "user" | "lead" | "webhook" | … */
  entity_type?: string;
  /** UUID or external ID of the related entity */
  entity_id?: string;
  /** Arbitrary key/value pairs (customer name, amount, etc.) */
  metadata?: Record<string, unknown>;
}

interface AdminRecipients {
  emails: string[];
  phones: string[];
}

// ─── Recipient Resolution ─────────────────────────────────────────────────────

function resolveAdminRecipients(): AdminRecipients {
  const ownerEmail  = process.env.OWNER_EMAIL;
  const ownerPhone  = process.env.OWNER_PHONE;
  const adminEmails = process.env.ADMIN_ALERT_EMAILS; // comma-separated fallback list

  const emails: string[] = [];
  if (ownerEmail) {
    emails.push(ownerEmail);
  } else if (adminEmails) {
    adminEmails.split(",").map(e => e.trim()).filter(Boolean).forEach(e => emails.push(e));
  }

  const phones: string[] = [];
  if (ownerPhone) phones.push(ownerPhone);

  return { emails, phones };
}

// ─── Deduplication ────────────────────────────────────────────────────────────

/**
 * Returns true if an unresolved alert with the same event_type + entity
 * already exists and was created within the last `withinMinutes` minutes.
 */
async function isDuplicateAlert(
  event_type: string,
  entity_type: string | undefined,
  entity_id: string | undefined,
  withinMinutes = 60,
): Promise<boolean> {
  try {
    const cutoff = new Date(Date.now() - withinMinutes * 60 * 1000).toISOString();
    let query = db
      .from("admin_alerts")
      .select("id", { count: "exact", head: true })
      .eq("event_type", event_type)
      .is("resolved_at", null)
      .gte("created_at", cutoff);

    if (entity_type) query = query.eq("entity_type", entity_type);
    if (entity_id)   query = query.eq("entity_id", entity_id);

    const { count } = await query;
    return (count ?? 0) > 0;
  } catch {
    return false; // fail open — allow the alert
  }
}

// ─── DB Logging ───────────────────────────────────────────────────────────────

async function insertAdminAlert(
  event: AdminAlertEvent,
  notified_email: boolean,
  notified_sms: boolean,
): Promise<string | null> {
  try {
    const { data, error } = await db
      .from("admin_alerts")
      .insert({
        event_type:    event.event_type,
        severity:      event.severity,
        title:         event.title,
        body:          event.body ?? null,
        entity_type:   event.entity_type ?? null,
        entity_id:     event.entity_id ?? null,
        metadata:      event.metadata ?? null,
        notified_email,
        notified_sms,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[AdminAlert] DB insert failed:", error.message);
      return null;
    }
    return data?.id ?? null;
  } catch (err: any) {
    console.error("[AdminAlert] Unexpected DB error:", err.message);
    return null;
  }
}

// ─── Email Sending ────────────────────────────────────────────────────────────

function buildAdminAlertEmail(event: AdminAlertEvent): { subject: string; html: string } {
  const severityBadge: Record<AdminAlertSeverity, string> = {
    info:     `<span style="background:#dbeafe;color:#1e40af;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:600;">INFO</span>`,
    warning:  `<span style="background:#fef3c7;color:#92400e;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:600;">WARNING</span>`,
    critical: `<span style="background:#fee2e2;color:#991b1b;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:600;">CRITICAL</span>`,
  };
  const badge     = severityBadge[event.severity];
  const appUrl    = process.env.APP_BASE_URL || "https://nomoremosquitoes.us";
  const adminUrl  = `${appUrl}/admin`;

  const metaRows = event.metadata
    ? Object.entries(event.metadata)
        .map(([k, v]) => `<tr><td style="padding:4px 0;font-size:13px;color:#6b7280;width:140px;">${k}</td><td style="padding:4px 0;font-size:13px;color:#111827;">${String(v)}</td></tr>`)
        .join("")
    : "";

  const metaTable = metaRows
    ? `<table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-top:16px;border-top:1px solid #e5e7eb;padding-top:12px;">${metaRows}</table>`
    : "";

  const bodySection = event.body
    ? `<p style="margin:12px 0 0;font-size:14px;color:#374151;line-height:1.6;">${event.body}</p>`
    : "";

  const subject = `[NMM Alert] ${event.title}`;
  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f3f4f6;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#fff;border-radius:10px;overflow:hidden;border:1px solid #e5e7eb;">
        <tr>
          <td style="background:#2d6a4f;padding:24px 36px;">
            <p style="margin:0;font-size:18px;font-weight:bold;color:#fff;">No More Mosquitoes — Admin Alert</p>
            <p style="margin:4px 0 0;font-size:12px;color:rgba(255,255,255,0.7);">Internal notification — do not forward</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 36px;">
            <div style="margin-bottom:16px;">${badge}</div>
            <h2 style="margin:0 0 8px;font-size:20px;color:#111827;">${event.title}</h2>
            ${bodySection}
            ${metaTable}
            <div style="margin-top:28px;">
              <a href="${adminUrl}" style="display:inline-block;background:#2d6a4f;color:#fff;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;">Open Admin Dashboard</a>
            </div>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;padding:16px 36px;border-top:1px solid #e5e7eb;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">This is an internal alert sent to NMM admin users only.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  return { subject, html };
}

async function sendAdminEmail(event: AdminAlertEvent, emails: string[]): Promise<boolean> {
  if (!emails.length) return false;
  const provider = getEmailProvider();
  const from     = getFromEmail();
  const { subject, html } = buildAdminAlertEmail(event);

  let ok = true;
  for (const to of emails) {
    try {
      await provider.send({ to, from, subject, html });
    } catch (err: any) {
      console.error(`[AdminAlert] Email to ${to} failed:`, err.message);
      ok = false;
    }
  }
  return ok;
}

// ─── SMS Sending ──────────────────────────────────────────────────────────────

function buildAdminAlertSms(event: AdminAlertEvent): string {
  const prefix = event.severity === "critical" ? "🚨 CRITICAL" : event.severity === "warning" ? "⚠️ WARNING" : "ℹ️ INFO";
  return `[NMM Alert] ${prefix}: ${event.title}${event.body ? ` — ${event.body}` : ""}`;
}

async function sendAdminSms(event: AdminAlertEvent, phones: string[]): Promise<boolean> {
  if (!phones.length) return false;
  const provider = getSmsProvider();
  const fromNumber = process.env.TWILIO_FROM_NUMBER || "";
  if (!fromNumber) return false;

  const body = buildAdminAlertSms(event);
  let ok = true;
  for (const to of phones) {
    try {
      await provider.send({ to, from: fromNumber, body });
    } catch (err: any) {
      console.error(`[AdminAlert] SMS to ${to} failed:`, err.message);
      ok = false;
    }
  }
  return ok;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fire-and-forget admin notification.
 * Deduplicates within 1 hour for info/warning, 15 minutes for critical.
 * Persists to admin_alerts table regardless of send outcome.
 */
export function notifyAdmin(event: AdminAlertEvent): void {
  void (async () => {
    try {
      const dedupWindow = event.severity === "critical" ? 15 : 60;
      const isDup = await isDuplicateAlert(event.event_type, event.entity_type, event.entity_id, dedupWindow);
      if (isDup) {
        console.log(`[AdminAlert] Skipping duplicate: ${event.event_type} / ${event.entity_id}`);
        return;
      }

      const { emails, phones } = resolveAdminRecipients();

      // Only send SMS for warning/critical
      const shouldSms = event.severity !== "info";

      const [emailSent, smsSent] = await Promise.all([
        sendAdminEmail(event, emails),
        shouldSms ? sendAdminSms(event, phones) : Promise.resolve(false),
      ]);

      await insertAdminAlert(event, emailSent, smsSent);
    } catch (err: any) {
      console.error("[AdminAlert] Unexpected error in notifyAdmin:", err.message);
    }
  })();
}

/**
 * Shorthand for critical severity — always sends SMS when phone configured.
 */
export function notifyAdminCritical(
  event_type: string,
  title: string,
  details?: Omit<AdminAlertEvent, "event_type" | "severity" | "title">,
): void {
  notifyAdmin({ event_type, severity: "critical", title, ...details });
}

/**
 * Logs an alert to the DB only — no email or SMS.
 * Useful for info-level events that should appear in the alert history
 * but don't warrant interrupting the owner.
 */
export async function logAdminAlert(event: AdminAlertEvent): Promise<string | null> {
  return insertAdminAlert(event, false, false);
}
