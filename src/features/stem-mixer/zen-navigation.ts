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

/** What the playlist should do when a song ends naturally. */
export type PlaylistEndAction =
  | 'defer-to-score-modal'
  | 'advance-with-score'
  | 'advance-without-score'

/**
 * End-of-song advance decision for a running playlist.
 *
 * The desktop mixer presents the score in StemMixerScoreModal and advances
 * when it closes — but that modal only mounts on the desktop branch. The zen
 * stage surfaces scores on the next song's overlay / the summary instead, so
 * deferring there would leave the advance waiting on a modal that never
 * appears and stall the playlist at 0:00. A playlist must ALWAYS advance at
 * end-of-song: defer only when the modal is actually mounted.
 */
export function playlistEndAction(
  zenStageActive: boolean,
  micActive: boolean,
  comparisonCount: number,
): PlaylistEndAction {
  const hasScoreData = micActive && comparisonCount > 0
  if (!hasScoreData) return 'advance-without-score'
  return zenStageActive ? 'advance-with-score' : 'defer-to-score-modal'
}

/** Zen lyrics size presets — Smaller / Current (default) / Bigger. */
export const ZEN_LYRICS_SIZES = ['smaller', 'current', 'bigger'] as const
export type ZenLyricsSize = (typeof ZEN_LYRICS_SIZES)[number]

/** Font multiplier applied to the zen lyrics lines for each preset. */
export const ZEN_LYRICS_SCALE: Record<ZenLyricsSize, number> = {
  smaller: 0.85,
  current: 1,
  bigger: 1.25,
}

/** Step a lyrics-size preset up or down, clamped at the ends. */
export function stepLyricsSize(
  size: ZenLyricsSize,
  direction: 1 | -1,
): ZenLyricsSize {
  const idx = ZEN_LYRICS_SIZES.indexOf(size)
  const next = Math.max(
    0,
    Math.min(ZEN_LYRICS_SIZES.length - 1, idx + direction),
  )
  return ZEN_LYRICS_SIZES[next]
}

/** Cycle a lyrics-size preset (for a single toggle button): smaller → current
 *  → bigger → smaller. */
export function cycleLyricsSize(size: ZenLyricsSize): ZenLyricsSize {
  const idx = ZEN_LYRICS_SIZES.indexOf(size)
  return ZEN_LYRICS_SIZES[(idx + 1) % ZEN_LYRICS_SIZES.length]
}
