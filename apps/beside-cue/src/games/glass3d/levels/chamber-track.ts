// The path through the rooms.
// ============================================================
//
// The chambers teach in a fixed order -- the room has a note, the note
// moves the danger, the answer is a sequence -- and three cards in a
// list invite playing them out of that order, which breaks the only
// teaching structure the slice has. So they are a TRACK: entered once,
// walked in order, and it remembers where you got to.
//
// ONE RULE, AND IT COMES FROM SOMEWHERE ELSE. `games/glass/score.ts`
// already says it: passing is a band, not a finish line, and nothing is
// gated by any of it. With "no streaks, ever" beside it, the design is
// settled and this module must not quietly reopen it:
//
//   * A room opens when the one before it is FINISHED, not when it is
//     finished well. Getting through is the condition; the grade is a
//     record kept beside it.
//   * A cleared room stays open. Going back to sing room one better is
//     a thing a player may do without starting again.
//   * Stopping costs nothing. The track is where you left it.
//
// Everything here is pure but for two functions that touch storage, and
// those are wrapped: a private window, a hand-edited entry and a room
// that no longer exists all have to end in a playable track rather than
// a thrown error inside a game.

import type { ChamberLevel } from './chambers'
import { CHAMBERS } from './chambers'

const KEY = 'beside-cue:games:chamber-track'

export interface TrackState {
  /** Ids of rooms finished at least once. Order is not meaningful. */
  readonly cleared: readonly string[]
  /** Best grade per room, 0..100. A record, never a gate. */
  readonly best: Readonly<Record<string, number>>
}

export const EMPTY_TRACK: TrackState = { cleared: [], best: {} }

/** Where a room sits on the path, or -1 if it is not on it. */
export const roomIndex = (id: string): number =>
  CHAMBERS.findIndex((c) => c.id === id)

export const isCleared = (state: TrackState, id: string): boolean =>
  state.cleared.includes(id)

/**
 * How far along the path the player has reached: the index of the first
 * room they have not finished.
 *
 * Deliberately NOT "the number of rooms cleared". A player who somehow
 * cleared room three without room two -- an edit, a shipped change of
 * order, a save carried across a version -- is at room two, because
 * that is the first thing they have not been taught.
 */
export const reachedIndex = (state: TrackState): number => {
  const at = CHAMBERS.findIndex((c) => !isCleared(state, c.id))
  return at === -1 ? CHAMBERS.length : at
}

/** Every room up to and including the furthest one reached. */
export const isOpen = (state: TrackState, id: string): boolean => {
  const i = roomIndex(id)
  return i >= 0 && i <= reachedIndex(state)
}

/** The whole path has been walked. */
export const isFinished = (state: TrackState): boolean =>
  reachedIndex(state) >= CHAMBERS.length

/**
 * The room to drop the player into.
 *
 * The furthest one they have not finished, and the LAST room once they
 * have finished them all -- a finished track re-entered should put them
 * somewhere, and the end is where they were.
 */
export const currentRoom = (state: TrackState): ChamberLevel => {
  const i = Math.min(reachedIndex(state), CHAMBERS.length - 1)
  return CHAMBERS[Math.max(0, i)]!
}

/** The room after this one, or null at the end of the path. */
export const roomAfter = (id: string): ChamberLevel | null => {
  const i = roomIndex(id)
  return i < 0 ? null : (CHAMBERS[i + 1] ?? null)
}

/**
 * Record a room finished, with the grade it was finished at.
 *
 * Keeps the BEST grade, not the last: a player who goes back to a room
 * they already cleared and has a bad run has not undone anything. And
 * clearing is idempotent, because finishing room one twice does not
 * make the path longer.
 */
export const recordClear = (
  state: TrackState,
  id: string,
  grade: number,
): TrackState => {
  if (roomIndex(id) < 0) return state
  const clamped = Math.max(0, Math.min(100, Math.round(grade)))
  const previous = state.best[id]
  return {
    cleared: isCleared(state, id) ? state.cleared : [...state.cleared, id],
    best: {
      ...state.best,
      [id]: previous === undefined ? clamped : Math.max(previous, clamped),
    },
  }
}

/** "2 of 3" -- how far along, for the card in the games list. */
export const progressLabel = (state: TrackState): string =>
  `${Math.min(reachedIndex(state), CHAMBERS.length)} of ${CHAMBERS.length}`

/**
 * The grade for the whole walk: the mean of the best grades of the rooms
 * finished, or null before any of them are.
 *
 * A mean of bests rather than of runs, for the same reason `recordClear`
 * keeps the best: the number should say how well the player can sing
 * these rooms, not how their last attempt went.
 */
export const walkGrade = (state: TrackState): number | null => {
  const grades = state.cleared
    .map((id) => state.best[id])
    .filter((g): g is number => typeof g === 'number')
  if (grades.length === 0) return null
  return Math.round(grades.reduce((a, b) => a + b, 0) / grades.length)
}

/**
 * Drop anything that is not a room any more.
 *
 * A stored track outlives the level list. Renaming a chamber, removing
 * one, or reordering them must leave a track that is merely shorter --
 * never one that reports progress through a room nobody can enter.
 */
const sanitise = (raw: unknown): TrackState => {
  if (typeof raw !== 'object' || raw === null) return EMPTY_TRACK
  const record = raw as { cleared?: unknown; best?: unknown }
  const cleared = Array.isArray(record.cleared)
    ? record.cleared.filter(
        (id): id is string => typeof id === 'string' && roomIndex(id) >= 0,
      )
    : []
  const best: Record<string, number> = {}
  if (typeof record.best === 'object' && record.best !== null) {
    for (const [id, value] of Object.entries(record.best)) {
      if (roomIndex(id) < 0) continue
      if (typeof value !== 'number' || !Number.isFinite(value)) continue
      best[id] = Math.max(0, Math.min(100, Math.round(value)))
    }
  }
  return { cleared: [...new Set(cleared)], best }
}

export const readTrack = (): TrackState => {
  try {
    const raw = window.localStorage.getItem(KEY)
    return raw === null ? EMPTY_TRACK : sanitise(JSON.parse(raw))
  } catch {
    return EMPTY_TRACK
  }
}

export const writeTrack = (state: TrackState): void => {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // the walk still happened; it just will not be there tomorrow
  }
}

/** Start the path again, keeping the grades already earned. */
export const restartTrack = (state: TrackState): TrackState => ({
  cleared: [],
  best: state.best,
})
