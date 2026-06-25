# Controlled Beta Launch Plan
**Date:** 2026-06-03
**Project:** No More Mosquitoes

---

## Launch Scope

**Phase 1 (Soft Beta):** 1–5 controlled customers
- Owner/admin knows each customer personally
- All orders monitored in real-time
- No public marketing or social media
- Feedback collected and issues fixed before Phase 2

**Phase 2 (Expanded Beta):** 5–20 customers
- Word-of-mouth referrals only
- Admin monitors daily
- All payment/appointment flows verified

**Phase 3 (Public Launch):** Full marketing
- After 5–10 fully successful end-to-end transactions
- All Phase 2 issues resolved
- Reminder automation confirmed working

---

## First Customer Test Procedure

1. Select a trusted friend/family member or team member as the first customer
2. Have them go through the full quote → signup → payment → appointment flow
3. Admin watches the Stripe Dashboard in real-time
4. Admin watches the Supabase appointments table in real-time
5. Confirm appointment created correctly
6. Confirm confirmation email received (check Resend dashboard)
7. Technician completes the service
8. Admin marks assignment complete
9. Confirm "service completed" email received by customer
10. Collect feedback

---

## Admin Monitoring Checklist

**After every order (Phase 1):**

| Check | Where | Expected |
|-------|-------|---------|
| Payment processed | Stripe Dashboard → Payments | Succeeded status |
| Webhook received | Stripe Dashboard → Webhooks → Events | HTTP 200 response |
| Subscription created | Supabase → subscriptions table | status = 'active' |
| Appointment created | Admin → `/admin/appointments` | Scheduled status |
| Confirmation email sent | Resend Dashboard → Emails | Delivered status |
| Profile onboarded | Supabase → profiles | is_onboarded = true |

**Daily:**

| Check | Where |
|-------|-------|
| `GET /api/health` | Uptime monitor or browser |
| Stripe failed payments | Stripe Dashboard → Payments → filter by Failed |
| `GET /api/admin/metrics/operations` | Admin panel |

---

## Reminder System Monitoring (7-Day Plan)

**Day 1:** Set `REMINDER_DRY_RUN=false` after confirming Resend is configured
**Day 2:** Trigger `send-reminders` Netlify function manually via Netlify Dashboard
**Day 3:** Verify first real reminder email sent to a test appointment
**Day 4–7:** Monitor reminder logs in Netlify for any failures

---

## Rollback Triggers

Immediately rollback (revert to previous deploy + kill switches) if:

| Trigger | Action |
|---------|--------|
| Stripe payments failing > 3 times | Check STRIPE_SECRET_KEY mode; verify webhook secret |
| Subscription not activating | Check webhook delivery in Stripe Dashboard |
| Reminder emails sending to wrong customers | Set `ENABLE_REMINDER_EMAILS=false` immediately |
| Database errors appearing in logs | Check Supabase Dashboard → Logs |
| Admin panel inaccessible | Check Netlify function logs |

**Kill switch priority order:**
1. `ENABLE_REMINDER_EMAILS=false` — stops emails
2. Netlify redeploy to previous version — rollback code
3. Supabase → pause project — nuclear option (affects all services)

---

## 24-Hour Monitoring Plan (Launch Day)

| Time | Action |
|------|--------|
| T+0 | Deploy to production, verify `/api/health` returns ok |
| T+15min | Complete first test transaction |
| T+30min | Verify payment, appointment, email in all systems |
| T+1hr | Check Netlify function logs for any errors |
| T+4hr | Check Stripe dashboard for any disputes or failures |
| T+8hr | Check admin metrics endpoint |
| T+24hr | Full review: payments, appointments, emails, errors |

---

## 7-Day Monitoring Plan

| Day | Focus |
|-----|-------|
| 1 | Payment flow, appointment creation, onboarding |
| 2 | Reminder automation (first batch if appointments due) |
| 3 | Parcel lookup performance, cache hit rate |
| 4 | Workforce dispatch (if technicians assigned) |
| 5 | Customer dashboard, billing portal |
| 6 | Error review — Netlify logs, Sentry (if configured) |
| 7 | Week 1 retrospective — fix any medium/low issues |

---

## Contacts

| Role | Contact |
|------|---------|
| Platform owner | Elijah Noble |
| Stripe support | dashboard.stripe.com → Help |
| Supabase support | supabase.com/dashboard → Support |
| Resend support | resend.com → Documentation / Support |
| Emergency rollback | Netlify Dashboard → Deploys → previous deploy |
