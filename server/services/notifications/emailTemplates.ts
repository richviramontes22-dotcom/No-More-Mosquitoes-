// ─── Shared email design tokens ───────────────────────────────────────────────
const BRAND_GREEN  = "#2d6a4f";
const BRAND_LIGHT  = "#f0faf4";
const TEXT_DARK    = "#1a1a1a";
const TEXT_MUTED   = "#6b7280";
const BORDER       = "#e5e7eb";
const FONT         = "Georgia, 'Times New Roman', serif";
const BODY_FONT    = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

function getCompanyAddress(): string {
  return process.env.COMPANY_ADDRESS || "";
}

function getSupportEmail(): string {
  return process.env.SUPPORT_EMAIL || "support@nomoremosquitoes.us";
}

function layout(content: string, preheader = "", profileId?: string | null): string {
  const companyAddress = getCompanyAddress();
  const supportEmail   = getSupportEmail();
  const appUrl         = process.env.APP_BASE_URL || "https://nomoremosquitoes.us";
  const year           = new Date().getFullYear();
  const unsubUrl       = profileId
    ? `${appUrl}/api/unsubscribe?unsub=${encodeURIComponent(profileId)}`
    : `${appUrl}/dashboard/profile`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>No More Mosquitoes</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:${BODY_FONT};-webkit-text-size-adjust:100%;">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;font-size:1px;color:#f3f4f6;">${preheader}</div>` : ""}
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f3f4f6;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid ${BORDER};">

        <!-- Header -->
        <tr>
          <td style="background-color:${BRAND_GREEN};padding:32px 40px;text-align:center;">
            <p style="margin:0;font-family:${FONT};font-size:22px;font-weight:bold;color:#ffffff;letter-spacing:0.5px;">No More Mosquitoes</p>
            <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.75);">Professional Mosquito Control</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px;color:${TEXT_DARK};font-size:15px;line-height:1.6;">
            ${content}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background-color:${BRAND_LIGHT};padding:24px 40px;border-top:1px solid ${BORDER};text-align:center;">
            <p style="margin:0;font-size:12px;color:${TEXT_MUTED};">© ${year} No More Mosquitoes · All rights reserved</p>
            ${companyAddress ? `<p style="margin:4px 0 0;font-size:12px;color:${TEXT_MUTED};">${companyAddress}</p>` : ""}
            <p style="margin:4px 0 0;font-size:12px;color:${TEXT_MUTED};">Support: <a href="mailto:${supportEmail}" style="color:${BRAND_GREEN};text-decoration:none;">${supportEmail}</a></p>
            <p style="margin:4px 0 0;font-size:12px;color:${TEXT_MUTED};">Questions? Reply to this email or visit <a href="${appUrl}" style="color:${BRAND_GREEN};text-decoration:none;">nomoremosquitoes.us</a></p>
            <p style="margin:8px 0 0;font-size:11px;color:${TEXT_MUTED};"><a href="${unsubUrl}" style="color:${TEXT_MUTED};text-decoration:underline;">Unsubscribe from emails</a> · <a href="${appUrl}/dashboard/profile" style="color:${TEXT_MUTED};text-decoration:underline;">Manage preferences</a></p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function infoRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:10px 0;border-bottom:1px solid ${BORDER};">
      <span style="display:inline-block;width:160px;font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:0.08em;color:${TEXT_MUTED};">${label}</span>
      <span style="font-size:15px;font-weight:600;color:${TEXT_DARK};">${value}</span>
    </td>
  </tr>`;
}

function ctaButton(text: string, href: string): string {
  return `<table cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
    <tr>
      <td style="background-color:${BRAND_GREEN};border-radius:8px;">
        <a href="${href}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;">${text}</a>
      </td>
    </tr>
  </table>`;
}

// ─── Template: appointment_confirmation ───────────────────────────────────────

export interface ConfirmationEmailData {
  customerName: string;
  propertyAddress: string;
  scheduledDate: string;       // "Monday, June 2, 2026"
  windowLabel: string;         // "Morning (8AM–12PM)"
  serviceType: string;         // "Mosquito Service"
  dashboardUrl: string;
}

