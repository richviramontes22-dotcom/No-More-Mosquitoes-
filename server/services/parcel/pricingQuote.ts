import type { PricingQuote, PricingCadenceOption } from "./types";
// Relative import (not the "@shared" alias): this module is reachable from
// vite.config.ts's dynamic `import("./server")`, and Vite's config-bundler
// externalizes bare/aliased specifiers, which Node then can't resolve.
import {
  CADENCE_DAYS_OPTIONS,
  CADENCE_LABELS,
  lookupAnnualCents,
  lookupCadenceCents,
  lookupOneTimeCents,
} from "../../../shared/pricing";

// Tier tables live in shared/pricing.ts — the single source of truth for
// subscription, annual, and one-time pricing across client and server.

export function buildPricingQuote(acreage: number): PricingQuote {
  const cadenceOptions: PricingCadenceOption[] = CADENCE_DAYS_OPTIONS.flatMap((days) => {
    const cents = lookupCadenceCents(acreage, days);
    if (cents == null) return [];
    return [{ cadenceDays: days, label: CADENCE_LABELS[days], cents }];
  });

  const annualCents = lookupAnnualCents(acreage);
  const oneTimeCents = lookupOneTimeCents(acreage);

  return {
    programs: {
      subscription: {
        cadenceOptions,
        defaultCadenceDays: 21,
      },
      one_time: {
        cents: oneTimeCents,
      },
      annual: {
        cents: annualCents,
      },
    },
  };
}
