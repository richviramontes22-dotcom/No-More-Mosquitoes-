# Environment Configuration Report

**Date:** 2026-05-30

## New Variables Added to .env.example

### Twilio SMS
```
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_NUMBER=+1...
```
All three must be set for SMS to be enabled. When any is missing, `getSmsProvider()` returns `NullSmsProvider` (logs intent, sends nothing).

### Company Info
```
COMPANY_ADDRESS=123 Main St, City, State ZIP
SUPPORT_EMAIL=support@nomoremosquitoes.us
SUPPORT_PHONE=(555) 555-5555
```
- `COMPANY_ADDRESS`: Shown in every email footer (CAN-SPAM compliance)
- `SUPPORT_EMAIL`: Shown in email footers and payment failure / subscription cancellation emails
- `SUPPORT_PHONE`: Shown in SMS HELP responses and en-route SMS messages

## Pre-Existing Variables (Unchanged)
- `RESEND_API_KEY` — Email provider
- `RESEND_FROM_EMAIL` — From address for emails
- `APP_BASE_URL` — Used in email CTAs and dashboard links

## Variable Usage Map
| Variable | Used In |
|----------|---------|
| TWILIO_ACCOUNT_SID | providers/index.ts (TwilioSmsProvider), twilioClient.ts |
| TWILIO_AUTH_TOKEN | providers/index.ts, twilioClient.ts |
| TWILIO_FROM_NUMBER | providers/index.ts, twilioClient.ts |
| COMPANY_ADDRESS | emailTemplates.ts `getCompanyAddress()` → footer |
| SUPPORT_EMAIL | emailTemplates.ts `getSupportEmail()` → footer; webhooks.sms.ts |
| SUPPORT_PHONE | smsTemplates.ts, webhooks.sms.ts |
