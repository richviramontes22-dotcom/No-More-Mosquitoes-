# Checkout Appointment Confirmation Fix Report

**Date:** 2026-05-30

## Problem
When a customer completed checkout and a first appointment was created from `session.metadata`, no appointment confirmation email was sent. The existing `sendAppointmentConfirmation` flow was only called from `schedule.ts`, not from `webhooksStripe.ts`.

## Fix
In `webhooksStripe.ts`, after the appointment INSERT succeeds in the `checkout.session.completed` handler:
1. Query back the newly created appointment by `user_id + property_id + scheduled_date`
2. Call `sendConfirmationForAppointment(apptId)` which:
   - Handles duplicate prevention internally (checks for existing `appointment_confirmation` log)
   - Looks up all required data from the DB
   - Sends via `getResendClient()` (existing flow)
   - Logs to `notification_log`

## Fire-and-Forget Pattern
The confirmation is dispatched in an async IIFE — the webhook handler returns `{ received: true }` immediately without waiting.

## Coverage
- Subscription checkout with scheduling metadata: covered
- One-time service checkout: appointment already existed or was created — confirmation sent via `schedule.ts` path
- Marketplace checkout: no appointment involvement, not applicable
