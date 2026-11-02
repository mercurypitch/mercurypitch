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
