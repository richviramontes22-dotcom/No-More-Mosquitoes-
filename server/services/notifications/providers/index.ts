/**
 * Provider Abstraction Layer
 * Decouples notification sending from specific vendor SDKs.
 * Use getEmailProvider() / getSmsProvider() everywhere — never import vendor clients directly in routes.
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
    console.log(`[NullSmsProvider] Would send SMS to ${opts.to} — body: "${opts.body.slice(0, 60)}..." (Twilio not configured)`);
  }
}

// ─── Resend Email Provider ────────────────────────────────────────────────────

class ResendEmailProvider implements EmailProvider {
  async send(opts: EmailSendOptions): Promise<void> {
    const client = getResendClient();
    if (!client) {
      throw new Error("ResendEmailProvider: RESEND_API_KEY not set");
    }
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

// ─── Twilio SMS Provider (fetch-based — no Twilio npm package) ────────────────

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

    const body = new URLSearchParams({
      To: opts.to,
      From: opts.from,
      Body: opts.body,
    });

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

/**
 * Returns a ResendEmailProvider when RESEND_API_KEY is set,
 * otherwise returns a NullEmailProvider that logs intent.
 */
export function getEmailProvider(): EmailProvider {
  if (process.env.RESEND_API_KEY) {
    return new ResendEmailProvider();
  }
  return new NullEmailProvider();
}

/**
 * Returns a TwilioSmsProvider when all Twilio credentials are set,
 * otherwise returns a NullSmsProvider that logs intent.
 */
export function getSmsProvider(): SmsProvider {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (sid && token && from) {
    return new TwilioSmsProvider(sid, token);
  }
  return new NullSmsProvider();
}

/**
 * Convenience: the configured from-address for emails.
 */
export { getFromEmail };
