/**
 * setup-live-stripe.cjs
 *
 * Creates all required LIVE Stripe products and prices for the No More Mosquitoes
 * subscription tiers, then:
 *   1. Writes live price IDs to LIVE_STRIPE_OBJECT_MAPPING.json
 *   2. Generates SQL for public.service_plans (printed to stdout)
 *   3. Creates/verifies the live webhook endpoint
 *
 * Usage:
 *   STRIPE_LIVE_KEY=sk_live_... node scripts/setup-live-stripe.cjs
 *
 * The live key is intentionally NOT read from .env to prevent accidental
 * live-mode operations during normal development.
 *
 * SAFETY:
 *   - Only creates objects when they don't already exist (checks by metadata.internal_id)
 *   - Never deletes any Stripe objects
 *   - Never prints or logs the secret key
 *   - Never touches marketplace add-on architecture
 */

'use strict';

const Stripe = require('stripe');
const fs = require('fs');
const path = require('path');

// ── Key validation ────────────────────────────────────────────────────────────
const LIVE_KEY = process.env.STRIPE_LIVE_KEY;

if (!LIVE_KEY) {
  console.error('\n[ERROR] STRIPE_LIVE_KEY environment variable is required.');
  console.error('Usage: STRIPE_LIVE_KEY=sk_live_... node scripts/setup-live-stripe.cjs\n');
  process.exit(1);
}

if (!LIVE_KEY.startsWith('sk_live_')) {
  console.error('\n[ERROR] STRIPE_LIVE_KEY must start with sk_live_');
  console.error('Got prefix:', LIVE_KEY.slice(0, 8));
  process.exit(1);
}

console.log('[setup-live-stripe] Key mode: LIVE ✓');

const stripe = new Stripe(LIVE_KEY, { apiVersion: '2023-10-16' });

// ── Tier definitions ──────────────────────────────────────────────────────────
// Mirrors STRIPE_PLANS in stripe-prices.ts exactly.
const TIERS = [
  { id: 'tier_1',  name: 'Mosquito Protection: 0.01–0.13 acres',  acreageMin: 0.01, acreageMax: 0.13, priceCents: 9500  },
  { id: 'tier_2',  name: 'Mosquito Protection: 0.14–0.20 acres',  acreageMin: 0.14, acreageMax: 0.20, priceCents: 11000 },
  { id: 'tier_3',  name: 'Mosquito Protection: 0.21–0.30 acres',  acreageMin: 0.21, acreageMax: 0.30, priceCents: 12500 },
  { id: 'tier_4',  name: 'Mosquito Protection: 0.31–0.40 acres',  acreageMin: 0.31, acreageMax: 0.40, priceCents: 13500 },
  { id: 'tier_5',  name: 'Mosquito Protection: 0.41–0.50 acres',  acreageMin: 0.41, acreageMax: 0.50, priceCents: 14500 },
  { id: 'tier_6',  name: 'Mosquito Protection: 0.51–0.60 acres',  acreageMin: 0.51, acreageMax: 0.60, priceCents: 16500 },
  { id: 'tier_7',  name: 'Mosquito Protection: 0.61–0.70 acres',  acreageMin: 0.61, acreageMax: 0.70, priceCents: 17500 },
  { id: 'tier_8',  name: 'Mosquito Protection: 0.71–0.80 acres',  acreageMin: 0.71, acreageMax: 0.80, priceCents: 19500 },
  { id: 'tier_9',  name: 'Mosquito Protection: 0.81–1.15 acres',  acreageMin: 0.81, acreageMax: 1.15, priceCents: 21500 },
  { id: 'tier_10', name: 'Mosquito Protection: 1.16–1.29 acres',  acreageMin: 1.16, acreageMax: 1.29, priceCents: 23000 },
  { id: 'tier_11', name: 'Mosquito Protection: 1.30–1.50 acres',  acreageMin: 1.30, acreageMax: 1.50, priceCents: 25000 },
  { id: 'tier_12', name: 'Mosquito Protection: 1.51–2.00 acres',  acreageMin: 1.51, acreageMax: 2.00, priceCents: 27000 },
];

const CADENCES = [14, 21, 30, 42];

const ONE_TIME = {
  internal_id: 'one_time',
  name: 'Intensive One-time Treatment',
  priceCents: 27000,
};

