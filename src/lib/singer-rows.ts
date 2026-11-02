// ============================================================
// Singer rows — which rows of a board can be reported, and what a block hides
// ============================================================
//
// Slice 4b of docs/plans/native-more-and-community.md. Every board that
// names other singers asks the same two things of a row, so they are
// answered once here, for the phone's Leagues and Legend screens and for
// the web's Leaderboard alike.
//
// Which rows: only one that shows a singer's own name and carries their
// id, and never the viewer's own. A league row says so in `named` (a weekly
// stand-in's id is a membership's, which leads nobody to anyone); a Legend
// board entry by carrying a `userId` (the Founder carries none). A worker
// that predates either field sends neither, and its rows offer nothing.
//
// What a block hides: the blocked singer's rows, at once, from what is on
// screen. The other rows keep the places the worker gave them (REQ-RB-012):
// a filter, never a re-rank.

/** A league row that can be reported or blocked: named, not the viewer's. */
export function canActOnStanding(
  row: { userId: string; named?: boolean },
  viewerId: string,
): boolean {
  return row.named === true && row.userId !== '' && row.userId !== viewerId
}

/**
 * The singer behind a board entry who can be reported or blocked, or null:
 * the Founder, an entry with no id, and the viewer's own have none.
 */
export function singerOfEntry(
  entry: { userId?: string; isFounder?: boolean },
  viewerId: string,
): string | null {
  const id = entry.userId
  if (entry.isFounder === true || id === undefined || id === '') return null
  return id === viewerId ? null : id
}

/** The rows less those of a blocked singer, every place left as it was. */
export function withoutBlocked<T>(
  rows: readonly T[],
  blocked: ReadonlySet<string>,
  idOf: (row: T) => string | null | undefined,
): T[] {
  if (blocked.size === 0) return [...rows]
  return rows.filter((row) => {
    const id = idOf(row)
    return id === null || id === undefined || !blocked.has(id)
  })
}
