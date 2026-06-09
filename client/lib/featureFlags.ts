/**
 * Client-side feature flags.
 *
 * Only reads VITE_-prefixed environment variables (public, bundled at build time).
 * Never reads server-side secrets or private operational flags.
 *
 * Server-side behavior (reminder sending, Regrid, workforce gate) is controlled
 * exclusively by server/lib/featureFlags.ts — the client should never try to
 * replicate those checks.
 */

function clientBool(envKey: string, defaultValue: boolean): boolean {
  const val = (import.meta.env as Record<string, string | undefined>)[envKey];
  if (val === undefined || val === "") return defaultValue;
  return val === "true" || val === "1";
}

export const clientFlags = {
  /** Show the admin debug panel link in the admin nav. Default: false */
  adminDebugPanel: () => clientBool("VITE_ENABLE_ADMIN_DEBUG_PANEL", false),

  /** Show dev-only UI elements (quick login, test credentials, etc.) */
  devTools: () => import.meta.env.DEV === true,
};
