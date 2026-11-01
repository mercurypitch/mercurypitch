// ============================================================
// Why a song of the singer's own sits out: counted, and said
// ============================================================
//
// A read that finds fewer entries than a song needs to play
// (OWN_SONG_MIN_ENTRIES) keeps why, counted (`leftOutOf`), and the "i" on
// its row in the Songs sheet says it in plain words (`leftOutWords`): how
// many lines were looked at, and what kept each from being a place to come
// in. The counts are the read's own reasons (entry-rules.ts, `judgeLine`),
// the ones its log tells.

import { OWN_SONG_MIN_ENTRIES } from './first-note-rules'

/** Why a line that was read is not an entry. */
export type LeftKind = 'unsteady' | 'late' | 'disagree' | 'offKey' | 'farOff'

/** Why a song gave too few entries, counted. */
export interface LeftOut {
  /** The lines looked at. */
  readonly lines: number
  /** Lines with too little breath before them to come in after. */
  readonly breathless: number
  /** Lines read that are not entries, by why. */
  readonly left: Readonly<Partial<Record<LeftKind, number>>>
}

const KINDS: ReadonlyArray<readonly [RegExp, LeftKind]> = [
  [/no steady note/u, 'unsteady'],
  [/settles/u, 'late'],
  [/notes /u, 'disagree'],
  [/cents off/u, 'offKey'],
  [/far from/u, 'farOff'],
]

/** The kind of a read's reason for leaving a line ("31.20 no steady note"); null for another. */
export function leftKind(why: string): LeftKind | null {
  return KINDS.find(([match]) => match.test(why))?.[1] ?? null
}

/** A read's reasons counted (own-song-read.ts, OwnSongRead). */
export function leftOutOf(read: {
  readonly lines?: number
  readonly breathless?: number
  readonly dropped: readonly string[]
}): LeftOut {
  const left: Partial<Record<LeftKind, number>> = {}
  for (const why of read.dropped) {
    const kind = leftKind(why)
    if (kind !== null) left[kind] = (left[kind] ?? 0) + 1
  }
  return { lines: read.lines ?? 0, breathless: read.breathless ?? 0, left }
}

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0

/** Is `value` a LeftOut, as kept on the phone? */
export function isLeftOut(value: unknown): value is LeftOut {
  if (typeof value !== 'object' || value === null) return false
  const out = value as Record<string, unknown>
  return (
    isCount(out.lines) &&
    isCount(out.breathless) &&
    typeof out.left === 'object' &&
    out.left !== null &&
    Object.values(out.left).every(isCount)
  )
}

/** `count` and the words for one or for more: "1 line", "3 lines". */
function counted(count: number, one: string, more: string): string {
  return `${count} ${count === 1 ? one : more}`
}

/** What each kind of line left says, after its count. */
const LEFT_WORDS: Readonly<Record<LeftKind, readonly [string, string]>> = {
  unsteady: [
    'starts with no clear note: the voice slides, rasps or wavers into it.',
    'start with no clear note: the voice slides, rasps or wavers into it.',
  ],
  late: [
    'settles on its note too late after the voice comes in.',
    'settle on their note too late after the voice comes in.',
  ],
  disagree: [
    'has a first note we could not pin down: two ways of hearing it disagree.',
    'have a first note we could not pin down: two ways of hearing it disagree.',
  ],
  offKey: ['is sung a little out of tune.', 'are sung a little out of tune.'],
  farOff: [
    "starts far from the rest of the song's notes.",
    "start far from the rest of the song's notes.",
  ],
}

const LEFT_ORDER: readonly LeftKind[] = [
  'unsteady',
  'late',
  'disagree',
  'offKey',
  'farOff',
]

/** Why a song sits out, as the Songs sheet's "i" says it. */
export interface LeftOutWords {
  /** What was found, against what a song needs. */
  readonly head: string
  /** What kept the other lines out, one a line, the most common first. */
  readonly reasons: readonly string[]
  /** What makes a song work. */
  readonly tip: string
}

/** Why a song that found `entries` sits out, in plain words. */
export function leftOutWords(why: LeftOut, entries: number): LeftOutWords {
  const tip =
    'Songs with a pause before their lines, and a clear note to start each one, work best.'
  if (why.lines === 0) {
    return { head: 'We found no notes in its voice to read.', reasons: [], tip }
  }
  const found =
    entries === 0
      ? 'none is a clear place to come in'
      : `only ${entries} ${entries === 1 ? 'is' : 'are'} a clear place to come in`
  const head = `Of its ${counted(why.lines, 'line', 'lines')}, ${found}. A song needs at least ${OWN_SONG_MIN_ENTRIES}.`
  const reasons: Array<{ count: number; words: string }> = []
  if (why.breathless > 0) {
    reasons.push({
      count: why.breathless,
      words: `${why.breathless} ${why.breathless === 1 ? 'comes' : 'come'} straight after the line before, with no pause where the band plays alone.`,
    })
  }
  for (const kind of LEFT_ORDER) {
    const count = why.left[kind] ?? 0
    if (count === 0) continue
    const [one, more] = LEFT_WORDS[kind]
    reasons.push({ count, words: `${count} ${count === 1 ? one : more}` })
  }
  return {
    head,
    // The most common first; a tie keeps the order above.
    reasons: reasons
      .map((reason, i) => ({ ...reason, i }))
      .sort((a, b) => b.count - a.count || a.i - b.i)
      .map((reason) => reason.words),
    tip,
  }
}