export function buildConfirmationEmail(data: ConfirmationEmailData): { subject: string; html: string } {
  const subject = `Appointment Confirmed — ${data.scheduledDate}`;
  const html = layout(
    `<h1 style="margin:0 0 8px;font-family:${FONT};font-size:26px;color:${BRAND_GREEN};">You're on the schedule!</h1>
    <p style="margin:0 0 28px;color:${TEXT_MUTED};font-size:15px;">Hi ${data.customerName}, your mosquito treatment appointment has been confirmed.</p>

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
      ${infoRow("Service", data.serviceType)}
      ${infoRow("Address", data.propertyAddress)}
      ${infoRow("Date", data.scheduledDate)}
      ${infoRow("Arrival Window", data.windowLabel)}
    </table>

    <div style="background:${BRAND_LIGHT};border:1px solid #bbf7d0;border-radius:8px;padding:16px 20px;margin-bottom:28px;">
      <p style="margin:0;font-size:13px;color:${BRAND_GREEN};font-weight:600;">📅 What to expect</p>
      <ul style="margin:8px 0 0;padding-left:18px;font-size:14px;color:${TEXT_DARK};line-height:1.7;">
        <li>Our technician will arrive within your <strong>arrival window</strong> — not at an exact time.</li>
        <li>Please ensure yard access is available during the full window.</li>
        <li>If you have pets, please keep them indoors during the treatment.</li>
        <li>You'll receive a reminder the day before and the morning of service.</li>
      </ul>
    </div>

    ${ctaButton("View Appointment", data.dashboardUrl)}

    <p style="font-size:13px;color:${TEXT_MUTED};margin-top:8px;">Need to reschedule or cancel? Log in to your dashboard or reply to this email and we'll take care of it.</p>`,
    `Confirmed: ${data.windowLabel} arrival window on ${data.scheduledDate}`
  );
  return { subject, html };
}

// ─── Template: reminder_24h ───────────────────────────────────────────────────

export interface ReminderEmailData {
  customerName: string;
  propertyAddress: string;
  scheduledDate: string;
  windowLabel: string;
  serviceType: string;
  dashboardUrl: string;
}

export function buildReminder24hEmail(data: ReminderEmailData): { subject: string; html: string } {
  const subject = `Reminder: Your appointment is tomorrow — ${data.scheduledDate}`;
  const html = layout(
    `<h1 style="margin:0 0 8px;font-family:${FONT};font-size:26px;color:${BRAND_GREEN};">Tomorrow's the day!</h1>
    <p style="margin:0 0 28px;color:${TEXT_MUTED};font-size:15px;">Hi ${data.customerName}, just a friendly reminder about your mosquito treatment tomorrow.</p>

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
      ${infoRow("Service", data.serviceType)}
      ${infoRow("Address", data.propertyAddress)}
      ${infoRow("Date", data.scheduledDate)}
      ${infoRow("Arrival Window", data.windowLabel)}
    </table>

    <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:16px 20px;margin-bottom:28px;">
      <p style="margin:0;font-size:13px;color:#92400e;font-weight:600;">⏰ Quick checklist for tomorrow</p>
      <ul style="margin:8px 0 0;padding-left:18px;font-size:14px;color:${TEXT_DARK};line-height:1.7;">
        <li>Keep pets indoors during and 30 minutes after treatment.</li>
        <li>Ensure yard gates and access points are unlocked.</li>
        <li>Move any outdoor toys or furniture away from spray zones if possible.</li>
        <li>You'll receive a same-day reminder the morning of service.</li>
      </ul>
    </div>

    ${ctaButton("View Appointment", data.dashboardUrl)}`,
    `Tomorrow: ${data.windowLabel} on ${data.scheduledDate}`
  );
  return { subject, html };
}

// ─── Template: reminder_same_day ─────────────────────────────────────────────

export function buildReminderSameDayEmail(data: ReminderEmailData): { subject: string; html: string } {
  const subject = `Today's your service day — ${data.windowLabel} arrival window`;
  const html = layout(
    `<h1 style="margin:0 0 8px;font-family:${FONT};font-size:26px;color:${BRAND_GREEN};">Your technician is coming today</h1>
    <p style="margin:0 0 28px;color:${TEXT_MUTED};font-size:15px;">Hi ${data.customerName}, your mosquito treatment is scheduled for today. Here's your arrival window:</p>

    <div style="background:${BRAND_LIGHT};border:2px solid ${BRAND_GREEN};border-radius:10px;padding:24px;text-align:center;margin-bottom:28px;">
      <p style="margin:0;font-size:12px;text-transform:uppercase;letter-spacing:0.1em;color:${BRAND_GREEN};font-weight:bold;">Arrival Window</p>
      <p style="margin:8px 0 0;font-family:${FONT};font-size:28px;font-weight:bold;color:${TEXT_DARK};">${data.windowLabel}</p>
      <p style="margin:6px 0 0;font-size:14px;color:${TEXT_MUTED};">${data.scheduledDate}</p>
    </div>

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
      ${infoRow("Service", data.serviceType)}
      ${infoRow("Address", data.propertyAddress)}
    </table>

    <p style="font-size:14px;color:${TEXT_DARK};margin:0 0 24px;">Our technician will arrive sometime during this window. Keep pets indoors and ensure gate access is available. We'll update you when your technician is on the way.</p>

    ${ctaButton("View Appointment", data.dashboardUrl)}`,
    `Today: Your technician arrives during the ${data.windowLabel}`
  );
  return { subject, html };
}

