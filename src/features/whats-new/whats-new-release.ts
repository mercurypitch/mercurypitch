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

/** localStorage key holding the last release line announced on this device. */
export const WHATS_NEW_SEEN_KEY = 'pitchperfect_whats_new_seen'

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
