# Technician App — Cost Analysis

**Status: Planning only — directional estimates for decision-making, not a vendor quote.**
No external pricing research was performed for this study; figures below are standard,
widely-known industry costs (app store fees) plus relative engineering-effort estimates
grounded in what already exists in this codebase (see the feasibility study, §1).

## One-time / setup costs

| Item | PWA | React Native | Flutter |
|---|---|---|---|
| Apple Developer Program | n/a (no App Store listing needed) | $99/year | $99/year |
| Google Play Developer account | n/a | $25 one-time | $25 one-time |
| New manifest + service worker | Low effort (days) | n/a | n/a |
| New mobile codebase | n/a | Moderate effort — new project, but reuses team's React/TS knowledge and can port business logic/validation rules conceptually from the web app | Moderate-to-high effort — new project **and** new language (Dart) for this team |
| Background location module | n/a (not reliably achievable) | Add a native background-location library + platform-specific permission/foreground-service setup (iOS + Android each need separate native configuration) | Same shape of work, different plugin ecosystem |
| Push notification setup | Android only: service worker + push subscription endpoint | Both platforms: APNs + FCM wiring | Both platforms: same wiring, different SDK |
| Offline data layer | Moderate (IndexedDB-based queue + conflict handling) | Moderate (native local DB, more mature offline patterns available) | Moderate (same shape) |
| App store review/approval cycles | n/a | Real but bounded (typically days, can recur per release) | Same |

## Ongoing / recurring costs

| Item | PWA | React Native | Flutter |
|---|---|---|---|
| Hosting | $0 incremental (same deploy as web) | $0 incremental for the API (same backend); app binaries are free to distribute via the stores | Same |
| Apple Developer Program renewal | n/a | $99/year | $99/year |
| Native dependency maintenance | n/a | Periodic SDK/Xcode/Gradle version bumps — ongoing but well-documented work | Same shape, Flutter/Dart-specific tooling |
| Engineering ramp-up | Low — same React/TS skill the team already has | Low — same React/TS skill, new mobile-specific APIs to learn | **Higher** — new language (Dart) and widget paradigm with no overlap with the team's existing React investment |
| Hiring pool / contractor availability | Same as current web hiring (large) | Large — React Native developers are common and often overlap with web React developers | Smaller, more specialized pool; less overlap with this team's existing web hires |
| Push notification service (FCM is free; APNs is free; a delivery-management layer like a hosted push service is optional, not required) | Android: free (FCM) | Free (FCM + APNs directly), or a paid push-delivery service if scale/features warrant it later | Same |

## Effort comparison (relative, not absolute hours)

Because roughly 70% of the underlying business logic already exists and works (auth,
shifts, assignments, routing, media upload, notes — see feasibility study §1), the
*relative* effort across options is mostly about **how much new device-capability work**
each option requires, not about rebuilding domain logic from scratch:

1. **PWA**: smallest increment over today — manifest, service worker, offline queue,
   Android push. No new language, no new app-store process.
2. **React Native**: a genuinely new client app, but built in a language/framework the
   team already knows, consuming the *same* existing REST API with no backend rewrite
   required (only the two backend gaps below are net-new regardless of platform).
3. **Flutter**: similar engineering shape to React Native, but with the added,
   non-reusable cost of learning Dart/Flutter from scratch — the single biggest cost
   differentiator in this whole analysis, and the main reason it's not recommended here.

## Backend work required regardless of which client platform is chosen

These are not platform costs — they're real gaps that exist today and block the
"admin visibility" requirement no matter what the technician carries:

- Build a consumer of `employee_location_pings` (a live/near-live map + "last ping" /
  staleness indicator on the admin Employee Tracking page, which currently shows
  simulated data and explicitly states the real feature isn't built).
- Add geolocation capture to clock-in/clock-out (currently captures none).
- Fix break-minute aggregation from `break_start`/`break_end` events (currently always 0).
- Define a data-retention policy for raw ping data (currently unbounded).

## Bottom line

The dominant cost driver in this analysis is not infrastructure or store fees — both are
small and comparable across native options. It's **engineering ramp-up and hiring
flexibility**, where React Native's reuse of the team's existing React/TypeScript
investment gives it a structural cost advantage over Flutter for this specific team, with
no corresponding capability advantage for Flutter to justify the difference.