// ─── Template: appointment_canceled ──────────────────────────────────────────

export interface CancelEmailData {
  customerName: string;
  propertyAddress: string;
  scheduledDate: string;
  windowLabel: string;
  dashboardUrl: string;
}

export function buildCancellationEmail(data: CancelEmailData): { subject: string; html: string } {
  const subject = `Appointment canceled — ${data.scheduledDate}`;
  const html = layout(
    `<h1 style="margin:0 0 8px;font-family:${FONT};font-size:26px;color:#b91c1c;">Appointment Canceled</h1>
    <p style="margin:0 0 28px;color:${TEXT_MUTED};font-size:15px;">Hi ${data.customerName}, your appointment has been canceled.</p>

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
      ${infoRow("Address", data.propertyAddress)}
      ${infoRow("Was scheduled", data.scheduledDate)}
      ${infoRow("Arrival Window", data.windowLabel)}
    </table>

    <p style="font-size:14px;color:${TEXT_DARK};margin-bottom:24px;">If you'd like to rebook, you can schedule a new appointment from your dashboard anytime.</p>

    ${ctaButton("Schedule a New Appointment", data.dashboardUrl)}

    <p style="font-size:13px;color:${TEXT_MUTED};margin-top:8px;">If you did not request this cancellation, please contact us immediately by replying to this email.</p>`,
    `Your appointment on ${data.scheduledDate} has been canceled`
  );
  return { subject, html };
}

// ─── Template: appointment_rescheduled ───────────────────────────────────────

export interface RescheduleEmailData {
  customerName: string;
  propertyAddress: string;
  newScheduledDate: string;
  newWindowLabel: string;
  dashboardUrl: string;
}

export function buildRescheduleEmail(data: RescheduleEmailData): { subject: string; html: string } {
  const subject = `Appointment rescheduled — new date: ${data.newScheduledDate}`;
  const html = layout(
    `<h1 style="margin:0 0 8px;font-family:${FONT};font-size:26px;color:${BRAND_GREEN};">Your appointment has been rescheduled</h1>
    <p style="margin:0 0 28px;color:${TEXT_MUTED};font-size:15px;">Hi ${data.customerName}, your mosquito treatment appointment has been moved to a new date.</p>

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
      ${infoRow("Address", data.propertyAddress)}
      ${infoRow("New Date", data.newScheduledDate)}
      ${infoRow("New Arrival Window", data.newWindowLabel)}
    </table>

    ${ctaButton("View Updated Appointment", data.dashboardUrl)}

    <p style="font-size:13px;color:${TEXT_MUTED};margin-top:8px;">If you have any questions about this change, please reply to this email.</p>`,
    `Rescheduled to ${data.newWindowLabel} on ${data.newScheduledDate}`
  );
  return { subject, html };
}

// ─── Template: service_completed ─────────────────────────────────────────────

export interface ServiceCompletionEmailData {
  customerName: string;
  scheduledDate?: string | null;  // display-formatted date
  hasMedia: boolean;
  dashboardUrl: string;
}

export function buildServiceCompletionEmail(data: ServiceCompletionEmailData): { subject: string; html: string; text: string } {
  const subject = "Your mosquito treatment is complete";
  const dateText = data.scheduledDate ? ` scheduled for <strong>${data.scheduledDate}</strong>` : "";
  const html = layout(
    `<h1 style="margin:0 0 8px;font-family:${FONT};font-size:26px;color:${BRAND_GREEN};">Service Complete!</h1>
    <p style="margin:0 0 28px;color:${TEXT_MUTED};font-size:15px;">Hi ${data.customerName}, great news — your mosquito treatment service${dateText} has been completed.</p>

    <div style="background:${BRAND_LIGHT};border:1px solid #bbf7d0;border-radius:8px;padding:16px 20px;margin-bottom:28px;">
      <p style="margin:0;font-size:14px;color:${BRAND_GREEN};font-weight:600;">What was treated</p>
      <ul style="margin:8px 0 0;padding-left:18px;font-size:14px;color:${TEXT_DARK};line-height:1.7;">
        <li>Your yard has been treated for mosquitoes and other biting insects.</li>
        <li>Treatment is most effective within 30 minutes of application.</li>
        <li>Keep pets and children away from treated areas for 30 minutes.</li>
      </ul>
    </div>

    ${data.hasMedia ? `<p style="font-size:14px;color:${TEXT_DARK};margin-bottom:24px;">Your technician attached service photos — you can view them in your dashboard.</p>` : ""}

    <p style="font-size:14px;color:${TEXT_DARK};margin-bottom:24px;">Visit your dashboard to view full details and your next scheduled visit.</p>

    ${ctaButton("View Dashboard", data.dashboardUrl)}

    <p style="font-size:13px;color:${TEXT_MUTED};margin-top:8px;">Thank you for choosing No More Mosquitoes. We appreciate your business!</p>`,
    `Your mosquito treatment${data.scheduledDate ? ` for ${data.scheduledDate}` : ""} is complete`
  );
  const text = [
    `Hi ${data.customerName},`,
    ``,
    `Your mosquito treatment service${data.scheduledDate ? ` scheduled for ${data.scheduledDate}` : ""} has been completed.`,
    ``,
    `Your yard has been treated for mosquitoes. Please keep pets and children away from treated areas for 30 minutes.`,
    ``,
    data.hasMedia ? `Your technician attached service photos — view them in your dashboard: ${data.dashboardUrl}` : `View your dashboard for details: ${data.dashboardUrl}`,
    ``,
    `Thank you for choosing No More Mosquitoes.`,
  ].join("\n");
  return { subject, html, text };
}

