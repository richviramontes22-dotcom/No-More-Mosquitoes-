# 06 — Consultation Request Flow Design Report

**Date:** 2026-07-03

---

## Current State (Before This Sprint)

`handleRequestConsultation` in `client/pages/dashboard/Marketplace.tsx` was a single-line toast:

```ts
const handleRequestConsultation = (item: CatalogItem) => {
  toast({ title: "Consultation request", description: `We'll reach out about ${item.name} within 24 hours.` });
};
```

No server call. No DB record. No admin notification. Toast-only.

---

## Options Considered

### Option A — Support Ticket (selected)
- Create a support ticket with category "general", subject "Marketplace Consultation Request: {itemName}"
- Uses existing `createTicket()` in `server/services/support/ticketService.ts`
- Admin can track and respond from existing `/admin/tickets` page
- Low complexity, no schema changes, durable DB record

### Option B — Marketplace Order with consultation_requested status
- Would require a new order status value or separate table
- Marketplace orders are for Stripe-paid items — consultation requests aren't payments
- More schema risk, less aligned with existing flow

### Option C — Admin alert email only
- Fastest, but no durable DB record
- If admin misses the email, request is lost
- Not recommended as sole mechanism

### Decision: Option A + admin notification (belt + suspenders)

1. `createTicket()` → durable DB record in `tickets` table, immediately visible in `/admin/tickets`
2. `notifyAdmin()` → email alert to owner/admin (fire-and-forget; if email env missing, ticket still saves)
3. Updated customer toast with clearer copy

---

## Requirements Met

| Requirement | Approach |
|---|---|
| Customer must be authenticated | `getAuthenticatedUser()` on server — returns 401 if not |
| Request must be recorded durably | `createTicket()` — writes to `tickets` table |
| Admin/owner notified | `notifyAdmin()` — email via Resend |
| Email failure doesn't lose request | `createTicket()` called first, `notifyAdmin()` is fire-and-forget |
| Duplicate double-click prevention | `consultingItemId` state prevents re-fire while in flight |
| Customer receives confirmation | Toast: "Consultation request sent. Our team will follow up…" |
| Request includes catalog item name | `subject: 'Marketplace Consultation Request: ${itemName}'` |
| Request includes customer identity | `userId`, profile name/email/phone in ticket description |
| No live SMS | `notifyAdmin` sends info-severity — info events skip SMS by design |
| Notification logged | `admin_alerts` table via `insertAdminAlert()` inside `notifyAdmin` |

---

## Endpoint Design

```
POST /api/marketplace/consultation-request
Authorization: Bearer <customer-access-token>
Body: { itemId, itemSlug, itemName }
Response: { ok: true, ticketId }
```

- Returns 401 if not authenticated
- Returns 400 if `itemName` missing
- Returns 200 `{ ok: true, ticketId }` on success
- Never fails silently — if ticket creation fails, 500 is returned to client

---

## Admin Visibility

Consultation requests appear in:
1. `/admin/tickets` — as open tickets with subject "Marketplace Consultation Request: …"
2. `/admin/alerts` + `/admin/notifications` — via the `admin_alerts` table entry from `notifyAdmin()`
3. Admin email inbox — via Resend notification
