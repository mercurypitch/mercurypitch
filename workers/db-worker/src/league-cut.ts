// ── Weekly league cut: pure, dependency-free decision logic ──────────
// No D1 / Env imports, so the promotion/relegation rules are unit-testable
// (src/tests/league-cut.test.ts) without a database — same split as
// league-points.ts / last-active.ts. The worker (src/league.ts) loads the
// week's memberships, calls computeCohortCut per cohort, and applies the
// returned moves to userProfiles.currentLeagueId.

/** A member's standing in one cohort at the end of the week. */
export interface CutMember {
  userId: string
  points: number
}

/** The rung the cohort belongs to, plus its neighbours in the ladder. */
export interface CutRung {
  /** Top N ACTIVE members promote up a rung (0 = top playable rung). */
  promoteCount: number
  /** Bottom M members relegate down a rung (0 = grace rung, nobody drops). */
  relegateCount: number
  /** League id one rank up, or null at the top (or when the next is locked). */
  upLeagueId: string | null
  /** League id one rank down, or null at the bottom. */
  downLeagueId: string | null
}

export interface CutMove {
  userId: string
  toLeagueId: string
  kind: 'promote' | 'relegate'
}

/**
 * Deterministic standings order: points DESC, then userId ASC as the
 * tiebreak, so reruns and tests always agree on who was "top N".
 */
export function orderStandings(members: CutMember[]): CutMember[] {
  return [...members].sort(
    (a, b) => b.points - a.points || (a.userId < b.userId ? -1 : 1),
  )
}

/**
 * One cohort's promotion/relegation decisions.
 *
 * Rules (see the league plan):
 * - Only ACTIVE members (points > 0) can promote — an inactive week never
 *   advances anyone, even when the cohort is small and promote slots go
 *   unfilled.
 * - The bottom `relegateCount` of the WHOLE cohort relegate (inactive members
 *   sit at the bottom of the standings, so they are first out the door).
 *   A member selected for promotion is never also relegated.
 * - `upLeagueId: null` (top playable rung / locked rung above) disables
 *   promotion; `downLeagueId: null` (grace rung) disables relegation.
 */
export function computeCohortCut(
  members: CutMember[],
  rung: CutRung,
): CutMove[] {
  if (members.length === 0) return []
  const ordered = orderStandings(members)
  const moves: CutMove[] = []
  const promoted = new Set<string>()

  if (rung.upLeagueId !== null && rung.promoteCount > 0) {
    const up = rung.upLeagueId
    for (const m of ordered) {
      if (promoted.size >= rung.promoteCount) break
      if (m.points <= 0) break // ordered — everyone after is inactive too
      promoted.add(m.userId)
      moves.push({ userId: m.userId, toLeagueId: up, kind: 'promote' })
    }
  }

  if (rung.downLeagueId !== null && rung.relegateCount > 0) {
    const down = rung.downLeagueId
    let remaining = rung.relegateCount
    for (let i = ordered.length - 1; i >= 0 && remaining > 0; i--) {
      const m = ordered[i]
      if (promoted.has(m.userId)) continue
      moves.push({ userId: m.userId, toLeagueId: down, kind: 'relegate' })
      remaining--
    }
  }

  return moves
}