// ─── Template: payment_failed ─────────────────────────────────────────────────

export interface PaymentFailedEmailData {
  customerName: string;
  amount: string;       // e.g. "$49.99"
  currency: string;
  billingPortalUrl: string;
  supportEmail: string;
}

export function buildPaymentFailedEmail(data: PaymentFailedEmailData): { subject: string; html: string; text: string } {
  const subject = "Action required: Payment failed for your No More Mosquitoes subscription";
  const html = layout(
    `<h1 style="margin:0 0 8px;font-family:${FONT};font-size:26px;color:#b91c1c;">Payment Failed</h1>
    <p style="margin:0 0 28px;color:${TEXT_MUTED};font-size:15px;">Hi ${data.customerName}, we were unable to process your payment of <strong>${data.amount}</strong> for your mosquito treatment subscription.</p>

    <div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:16px 20px;margin-bottom:28px;">
      <p style="margin:0;font-size:14px;color:#991b1b;font-weight:600;">What you need to do</p>
      <ul style="margin:8px 0 0;padding-left:18px;font-size:14px;color:${TEXT_DARK};line-height:1.7;">
        <li>Update your payment method in the billing portal.</li>
        <li>Once updated, we will retry the charge automatically.</li>
        <li>If payment fails repeatedly, your subscription may be paused.</li>
      </ul>
    </div>

    ${ctaButton("Update Payment Method", data.billingPortalUrl)}

    <p style="font-size:13px;color:${TEXT_MUTED};margin-top:8px;">Need help? Reply to this email or contact us at <a href="mailto:${data.supportEmail}" style="color:${BRAND_GREEN};">${data.supportEmail}</a></p>`,
    "Action required: update your payment method to keep your subscription active"
  );
  const text = [
    `Hi ${data.customerName},`,
    ``,
    `We were unable to process your payment of ${data.amount} for your mosquito treatment subscription.`,
    ``,
    `Please update your payment method at: ${data.billingPortalUrl}`,
    ``,
    `Once updated, we will retry the charge automatically.`,
    ``,
    `Need help? Contact us at ${data.supportEmail}`,
  ].join("\n");
  return { subject, html, text };
}

// ─── Template: subscription_activated ────────────────────────────────────────

export interface SubscriptionActivatedEmailData {
  customerName: string;
  planName: string;
  startDate: string;
  dashboardUrl: string;
}

export function buildSubscriptionActivatedEmail(data: SubscriptionActivatedEmailData): { subject: string; html: string; text: string } {
  const subject = `Welcome to No More Mosquitoes — your ${data.planName} subscription is active`;
  const html = layout(
    `<h1 style="margin:0 0 8px;font-family:${FONT};font-size:26px;color:${BRAND_GREEN};">Your subscription is active!</h1>
    <p style="margin:0 0 28px;color:${TEXT_MUTED};font-size:15px;">Hi ${data.customerName}, welcome! Your <strong>${data.planName}</strong> subscription started on ${data.startDate}. We're excited to help you enjoy a mosquito-free yard.</p>

    <div style="background:${BRAND_LIGHT};border:1px solid #bbf7d0;border-radius:8px;padding:16px 20px;margin-bottom:28px;">
      <p style="margin:0;font-size:14px;color:${BRAND_GREEN};font-weight:600;">What happens next</p>
      <ul style="margin:8px 0 0;padding-left:18px;font-size:14px;color:${TEXT_DARK};line-height:1.7;">
        <li>Your first treatment appointment is being scheduled — you'll receive a confirmation shortly.</li>
        <li>You can view your schedule and manage your subscription from your dashboard.</li>
        <li>We'll send you reminders before each visit.</li>
      </ul>
    </div>

    ${ctaButton("Go to Dashboard", data.dashboardUrl)}

    <p style="font-size:13px;color:${TEXT_MUTED};margin-top:8px;">Have questions? Just reply to this email and we'll be happy to help.</p>`,
    `Welcome! Your ${data.planName} plan is now active`
  );
  const text = [
    `Hi ${data.customerName},`,
    ``,
    `Your ${data.planName} subscription started on ${data.startDate}. Welcome to No More Mosquitoes!`,
    ``,
    `Your first treatment appointment is being scheduled — you'll receive a confirmation shortly.`,
    ``,
    `Dashboard: ${data.dashboardUrl}`,
  ].join("\n");
  return { subject, html, text };
}

