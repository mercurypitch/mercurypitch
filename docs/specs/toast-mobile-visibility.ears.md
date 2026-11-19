# Toast and Banner Mobile Visibility -- EARS Requirements

Requirements for ensuring toast notifications and the verify-email banner
remain fully visible and interactive on mobile viewports, above the bottom
tab bar.

**Source:** `src/styles/Notifications.module.css` -- notification container
layout; `src/components/account/VerifyEmailBanner.module.css` -- email banner
positioning
**Tests:** `src/tests/toast-mobile-visibility.test.ts` (`REQ-TMV-001..003`),
`src/e2e/singing-phone-sideways.spec.ts` (`REQ-TMV-004..005`),
`src/e2e/piano-phone-stage-notices.spec.ts` and
`src/e2e/karaoke-phone-stage.spec.ts` (`REQ-TMV-005`),
`src/lib/foot-space.test.ts` (the published room)

EARS keywords: **WHEN** (event), **WHILE** (state), **IF/THEN** (unwanted
behaviour), **WHERE** (optional feature), otherwise ubiquitous ("shall").

Scope note: covers the positioning and overflow behaviour of the
notification toast container and the verify-email banner on mobile
(<=768 px / <=600 px), and on a phone held on its side. Desktop layout,
notification store logic, and email verification flow are out of scope.

## Notification container -- `REQ-TMV-001..002`

### REQ-TMV-001 -- Mobile toast container respects tab bar clearance

**WHILE** the viewport width is at most 768 px, the notification
container shall constrain its maximum height so that its content --
including action and close buttons on every visible toast -- never extends
beyond the visible area above the bottom tab bar. The maximum height shall
be computed from the dynamic viewport height minus the safe-area inset and
the tab bar total height (`--tabbar-total`).

### REQ-TMV-002 -- Overflowing toasts are scrollable

**IF** the total height of stacked toast notifications exceeds the
container's maximum height on a mobile viewport, **THEN** the container
shall become scrollable (`overflow-y: auto`) so every toast and its
interactive controls remain reachable.

### REQ-TMV-004 -- A phone on its side stands its toasts at the foot

**WHILE** the pointer is coarse and the viewport is in landscape at most
500 px tall (`SHORT_TOUCH_LANDSCAPE_QUERY`, a phone on its side), the
notification container shall stand at the foot of the window, on the tab
bar's published room (`--tabbar-space`) where a tab bar is drawn, at the
window's right end and at most 60% of its width, so it covers neither the
header's controls, nor the tab bar, nor the Singing stage's column of
controls on the left. Where a stage's left column publishes its right edge
(`--page-column-space`, the Karaoke stage's transport on its side), the
container shall also be no wider than the window less that edge. Pinned by
`src/e2e/singing-phone-sideways.spec.ts` at 844x390, 932x430, 740x360 and
667x375.

### REQ-TMV-005 -- A phone stage's notices stand on its transport

**WHILE** a phone stage's transport bar spans the window's foot (the
Singing stage upright, the Piano stage, the Karaoke stage upright), the
bar shall publish its room as `--page-dock-space`
(`src/lib/foot-space.ts`), and the notification container shall stand on
it rather than over the bar's buttons. **WHILE** the Singing or Karaoke
stage is on its side, its bar stands in the stage's left column and shall
publish no dock room, so the notices do not lift off the window's foot.
The native app publishes nothing: its own pill says a notice.

## Verify-email banner -- `REQ-TMV-003`

### REQ-TMV-003 -- Banner sits above the tab bar on mobile

**WHILE** the viewport width is at most 600 px, the verify-email banner
shall be positioned above the mobile tab bar by offsetting its `bottom`
value by `--tabbar-total` plus a spacing margin, ensuring the Resend and
Close buttons are never occluded by navigation chrome. The banner shall
also cap its own height and scroll when its content (including long email
addresses that wrap) would otherwise extend past the top of the viewport.
