/**
 * Provider Abstraction Layer
 * Decouples notification sending from specific vendor SDKs.
 * Use getEmailProvider() / getSmsProvider() / getSmsFromNumber() everywhere
 * — never import vendor clients or read TWILIO_* / SMS_* env vars in routes.
 *
 * SMS provider selection (checked in order):
 *   SMS_PROVIDER=telnyx → TelnyxSmsProvider (recommended, no Twilio dependency)
 *   SMS_PROVIDER=twilio  → TwilioSmsProvider (legacy, kept for backward compat)
 *   TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_FROM_NUMBER set → TwilioSmsProvider
 *   otherwise           → NullSmsProvider (logs intent, never sends)
 */

import { getResendClient, getFromEmail } from "../resendClient";

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface EmailSendOptions {
  to: string;
  from: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SmsSendOptions {
  to: string;
  from: string;
  body: string;
}

export interface EmailProvider {
  send(opts: EmailSendOptions): Promise<void>;
}

export interface SmsProvider {
  send(opts: SmsSendOptions): Promise<void>;
}

// ─── Null Providers (no-op, log intent) ───────────────────────────────────────

class NullEmailProvider implements EmailProvider {
  async send(opts: EmailSendOptions): Promise<void> {
    console.log(`[NullEmailProvider] Would send email to ${opts.to} — subject: "${opts.subject}" (RESEND_API_KEY not set)`);
  }
}

class NullSmsProvider implements SmsProvider {
  async send(opts: SmsSendOptions): Promise<void> {
    console.log(`[NullSmsProvider] Would send SMS to ${opts.to}: "${opts.body.slice(0, 60)}…" (SMS provider not configured — set SMS_PROVIDER + credentials)`);
  }
}

// ─── Resend Email Provider ────────────────────────────────────────────────────

class ResendEmailProvider implements EmailProvider {
  async send(opts: EmailSendOptions): Promise<void> {
    const client = getResendClient();
    if (!client) throw new Error("ResendEmailProvider: RESEND_API_KEY not set");
    const payload: Record<string, unknown> = {
      from: opts.from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    };
    if (opts.text) payload.text = opts.text;
    await client.emails.send(payload as any);
  }
}

// ─── Telnyx SMS Provider (recommended non-Twilio option) ─────────────────────
// REST API, fetch-based — no npm package needed.
// Required env vars:
//   SMS_PROVIDER=telnyx
//   SMS_API_KEY=<Telnyx API key>
//   SMS_FROM_NUMBER=<E.164 number or messaging profile ID>
//   SMS_MESSAGING_PROFILE_ID=<optional, for A2P campaigns>

class TelnyxSmsProvider implements SmsProvider {
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async send(opts: SmsSendOptions): Promise<void> {
    const payload: Record<string, unknown> = {
      from: opts.from,
      to: opts.to,
      text: opts.body,
    };
    const profileId = process.env.SMS_MESSAGING_PROFILE_ID;
    if (profileId) payload.messaging_profile_id = profileId;

    const response = await fetch("https://api.telnyx.com/v2/messages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`TelnyxSmsProvider: HTTP ${response.status} — ${errorText.slice(0, 200)}`);
    }
  }
}

// ─── Twilio SMS Provider (legacy, kept for backward compatibility) ─────────────
// Fetch-based — does not require the twilio npm package at runtime.
// Activated when SMS_PROVIDER=twilio OR when TWILIO_* env vars are all set.

class TwilioSmsProvider implements SmsProvider {
  private readonly accountSid: string;
  private readonly authToken: string;

  constructor(accountSid: string, authToken: string) {
    this.accountSid = accountSid;
    this.authToken = authToken;
  }

  async send(opts: SmsSendOptions): Promise<void> {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
    const credentials = Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64");

    const body = new URLSearchParams({ To: opts.to, From: opts.from, Body: opts.body });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`TwilioSmsProvider: HTTP ${response.status} — ${errorText.slice(0, 200)}`);
    }
  }
}

// ─── Factory Functions ────────────────────────────────────────────────────────

export function getEmailProvider(): EmailProvider {
  if (process.env.RESEND_API_KEY) return new ResendEmailProvider();
  return new NullEmailProvider();
}

/**
 * Returns the configured SMS provider, or NullSmsProvider if none is configured.
 * Check SMS_PROVIDER first, then fall back to detecting TWILIO_* vars for
 * backward compatibility.
 */
export function getSmsProvider(): SmsProvider {
  const provider = (process.env.SMS_PROVIDER || "").toLowerCase();

  if (provider === "telnyx") {
    const apiKey = process.env.SMS_API_KEY;
    if (apiKey) return new TelnyxSmsProvider(apiKey);
    console.warn("[getSmsProvider] SMS_PROVIDER=telnyx but SMS_API_KEY not set — using NullSmsProvider");
    return new NullSmsProvider();
  }

  // Explicit twilio selection OR legacy: TWILIO vars all set
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;
  if (provider === "twilio" || (twilioSid && twilioToken && process.env.TWILIO_FROM_NUMBER)) {
    if (twilioSid && twilioToken) return new TwilioSmsProvider(twilioSid, twilioToken);
  }

  return new NullSmsProvider();
}

/**
 * Returns the configured from-number for SMS sends.
 * Prefers SMS_FROM_NUMBER (provider-neutral), falls back to TWILIO_FROM_NUMBER
 * for backward compatibility.
 */
export function getSmsFromNumber(): string {
  return process.env.SMS_FROM_NUMBER || process.env.TWILIO_FROM_NUMBER || "";
}

/** Convenience: the configured from-address for emails. */
export { getFromEmail };