// ─── Template: subscription_cancelled ────────────────────────────────────────

export interface SubscriptionCancelledEmailData {
  customerName: string;
  planName: string;
  endDate: string;
  dashboardUrl: string;
  supportEmail: string;
}

export function buildSubscriptionCancelledEmail(data: SubscriptionCancelledEmailData): { subject: string; html: string; text: string } {
  const subject = `Your No More Mosquitoes subscription has been canceled`;
  const html = layout(
    `<h1 style="margin:0 0 8px;font-family:${FONT};font-size:26px;color:#b91c1c;">Subscription Canceled</h1>
    <p style="margin:0 0 28px;color:${TEXT_MUTED};font-size:15px;">Hi ${data.customerName}, your <strong>${data.planName}</strong> subscription has been canceled. Service ended on ${data.endDate}.</p>

    <p style="font-size:14px;color:${TEXT_DARK};margin-bottom:24px;">Any remaining scheduled appointments have been canceled. You can resubscribe at any time from your dashboard.</p>

    ${ctaButton("Resubscribe", data.dashboardUrl)}

    <p style="font-size:13px;color:${TEXT_MUTED};margin-top:8px;">If you canceled by mistake or have questions, contact us at <a href="mailto:${data.supportEmail}" style="color:${BRAND_GREEN};">${data.supportEmail}</a></p>`,
    `Your ${data.planName} subscription has been canceled`
  );
  const text = [
    `Hi ${data.customerName},`,
    ``,
    `Your ${data.planName} subscription has been canceled. Service ended on ${data.endDate}.`,
    ``,
    `Any remaining scheduled appointments have been canceled.`,
    ``,
    `To resubscribe: ${data.dashboardUrl}`,
    ``,
    `Questions? Contact us at ${data.supportEmail}`,
  ].join("\n");
  return { subject, html, text };
}

// ─── Template: subscription_renewed ──────────────────────────────────────────

export interface SubscriptionRenewedEmailData {
  customerName: string;
  planName: string;
  amount: string;
  nextBillingDate: string;
  dashboardUrl: string;
}

export function buildSubscriptionRenewedEmail(data: SubscriptionRenewedEmailData): { subject: string; html: string; text: string } {
  const subject = `Your No More Mosquitoes subscription has been renewed`;
  const html = layout(
    `<h1 style="margin:0 0 8px;font-family:${FONT};font-size:26px;color:${BRAND_GREEN};">Subscription Renewed</h1>
    <p style="margin:0 0 28px;color:${TEXT_MUTED};font-size:15px;">Hi ${data.customerName}, your <strong>${data.planName}</strong> subscription has been successfully renewed.</p>

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
      ${infoRow("Plan", data.planName)}
      ${infoRow("Amount charged", data.amount)}
      ${infoRow("Next billing date", data.nextBillingDate)}
    </table>

    ${ctaButton("View Dashboard", data.dashboardUrl)}

    <p style="font-size:13px;color:${TEXT_MUTED};margin-top:8px;">Thanks for staying with us — see you at your next treatment!</p>`,
    `Your ${data.planName} plan renewed — next billing: ${data.nextBillingDate}`
  );
  const text = [
    `Hi ${data.customerName},`,
    ``,
    `Your ${data.planName} subscription has been renewed.`,
    `Amount charged: ${data.amount}`,
    `Next billing date: ${data.nextBillingDate}`,
    ``,
    `Dashboard: ${data.dashboardUrl}`,
  ].join("\n");
  return { subject, html, text };
}

// ─── Template: annual_plan_expiring ──────────────────────────────────────────

export interface AnnualPlanExpiringEmailData {
  customerName: string;
  expiryDate: string;
  daysRemaining: number;
  renewUrl: string;
  supportEmail: string;
}

