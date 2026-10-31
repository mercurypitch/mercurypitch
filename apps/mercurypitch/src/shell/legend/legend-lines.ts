// ============================================================
// Legend lines — the Legend room's words, from the challenge it shows
// ============================================================
//
// Pure, so the wording is tested without drawing the room. Never a period
// ("this week", "weekly"): a Legend runs one to eight weeks and stays open
// two days past its close (challenge-period-neutral.test.ts), so the close
// is said as time left, in words. A score is the web's percentage, so the
// phone and the board say the same number.

import type { WeeklyTier } from '@/features/challenges/weekly-attempt'
import type { ArchivedWeeklyChallenge, WeeklyBoard, } from '@/features/challenges/weekly-service'
import { midiToNoteNameOctave } from '@/lib/note-utils'
import type { MelodyItem } from '@/types'
import { durationInWords } from '../duration-words'
import type { Miss, MissSide } from './legend-lane'

/** Under the title: how long the Legend has left. */
export function closesLine(endsAt: string, nowMs: number): string {
  const left = Date.parse(endsAt) - nowMs
  if (!Number.isFinite(left)) return ''
  // The worker counts takes for two days past the close.
  if (left <= 0) return 'Closing: takes still count for a little longer'
  return `Ends in ${durationInWords(left)}`
}

/** How long a Legend still counts takes past its close (the worker's). */
export const LEGEND_GRACE_MS = 2 * 86_400_000

/**
 * The close in a row's or a card's few words: "Ends in 3 days", "Closing"
 * in the two days' grace, or null once even the grace has gone (a Legend
 * the phone kept while it could not read the next) or the close is unread.
 */
export function closesShortLine(endsAt: string, nowMs: number): string | null {
  const left = Date.parse(endsAt) - nowMs
  if (!Number.isFinite(left) || left <= -LEGEND_GRACE_MS) return null
  return left <= 0 ? 'Closing' : `Ends in ${durationInWords(left)}`
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

/** The chip over the door's poster: how many notes, from where to where. */
export function notesLine(line: readonly { midi: number }[]): string | null {
  if (line.length === 0) return null
  const midis = line.map((note) => Math.round(note.midi))
  const lo = midiToNoteNameOctave(Math.min(...midis))
  const hi = midiToNoteNameOctave(Math.max(...midis))
  const count = line.length === 1 ? '1 note' : `${line.length} notes`
  return lo === hi ? `${count} · ${lo}` : `${count} · ${lo} to ${hi}`
}

/**
 * Under a take's score, which the big number already says: what the Legend
 * asks for, and whether the take reached it. Practice passes no score.
 */
export function askLine(score: number | null, targetScore: number): string {
  return score !== null && score >= targetScore
    ? `The Legend asks for ${targetScore}%, and you reached it.`
    : `The Legend asks for ${targetScore}%.`
}

/** How many of the line's notes the take lit. */
export function litLine(lit: number, total: number): string {
  return `${lit} of ${total} lit`
}

const LONG: Record<MissSide, string> = {
  flat: 'sung flat',
  sharp: 'sung sharp',
  unsung: 'not sung',
  unsteady: 'unsteady',
}

const SHORT: Record<MissSide, string> = {
  flat: 'flat',
  sharp: 'sharp',
  unsung: 'not sung',
  unsteady: 'unsteady',
}

/**
 * Which notes a take missed, and which way: "E4 missed, sung flat", "E4
 * flat, F4 sharp", "4 missed: E4 flat, F4 sharp and 2 more". Null when
 * every note was lit.
 */
export function missLine(misses: readonly Miss[]): string | null {
  if (misses.length === 0) return null
  const [a, b] = misses
  if (b === undefined) return `${a.label} missed, ${LONG[a.side]}`
  const two = `${a.label} ${SHORT[a.side]}, ${b.label} ${SHORT[b.side]}`
  if (misses.length === 2) return two
  return `${misses.length} missed: ${two} and ${misses.length - 2} more`
}

/** Merc's word on a posted take, by how far it went. */
export function mercLine(tier: WeeklyTier): string {
  if (tier === 'beat-founder') return "The Founder's mark is yours now."
  if (tier === 'completed') return 'That one is on the board.'
  return 'On the board. Every take trains the climb.'
}
