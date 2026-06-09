/**
 * Server-side feature flags.
 *
 * All flags read from environment variables with safe production defaults.
 * Flags are functions (not constants) so they re-read env at call time —
 * no server restart needed when env changes are hot-reloaded in dev.
 *
 * Safe defaults: when in doubt, the default keeps existing behavior working.
 * Never expose private flags (Stripe secrets, service keys) through these helpers.
 */

function boolFlag(envKey: string, defaultValue: boolean): boolean {
  const val = process.env[envKey];
  if (val === undefined || val === "") return defaultValue;
  return val === "true" || val === "1";
}

export const flags = {
  /** Enable the Stripe inline payment / booking flow. Default: true */
  inlinePayment: () => boolFlag("ENABLE_INLINE_PAYMENT", true),

  /** Enable actual sending of reminder emails via Resend. Default: true */
  reminderEmails: () => boolFlag("ENABLE_REMINDER_EMAILS", true),

  /**
   * Reminder dry-run mode — log intent but do not actually send.
   * Default: false (production mode). Set to "true" in staging/dev.
   */
  reminderDryRun: () => boolFlag("REMINDER_DRY_RUN", false),

  /** Enable county-level GIS parcel lookup. Default: true */
  parcelCountyLookup: () => boolFlag("ENABLE_PARCEL_COUNTY_LOOKUP", true),

  /**
   * Enable Regrid API fallback when county GIS fails.
   * Default: false — Regrid costs money per call.
   */
  regridFallback: () => boolFlag("ENABLE_REGRID_FALLBACK", false),

  /** Enable workforce validation gate before route publish. Default: true */
  workforceValidation: () => boolFlag("ENABLE_WORKFORCE_VALIDATION", true),

  /** Enable route publish gate (workforce validation blocks publish). Default: true */
  routePublishGate: () => boolFlag("ENABLE_ROUTE_PUBLISH_GATE", true),

  /** Enable admin debug panel at /admin/debug. Default: false (hidden in prod) */
  adminDebugPanel: () => boolFlag("ENABLE_ADMIN_DEBUG_PANEL", false),

  /**
   * Enable verbose checkpoint logging (info-level, every step).
   * Default: false — checkpoints log at debug level only.
   */
  verboseCheckpoints: () => boolFlag("ENABLE_VERBOSE_CHECKPOINTS", false),
};

/** Returns all flags as a safe snapshot — for the admin debug page. */
export function getAllFlags(): Record<string, boolean> {
  return {
    ENABLE_INLINE_PAYMENT:       flags.inlinePayment(),
    ENABLE_REMINDER_EMAILS:      flags.reminderEmails(),
    REMINDER_DRY_RUN:            flags.reminderDryRun(),
    ENABLE_PARCEL_COUNTY_LOOKUP: flags.parcelCountyLookup(),
    ENABLE_REGRID_FALLBACK:      flags.regridFallback(),
    ENABLE_WORKFORCE_VALIDATION: flags.workforceValidation(),
    ENABLE_ROUTE_PUBLISH_GATE:   flags.routePublishGate(),
    ENABLE_ADMIN_DEBUG_PANEL:    flags.adminDebugPanel(),
    ENABLE_VERBOSE_CHECKPOINTS:  flags.verboseCheckpoints(),
  };
}