export function buildAnnualPlanExpiringEmail(data: AnnualPlanExpiringEmailData): { subject: string; html: string; text: string } {
  const subject = `Your annual plan expires in ${data.daysRemaining} day${data.daysRemaining !== 1 ? "s" : ""} — renew now`;
  const html = layout(
    `<h1 style="margin:0 0 8px;font-family:${FONT};font-size:26px;color:#92400e;">Plan Expiring Soon</h1>
    <p style="margin:0 0 28px;color:${TEXT_MUTED};font-size:15px;">Hi ${data.customerName}, your annual mosquito control plan expires on <strong>${data.expiryDate}</strong> — that's ${data.daysRemaining} day${data.daysRemaining !== 1 ? "s" : ""} away.</p>

    <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:16px 20px;margin-bottom:28px;">
      <p style="margin:0;font-size:14px;color:#92400e;font-weight:600;">Don't lose your protection</p>
      <p style="margin:8px 0 0;font-size:14px;color:${TEXT_DARK};">Renew now to ensure uninterrupted mosquito control and keep your yard protected throughout the season.</p>
    </div>

    ${ctaButton("Renew My Plan", data.renewUrl)}

    <p style="font-size:13px;color:${TEXT_MUTED};margin-top:8px;">Questions about renewal? Contact us at <a href="mailto:${data.supportEmail}" style="color:${BRAND_GREEN};">${data.supportEmail}</a></p>`,
    `Your annual plan expires in ${data.daysRemaining} days — renew to keep your protection`
  );
  const text = [
    `Hi ${data.customerName},`,
    ``,
    `Your annual mosquito control plan expires on ${data.expiryDate} (${data.daysRemaining} days away).`,
    ``,
    `Renew now: ${data.renewUrl}`,
    ``,
    `Questions? Contact us at ${data.supportEmail}`,
  ].join("\n");
  return { subject, html, text };
}

// ─── Template: annual_plan_expired ───────────────────────────────────────────

export interface AnnualPlanExpiredEmailData {
  customerName: string;
  expiredDate: string;
  renewUrl: string;
  supportEmail: string;
}

export function buildAnnualPlanExpiredEmail(data: AnnualPlanExpiredEmailData): { subject: string; html: string; text: string } {
  const subject = `Your No More Mosquitoes annual plan has expired`;
  const html = layout(
    `<h1 style="margin:0 0 8px;font-family:${FONT};font-size:26px;color:#b91c1c;">Plan Expired</h1>
    <p style="margin:0 0 28px;color:${TEXT_MUTED};font-size:15px;">Hi ${data.customerName}, your annual mosquito control plan expired on <strong>${data.expiredDate}</strong>. Your scheduled treatments have been paused.</p>

    <p style="font-size:14px;color:${TEXT_DARK};margin-bottom:24px;">Renew your plan to restore service and get back to enjoying a mosquito-free yard.</p>

    ${ctaButton("Renew Now", data.renewUrl)}

    <p style="font-size:13px;color:${TEXT_MUTED};margin-top:8px;">Need help? Contact us at <a href="mailto:${data.supportEmail}" style="color:${BRAND_GREEN};">${data.supportEmail}</a></p>`,
    `Your annual plan expired on ${data.expiredDate} — renew to restore service`
  );
  const text = [
    `Hi ${data.customerName},`,
    ``,
    `Your annual mosquito control plan expired on ${data.expiredDate}.`,
    ``,
    `Renew to restore service: ${data.renewUrl}`,
    ``,
    `Questions? Contact us at ${data.supportEmail}`,
  ].join("\n");
  return { subject, html, text };
}

// ─── Template: lead_acknowledgement ──────────────────────────────────────────

export interface LeadAcknowledgementEmailData {
  customerName: string;
  serviceType: string;
  zip: string;
  supportEmail: string;
}

