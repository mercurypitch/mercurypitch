// ============================================================
// Zen-mode song navigation — pure decision helpers
// ============================================================
//
// The zen karaoke stage (KaraokeMobileStage) drives song navigation through a
// tiny back/next transport plus an autoplay toggle. The *decisions* behind
// those controls are extracted here as pure functions so they can be unit
// tested without mounting the audio engine or the RAF loop:
//
//   - resolveBackIntent  — the iPod/Spotify "back" button: seek-to-start vs.
//     jump-to-previous, decided purely from the playback position.
//   - orderedLibrarySessions — the library order shown in the song sheet, and
//     the order prev/next step through.
//   - prevSessionId / nextSessionId — the neighbour of the current song.
//   - autoAdvanceTarget — the next song to auto-play when the current one ends.
//
// Keep this module free of SolidJS and DOM imports — it is plain data in / data
// out, shared by KaraokeMobileStage (controls) and StemMixer (end-of-song).

/** How close to the start (seconds) still counts as "at the beginning", so a
 *  back press jumps to the previous song instead of re-seeking to zero. A few
 *  seconds mirrors the familiar media-player behaviour. */
export const SEEK_TO_START_THRESHOLD_SEC = 3

/** What a press of the back-to-beginning control should do. */
export type BackIntent = 'seek-start' | 'prev'

/**
 * Position-based "back" behaviour, matching common media players:
 *
 * - Past the first few seconds -> seek the current song to its start.
 * - Within the first few seconds, *and* a previous item exists -> jump to that
 *   previous item.
 *
 * Being purely a function of the current position means the "first click seeks,
 * a second click near the start goes to previous" sequence falls out naturally:
 * the first press seeks to 0, which drops the position into the threshold, so a
 * follow-up press resolves to `prev`. With no previous item it always seeks to
 * start (a harmless no-op at 0).
 */
export function resolveBackIntent(
  elapsedSec: number,
  hasPrev: boolean,
  thresholdSec: number = SEEK_TO_START_THRESHOLD_SEC,
): BackIntent {
  if (hasPrev && elapsedSec <= thresholdSec) return 'prev'
  return 'seek-start'
}

/** The subset of a session record the library ordering depends on. */
export interface LibrarySessionLike {
  sessionId: string
  status: string
  createdAt: number
  outputs?: unknown
  stemMeta?: unknown
}

/**
 * The playable library in display order: completed songs that still have audio
 * (stem outputs or stem metadata) on this device, excluding the built-in demo,
 * newest first. This is the single source of truth for both the song sheet and
 * prev/next stepping, so the controls always match the visible list.
 */
export function orderedLibrarySessions<T extends LibrarySessionLike>(
  sessions: readonly T[],
  demoSessionId: string,
): T[] {
  return sessions
    .filter(
      (s) =>
        s.status === 'completed' &&
        s.sessionId !== demoSessionId &&
        (s.outputs !== undefined || s.stemMeta !== undefined),
    )
    .sort((a, b) => b.createdAt - a.createdAt)
}

/**
 * The id `offset` steps away from `currentId` in an ordered id list, or null
 * when that would fall off either end or the current id isn't in the list.
 */
export function relativeSessionId(
  orderedIds: readonly string[],
  currentId: string | undefined,
  offset: number,
): string | null {
  if (currentId === undefined) return null
  const idx = orderedIds.indexOf(currentId)
  if (idx === -1) return null
  const target = idx + offset
  if (target < 0 || target >= orderedIds.length) return null
  return orderedIds[target]
}

/** The song after the current one in the library, or null at the end. */
export function nextSessionId(
  orderedIds: readonly string[],
  currentId: string | undefined,
): string | null {
  return relativeSessionId(orderedIds, currentId, 1)
}

/** The song before the current one in the library, or null at the start. */
export function prevSessionId(
  orderedIds: readonly string[],
  currentId: string | undefined,
): string | null {
  return relativeSessionId(orderedIds, currentId, -1)
}

/**
 * When a song ends, the next library song to auto-play — or null when autoplay
 * is off, the current song is unknown, or there is no next song. Playlists run
 * their own advance flow (scoring, summary); this covers free-library listening.
 */
export function autoAdvanceTarget(
  autoplayOn: boolean,
  orderedIds: readonly string[],
  currentId: string | undefined,
): string | null {
  if (!autoplayOn) return null
  return nextSessionId(orderedIds, currentId)
}
