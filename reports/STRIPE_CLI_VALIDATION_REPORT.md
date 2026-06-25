# Stripe CLI Validation Report
**Date:** 2026-06-03
**Stripe CLI status:** INSTALLED AND CONFIGURED

---

## CLI Account Verification

```
stripe whoami
```

**Output:**
```
Profile:              default
Account:              No More Mosquitoes (acct_1T8zGo1GVLFt2OB8)
Device name:          DESKTOP-8N5E89V
Test mode key:        available (expires 2026-09-01)
Live mode key:        available (expires 2026-09-01)
API version:          2026-04-22.dahlia
```

✅ Connected to correct account: **No More Mosquitoes**
✅ Both test and live mode keys available

---

## Webhook Listener

```
stripe listen --forward-to localhost:8080/api/webhooks/stripe
```

**Output:**
```
Ready! You are using Stripe API Version [2026-02-25.clover].
Your webhook signing secret is whsec_2fa6635f1fd7848d... (^C to quit)
```

The CLI signing secret (`whsec_2fa6635f...`) was added to `.env` as `STRIPE_WEBHOOK_SECRET` for local testing.

---

## Event Trigger Results

### Pre-fix (STRIPE_WEBHOOK_SECRET missing):
All events returned **HTTP 500** — "Server configuration missing"

### Post-fix (STRIPE_WEBHOOK_SECRET set):
All events return **HTTP 200** — complete success.

| Event Triggered | CLI Status | HTTP Response | Evidence |
|----------------|-----------|--------------|---------|
| `payment_intent.succeeded` | ✅ Triggered | **200** | evt_3TeA7P1GVLFt2OB805qBjHJx |
| `charge.succeeded` | ✅ Triggered | **200** | evt_3TeA7P1GVLFt2OB804Ji3092 |
| `checkout.session.completed` | ✅ Triggered | **200** | evt_1TeAAc1GVLFt2OB8zr1mLJVd |
| `invoice.paid` | ✅ Triggered | **200** | Multiple events all 200 |
| `customer.subscription.updated` | ✅ Triggered | **200** | Multiple events all 200 |
| `payment_intent.created` | ✅ Triggered | **200** | evt_3TeA7P1GVLFt2OB80fs6n4tV |
| `charge.updated` | ✅ Triggered | **200** | evt_3TeA7P1GVLFt2OB805rgx51b |

**Total events processed: 15+ | Success rate: 100%**

---

## Signature Verification Confirmed

The Stripe SDK `stripe.webhooks.constructEvent()` was called with the CLI signing secret and successfully verified every event. No signature verification errors.

**Evidence:** All events returned 200. If signature verification failed, the server would return 400 and log "Signature verification failed."

---

## Production Webhook Setup (Owner Action Required)

For the Netlify production deployment, the webhook must be configured in Stripe Dashboard:

1. Go to Stripe Dashboard → Developers → Webhooks → Add endpoint
2. Endpoint URL: `https://nomoremosquitoes.us/api/webhooks/stripe`
3. Select events to listen for:
   - `checkout.session.completed`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `customer.subscription.deleted`
   - `customer.subscription.updated`
   - `payment_intent.succeeded`
   - `charge.refunded`
4. Copy the **Signing Secret** (starts with `whsec_...`)
5. Set `STRIPE_WEBHOOK_SECRET=whsec_...` in Netlify Dashboard → Environment Variables
6. Redeploy

**Verify production webhook:**
```bash
stripe trigger checkout.session.completed --api-key sk_live_...
```
Or use Stripe Dashboard → Webhooks → "Send test webhook"

---

## Local Testing Commands for Future Use

```bash
# Start listener (terminal 1)
stripe listen --forward-to localhost:8080/api/webhooks/stripe

# Trigger events (terminal 2)
stripe trigger payment_intent.succeeded
stripe trigger checkout.session.completed
stripe trigger invoice.paid
stripe trigger invoice.payment_failed
stripe trigger customer.subscription.deleted
stripe trigger customer.subscription.updated
```
