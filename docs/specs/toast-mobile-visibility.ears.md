# Toast Mobile Visibility — EARS Requirements

Requirements for ensuring toast notifications and the email-verification banner remain fully visible and interactive above the mobile bottom tab bar.

## REQ-TOAST-001 — Toast container clears mobile tab bar
**WHEN** the viewport width is at or below the mobile breakpoint (768 px)
**THE** notification toast container shall position itself so that all toasts, including their action and dismiss buttons, render above the BottomTabBar and remain fully visible and tappable.

## REQ-TOAST-002 — Email-verification banner clears mobile tab bar
**WHEN** the viewport width is at or below the mobile breakpoint (768 px)
**WHILE** the VerifyEmailBanner is visible
**THE** banner shall be positioned above the BottomTabBar (accounting for --tabbar-total) and at a z-index higher than --z-tabbar, so its Resend, Close, and Confirm controls are never occluded.

## REQ-TOAST-003 — Toast z-index above all navigation chrome
**Ubiquitous:** The notification toast container z-index (--z-toast) shall be higher than the tab bar (--z-tabbar), sheets (--z-sheet), and modals (--z-modal) so that toasts always render on top of all navigation and modal chrome.
