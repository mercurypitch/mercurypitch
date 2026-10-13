// Shipped example songs: how a session row is recognised as one.
//
// Lives in lib rather than beside the Karaoke Night feature because the
// session store needs the same answer (the boot prune must leave examples
// alone) and a store may not import a feature. The feature modules
// (demo-song, examples-library) re-export everything here, so their
// importers did not move.
//
// Pure: no db, no store, no DOM.

/** The two fields of a session row the example test reads. Structural, so
 *  this module does not import the session store's UvrSession. */
export interface ExampleCandidate {
  sessionId: string
  provider?: string
}

/**
 * Session id of the ORIGINAL demo — lyrics, pitch analysis and scores
 * persist under it in the local db exactly like a normal separation
 * session.
 *
 * It is a bare string with no slug in it because it shipped that way, and
 * every visitor who has ever sung the demo has local rows keyed by it.
 * `demoSessionId` therefore keeps returning exactly this for the original
 * slug rather than migrating anybody.
 */
export const DEMO_SESSION_ID = 'karaoke-night-demo'

/** The slug the shipped manifest and every pre-list row carry. */
export const LEGACY_SLUG = 'karaoke-night'

/**
 * Local-db session id for a demo.
 *
 * The original keeps its historic id; anything added later is namespaced
 * under it. Getting this wrong does not throw — it silently orphans a
 * visitor's lyrics and takes, which is why the legacy case is spelled out
 * rather than derived.
 */
export function demoSessionId(slug: string | undefined): string {
  const s = (slug ?? '').trim()
  return s === '' || s === LEGACY_SLUG
    ? DEMO_SESSION_ID
    : `${DEMO_SESSION_ID}:${s}`
}

/** Whether a local session belongs to any demo song. */
export function isDemoSessionId(sessionId: string): boolean {
  return (
    sessionId === DEMO_SESSION_ID || sessionId.startsWith(`${DEMO_SESSION_ID}:`)
  )
}

/**
 * The `provider` stamped on every seeded example, and the only reliable way
 * to tell one from a visitor's own upload once both are ordinary rows in the
 * session store.
 *
 * Group membership would be the intuitive test and is the wrong one: a
 * visitor can drag an example out of the Examples group, and the row is
 * still not their song.
 */
export const EXAMPLE_PROVIDER = 'examples'

/**
 * True for a seeded example rather than something the visitor brought.
 *
 * Its stems stream from R2 (or the native bundle) instead of living in
 * uvrStemBlobs, and its `createdAt` is a sort key that files the examples
 * below the visitor's own songs, not a date anything happened on.
 *
 * The funnel needs this to keep `karaoke_song_staged` meaning "brought
 * their own song" — it is Campaign E's bid target, and an event a visitor
 * can fire by tapping a built-in track would optimise the campaign toward
 * exactly the behaviour it is supposed to measure the absence of.
 *
 * Two independent signals, either sufficient. `provider` is what the
 * current seeder stamps; the session-id format covers rows a device
 * seeded under an older build that may predate the stamp. Every example
 * id comes from `demoSessionId()` by construction, and a visitor's own
 * separation can never be given one — so the id check adds legacy safety
 * without any way to misclassify a real upload.
 */
export function isExampleSession(
  session: ExampleCandidate | undefined,
): boolean {
  if (session === undefined) return false
  return (
    session.provider === EXAMPLE_PROVIDER || isDemoSessionId(session.sessionId)
  )
}
