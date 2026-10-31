// ============================================================
// Legend lines — the Legend room's words, from the challenge it shows
// ============================================================
//
// Pure, so the wording is tested without drawing the room. Never a period
// ("this week", "weekly"): a Legend runs one to eight weeks and stays open
// two days past its close (challenge-period-neutral.test.ts), so the close
// is said as time left, in words. A score is the web's percentage, so the
// phone and the board say the same number.

import type { ArchivedWeeklyChallenge, WeeklyBoard, } from '@/features/challenges/weekly-service'
import type { MelodyItem } from '@/types'
import { durationInWords } from '../duration-words'

/** Under the title: how long the Legend has left. */
export function closesLine(endsAt: string, nowMs: number): string {
  const left = Date.parse(endsAt) - nowMs
  if (!Number.isFinite(left)) return ''
  // The worker counts takes for two days past the close.
  if (left <= 0) return 'Closing: takes still count for a little longer'
  return `Ends in ${durationInWords(left)}`
}

/** A past Legend's close, as a date. */
export function endedLine(archived: ArchivedWeeklyChallenge): string {
  const at = Date.parse(archived.results?.closedAt ?? archived.endsAt)
  if (!Number.isFinite(at)) return 'Closed'
  const date = new Date(at).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  })
  return `Closed ${date}`
}

/** Where the line sits against the singer's range, if outside it. */
export function rangeSide(
  items: readonly MelodyItem[],
  range: { min: number; max: number },
): 'above' | 'below' | null {
  // Untrusted, as challengeToZenExercise reads it: a note with no pitch
  // is left out, never a reason for the room not to draw.
  const midis = items
    .map((item) => item.note?.midi)
    .filter((midi): midi is number => Number.isFinite(midi))
  if (midis.length === 0) return null
  if (Math.max(...midis) > range.max) return 'above'
  if (Math.min(...midis) < range.min) return 'below'
  return null
}

/**
 * Said before the take, never fixed by moving the line: a Legend is sung at
 * its written pitch, so everyone on the board sang the same notes
 * (MISTAKES.md, "Never transpose a weekly challenge to the singer's range").
 */
export function rangeLine(side: 'above' | 'below', preset: string): string {
  return `This Legend is written ${side} your ${preset} range, a feat for another voice. Sing it anyway if you like: it is scored as written.`
}

/** How many sang it, and finished it. */
export function countsLine(board: WeeklyBoard): string | null {
  if (board.attemptedCount <= 0) return null
  const sang =
    board.attemptedCount === 1
      ? '1 singer has sung this'
      : `${board.attemptedCount} singers have sung this`
  return board.completedCount > 0
    ? `${sang}, ${board.completedCount} completed it`
    : sang
}

/**
 * The singer's own standing, in words. Never their rank beside the top
 * rows' ranks: the Founder sits in the top rows but not in the singer's
 * count, so the two numbers are on different scales.
 */
export function standingLine(board: WeeklyBoard): string | null {
  const you = board.you
  if (you === null) return null
  const best = Math.round(you.best)
  if (!you.ranked) {
    return `Your best ${best}%. Not on the board: turn on public boards in Account to be ranked.`
  }
  if (you.beatFounder) return `You beat the Founder: your best is ${best}%`
  if (board.rankedCount > 0 && you.percentile > 0) {
    return `Your best ${best}%, in the top ${Math.max(1, Math.round(you.percentile))}% of ${board.rankedCount}`
  }
  return `Your best ${best}%`
}

/** The score the take reached, said once it is in. */
export function takeLine(score: number, targetScore: number): string {
  return score >= targetScore
    ? `${score}%: the Legend asks for ${targetScore}%, and you reached it`
    : `${score}%: the Legend asks for ${targetScore}%`
}
