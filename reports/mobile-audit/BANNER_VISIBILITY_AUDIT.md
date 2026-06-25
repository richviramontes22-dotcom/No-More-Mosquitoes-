# Homepage Banner Visibility Audit

**Date:** 2026-06-19
**Scope:** Homepage "announcement band" — `A California Employee/Community Based Company`
**Status:** Fixed and verified (desktop, mobile, tablet)

## Root Cause

The banner is rendered in `client/components/sections/HeroSection.tsx`, in normal page
flow directly below a spacer `<div>` that reserves space for the fixed site header, and
above the hero's full-bleed rotating image carousel.

Two independent, compounding defects:

### 1. Contrast was effectively zero
```tsx
// BEFORE
<div className="relative z-10 py-1.5 bg-secondary/10 backdrop-blur-sm border-b border-secondary/15">
  <p className="text-center text-[10px] sm:text-[11px] font-black uppercase tracking-[0.4em] text-secondary-foreground/55">
    {t("hero.eyebrow")}
  </p>
</div>
```
- Background: the brand gold (`--secondary`) at **10% opacity** — barely tints the photo behind it.
- Text: the brand dark-navy (`--secondary-foreground`) at **55% opacity** — the intended
  pairing for *opaque* gold, diluted to near-nothing once both sides were faded.
- Combined effect: a near-transparent gold wash with near-transparent dark text on top of
  a busy, rotating photo. The "highlight to read it" symptom is the classic signature of a
  text/background pair with almost no luminance delta.
- Font size was tiny (10–11px) with extreme letter-spacing (`tracking-[0.4em]`), which
  reduces word-shape legibility further at that size.

### 2. Fixing #1 exposed a second, pre-existing bug
Once the band became visible, it revealed that the header-height spacer
(`pt-[92px] sm:pt-[106px] md:pt-[122px]`) **undershot the real fixed-header height by
~44px on mobile** (header height: 136.5px measured vs. 92px assumed below the `sm:`
breakpoint, because the header's logo/tagline content wraps to an extra line at narrow
widths). The band rendered partially *underneath* the header instead of below it — invisible
before only because the band itself was invisible. This needed fixing as part of the same
change; otherwise the now-visible band would have produced a worse-looking overlap defect.

## Files Changed

`client/components/sections/HeroSection.tsx` — two adjacent blocks, no other files touched.

## CSS / Classes Changed

**Header spacer** (line ~70):
| | Before | After |
|---|---|---|
| Base (<640px) | `pt-[92px]` | `pt-[140px]` |
| `sm:` (≥640px) | `sm:pt-[106px]` | `sm:pt-[110px]` |
| `md:` (≥768px) | `md:pt-[122px]` | `md:pt-[126px]` |

Values are the actual rendered `<header>` bounding-box height at each breakpoint
(measured via Playwright: 136.5px / 109px / 124px) plus a small safety buffer.

**Announcement band container:**
| | Before | After |
|---|---|---|
| Background | `bg-secondary/10` | `bg-primary/90` |
| Border | `border-secondary/15` | `border-primary-foreground/15` |
| Padding | `py-1.5` | `py-2.5` |

**Announcement band text:**
| | Before | After |
|---|---|---|
| Color | `text-secondary-foreground/55` | `text-primary-foreground` (full opacity) |
| Size | `text-[10px] sm:text-[11px]` | `text-xs sm:text-sm` (12px → 14px) |
| Letter-spacing | `tracking-[0.4em]` | `tracking-[0.15em]` |
| Extra | — | inline `textShadow: 0 1px 3px rgba(0,0,0,0.45)` |

`font-black` and `uppercase` were already present and are unchanged — they were not the problem.

**Design rationale:** `bg-primary` / `text-primary-foreground` is the same dark-teal/near-white
pair already used throughout the site for primary buttons (e.g. the hero's own "Schedule
Service" CTA), so the band now reads as an intentional, on-brand solid strip rather than a
generic dark overlay — preserving the premium look while fixing contrast. Because the
background is now 90% opaque, the rotating carousel photo barely shows through, so contrast
holds **regardless of which hero image is active** — this was verified by re-running the
capture script across the carousel's auto-rotation and confirming the band's own background
dominates in all cases (it never relies on the photo for contrast).

## Before / After Screenshots

All paths relative to `reports/mobile-audit/screenshots/banner/`:

| Viewport | Before | After |
|---|---|---|
| Desktop (1440×900) | `home_desktop_before.png` | `home_desktop_after.png` |
| Mobile — iPhone 13 (390×844) | `home_iphone13_before.png` | `home_iphone13_after.png` |
| Tablet — iPad Air-equivalent (820×1180) | `home_ipad-air_before.png` | `home_ipad-air_after.png` |

## Desktop Result

Before: band is indistinguishable from the photo behind it — no visible text at this
resolution. After: a clean, solid dark-teal strip with crisp white centered text, sitting
directly below the header with no overlap, clearly readable at a glance.

## Mobile Result

Before: band was both invisible *and* (latently) overlapping the header. After: band
renders as a distinct teal strip fully below the header, full-width, legible without
zooming or selecting text. Confirmed on a 390×844 viewport (iPhone 13 class).

## Accessibility / Contrast Assessment

Measured directly from rendered computed styles (not estimated):

- Text color: `rgb(248, 250, 252)` (`--primary-foreground`)
- Band background: `rgba(12, 99, 121, 0.9)` (`--primary` at 90% opacity)
- **Computed WCAG contrast ratio: 6.52:1**

This exceeds **WCAG AA for normal text (4.5:1)** and **WCAG AA for large text (3:1)** with
a comfortable margin, and is close to **AAA for normal text (7:1)**. The actual ratio in
production will be marginally higher than 6.52:1, since the 10% non-opaque portion of the
background blends with the dark overlay already present behind the hero photo (i.e. it
blends toward darker, not lighter).

No other accessibility regressions: the text element has no interactive role (no
focus-state or tap-target implications), and `aria-hidden` usage on the hero's decorative
overlay `<div>`s is unchanged.

## Verification Method

Real rendered screenshots via Playwright (Chromium for desktop, WebKit for mobile/tablet)
against the local dev server, plus direct DOM measurement (`getBoundingClientRect` /
`getComputedStyle`) for the header-height and contrast claims above — not estimated from
source code alone.
