# Notifications rework — clarity across desktop & mobile

**Status**: planned. A first mobile-safety pass shipped (see "Shipped now");
the fuller redesign below is future work.

## Why

Notifications today are a single toast host (`Notifications.tsx` +
`Notifications.module.css`, driven by `notifications-store`): a bottom-centre
stack of auto-expiring cards (3 s info, 6 s action). Two problems:

1. **Mobile** — the stack floats at the very bottom, directly over the new
   floating `BottomTabBar` (toast `z-index: 11000` ≫ bar `380`), so an
   offer like "take a tour" **blocked navigation** and had **no dismiss
   control** (it only auto-expired). On a phone a toast is a modal-ish
   interruption and must never trap the user.
2. **Desktop** — the same small bottom-centre bubble is easy to miss: no
   persistence, no history, and success/info toasts vanish in 3 s. Important
   confirmations ("credits added", "session shared", "separation failed")
   get the same weight as trivia and can be missed entirely.

The app is going native-feel; notifications should feel intentional and be
impossible to miss when they matter, on either form factor.

## Shipped now (mobile safety pass)

- Every toast has an explicit **dismiss (×)** — the `.closeBtn` styling
  already existed; the component just never rendered it.
- On `≤768px` the stack sits **above** the tab bar
  (`bottom: calc(var(--tabbar-total) + 20px)`), so it never covers
  navigation. Both hosts that mount the toast (main app, karaoke-night) carry
  the token and bottom chrome.

That unblocks the reported bug. The rest is the forward plan.

## Principles

- **Severity drives treatment.** Trivia (info) stays a quiet auto-expiring
  toast. Consequential outcomes (success/warning/error) get more weight: no
  auto-expire for errors, an icon, and a place they can be re-read.
- **One system, two renders.** A single store + severity model; desktop and
  mobile differ only in placement/animation, like the stages differ from the
  desktop panels. Never fork the data model.
- **Never trap the user.** Always dismissible; never covers primary
  navigation (tab bar, transport) on any viewport.
- **Reduced-motion & a11y first.** `role="status"` for info, `role="alert"`
  for warning/error; honour `prefers-reduced-motion` (the slide-in is
  currently unconditional).

## Proposed system

### Store (`notifications-store`)
- Add `severity` (reuse `type`) + optional `durationMs` (null = sticky) +
  optional `icon`. Errors default sticky; info/success default timed.
- Keep the `channel` de-dupe (already good — one "take a tour" at a time).
- Add a small **recent log** (last ~20, capped, in-memory) so a "notification
  centre" can re-show what flashed by. Not persisted across reloads in v1.

### Desktop render
- Keep bottom-right stack, but:
  - severity icon + heavier treatment for warning/error (errors sticky with ×),
  - a tiny **bell** in the header showing an unread count that opens a
    popover list of the recent log — so a missed toast is still recoverable.
- Consider `View Transitions`-based enter/leave (progressive enhancement).

### Mobile render
- Toasts already cleared the tab bar. Add:
  - **swipe-to-dismiss** on the card (reuse the `Sheet` pointer-drag logic),
  - severity-appropriate haptic via the `platform` service (success/​warning),
  - the same recent-log list reachable from the **More** sheet, so nothing is
    lost to a blink.

### Retitle/scope for tour offers
- The per-page "take a tour" offer (`usePageTourOffer` / `offerTourOnce`)
  should be a *low-severity, always-dismissible* toast (now it is). Consider
  showing it at most once per page per install (it already de-dupes per
  channel) and not at all on the very first mobile session, where the bottom
  bar + stages are self-explanatory.

## Rollout

1. **(done)** mobile safety: dismiss button + clear the tab bar.
2. Store: `severity`/`durationMs`/sticky-errors + reduced-motion + a11y roles.
3. Desktop bell + recent-log popover.
4. Mobile swipe-to-dismiss + haptic + recent log in the More sheet.
5. Audit every `showNotification`/`showActionNotification` call site and set
   the right severity/duration (errors sticky, confirmations success, etc.).

## Related

- Tab bar / sheet primitives: [mobile-kit.md](mobile-kit.md)
- Desktop-funnel hint pattern reused for consequential CTAs:
  `src/components/mobile/DesktopHint.tsx`
