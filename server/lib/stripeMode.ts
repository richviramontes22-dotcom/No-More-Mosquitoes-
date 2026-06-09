export type StripeMode = 'live' | 'test' | 'unknown';

/**
 * Warns if a Stripe test key is used in a production NODE_ENV context.
 * Previously threw a fatal error — changed to a non-fatal warning because
 * Netlify always sets NODE_ENV=production, which caused the serverless function
 * to crash for staging/testing environments that legitimately use test keys.
 *
 * The admin debug page and health endpoint already surface the mode mismatch
 * as a visible warning without blocking the function from starting.
 */
export function assertStripeKeyNotTestInProduction(): void {
  const key =
    process.env.STRIPE_SECRET_KEY ||
    process.env.STRIPE_API_KEY ||
    process.env.STRIPE_SECRET ||
    "";
  if (process.env.NODE_ENV === "production" && key.startsWith("sk_test_")) {
    console.error(
      "[Stripe] WARNING: STRIPE_SECRET_KEY is a TEST key but NODE_ENV=production. " +
      "Real subscription/payment flows will fail if Stripe price IDs are live mode. " +
      "Set STRIPE_SECRET_KEY to a live key (sk_live_...) before accepting real payments."
    );
    // No throw — allows staging/testing deployments on Netlify to function normally.
  }
}

export function getStripeMode(): StripeMode {
  const key =
    process.env.STRIPE_SECRET_KEY ||
    process.env.STRIPE_API_KEY ||
    process.env.STRIPE_SECRET;
  if (!key) return 'unknown';
  if (key.startsWith('sk_live_')) return 'live';
  if (key.startsWith('sk_test_')) return 'test';
  return 'unknown';
}

export function isTestMode(): boolean {
  return getStripeMode() === 'test';
}

export function isLiveMode(): boolean {
  return getStripeMode() === 'live';
}

/**
 * Logs a clear server-side error when test keys attempt to use live prices or vice versa.
 * Call this if you detect a mismatch at the price-resolution layer.
 */
export function logModeMismatch(reason: string): void {
  console.error(`[Stripe] MODE MISMATCH — ${reason}`);
  console.error('[Stripe] Check STRIPE_SECRET_KEY in your environment:');
  console.error('  localhost: sk_test_... (use test prices)');
  console.error('  production: sk_live_... (use live prices)');
}

/**
 * Returns a human-readable diagnostics object safe to expose to admins.
 * Never includes key values — only mode and presence.
 */
export function getStripeDiagnostics() {
  const key =
    process.env.STRIPE_SECRET_KEY ||
    process.env.STRIPE_API_KEY ||
    process.env.STRIPE_SECRET;
  const mode = getStripeMode();
  const nodeEnv = process.env.NODE_ENV || 'unset';
  const isProd = nodeEnv === 'production';
  const mismatch = isProd && mode === 'test';

  return {
    stripe_mode: mode,
    node_env: nodeEnv,
    app_base_url: process.env.APP_BASE_URL || 'unset',
    secret_key_configured: !!key,
    webhook_secret_configured: !!process.env.STRIPE_WEBHOOK_SECRET,
    publishable_key_configured: !!process.env.VITE_STRIPE_PUBLISHABLE_KEY,
    mode_mismatch: mismatch,
    mismatch_detail: mismatch
      ? 'NODE_ENV=production but STRIPE_SECRET_KEY is a test key — subscription flows will fail with live price IDs'
      : null,
  };
}