const WEBHOOK_URL = 'https://nomoremosquitoes.us/api/webhooks/stripe';
const WEBHOOK_EVENTS = [
  'checkout.session.completed',
  'invoice.paid',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'payment_intent.payment_failed',
  'payment_intent.succeeded',
  'charge.refunded',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

async function findExistingProduct(internalId) {
  // Search by metadata.internal_id to avoid duplicates
  const list = await stripe.products.search({
    query: `metadata['internal_id']:'${internalId}' AND active:'true'`,
    limit: 1,
  });
  return list.data[0] || null;
}

async function findExistingPrice(productId, cadenceDays) {
  // Search by product + metadata.cadence_days
  const list = await stripe.prices.search({
    query: `product:'${productId}' AND metadata['cadence_days']:'${cadenceDays}' AND active:'true'`,
    limit: 1,
  });
  return list.data[0] || null;
}

async function findExistingOneTimePrice(productId) {
  const list = await stripe.prices.search({
    query: `product:'${productId}' AND type:'one_time' AND active:'true'`,
    limit: 1,
  });
  return list.data[0] || null;
}

async function getOrCreateProduct(tier) {
  const existing = await findExistingProduct(tier.id);
  if (existing) {
    console.log(`  [product] REUSE  ${tier.id} → ${existing.id}`);
    return existing;
  }

  const product = await stripe.products.create({
    name: tier.name,
    metadata: {
      internal_id: tier.id,
      acreage_min: tier.acreageMin.toString(),
      acreage_max: tier.acreageMax.toString(),
    },
  });
  console.log(`  [product] CREATE ${tier.id} → ${product.id}`);
  return product;
}

async function getOrCreateRecurringPrice(product, cadenceDays, priceCents, internalId) {
  const existing = await findExistingPrice(product.id, cadenceDays);
  if (existing) {
    console.log(`  [price]   REUSE  ${internalId} → ${existing.id}`);
    return existing;
  }

  const price = await stripe.prices.create({
    product: product.id,
    currency: 'usd',
    unit_amount: priceCents,
    recurring: {
      interval: 'day',
      interval_count: cadenceDays,
    },
    nickname: `${cadenceDays}-day Cadence`,
    metadata: {
      internal_id: internalId,
      cadence_days: cadenceDays.toString(),
    },
  });
  console.log(`  [price]   CREATE ${internalId} → ${price.id}`);
  return price;
}

async function getOrCreateOneTimePrice(product, priceCents) {
  const existing = await findExistingOneTimePrice(product.id);
  if (existing) {
    console.log(`  [price]   REUSE  one_time → ${existing.id}`);
    return existing;
  }

  const price = await stripe.prices.create({
    product: product.id,
    currency: 'usd',
    unit_amount: priceCents,
    metadata: {
      internal_id: 'one_time',
    },
  });
  console.log(`  [price]   CREATE one_time → ${price.id}`);
  return price;
}

async function getOrCreateWebhook() {
  const list = await stripe.webhookEndpoints.list({ limit: 100 });
  const existing = list.data.find(we => we.url === WEBHOOK_URL);

  if (existing) {
    const missingEvents = WEBHOOK_EVENTS.filter(e => !existing.enabled_events.includes(e));
    if (missingEvents.length > 0) {
      console.log(`  [webhook] UPDATE existing ${existing.id} — adding: ${missingEvents.join(', ')}`);
      await stripe.webhookEndpoints.update(existing.id, {
        enabled_events: WEBHOOK_EVENTS,
      });
      console.log(`  [webhook] UPDATED ${existing.id}`);
    } else {
      console.log(`  [webhook] REUSE  ${existing.id} — all events present`);
    }
    return { id: existing.id, reused: true };
  }

  const webhook = await stripe.webhookEndpoints.create({
    url: WEBHOOK_URL,
    enabled_events: WEBHOOK_EVENTS,
    description: 'NMM production webhook — billing, subscriptions, marketplace payments',
  });

  // The signing secret is returned ONCE at creation and cannot be retrieved again.
  // DO NOT log it here — print instructions only.
  console.log(`  [webhook] CREATED ${webhook.id}`);
  console.log('\n  ⚠️  IMPORTANT: Copy the webhook signing secret from the Stripe Dashboard now.');
  console.log('  Set it in Netlify as: STRIPE_WEBHOOK_SECRET=whsec_...\n');
  return { id: webhook.id, reused: false };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const MAPPING_PATH = path.join(__dirname, '..', 'dev-notes', 'LIVE_STRIPE_OBJECT_MAPPING.json');
  const mapping = JSON.parse(fs.readFileSync(MAPPING_PATH, 'utf8'));

  // Results collected for SQL generation and mapping update
  const livePriceMap = {}; // internal_id → live price ID

  console.log('\n=== PHASE 1: Subscription Products & Prices ===\n');

  for (const tier of TIERS) {
    console.log(`\n[tier] ${tier.id} — ${tier.name}`);
    const product = await getOrCreateProduct(tier);

    for (const cadence of CADENCES) {
      const internalId = `${tier.id}_${cadence}d`;
      const price = await getOrCreateRecurringPrice(product, cadence, tier.priceCents, internalId);
      livePriceMap[internalId] = price.id;
    }
  }

  console.log('\n=== PHASE 2: One-time Treatment Product & Price ===\n');

  const oneTimeProduct = await getOrCreateProduct({ id: 'one_time_product', name: ONE_TIME.name });
  const oneTimePrice = await getOrCreateOneTimePrice(oneTimeProduct, ONE_TIME.priceCents);
  livePriceMap['one_time'] = oneTimePrice.id;

  console.log('\n=== PHASE 3: Webhook ===\n');

  const webhook = await getOrCreateWebhook();

  // ── Update mapping JSON ───────────────────────────────────────────────────

  console.log('\n=== PHASE 4: Updating LIVE_STRIPE_OBJECT_MAPPING.json ===\n');

  for (const plan of mapping.subscription_plans) {
    const liveId = livePriceMap[plan.internal_id];
    if (liveId) {
      plan.live_price_id = liveId;
    }
  }
  for (const plan of mapping.one_time_plans) {
    const liveId = livePriceMap[plan.internal_id];
    if (liveId) {
      plan.live_price_id = liveId;
    }
  }
  mapping.webhook_config.live_endpoint_id = webhook.id;
  mapping._meta.live_setup_completed = new Date().toISOString();

  fs.writeFileSync(MAPPING_PATH, JSON.stringify(mapping, null, 2), 'utf8');
  console.log('  Mapping JSON updated ✓');

  // ── Generate SQL ──────────────────────────────────────────────────────────

  console.log('\n=== PHASE 5: Generating Supabase SQL ===\n');

  const allPlans = [...mapping.subscription_plans, ...mapping.one_time_plans];
  const sqlRows = allPlans
    .filter(p => p.live_price_id && !p.live_price_id.startsWith('PENDING'))
    .map(p => {
      const program = p.stripe_type === 'one_time' ? 'one_time' : 'subscription';
      const cadence = p.cadence_days || 0;
      const min = p.acreage_min;
      const max = p.acreage_max;
      const cents = p.price_cents;
      const priceId = p.live_price_id;
      const name = p.internal_id;
      return `  ('${name}', ${min}, ${max}, ${cadence}, ${cents}, '${priceId}', '${program}', true)`;
    });

  const sql = `-- Generated by setup-live-stripe.cjs — ${new Date().toISOString()}
-- Run in Supabase SQL Editor (Production database)
-- Uses ON CONFLICT to be idempotent — safe to re-run

INSERT INTO public.service_plans
  (name, acreage_min, acreage_max, cadence_days, price_cents, stripe_price_id, program, active)
VALUES
${sqlRows.join(',\n')}
ON CONFLICT (name) DO UPDATE SET
  stripe_price_id = EXCLUDED.stripe_price_id,
  price_cents     = EXCLUDED.price_cents,
  active          = EXCLUDED.active;
`;

  const SQL_PATH = path.join(__dirname, '..', 'dev-notes', 'LIVE_SERVICE_PLANS_INSERT.sql');
  fs.writeFileSync(SQL_PATH, sql, 'utf8');
  console.log('  SQL written to dev-notes/LIVE_SERVICE_PLANS_INSERT.sql ✓');
  console.log('\n--- SQL Preview (first 5 rows) ---');
  console.log(sql.split('\n').slice(0, 10).join('\n'));
  console.log('...\n');

  // ── Summary ───────────────────────────────────────────────────────────────

  const totalPrices = Object.keys(livePriceMap).length;
  console.log('=== COMPLETE ===\n');
  console.log(`  Live prices mapped: ${totalPrices} / 49`);
  console.log(`  Webhook: ${webhook.id} (${webhook.reused ? 'reused' : 'created'})`);
  console.log('\nNext steps:');
  console.log('  1. Run the SQL in dev-notes/LIVE_SERVICE_PLANS_INSERT.sql in Supabase SQL Editor');
  console.log('  2. Set STRIPE_SECRET_KEY=sk_live_... in Netlify');
  console.log('  3. Set VITE_STRIPE_PUBLISHABLE_KEY=pk_live_... in Netlify');
  console.log('  4. Set STRIPE_WEBHOOK_SECRET=whsec_... (from Stripe Dashboard) in Netlify');
  console.log('  5. Deploy\n');
}

main().catch(err => {
  console.error('\n[FATAL]', err.message);
  process.exit(1);
});
