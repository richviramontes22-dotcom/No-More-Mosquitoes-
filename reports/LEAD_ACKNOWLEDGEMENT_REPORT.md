# Lead Acknowledgement Report

**Date:** 2026-05-30

## Implementation
**File:** `server/routes/schedule.ts`
**Trigger:** Immediately after a successful `schedule_requests` INSERT

## What Was Implemented
1. After saving the schedule request to the DB, a fire-and-forget async block sends a lead acknowledgement email.
2. Sends to `payload.email` (the submitted form email — no auth required).
3. Uses `buildLeadAcknowledgementEmail()` with customer name, service type, zip, and support email.
4. Logs to `notification_log` with `type='lead_acknowledgement'` and `payload: { schedule_request_id }`.
5. Non-fatal: email failure is caught and logged to console, never propagates to the HTTP response.

## Template Content
- "We got your request!" heading
- Service type and zip displayed in info table
- "What to expect" section with 1 business day SLA
- CTA button to create account at APP_BASE_URL/signup
- Support email contact

## Notes
- This fires for ALL schedule requests, including guest (unauthenticated) submissions
- The email fires even if the DB insert failed (error is logged but doesn't stop the acknowledgement)
- No duplicate prevention — each form submission should generate exactly one acknowledgement
- Lead acknowledgement uses `getEmailProvider()` — no direct Resend import
