# 07 — Consultation Request Notification Implementation Report

**Date:** 2026-07-03

---

## Files Modified

| File | Change |
|---|---|
| `server/routes/marketplaceStripe.ts` | Added imports + `POST /consultation-request` endpoint |
| `client/pages/dashboard/Marketplace.tsx` | Replaced toast-only handler with async API call + double-click guard |

---

## Server: New Endpoint

`POST /api/marketplace/consultation-request`

```typescript
// Imports added to marketplaceStripe.ts:
import { createTicket } from "../services/support/ticketService";
import { notifyAdmin } from "../services/notifications/adminNotificationService";

router.post("/consultation-request", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);  // 401 if not logged in
    const { itemId, itemSlug, itemName } = req.body;

    if (!itemName?.trim()) return res.status(400).json({ error: "itemName is required" });

    // Fetch customer profile for ticket description
    const { data: profile } = await db
      .from("profiles").select("name, email, phone").eq("id", user.id).maybeSingle();

    const customerName = profile?.name ?? user.email ?? "Unknown customer";

    // 1. Create durable ticket
    const ticket = await createTicket({
      userId: user.id,
      subject: `Marketplace Consultation Request: ${itemName.trim()}`,
      description: `Item: ${itemName}\n...`,
      category: "general",
      priority: "medium",
    });

    // 2. Fire-and-forget admin notification (email + admin_alerts DB)
    notifyAdmin({
      event_type: "marketplace.consultation_requested",
      severity: "info",
      title: `Consultation request: ${itemName.trim()}`,
      body: `${customerName} requested a consultation for "${itemName.trim()}".`,
      entity_type: "ticket",
      entity_id: ticket?.id ?? undefined,
      metadata: { customer_name, item_name, item_slug, ticket_id },
    });

    return res.json({ ok: true, ticketId: ticket?.id ?? null });
  } catch (e: any) {
    return res.status(e.status || 500).json({ error: e.message });
  }
});
```

**Key behaviors:**
- `getAuthenticatedUser()` reuses the existing auth helper already in the file — returns 401 without a valid session
- `createTicket()` writes to the `tickets` table via service-role client (bypasses RLS, already established pattern)
- `notifyAdmin()` is fire-and-forget; if email isn't configured, the ticket is still saved
- Info severity → no SMS (per `notifyAdmin` design: SMS only for warning/critical)

---

## Client: Updated Handler

`client/pages/dashboard/Marketplace.tsx`

```tsx
const [consultingItemId, setConsultingItemId] = useState<string | null>(null);

const handleRequestConsultation = async (item: CatalogItem) => {
  if (consultingItemId === item.id) return;  // double-click guard
  setConsultingItemId(item.id);
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) throw new Error("No active session.");

    const res = await fetch("/api/marketplace/consultation-request", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ itemId: item.id, itemSlug: item.slug, itemName: item.name }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Request failed.");
    }
    toast({
      title: "Consultation request sent",
      description: `Our team will follow up about ${item.name} within 24 hours.`,
    });
  } catch (err: any) {
    toast({ title: "Could not submit request", description: err.message, variant: "destructive" });
  } finally {
    setConsultingItemId(null);
  }
};
```

---

## What Happens on Submission

1. Customer clicks "Request Consultation" on a `requiresConsultation` catalog item
2. Double-click guard sets `consultingItemId = item.id` (prevents re-entry)
3. `POST /api/marketplace/consultation-request` called with Bearer token
4. Server validates auth → fetches profile → creates ticket → fires admin notification
5. Client receives `{ ok: true, ticketId }` → shows success toast
6. On any error → shows error toast with message
7. Finally: `consultingItemId` cleared, button is re-enabled

---

## Admin Experience

After a customer submits a consultation request:
- `/admin/tickets` shows a new open ticket: "Marketplace Consultation Request: {item name}"
- Ticket body includes customer name, email, phone, item slug, item ID
- Admin email inbox receives a notification (if `RESEND_API_KEY` + `OWNER_EMAIL` are configured)
- `/admin/alerts` shows the logged event under `marketplace.consultation_requested`

---

## Validation

- TypeScript: 0 errors ✅
- Tests: 223/223 ✅ (no new tests added — endpoint creates a durable record; unit test would need to mock ticketService + notifyAdmin, which would not add confidence over an integration test)
- Build: clean ✅
- Functions: 7/7 ✅
