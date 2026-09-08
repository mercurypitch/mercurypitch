// ============================================================
// What's New — which release a visitor has been told about
// ============================================================
//
// The page announces itself once per RELEASE LINE (major.minor), not once
// per version. A patch is a fix somebody already wanted; interrupting for
// it teaches people to dismiss the panel unread, and then the release that
// does matter gets dismissed too.
//
// Pure on purpose: the decision is a string comparison, and it is the part
// worth testing. Storage and rendering live with the surface.

/**
 * localStorage key holding the last release line announced on this device.
 *
 * The suffix is a deliberate one-off reset, not versioning for its own sake.
 * 0.9.2 is the release that first carries Ear Lab and Drum Night, and it is a
 * patch on a line every returning device has already been told about — so
 * without a new key the announcement the release actually deserves would
 * never fire. Changing the key makes every device unseen exactly once; the
 * once-per-line rule below is unchanged and takes over again immediately.
 */
export const WHATS_NEW_SEEN_KEY = 'pitchperfect_whats_new_seen_v2'

/**
 * The `major.minor` of a semver-ish string — the granularity the panel
 * announces at. Anything unparseable returns null, which reads downstream
 * as "say nothing", never as "announce again".
 */
export function releaseLine(version: string): string | null {
  const match = /^(\d+)\.(\d+)/.exec(version.trim())
  if (match === null) return null
  return `${match[1]}.${match[2]}`
}

/**
 * Routes that mean "somebody sent me here for THIS" — a shared song, a
 * scanned code, a password reset, one chapter of the guide. Arriving on one
 * is a request for that thing, and opening a release page over it is the
 * same rudeness whatever the page says.
 *
 * A denylist rather than an allowlist, because the ordinary ways in are the
 * long tail: a bare URL, a tab, the Karaoke upload view, and — the one that
 * cost a release its announcement — `settings-section`, which is simply what
 * the hash says when the app restores somebody who was last in Settings.
 * An allowlist of 'tab' and 'unknown' silently excluded all of those.
 */
export const DEEP_LINK_ROUTE_TYPES: readonly string[] = [
  'jam-room',
  'sync-room',
  'device-link',
  'share-short',
  'share-load',
  'share-fallback',
  'reset-password',
  'uvr-session',
  'uvr-session-mixer',
  'learn-chapter',
  'guide-start',
  'onboarding-map',
  'voice-constellation',
  'admin',
]

/** True when arriving on this route should hold the announcement back. */
export function routeSuppressesAnnouncement(routeType: string): boolean {
  return DEEP_LINK_ROUTE_TYPES.includes(routeType)
}

export interface AnnounceInput {
  /** The running app version, e.g. package.json's `0.9.0`. */
  current: string
  /** Release line last announced here, or null on a device that has none. */
  seen: string | null
  /**
   * Has this device used the app BEFORE this version? A first-ever visitor
   * is mid-onboarding and has no "new" to be shown — everything is new.
   * They are marked as caught up instead, so their first announcement is
   * the next real release.
   */
  returning: boolean
}

/** True when this device should be shown the What's New page unprompted. */
export function shouldAnnounce({
  current,
  seen,
  returning,
}: AnnounceInput): boolean {
  const line = releaseLine(current)
  if (line === null) return false
  if (!returning) return false
  if (seen === null) return true
  return seen !== line
}
