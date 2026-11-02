// ============================================================
// The running Legend's board — what the top of it sends
// ============================================================
//
// The board's first entries (index.ts, handleWeeklyBoard) once the singers
// hidden from the viewer are dropped, every place kept (blocks.ts). Each
// entry but the Founder's carries the singer's id: every one of them opted
// in to be named on public boards, and the leaderboard already sends the id
// beside each name. The phone reports and blocks a singer on the board by
// that id (slice 4b of docs/plans/native-more-and-community.md). The
// Founder is the house's seed score, nobody's account, and carries none.

/** An entry placed among everyone on the board, before it is sent. */
export interface PlacedBoardEntry {
  rank: number
  /** Null for the Founder. */
  userId: string | null
  displayName: string
  best: number
  isFounder: boolean
}

/** An entry as the board sends it. */
export interface BoardTopEntry {
  rank: number
  /** The singer's id; absent for the Founder. */
  userId?: string
  displayName: string
  best: number
  isFounder: boolean
}

/** How many entries the board sends. */
export const BOARD_TOP_SIZE = 10

/** The top of the board as sent: places kept, an id for every singer. */
export function boardTop(shown: readonly PlacedBoardEntry[]): BoardTopEntry[] {
  return shown.slice(0, BOARD_TOP_SIZE).map((entry) => {
    const sent: BoardTopEntry = {
      rank: entry.rank,
      displayName: entry.displayName,
      best: entry.best,
      isFounder: entry.isFounder,
    }
    if (!entry.isFounder && entry.userId !== null) sent.userId = entry.userId
    return sent
  })
}

// ── The closed Legends' podiums ──────────────────────────────────────
//
// A podium is frozen when its Legend closes, so a name that may no longer be
// shown is withheld as it is read (index.ts, `redactPodiums`): a singer who
// opted out, was suspended or withdrew their score, and, for a reader with a
// session, a singer in a block with them, either way (REQ-RB-014). The place
// and the score stay, so nobody moves up into it; the name and the id go.

/** A podium place as a closed Legend's `resultsJson` keeps it. */
export interface StoredPodiumPlace {
  userId?: unknown
  displayName?: unknown
  best?: unknown
  rank?: unknown
  redacted?: boolean
}

/**
 * The podium with every name `shows` refuses withheld, and whether any was.
 * A place with no id (a version 1 row) is kept as stored: there is nobody
 * to ask about.
 */
export function withholdNames(
  podium: readonly StoredPodiumPlace[],
  shows: (userId: string) => boolean,
): { podium: StoredPodiumPlace[]; changed: boolean } {
  let changed = false
  const next = podium.map((place): StoredPodiumPlace => {
    const id = place.userId
    if (typeof id !== 'string' || id === '' || shows(id)) return place
    changed = true
    // The id goes with the name: nothing downstream needs it once the name
    // is gone, and shipping it would leave the singer identifiable to
    // anyone holding an older copy of the same archive.
    return {
      best: place.best,
      rank: place.rank,
      displayName: null,
      redacted: true,
    }
  })
  return { podium: next, changed }
}
