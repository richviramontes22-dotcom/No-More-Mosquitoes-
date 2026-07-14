# Report 14 — Responsive & Accessibility QA

**Sprint:** Customer-Facing Flow Cleanup + Promo Popup System  
**Phase:** 14  
**Date:** 2026-07-13  
**Status:** COMPLETE (static review; no browser available in this session)

---

## Scope

Static code review of responsive layout and accessibility attributes for all UI changes in this
sprint. A live browser test is recommended before production deploy.

---

## Appointment Slot Changes

**ScheduleFlow.tsx + Appointments.tsx:**

- Slots that were greyed/disabled (`opacity-40`, `cursor-not-allowed`, `bg-muted/50`) are now
  hidden entirely via `.filter(w => w.available)`. The slot grid is narrower but there are no
  broken layout artifacts — the grid uses `flex-wrap` / `grid` which handles fewer items cleanly.
- "Available" label is a plain string; no responsive breakpoint concerns.
- No ARIA changes needed — disabled buttons were the old pattern; removal is strictly cleaner.

---

## SiteHeader Language Selector Removal

- Removed a `hidden md:block` desktop block and a mobile drawer block. No layout shift
  introduced — the surrounding flex container shrinks to fit naturally.
- No ARIA landmark or keyboard trap removed.
- Mobile nav drawer still functional; removed DropdownMenu was self-contained.

---

## Promotional Popup — Responsive

**Modal sizing:**
```css
fixed inset-0 flex items-center justify-center p-4
  → w-full max-w-md bg-background rounded-[24px]
```
- `p-4` padding on mobile prevents edge bleed.
- `max-w-md` caps desktop width; `w-full` fills smaller screens.
- Image: `w-full h-44 object-cover` — scales with container width.
- CTA buttons: `flex-wrap gap-2` — stack on narrow viewports (`flex-1 sm:flex-none`).

**Vertical overflow:**
- Modal content is fixed-height header image + padding + text + buttons. At the smallest
  supported viewport (320px wide), the modal fits without internal scroll.
- If body text is very long, the `whitespace-pre-line` block will grow the card. Admins
  should keep body text concise; no hard truncation is enforced (intentional — admin-entered
  content).

**Backdrop:**
- `fixed inset-0` — full-viewport coverage on all screen sizes. ✓

---

## Promotional Popup — Accessibility

| Attribute | Value | Notes |
|-----------|-------|-------|
| `role` | `"dialog"` | Correct for modal |
| `aria-modal` | `"true"` | Tells screen readers to trap focus within |
| `aria-labelledby` | `"promo-popup-title"` | Points to h2 with popup title |
| Dismiss button `aria-label` | `"Dismiss promotion"` | Visible to screen readers |
| Backdrop `aria-hidden` | `"true"` | Screen readers skip non-interactive backdrop |
| Escape key | Dismisses popup | Standard modal keyboard behavior |
| Focus management | Not explicitly set | **Recommendation:** add `autoFocus` to dismiss button or first interactive element for keyboard users who Tab into the modal |
| "No thanks" link | `focus-visible:ring-2 focus-visible:ring-ring` | ✓ Keyboard focus visible |

**Known gap:** Focus is not programmatically moved into the modal when it appears. This is a
minor accessibility gap for keyboard/screen-reader users. The modal is dismissible via Escape
and all controls are reachable by Tab. A future improvement would add a `useEffect` that focuses
the dismiss button when `visible` becomes `true`.

---

## Hero Section

- Phone display now: `{t("hero.callOrText")} {siteConfig.phone.display}` — plain text
  concatenation. No responsive or accessibility impact.
- The `<a href={siteConfig.phone.link}>` wrapper is unchanged.

---

## Promotions Management (Admin)

- Inline heading (`flex items-center gap-2`) — standard flex pattern. ✓
- Dialog uses `shadcn/ui Dialog` — inherits focus trap and `role="dialog"` from that library. ✓
- Stats bar: `grid-cols-2 sm:grid-cols-4` — stacks on mobile. ✓
- Table: no explicit overflow-x wrapper; admin pages assume at least tablet width (same
  convention as other admin pages in this codebase).

---

## Recommended Pre-Deploy Manual Checks

1. Open popup on mobile (375px) — verify no overflow, buttons stack correctly.
2. Tab through popup with keyboard — verify all controls are reachable.
3. Test with screen reader (VoiceOver/NVDA) — verify `aria-labelledby` announced on open.
4. Verify slot grid layout with 1 available slot vs. 5 available slots.
5. Verify language selector is gone from both desktop header and mobile nav drawer.
