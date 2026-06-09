/**
 * Lightweight checkpoint system.
 *
 * Checkpoints trace progress through multi-step flows (payment, parcel,
 * routing, reminders) so that when something fails you know exactly
 * which step was reached.
 *
 * Currently logs to stdout (JSON structured). Persistence to DB is deferred
 * until ENABLE_VERBOSE_CHECKPOINTS=true is validated in production.
 */

import { logger } from "./logger";

const verboseEnabled = () => process.env.ENABLE_VERBOSE_CHECKPOINTS === "true";

/**
 * Record a checkpoint in a multi-step flow.
 *
 * @param requestId  The request-scoped trace ID
 * @param name       Dot-notation checkpoint name: "billing.payment.verified"
 * @param meta       Any non-sensitive contextual data (userId, counts, etc.)
 */
export function checkpoint(
  requestId: string,
  name: string,
  meta?: Record<string, unknown>
): void {
  if (!verboseEnabled()) {
    // Always log at debug level (suppressed in prod unless flag is on)
    logger.debug(`checkpoint:${name}`, { requestId, ...meta });
    return;
  }
  // Verbose mode: log at info so every step shows in the log stream
  logger.info(`checkpoint:${name}`, { requestId, checkpoint: name, ...meta });
}

// ─── Named checkpoint constants (prevent typos) ───────────────────────────────

export const CP = {
  // Billing / booking flow
  BILLING_START:                    "billing.start",
  BILLING_CUSTOMER_CREATED:         "billing.customer.created",
  BILLING_PAYMENT_INTENT_CREATED:   "billing.payment_intent.created",
  BILLING_PAYMENT_VERIFIED:         "billing.payment.verified",
  BILLING_APPOINTMENT_CREATED:      "billing.appointment.created",
  BILLING_SUBSCRIPTION_CREATED:     "billing.subscription.created",
  BILLING_PROFILE_ONBOARDED:        "billing.profile.onboarded",
  BILLING_COMPLETE:                 "billing.complete",

  // Parcel lookup
  PARCEL_START:                     "parcel.lookup.start",
  PARCEL_CACHE_CHECKED:             "parcel.cache.checked",
  PARCEL_CACHE_HIT:                 "parcel.cache.hit",
  PARCEL_CACHE_MISS:                "parcel.cache.miss",
  PARCEL_COUNTY_DISABLED:           "parcel.county_lookup.disabled",
  PARCEL_COUNTY_DETECTED:           "parcel.county.detected",
  PARCEL_COUNTY_LOOKUP_START:       "parcel.county.lookup.start",
  PARCEL_COUNTY_LOOKUP_SUCCESS:     "parcel.county.lookup.success",
  PARCEL_COUNTY_LOOKUP_FAILED:      "parcel.county.lookup.failed",
  PARCEL_GEOMETRY_CALCULATED:       "parcel.geometry.calculated",
  PARCEL_SCAG_FALLBACK_USED:        "parcel.scag.fallback.used",
  PARCEL_REGRID_FALLBACK_USED:      "parcel.regrid.fallback.used",
  PARCEL_FALLBACK_USED:             "parcel.fallback.used",
  PARCEL_MANUAL_REVIEW:             "parcel.manual_review",

  // Workforce routing
  ROUTE_DAY_GENERATE_START:         "route.day.generate.start",
  ROUTE_BLACKOUT_CHECKED:           "route.blackout.checked",
  ROUTE_TECHS_FILTERED:             "route.technicians.filtered",
  ROUTE_CAPACITY_APPLIED:           "route.capacity.applied",
  ROUTE_CREATED:                    "route.created",
  ROUTE_GENERATE_FAILED:            "route.generate.failed",
  ROUTE_PUBLISH_VALIDATION_START:   "route.publish.validation.start",
  ROUTE_PUBLISH_BLOCKED:            "route.publish.blocked",
  ROUTE_PUBLISH_SUCCESS:            "route.publish.success",

  // Reminder automation
  REMINDER_BATCH_START:             "reminder.batch.start",
  REMINDER_APPOINTMENTS_FOUND:      "reminder.appointments.found",
  REMINDER_DUPLICATE_SKIPPED:       "reminder.duplicate.skipped",
  REMINDER_SENT:                    "reminder.sent",
  REMINDER_FAILED:                  "reminder.failed",
  REMINDER_BATCH_COMPLETE:          "reminder.batch.complete",

  // Onboarding
  ONBOARDING_START:                 "onboarding.start",
  ONBOARDING_FORM_ASSIGNED:         "onboarding.form.assigned",
  ONBOARDING_SIGNED:                "onboarding.signed",
  ONBOARDING_COMPLETE:              "onboarding.complete",
} as const;
