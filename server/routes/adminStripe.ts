import { Router } from "express";

const router = Router();

const STRIPE_API = "https://api.stripe.com/v1";

function getSecret() {
  const key = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_API_KEY || process.env.STRIPE_SECRET;
  return key || undefined;
}

async function stripeFetch(path: string, init?: RequestInit) {
  const secret = getSecret();
  if (!secret) throw Object.assign(new Error("Stripe not configured"), { status: 501 });
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${secret}` },
    ...init,
  } as RequestInit);
  if (!res.ok) throw Object.assign(new Error(await res.text()), { status: res.status });
  return res.json();
}

router.get("/stripe/status", async (_req, res) => {
  const secret = getSecret();
  if (!secret) return res.json({ enabled: false });
  try {
    const [account, balance] = await Promise.all([
      stripeFetch("/account"),
      stripeFetch("/balance"),
    ]);
    res.json({ enabled: true, account: { id: account.id, email: account.email, business_type: account.business_type }, balance });
  } catch (e: any) {
    res.status(e.status || 500).json({ enabled: false, error: e.message || String(e) });
  }
});

router.get("/stripe/invoices", async (req, res) => {
  try {
    const params = new URLSearchParams();
    const { limit, status } = req.query as Record<string, string>;
    params.set("limit", String(Math.min(Number(limit || 25), 100)));
    if (status) params.set("status", status);
    const data = await stripeFetch(`/invoices?${params.toString()}`);
    const invoices = (data.data || []).map((i: any) => ({
      id: i.id,
      number: i.number,
      status: i.status,
      total: i.total,
      currency: i.currency,
      customer_email: i.customer_email,
      customer_name: i.customer_name,
      created: i.created ? new Date(i.created * 1000).toISOString() : undefined,
      due_date: i.due_date ? new Date(i.due_date * 1000).toISOString() : undefined,
      hosted_invoice_url: i.hosted_invoice_url,
    }));
    res.json({ invoices });
  } catch (e: any) {
    res.status(e.status || 500).json({ error: e.message || String(e) });
  }
});

router.get("/stripe/revenue", async (req, res) => {
  try {
    const days = Math.max(1, Math.min(365, Number((req.query.days as string) || 30)));
    const since = Math.floor((Date.now() - days * 24 * 60 * 60 * 1000) / 1000);
    const params = new URLSearchParams();
    params.set("limit", "100");
    params.set("status", "succeeded");
    params.set("created[gte]", String(since));
    const data = await stripeFetch(`/payment_intents?${params.toString()}`);
    const buckets = new Map<string, number>();
    for (const pi of data.data || []) {
      const d = new Date((pi.created || 0) * 1000);
      const key = d.toISOString().slice(0, 10);
      const amount = typeof pi.amount_received === "number" ? pi.amount_received : pi.amount || 0;
      buckets.set(key, (buckets.get(key) || 0) + amount);
    }
    const series = Array.from(buckets.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, cents]) => ({ date, amount: cents / 100 }));
    res.json({ days, series });
  } catch (e: any) {
    res.status(e.status || 500).json({ error: e.message || String(e) });
  }
});

export default router;
