// ============================================================
// The native Ear Report's words and its maps' axes (MercReport.tsx,
// docs/plans/ear-lab-native-look.md, "The Ear Report"): Merc's line from
// the numbers, a count said in words, the Index's caption, and which of
// a wide bank's items a map draws.
//
// A mix-up is said as a count, never as a share of tries: the tries are
// counted from tapped answers only, so a mix-up sung into the mic would
// read as a larger share than it is.
// ============================================================

import type { ConfusionMatrix, TopConfusion } from '@/lib/ear/confusion-report'
import type { CalibrationRunEntry } from '@/stores/ear-lab-store'
import { dateLabel } from '../instruments'
import type { ConfusionSection, ReportRange } from '../report-data'

/** "once", "twice", "7 times". */
export function timesWord(count: number): string {
  if (count === 1) return 'once'
  if (count === 2) return 'twice'
  return `${count} times`
}

const NUMBER_WORDS = [
  'no',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
] as const

/** A count as a sentence says it: words to twelve, digits after. */
export function countWord(count: number): string {
  return NUMBER_WORDS[count] ?? String(count)
}

/** A range as the Index's caption says it. */
const RANGE_SAID: Record<ReportRange, string> = {
  '4w': 'four weeks',
  '12w': 'twelve weeks',
  all: 'all',
}

/**
 * The line under the Index's trace: "Three seals in twelve weeks. Only a
 * calibration moves it." `count` is the seals inside the range.
 */
export function sealsCaption(count: number, range: ReportRange): string {
  const seals = count === 1 ? 'seal' : 'seals'
  const counted = countWord(count)
  const said = `${counted.charAt(0).toUpperCase()}${counted.slice(1)} ${seals}`
  const where =
    range === 'all'
      ? count === 0
        ? 'yet'
        : 'so far'
      : count === 0
        ? `in the last ${RANGE_SAID[range]}`
        : `in ${RANGE_SAID[range]}`
  return `${said} ${where}. Only a calibration moves it.`
}

/** Beyond this many items a phone's map would be too fine to read. */
export const MAP_MAX_ITEMS = 8

/**
 * The items a map draws, in the bank's order: all of them for a bank of
 * up to MAP_MAX_ITEMS, else only those with a mix-up either way (as what
 * played or as what was answered), and at least two.
 */
export function mapLabels(matrix: ConfusionMatrix): string[] {
  const { labels, cells } = matrix
  if (labels.length <= MAP_MAX_ITEMS) return [...labels]
  const involved = labels.filter((_, i) =>
    labels.some((__, j) => cells[i][j] > 0 || cells[j][i] > 0),
  )
  if (involved.length >= 2) return involved
  // One item alone has no map: show it with its neighbour in the bank.
  const at = labels.indexOf(involved[0] ?? labels[0])
  const next = at + 1 < labels.length ? at + 1 : at - 1
  return [labels[Math.min(at, next)], labels[Math.max(at, next)]]
}

/** The mix-up that slips most, across the drills, by its count. */
export interface WorstMixUp {
  readonly section: ConfusionSection
  readonly confusion: TopConfusion
}

export function worstMixUp(
  tops: readonly { section: ConfusionSection; top: readonly TopConfusion[] }[],
): WorstMixUp | null {
  let worst: WorstMixUp | null = null
  for (const { section, top } of tops) {
    const first = top[0]
    if (first === undefined) continue
    if (worst === null || first.count > worst.confusion.count) {
      worst = { section, confusion: first }
    }
  }
  return worst
}

/**
 * Merc's line at the top of the report: how the Index moved since the
 * seal before, and the mix-up that slips most, from the numbers alone.
 * `seals` are the calibrations, newest first.
 */
export function reportLine(
  seals: readonly CalibrationRunEntry[],
  worst: WorstMixUp | null,
): string {
  const [latest, previous] = seals
  const slips =
    worst === null
      ? null
      : `${worst.section.spoken(worst.confusion.expected)} slips to ${worst.section.spoken(
          worst.confusion.answered,
        )} the most.`
  if (latest === undefined) {
    return slips === null
      ? 'Nothing sealed yet. One calibration and this page starts to draw.'
      : `Nothing sealed yet. ${slips}`
  }
  let moved: string
  if (previous === undefined) {
    moved = `Sealed at ${latest.index}.`
  } else {
    const delta = latest.index - previous.index
    const since = dateLabel(previous.at)
    moved =
      delta > 0
        ? `Up ${delta} since ${since}.`
        : delta < 0
          ? `Down ${-delta} since ${since}.`
          : `Level with ${since}.`
  }
  return slips === null ? `${moved} No mix-ups so far.` : `${moved} ${slips}`
}
