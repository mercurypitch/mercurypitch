// ============================================================
// Cast receiver config — the names a Cast receiver and its senders share
// ============================================================
//
// The stage on a Google Cast device is a Custom Web Receiver: a page of the
// website, registered in the Cast SDK Developer Console, that a Cast device
// loads when a sender starts a session (docs/plans/tv-cast-and-google-tv.md,
// P6). The owner registered two on 2026-10-23: the dev one, for test builds,
// at https://dev.mercurypitch.com/cast-receiver, and the production one, for
// store builds, at https://mercurypitch.com/cast-receiver. An application
// ID is not a secret: every sender carries one.
//
// Senders and the receiver talk on a namespace of their own (REQ-TV-110),
// in messages under the platform's 64 KB point-to-point limit (REQ-TV-111).

/** The registered Custom Receiver applications. */
export const CAST_RECEIVER_APP_IDS = {
  /** Test builds, served by the dev site. */
  dev: '01A75FA0',
  /** Store builds, served by the production site. */
  prod: 'D7DF12C6',
} as const

/** Where both registrations point, on their own site. */
export const CAST_RECEIVER_PATH = '/cast-receiver'

/** The stage's own channel between a sender and the receiver. */
export const CAST_STAGE_NAMESPACE = 'urn:x-cast:com.mercurypitch.stage'

/** Google's Web Receiver SDK, from the one place Google serves it. */
export const CAST_RECEIVER_SDK_URL =
  'https://www.gstatic.com/cast/sdk/libs/caf_receiver/v3/cast_receiver_framework.js'

/** The most one Cast message may carry, point to point. */
export const CAST_MESSAGE_LIMIT_BYTES = 64 * 1024

/**
 * How long the receiver stays up with no sender before it closes itself, so
 * a TV is not left on the stage's idle screen once everyone has gone.
 */
export const CAST_IDLE_CLOSE_MS = 5 * 60_000
