# Technician App — Architecture Comparison

**Status: Planning only. No app was built as part of this study.**

## Option A — Responsive Website (current state)

What it is today: the existing `/employee/*` React SPA, mobile-responsive via Tailwind,
no install step, same deploy pipeline as the rest of the site.

- **Cost**: effectively $0 incremental — it already exists.
- **Limitations**: no background location, no push, no offline, no home-screen icon, no
  app-store presence. Subject to whatever the technician's mobile browser does when the
  tab is backgrounded (typically: JS execution pauses or the page is evicted from memory
  within seconds to minutes).
- **Best use case**: everything that doesn't require background execution — viewing
  today's route, marking job status, uploading photos, reading messages, clocking in/out
  while the phone is actively in hand. This covers a large share of real technician usage.

## Option B — Progressive Web App (PWA)

What it would add on top of Option A: a `manifest.json` (installable, home-screen icon,
splash screen) + a service worker (offline asset caching, a queue for writes made while
offline, and — on Android only — web push via the Push API).

- **Cost**: low-to-moderate. No new language/framework — same React codebase, add a
  manifest + service worker + an offline write-queue (e.g. IndexedDB-backed). Realistic
  estimate: a few weeks of focused work, not a rewrite.
- **Speed**: same as the current web app (it *is* the current web app, with a wrapper).
- **Installability**: yes, via "Add to Home Screen" — works on both iOS and Android, but
  the iOS install flow is manual (Safari share-sheet) and has historically lower discovery/
  adoption than a real App Store listing.
- **Offline capability**: solid for *asset* caching (the app shell loads instantly even
  offline) and *write queuing* (save a status update / note locally, sync when back
  online) — this materially closes the offline gap from Option A.
- **Push notifications**: works on Android (Push API + service worker). **Does not work
  on iOS in any reliable, general way for this kind of app** — iOS Safari's web-push
  support is recent, version-gated, and requires the PWA to already be installed to the
  home screen first; it is not equivalent to native push in reach or reliability.
- **Background GPS limitation**: this is the option's hard ceiling — see the feasibility
  study, Section 3. A PWA cannot reliably track location once it's not the foreground app,
  especially on iOS. If "track continuously while clocked in, even with the phone in a
  pocket" is a real requirement, a PWA does not satisfy it.
- **Best use case**: a strong *intermediate* step — gets offline + installability + (on
  Android) push, without a platform rewrite, while accepting the background-location
  ceiling.

## Option C — React Native

- **Android/iOS support**: single codebase (TypeScript/JSX, like the existing web app),
  compiled to native on both platforms. Reuses a meaningful amount of business-logic
  thinking (and some literal logic, e.g. status-machine rules, ETA formatting) from the
  existing web codebase, though UI components are not directly shared with the web React
  app (different rendering layer — React Native doesn't render DOM/Tailwind).
- **GPS reliability**: real native background location is achievable via
  community-standard libraries (e.g. background-geolocation-style modules) on both
  platforms, with proper foreground-service notifications on Android (required by the OS)
  and `Always`/`When in Use` permission prompts on iOS, satisfying the "clear tracking
  indicator" requirement directly through the OS's own location-in-use UI plus an
  in-app indicator.
- **Background services**: supported on both platforms via native modules; React Native's
  JS thread itself is not what's doing the background work — it delegates to native code,
  which is the correct architecture for this requirement.
- **Camera/media**: mature, well-supported (native camera/gallery modules); offline
  photo/video capture + queued upload is a standard, well-trodden pattern.
- **Push notifications**: full native push on both platforms (APNs via a wrapper, FCM),
  reliable and well-documented.
- **Offline storage**: SQLite or a key-value store (e.g. a native-backed local DB) gives
  robust offline queuing with proper conflict resolution, well beyond what a PWA's
  IndexedDB-based queue can comfortably do.
- **Cost**: moderate — new mobile codebase to build and maintain, but the *team already
  knows TypeScript/React*, which is the dominant cost factor in ramp-up. Ongoing cost is
  two app-store presences (Apple Developer Program $99/yr, Google Play one-time $25) plus
  release/review cycles.
- **Maintenance**: requires periodically updating native dependencies (Xcode/Android SDK
  version bumps), which is real but well-understood, ongoing maintenance — not a one-time cost.

## Option D — Flutter

- **Android/iOS support**: single codebase (Dart), compiled to native on both platforms.
- **Performance**: generally excellent, often cited as smoother than React Native for
  complex animations/custom UI — not a meaningfully important factor for this app (mostly
  forms, lists, maps, and a status-button workflow, not a graphics-heavy app).
- **GPS/background services**: comparable native capability to React Native — Flutter
  plugins exist for background location, foreground services, and push, with similar
  reliability once configured correctly.
- **New stack cost**: this is Flutter's real disadvantage *for this team specifically* —
  Dart is a new language and Flutter's widget model is a new paradigm, unlike React Native
  which extends the team's existing React/TypeScript knowledge. For a team that already
  knows React (confirmed: the entire existing codebase, web and the planned mobile work,
  is React/TypeScript), Flutter means a real ramp-up cost with no reuse of existing
  team knowledge, where React Native has none.
- **Hiring/maintenance implications**: the local/contractor talent pool for React Native
  developers is larger and overlaps with existing web React talent (easier to have one
  engineer flex between the web app and the mobile app); Flutter/Dart talent is a smaller,
  more specialized pool.

## Recommendation

| Horizon | Recommendation | Why |
|---|---|---|
| **Short-term** | Stay on Option A, ship the PWA layer (Option B) | Closes offline + installability + Android push gaps cheaply, no new stack, while the team validates exactly how much technicians need background tracking in practice |
| **Medium-term** | Build a **React Native** app if continuous background location, reliable push, or robust offline media capture become firm requirements | React Native gives full native capability while reusing the team's existing React/TypeScript skill set — Flutter offers no architectural advantage here large enough to justify a brand-new language/stack for this team |
| **Long-term** | Maintain the React Native app as the technician's primary tool; keep the responsive web app as a fallback/admin-side view | Native app for the people who need background GPS + offline + push (technicians); web stays right for customer service, sales, and admin, where none of those device capabilities matter |

**Flutter is not recommended** for this specific team and codebase — not because it's a
worse technology in the abstract, but because it offers no capability React Native lacks
for this use case, while costing strictly more in ramp-up and hiring flexibility given the
team's existing React investment.
