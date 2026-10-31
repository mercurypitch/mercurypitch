// ============================================================
// League lines — the Leagues screen's words, from the league it shows
// ============================================================
//
// Pure, so the wording is tested without drawing the screen. A place is
// words ("4th of 23"), the next cut is days or hours in words (never the
// web's "3d 4h"), and nothing is a percentage. Who moves where is not
// decided here: that is the shared cut (src/lib/league-board.ts).

import type { LeagueMe, LeagueRung } from '@/db/services/league-service'
import type { LeagueNeighbours, LeagueZone } from '@/lib/league-board'
import { ordinal } from '@/lib/league-board'
import { durationInWords } from '../duration-words'

/** "1 point", "120 points". */
export function pointsWord(points: number): string {
  return points === 1 ? '1 point' : `${points} points`
}

/** Under the rung's name: the singer's place and points this week. */
export function placeLine(me: LeagueMe): string {
  if (
    me.rank === null ||
    me.rank === undefined ||
    me.cohortSize === undefined
  ) {
    return 'No points yet this week'
  }
  return `${ordinal(me.rank)} of ${me.cohortSize} this week, ${pointsWord(me.points ?? 0)}`
}

/** Where the singer is headed if the week ended now. */
export function zoneLine(
  zone: LeagueZone | null,
  near: LeagueNeighbours,
): string | null {
  switch (zone) {
    case 'promote':
      return near.up === undefined
        ? 'On course to move up a rung'
        : `On course to move up to ${near.up.name}`
    case 'demote':
      return near.down === undefined
        ? 'On course to drop a rung'
        : `On course to drop to ${near.down.name}`
    case 'hold':
      return 'Holding your rung'
    case null:
      return null
  }
}

/** The rung's rules, a sentence each: who moves up, who drops. */
export function rulesLines(rung: LeagueRung, near: LeagueNeighbours): string[] {
  const up =
    rung.promoteCount <= 0
      ? 'The highest rung there is for now: hold it.'
      : near.up === undefined
        ? `The top ${rung.promoteCount} with points move up a rung.`
        : `The top ${rung.promoteCount} with points move up to ${near.up.name}.`
  const down =
    rung.relegateCount <= 0
      ? 'Nobody drops from this rung.'
      : near.down === undefined
        ? `The bottom ${rung.relegateCount} drop a rung.`
        : `The bottom ${rung.relegateCount} drop to ${near.down.name}.`
  return [up, down]
}

/** When the week's cut comes: Monday at midnight UTC. */
export function nextCutLine(ms: number): string {
  return `The next cut is in ${durationInWords(ms)}`
}

/** The line across the standings where a zone ends. */
export function boardLine(
  zone: 'promote' | 'demote',
  to: string | undefined,
): string {
  if (zone === 'promote') {
    return to === undefined
      ? 'Above this line, up a rung'
      : `Above this line, up to ${to}`
  }
  return to === undefined
    ? 'Below this line, down a rung'
    : `Below this line, down to ${to}`
}

/** A rung's name on the ladder: the mystery one has none yet. */
export function rungName(rung: LeagueRung): string {
  return rung.isMystery ? 'Coming soon' : rung.name
}

/** The line under a rung of the ladder, if it has one. */
export function rungLine(
  rung: LeagueRung,
  myRank: number | undefined,
  revealed: boolean,
): string | null {
  if (rung.isMystery) return 'A league still to come'
  if (myRank !== undefined && rung.rank === myRank) return 'Your league'
  if (!revealed) return `Reach ${rung.name} to unveil its trophy`
  return null
}
