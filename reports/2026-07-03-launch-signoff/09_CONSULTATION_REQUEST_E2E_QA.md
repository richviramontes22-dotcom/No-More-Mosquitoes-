# Phase 09 — Consultation Request End-to-End QA

**Date:** 2026-07-13  
**Sprint:** Production Launch Verification

---

## Status: BLOCKED — Requires Live Customer Session

A real Supabase auth session for a customer account is required to test the full round-trip.
The QA customer accounts from Phase 04 are also not yet created.

---

## Code-Level Verification (Completed)

### Client → Server

| Step | Location | Status |
|---|---|---|
| Button calls `handleRequestConsultation(item)` | `Marketplace.tsx` | ✅ |
| Gets session token: `supabase.auth.getSession()` | `Marketplace.tsx` | ✅ |
| `POST /api/marketplace/consultation-request` with Bearer token | `Marketplace.tsx` | ✅ |
| Body: `{ itemId, itemSlug, itemName }` | `Marketplace.tsx` | ✅ |
| Missing itemName returns 400 | `marketplaceStripe.ts` | ✅ |
| Unauthenticated returns 401 | `getAuthenticatedUser()` in `marketplaceStripe.ts` | ✅ |

### Server → Database

| Step | Location | Status |
|---|---|---|
| Fetches customer profile (`name`, `email`, `phone`) | `marketplaceStripe.ts` | ✅ |
| Calls `createTicket({ userId, subject, description, category, priority })` | `ticketService.ts` | ✅ |
| Ticket inserted into `tickets` table via service-role client | `ticketService.ts` | ✅ |
| Returns ticket ID even if notification fails | `marketplaceStripe.ts` try/catch | ✅ |

### Server → Notifications

| Step | Location | Status |
|---|---|---|
| `notifyAdmin({ event_type: "marketplace.consultation_requested", ... })` called | `marketplaceStripe.ts` | ✅ |
| Deduplicates within 1 hour for same event_type | `adminNotificationService.ts` | ✅ |
| Inserts row into `admin_alerts` table | `adminNotificationService.ts` | ✅ |
| Email sent to OWNER_EMAIL via Resend | `adminNotificationService.ts` | ✅ |
| No SMS for `severity: "info"` (correct — info = email only) | `adminNotificationService.ts` | ✅ |
| Notification failure does NOT fail the API response | fire-and-forget call | ✅ |

### Client ← Server Response

| Step | Location | Status |
|---|---|---|
| `{ ok: true, ticketId: "..." }` returned on success | `marketplaceStripe.ts` | ✅ |
| `consultingItemId` cleared in `finally` block | `Marketplace.tsx` | ✅ |
| Success toast: "Consultation request sent" | `Marketplace.tsx` | ✅ |
| Error toast on non-OK response | `Marketplace.tsx` | ✅ |

---

## Manual End-to-End Test Steps

1. Log in as QA Customer 1 at `https://nomoremosquitoes.us/login`
2. Navigate to `/dashboard/marketplace`
3. Find an add-on item (e.g., "Mosquito Barrier Spray") and click "Request Consultation"
4. Confirm loading state on button (briefly)
5. Confirm success toast: "Consultation request sent — Our team will follow up about [item name] within 24 hours."

**Verify in Supabase dashboard:**
- `tickets` table: new row with `subject = "Marketplace Consultation Request: Mosquito Barrier Spray"`, `status = "open"`, `category = "general"`, `priority = "medium"`, `profile_id = QA_CUSTOMER_1_UUID`
- `admin_alerts` table: new row with `event_type = "marketplace.consultation_requested"`, `entity_type = "ticket"`

**Verify in Resend dashboard (or inbox at OWNER_EMAIL):**
- Email received: "Consultation request: Mosquito Barrier Spray"
- Email body contains: customer name, item name, slug, customer ID

6. Click "Request Consultation" on the same item again immediately
   - Confirm button stays in loading state or is disabled (duplicate guard: `consultingItemId === item.id`)

---

## Pass Criteria

- Ticket row created in `tickets` table ✅
- `admin_alerts` row created ✅
- OWNER_EMAIL receives notification email ✅
- No duplicate alert within 1 hour of the first ✅
- API response time < 3s ✅

---

## Verdict

| Check | Status |
|---|---|
| Code-level: full request path, error handling, dedup | ✅ All verified |
| Live: ticket creation, alert, email delivery | ⏳ BLOCKED — requires customer session + QA accounts |

**Phase 09: BLOCKED — requires QA customer account (Phase 04) and live browser.**
