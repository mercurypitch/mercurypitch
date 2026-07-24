# Toast and Banner Mobile Visibility -- EARS Requirements

Requirements for ensuring toast notifications and the verify-email banner
remain fully visible and interactive on mobile viewports, above the bottom
tab bar.

Source:

- `src/styles/Notifications.module.css` -- notification container layout
- `src/components/account/VerifyEmailBanner.module.css` -- email banner
  positioning

Tests:

- `src/tests/toast-mobile-visibility.test.ts` (`REQ-TMV-001..003`)

EARS keywords: **WHEN** (event), **WHILE** (state), **IF/THEN** (unwanted
behaviour), **WHERE** (optional feature), otherwise ubiquitous ("shall").

Scope note: covers the positioning and overflow behaviour of the
notification toast container and the verify-email banner on mobile
(<=768 px / <=600 px). Desktop layout, notification store logic, and email
verification flow are out of scope.

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

## Verify-email banner -- `REQ-TMV-003`

### REQ-TMV-003 -- Banner sits above the tab bar on mobile
**WHILE** the viewport width is at most 600 px, the verify-email banner
shall be positioned above the mobile tab bar by offsetting its `bottom`
value by `--tabbar-total` plus a spacing margin, ensuring the Resend and
Close buttons are never occluded by navigation chrome. The banner shall
also cap its own height and scroll when its content (including long email
addresses that wrap) would otherwise extend past the top of the viewport.