export function buildLeadAcknowledgementEmail(data: LeadAcknowledgementEmailData): { subject: string; html: string; text: string } {
  const subject = `We received your request — No More Mosquitoes`;
  const appUrl  = process.env.APP_BASE_URL || "https://nomoremosquitoes.us";
  const html = layout(
    `<h1 style="margin:0 0 8px;font-family:${FONT};font-size:26px;color:${BRAND_GREEN};">We got your request!</h1>
    <p style="margin:0 0 28px;color:${TEXT_MUTED};font-size:15px;">Hi ${data.customerName}, thank you for reaching out. We've received your service request and will be in touch within 1 business day.</p>

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
      ${infoRow("Service", data.serviceType)}
      ${infoRow("Zip Code", data.zip)}
    </table>

    <div style="background:${BRAND_LIGHT};border:1px solid #bbf7d0;border-radius:8px;padding:16px 20px;margin-bottom:28px;">
      <p style="margin:0;font-size:14px;color:${BRAND_GREEN};font-weight:600;">What to expect</p>
      <ul style="margin:8px 0 0;padding-left:18px;font-size:14px;color:${TEXT_DARK};line-height:1.7;">
        <li>A member of our team will contact you within 1 business day to confirm details.</li>
        <li>We'll schedule your first treatment at a time that works for you.</li>
        <li>You can also create an account to manage your service online.</li>
      </ul>
    </div>

    ${ctaButton("Create an Account", appUrl + "/signup")}

    <p style="font-size:13px;color:${TEXT_MUTED};margin-top:8px;">Questions in the meantime? Reply to this email or contact us at <a href="mailto:${data.supportEmail}" style="color:${BRAND_GREEN};">${data.supportEmail}</a></p>`,
    `We received your service request — we'll be in touch within 1 business day`
  );
  const text = [
    `Hi ${data.customerName},`,
    ``,
    `Thank you for reaching out! We've received your service request for ${data.serviceType} in zip code ${data.zip}.`,
    ``,
    `We'll be in touch within 1 business day to confirm details and schedule your first treatment.`,
    ``,
    `Questions? Contact us at ${data.supportEmail}`,
  ].join("\n");
  return { subject, html, text };
}

// ─── Template: technician_en_route (email fallback) ──────────────────────────

export interface EnRouteFallbackEmailData {
  customerName: string;
  windowLabel: string;
  propertyAddress: string;
  scheduledDate: string;
  dashboardUrl: string;
}

export function buildEnRouteFallbackEmail(data: EnRouteFallbackEmailData): { subject: string; html: string; text: string } {
  const subject = `Your technician is on the way — ${data.scheduledDate}`;
  const html = layout(
    `<h1 style="margin:0 0 8px;font-family:${FONT};font-size:26px;color:${BRAND_GREEN};">Your technician is on the way!</h1>
    <p style="margin:0 0 28px;color:${TEXT_MUTED};font-size:15px;">Hi ${data.customerName}, your mosquito treatment technician is headed to your property now.</p>

    <div style="background:${BRAND_LIGHT};border:2px solid ${BRAND_GREEN};border-radius:10px;padding:24px;text-align:center;margin-bottom:28px;">
      <p style="margin:0;font-size:12px;text-transform:uppercase;letter-spacing:0.1em;color:${BRAND_GREEN};font-weight:bold;">Arrival Window</p>
      <p style="margin:8px 0 0;font-family:${FONT};font-size:28px;font-weight:bold;color:${TEXT_DARK};">${data.windowLabel}</p>
      <p style="margin:6px 0 0;font-size:14px;color:${TEXT_MUTED};">${data.scheduledDate}</p>
    </div>

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
      ${infoRow("Address", data.propertyAddress)}
    </table>

    <p style="font-size:14px;color:${TEXT_DARK};margin-bottom:24px;">Please make sure yard access is available. If you have pets, please bring them inside before the technician arrives.</p>

    ${ctaButton("View Appointment", data.dashboardUrl)}`,
    `Your technician is on the way — ${data.windowLabel}`
  );
  const text = [
    `Hi ${data.customerName},`,
    ``,
    `Your mosquito treatment technician is on the way to ${data.propertyAddress}.`,
    `Arrival window: ${data.windowLabel} on ${data.scheduledDate}`,
    ``,
    `Please ensure yard access is available and bring pets inside.`,
    ``,
    `View appointment: ${data.dashboardUrl}`,
  ].join("\n");
  return { subject, html, text };
}

// ─── Template: employee_assignment (internal) ─────────────────────────────────

export interface EmployeeAssignmentEmailData {
  employeeName: string;
  changeType: "created" | "updated" | "cancelled";
  appointmentDate: string;       // "Monday, June 2, 2026"
  windowLabel: string;           // "Morning (8AM–12PM)"
  propertyAddress: string;
  notes?: string | null;
  dashboardUrl: string;
  appointmentCount?: number;     // when multiple appointments assigned at once
}

