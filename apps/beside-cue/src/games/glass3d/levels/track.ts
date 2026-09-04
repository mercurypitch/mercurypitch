// A path through rooms, walked in order.
// ============================================================
//
// The chambers are a track, and now the Sorting Line is one too. The
// rules are the same in both -- they come from `games/glass/score.ts`
// and from maff, standing -- so they live once, here, over a room list
// and a storage key, and each world instantiates them:
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

export interface TrackState {
  /** Ids of rooms finished at least once. Order is not meaningful. */
  readonly cleared: readonly string[]
  /** Best grade per room, 0..100. A record, never a gate. */
  readonly best: Readonly<Record<string, number>>
}

export const EMPTY_TRACK: TrackState = { cleared: [], best: {} }

/** The least a room has to be to sit on a track. */
export interface TrackRoom {
  readonly id: string
}

export interface Track<R extends TrackRoom> {
  readonly rooms: readonly R[]
  roomIndex(id: string): number
  isCleared(state: TrackState, id: string): boolean
  reachedIndex(state: TrackState): number
  isOpen(state: TrackState, id: string): boolean
  isFinished(state: TrackState): boolean
  currentRoom(state: TrackState): R
  roomAfter(id: string): R | null
  recordClear(state: TrackState, id: string, grade: number): TrackState
  progressLabel(state: TrackState): string
  walkGrade(state: TrackState): number | null
  readTrack(): TrackState
  writeTrack(state: TrackState): void
  restartTrack(state: TrackState): TrackState
}

export const createTrack = <R extends TrackRoom>(
  rooms: readonly R[],
  key: string,
): Track<R> => {
  const roomIndex = (id: string): number => rooms.findIndex((r) => r.id === id)

  const isCleared = (state: TrackState, id: string): boolean =>
    state.cleared.includes(id)

  /**
   * How far along the path the player has reached: the index of the
   * first room they have not finished.
   *
   * Deliberately NOT "the number of rooms cleared". A player who somehow
   * cleared room three without room two -- an edit, a shipped change of
   * order, a save carried across a version -- is at room two, because
   * that is the first thing they have not been taught.
   */
  const reachedIndex = (state: TrackState): number => {
    const at = rooms.findIndex((r) => !isCleared(state, r.id))
    return at === -1 ? rooms.length : at
  }

  const isOpen = (state: TrackState, id: string): boolean => {
    const i = roomIndex(id)
    return i >= 0 && i <= reachedIndex(state)
  }

  const isFinished = (state: TrackState): boolean =>
    reachedIndex(state) >= rooms.length

  /** The furthest room not finished, and the LAST room once they all
   * are -- a finished track re-entered should put them somewhere. */
  const currentRoom = (state: TrackState): R => {
    const i = Math.min(reachedIndex(state), rooms.length - 1)
    return rooms[i]!
  }

  const roomAfter = (id: string): R | null => {
    const i = roomIndex(id)
    return i < 0 ? null : (rooms[i + 1] ?? null)
  }

  /** Keeps the BEST grade, not the last, and is idempotent: finishing
   * room one twice does not make the path longer. */
  const recordClear = (
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

  const progressLabel = (state: TrackState): string =>
    `${Math.min(reachedIndex(state), rooms.length)} of ${rooms.length}`

  /** A mean of bests rather than of runs: how well the player CAN sing
   * these rooms, not how the last attempt went. */
  const walkGrade = (state: TrackState): number | null => {
    const grades = state.cleared
      .map((id) => state.best[id])
      .filter((g): g is number => typeof g === 'number')
    if (grades.length === 0) return null
    return Math.round(grades.reduce((a, b) => a + b, 0) / grades.length)
  }

  /** A stored track outlives the level list. Renaming, removing or
   * reordering a room must leave a track that is merely shorter. */
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

  const readTrack = (): TrackState => {
    try {
      const raw = window.localStorage.getItem(key)
      return raw === null ? EMPTY_TRACK : sanitise(JSON.parse(raw))
    } catch {
      return EMPTY_TRACK
    }
  }

  const writeTrack = (state: TrackState): void => {
    try {
      window.localStorage.setItem(key, JSON.stringify(state))
    } catch {
      // the walk still happened; it just will not be there tomorrow
    }
  }

  const restartTrack = (state: TrackState): TrackState => ({
    cleared: [],
    best: state.best,
  })

  return {
    rooms,
    roomIndex,
    isCleared,
    reachedIndex,
    isOpen,
    isFinished,
    currentRoom,
    roomAfter,
    recordClear,
    progressLabel,
    walkGrade,
    readTrack,
    writeTrack,
    restartTrack,
  }
}
