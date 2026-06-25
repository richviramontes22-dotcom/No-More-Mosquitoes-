# Technician App — Feature Matrix

**Status: Planning only.** ✅ = fully supported, ⚠️ = partial/limited, ❌ = not supported/not reliable.
"Today" reflects the actual current implementation (see `TECHNICIAN_APP_FEASIBILITY_STUDY.md` §1), not a hypothetical.

| Requirement | Today (Web) | PWA | React Native | Flutter |
|---|---|---|---|---|
| Employee authentication | ✅ (Supabase, shared with web) | ✅ (same) | ✅ (same API) | ✅ (same API) |
| Role verification (DB-canonical) | ✅ | ✅ | ✅ | ✅ |
| Session handling / timeout | ✅ | ✅ | ✅ | ✅ |
| Clock in / clock out | ✅ (no geo captured) | ✅ (no geo captured unless added) | ✅ + geo at clock-in/out | ✅ + geo at clock-in/out |
| Breaks | ⚠️ (events recorded, minutes not aggregated) | ⚠️ (same, until fixed) | ⚠️ (same gap, server-side fix needed regardless) | ⚠️ (same) |
| GPS consent capture/withdrawal | ✅ (versioned, audited) | ✅ (same backend) | ✅ (same backend) | ✅ (same backend) |
| Location ping **while app is foreground** | ✅ (on status-change taps) | ✅ | ✅ | ✅ |
| Location tracking **continuously while clocked in, backgrounded** | ❌ | ❌ on iOS, ⚠️ unreliable on Android | ✅ | ✅ |
| Auto-stop tracking on clock-out | ⚠️ (no tracking loop exists to stop) | ⚠️ (same, until a loop exists) | ✅ (tear down foreground service/background task) | ✅ (same) |
| Clear in-app tracking status indicator | ❌ (not built) | ❌ (not built) | ✅ (OS-level indicator + in-app) | ✅ (same) |
| Today's route, stop order, ETA | ✅ | ✅ | ✅ | ✅ |
| Navigation handoff (Google/Apple Maps) | ✅ | ✅ | ✅ | ✅ |
| Route updates (re-poll) | ⚠️ (2-min poll, not push) | ⚠️ (poll, or push on Android only) | ✅ (push-driven) | ✅ (push-driven) |
| Appointment status actions (en route/arrive/complete/no-show/skip) | ✅ | ✅ | ✅ | ✅ |
| "Blocked / Unable to Service" path | ✅ (maps to no_show/skipped + reason) | ✅ | ✅ | ✅ |
| Reschedule request from technician side | ⚠️ (not technician-initiated today — reschedule requests are customer/admin-side) | ⚠️ (same gap) | ⚠️ (same gap, needs new API) | ⚠️ (same gap) |
| Photos/videos upload | ✅ (direct to Supabase Storage) | ✅ | ✅ + offline queue | ✅ + offline queue |
| Treatment / product notes | ✅ | ✅ | ✅ | ✅ |
| Offline media queue (capture now, upload later) | ❌ | ⚠️ (IndexedDB queue — workable, less robust) | ✅ (native local DB queue) | ✅ (same) |
| Call / text customer | ✅ (`tel:`/`sms:` links) | ✅ | ✅ | ✅ |
| Masked phone number option | ⚠️ (not implemented — would need a calling/SMS proxy service either way, platform-independent) | ⚠️ same | ⚠️ same | ⚠️ same |
| Offline: cached route | ❌ | ✅ (service worker cache) | ✅ (local DB) | ✅ (local DB) |
| Offline: queued status/notes/photo writes | ❌ | ⚠️ (workable, browser-tab-lifetime risk) | ✅ | ✅ |
| Conflict resolution on sync | ❌ (n/a, nothing queues) | ⚠️ (must be built, harder in a tab that can be evicted mid-sync) | ✅ (more control over sync lifecycle) | ✅ |
| Push: new assignment | ❌ (email/SMS only) | ⚠️ Android only | ✅ both platforms | ✅ both platforms |
| Push: route change | ❌ | ⚠️ Android only | ✅ | ✅ |
| Push: schedule change | ❌ | ⚠️ Android only | ✅ | ✅ |
| Push: emergency alert | ❌ | ⚠️ Android only | ✅ | ✅ |
| Lost-device handling (passcode/biometric gate) | ❌ (relies on phone's own OS lock screen only) | ❌ (same) | ✅ (can require biometric/passcode re-entry in-app) | ✅ (same) |
| Device-level permission granularity (camera/location separate from app login) | ✅ (browser permission prompts) | ✅ | ✅ (native OS permission system) | ✅ |
| Admin: live location while clocked in | ❌ (no consumer of ping data built) | ❌ (same — backend gap, not platform gap) | ❌ (same — backend gap, not platform gap) | ❌ (same) |
| Admin: current status / current route | ✅ (via existing admin appointment/route views) | ✅ | ✅ | ✅ |
| Admin: last-ping / stale indicator | ❌ (not built) | ❌ | ❌ | ❌ |
| Admin: consent/audit trail | ✅ (`gps_consent_form_version_id`, `onboarding_audit_log`) | ✅ (same backend) | ✅ (same backend) | ✅ (same backend) |

**Reading this matrix**: the "Admin: live location" rows are ❌ across *every* column —
that's backend work (build the read-side of `employee_location_pings` + an admin map),
not a reason to choose one client platform over another. The rows that actually
*differentiate* the four options are the background-location and push rows, where
Responsive Web and PWA hit real OS-level ceilings that React Native and Flutter don't.
