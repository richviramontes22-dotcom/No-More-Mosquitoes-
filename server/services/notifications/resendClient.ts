import { Resend } from "resend";

let _client: Resend | null = null;

export function getResendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!_client) _client = new Resend(process.env.RESEND_API_KEY);
  return _client;
}

export function getFromEmail(): string {
  return process.env.RESEND_FROM_EMAIL || "No More Mosquitoes <hello@nomoremosquitoes.us>";
}

export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}