export function buildEmployeeAssignmentEmail(data: EmployeeAssignmentEmailData): { subject: string; html: string; text: string } {
  const appUrl  = process.env.APP_BASE_URL || "https://nomoremosquitoes.us";

  const actionLabel = data.changeType === "created"
    ? "New Assignment"
    : data.changeType === "cancelled"
    ? "Assignment Cancelled"
    : "Assignment Updated";

  const intro = data.changeType === "created"
    ? `You have been assigned a new service appointment. Please review the details below and log in to your employee portal to confirm.`
    : data.changeType === "cancelled"
    ? `Your scheduled assignment has been cancelled. No action required on your end.`
    : `Your assignment has been updated. Please review the new details below.`;

  const headerColor = data.changeType === "cancelled" ? "#b91c1c" : BRAND_GREEN;

  const subject = data.changeType === "created"
    ? `New Assignment — ${data.appointmentDate}`
    : data.changeType === "cancelled"
    ? `Assignment Cancelled — ${data.appointmentDate}`
    : `Assignment Updated — ${data.appointmentDate}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>No More Mosquitoes — Employee Assignment</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:${BODY_FONT};">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f3f4f6;padding:32px 16px;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;width:100%;background:#fff;border-radius:12px;overflow:hidden;border:1px solid ${BORDER};">
        <tr>
          <td style="background-color:${headerColor};padding:24px 36px;">
            <p style="margin:0;font-size:16px;font-weight:bold;color:#fff;">No More Mosquitoes — Employee Notice</p>
            <p style="margin:4px 0 0;font-size:12px;color:rgba(255,255,255,0.75);">${actionLabel} · Internal</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 36px;color:${TEXT_DARK};font-size:14px;line-height:1.6;">
            <p style="margin:0 0 20px;">Hi ${data.employeeName},</p>
            <p style="margin:0 0 24px;color:${TEXT_MUTED};">${intro}</p>
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
              ${infoRow("Date", data.appointmentDate)}
              ${infoRow("Window", data.windowLabel)}
              ${infoRow("Address", data.propertyAddress)}
              ${data.notes ? infoRow("Notes", data.notes) : ""}
            </table>
            ${data.changeType !== "cancelled" ? `
            <table cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
              <tr>
                <td style="background-color:${BRAND_GREEN};border-radius:8px;">
                  <a href="${data.dashboardUrl}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:bold;color:#fff;text-decoration:none;">View My Schedule</a>
                </td>
              </tr>
            </table>` : ""}
            <p style="margin:24px 0 0;font-size:12px;color:${TEXT_MUTED};">This is an internal message from No More Mosquitoes operations. Do not forward.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = [
    `Hi ${data.employeeName},`,
    ``,
    intro,
    ``,
    `Date: ${data.appointmentDate}`,
    `Window: ${data.windowLabel}`,
    `Address: ${data.propertyAddress}`,
    data.notes ? `Notes: ${data.notes}` : null,
    ``,
    `View schedule: ${data.dashboardUrl}`,
  ].filter(Boolean).join("\n");

  return { subject, html, text };
}

// ─── Template: welcome_email ─────────────────────────────────────────────────

export interface WelcomeEmailData {
  customerName: string;
  dashboardUrl: string;
  supportEmail?: string;
}

export function buildWelcomeEmail(data: WelcomeEmailData): { subject: string; html: string; text: string } {
  const supportEmail = data.supportEmail || getSupportEmail();
  const subject      = "Welcome to No More Mosquitoes!";
  const html = layout(
    `<h1 style="margin:0 0 8px;font-family:${FONT};font-size:26px;color:${BRAND_GREEN};">Welcome to No More Mosquitoes!</h1>
    <p style="margin:0 0 28px;color:${TEXT_MUTED};font-size:15px;">Hi ${data.customerName}, your account is ready. We're thrilled to help you enjoy a mosquito-free yard.</p>

    <div style="background:${BRAND_LIGHT};border:1px solid #bbf7d0;border-radius:8px;padding:16px 20px;margin-bottom:28px;">
      <p style="margin:0;font-size:14px;color:${BRAND_GREEN};font-weight:600;">Get started in 2 minutes</p>
      <ul style="margin:8px 0 0;padding-left:18px;font-size:14px;color:${TEXT_DARK};line-height:1.7;">
        <li>Choose a service plan that fits your yard size.</li>
        <li>Schedule your first treatment appointment.</li>
        <li>Our team will confirm availability and arrive during your chosen window.</li>
      </ul>
    </div>

    ${ctaButton("Set Up My Service", data.dashboardUrl)}

    <p style="font-size:13px;color:${TEXT_MUTED};margin-top:8px;">Questions? Reply to this email or contact us at <a href="mailto:${supportEmail}" style="color:${BRAND_GREEN};">${supportEmail}</a></p>`,
    "Your No More Mosquitoes account is ready — get started today"
  );
  const text = [
    `Hi ${data.customerName},`,
    ``,
    `Welcome to No More Mosquitoes! Your account is ready.`,
    ``,
    `Get started: ${data.dashboardUrl}`,
    ``,
    `Questions? Contact us at ${supportEmail}`,
  ].join("\n");
  return { subject, html, text };
}
