import { getTwilioClient, getTwilioFromNumber, isSmsConfigured } from "./twilioClient";
import { buildEnRouteSms, EnRouteSmsData } from "./smsTemplates";
import { logNotification, isDuplicateNotification } from "./notificationLogger";

export interface SendEnRouteSmsParams {
  appointmentId: string;
  profileId?: string | null;
  recipientPhone: string;
  smsData: EnRouteSmsData;
}

/**
 * Sends an en-route SMS via Twilio.
 * Non-throwing — designed for fire-and-forget after dispatch.
 * Logs result to notification_log regardless of success/failure.
 */
export async function sendEnRouteSMS(params: SendEnRouteSmsParams): Promise<void> {
  const { appointmentId, profileId, recipientPhone, smsData } = params;

  if (!isSmsConfigured()) {
    console.log(`[EnRouteSMS] Twilio not configured — skipping SMS for appointment ${appointmentId}`);
    await logNotification({
      appointmentId,
      profileId: profileId ?? null,
      recipientPhone,
      channel: "sms",
      notificationType: "technician_enroute",
      status: "skipped",
      provider: "twilio",
      errorMessage: "Twilio not configured",
    });
    return;
  }

  // Duplicate prevention — allow resend if previous SMS failed
  const isDuplicate = await isDuplicateNotification(appointmentId, "technician_enroute");
  if (isDuplicate) {
    console.log(`[EnRouteSMS] Skipping duplicate en-route SMS for appointment ${appointmentId}`);
    return;
  }

  const body = buildEnRouteSms(smsData);
  const from = getTwilioFromNumber()!;
  const client = getTwilioClient()!;

  try {
    const message = await client.messages.create({
      body,
      from,
      to: recipientPhone,
    });

    await logNotification({
      appointmentId,
      profileId: profileId ?? null,
      recipientPhone,
      channel: "sms",
      notificationType: "technician_enroute",
      status: "sent",
      provider: "twilio",
      providerMessageId: message.sid,
    });

    console.log(`[EnRouteSMS] Sent to ${recipientPhone} — SID: ${message.sid}`);
  } catch (err: any) {
    console.error(`[EnRouteSMS] Failed for appointment ${appointmentId}:`, err.message);
    await logNotification({
      appointmentId,
      profileId: profileId ?? null,
      recipientPhone,
      channel: "sms",
      notificationType: "technician_enroute",
      status: "failed",
      provider: "twilio",
      errorMessage: err.message,
    });
  }
}
