// ============================================================
// League board — this week's cut, as every surface that shows it reads it
// ============================================================
//
// One reading of who moves where, shared so that two surfaces on one phone
// cannot disagree: the native Leagues screen and the Progress page's league
// card. It mirrors the server's cut (workers/db-worker/src/league-cut.ts),
// which is what decides:
//
//   - only members with points move up, at most the rung's promote count;
//   - the bottom relegate count of the WHOLE cohort drop, and a member who
//     moves up is never among them.
//
// The relegation line is drawn from the cohort's full size, not from the
// rows the server sends: it sends the top 50. The web's Leaderboard draws
// the same cut inline (CommunityLeaderboard.tsx, `leagueBoard`).

import type { LeagueMe, LeagueRung, LeagueStanding, } from '@/db/services/league-service'

/** Where a member stands at this week's cut. */
export type LeagueZone = 'promote' | 'hold' | 'demote'

/** A row of the standings, or the line where a zone ends. */
export type LeagueBoardItem =
  | { kind: 'row'; row: LeagueStanding; zone: LeagueZone }
  | { kind: 'line'; zone: 'promote' | 'demote'; to: string | undefined }

export interface LeagueNeighbours {
  /** The rung a promotion reaches; none above the top playable rung. */
  up: LeagueRung | undefined
  /** The rung a relegation drops to; none below the first. */
  down: LeagueRung | undefined
}

/** The veiled trophy a rung above the singer's shows. */
export const LOCKED_TROPHY = '/leagues/locked.webp'

/** The rungs either side of `rank` on the ladder. */
export function leagueNeighbours(
  rank: number | undefined,
  ladder: readonly LeagueRung[],
): LeagueNeighbours {
  if (rank === undefined) return { up: undefined, down: undefined }
  return {
    up: ladder.find((rung) => rung.rank === rank + 1 && !rung.isMystery),
    down: ladder.find((rung) => rung.rank === rank - 1),
  }
}

/** The standings cut into zones, with a line where each zone ends. */
export function leagueBoard(
  me: LeagueMe,
  ladder: readonly LeagueRung[],
): LeagueBoardItem[] {
  const rows = me.standings ?? []
  const total = me.cohortSize ?? rows.length
  const promoteCount = me.league?.promoteCount ?? 0
  const relegateCount = me.league?.relegateCount ?? 0
  // Only members with points move up: the trailing rows without any are
  // trimmed out of the promotion zone.
  let promoteEnd = Math.min(promoteCount, rows.length)
  while (promoteEnd > 0 && (rows[promoteEnd - 1]?.points ?? 0) <= 0) {
    promoteEnd--
  }
  const demoteStart =
    relegateCount > 0 ? Math.max(promoteEnd, total - relegateCount) : total
  const { up, down } = leagueNeighbours(me.league?.rank, ladder)
  const items: LeagueBoardItem[] = []
  rows.forEach((row, index) => {
    if (promoteEnd > 0 && promoteEnd < total && index === promoteEnd) {
      items.push({ kind: 'line', zone: 'promote', to: up?.name })
    }
    if (demoteStart < total && index === demoteStart) {
      items.push({ kind: 'line', zone: 'demote', to: down?.name })
    }
    items.push({
      kind: 'row',
      row,
      zone:
        index < promoteEnd
          ? 'promote'
          : index >= demoteStart
            ? 'demote'
            : 'hold',
    })
  })
  return items
}

/**
 * Where the singer stands at this week's cut, from their own rank and
 * points: the same answer `leagueBoard` gives their row. Null without a
 * place this week (no points yet, or not eligible).
 */
export function leagueZoneOf(me: LeagueMe): LeagueZone | null {
  const rung = me.league
  if (
    !me.eligible ||
    rung === undefined ||
    me.rank === null ||
    me.rank === undefined ||
    me.cohortSize === undefined
  ) {
    return null
  }
  if (me.rank <= rung.promoteCount && (me.points ?? 0) > 0) return 'promote'
  if (rung.relegateCount > 0 && me.rank > me.cohortSize - rung.relegateCount) {
    return 'demote'
  }
  return 'hold'
}

/**
 * A rung above the singer's shows a veiled trophy: the name stays, the
 * prize is the surprise. Their own rung, the rungs below it and the mystery
 * rung show their own; with no league yet, only the first does.
 */
export function rungRevealed(
  rung: LeagueRung,
  myRank: number | undefined,
): boolean {
  return rung.isMystery || rung.rank <= (myRank ?? 1)
}

/** 1st, 2nd, 3rd, 4th, 11th, 21st. */
export function ordinal(n: number): string {
  const tens = n % 100
  if (tens >= 11 && tens <= 13) return `${n}th`
  switch (n % 10) {
    case 1:
      return `${n}st`
    case 2:
      return `${n}nd`
    case 3:
      return `${n}rd`
    default:
      return `${n}th`
  }
}

/**
 * Monday 00:00 UTC of the week holding `nowMs`, as an ISO string: the week
 * the server counts points in (`isoWeekStart`, workers/db-worker/src/league.ts).
 */
export function leagueWeekStart(nowMs: number = Date.now()): string {
  const now = new Date(nowMs)
  const monday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  )
  monday.setUTCDate(monday.getUTCDate() - ((now.getUTCDay() + 6) % 7))
  return monday.toISOString()
}
