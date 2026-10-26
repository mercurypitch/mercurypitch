// ============================================================
// Weekly Check-up — then and now, from the voiceprint history
// ============================================================
//
// What moved between a singer's first week of Check-ups and their latest,
// said only where the numbers are real (docs/specs/weekly-check-up.ears.md).
// Every saved voiceprint is a Check-up reading: the same tasks scored by the
// same maths (computeMirrorResult), so two of them compare (REQ-GVC-060).
//
// - No comparison before the data exists: the newest take has to be a week
//   after the oldest.
// - Each side is at most two takes, its first and the next one within the
//   week, and a side reads as the best of its takes per metric. People get
//   better at a task just by knowing it, so a single first take undersells
//   where they started; the latest week gets the same allowance.
// - A range read that is not clean (singer-match.ts `isCleanRange`) is no
//   range at all here. Its accuracy and steadiness still count.
// - A change is named only when it reaches its threshold. Under it the words
//   are neutral, with both values and no arrow, sign or praise word
//   (REQ-GVC-065, REQ-GVC-066). A fall is said as plainly as a rise.
//
// Pure: the history and the practice sessions come in as data, so the Home
// card, the Mirror's panel and the share card all read one answer.

import type { MirrorSummary } from '@/lib/mirror/metrics'
import { isCleanRange } from '@/lib/mirror/singer-match'
import { midiToNoteNameOctave } from '@/lib/note-utils'
import { CHECKUP_INTERVAL_MS, takenAtMs } from './due'

/**
 * How far a reading has to move before the Check-up names the change: the
 * range's span in semitones, accuracy and steadiness in points out of 100.
 *
 * Provisional. There is no data yet on how far one singer's readings move
 * from take to take with nothing changed (guided-voice-check.ears.md has no
 * validated noise floor, and neither does card-renderer.ts's change line),
 * so these are a first guess at "more than the noise". Revisit them once the
 * Check-ups themselves have measured it.
 */
export const CHECKUP_THRESHOLDS = {
  range: 2,
  accuracy: 5,
  steadiness: 5,
} as const

export type CheckupMetric = keyof typeof CHECKUP_THRESHOLDS

/** The metrics in the order every surface lists them. */
export const CHECKUP_METRICS: readonly CheckupMetric[] = [
  'range',
  'accuracy',
  'steadiness',
]

/** A saved voiceprint, as far as the Check-up reads one. */
export interface CheckupTake {
  takenAt: string
  summary: MirrorSummary
}

export interface CheckupRange {
  lowMidi: number
  highMidi: number
  semitones: number
}

/** One side's reading: the best of its takes, per metric. */
export interface CheckupReading {
  range: CheckupRange | null
  accuracy: number | null
  steadiness: number | null
}

export interface CheckupSide<
  T extends CheckupTake = CheckupTake,
> extends CheckupReading {
  /** One or two takes, oldest first. */
  takes: readonly T[]
}

export interface CheckupChange {
  metric: CheckupMetric
  then: number
  now: number
  /** Now minus then: the span's semitones, or points. */
  delta: number
  /** Whether the change reaches its threshold, and so may be named. */
  named: boolean
}

export interface ThenAndNow<T extends CheckupTake = CheckupTake> {
  then: CheckupSide<T>
  now: CheckupSide<T>
  /** Null for a metric one side has no reading of. */
  changes: Record<CheckupMetric, CheckupChange | null>
  /** From Then's last take to Now's first, epoch milliseconds: the practice
   *  that counts as in between. */
  between: { from: number; to: number }
}

interface Dated<T> {
  take: T
  ms: number
}

function chronological<T extends CheckupTake>(
  history: readonly T[],
): Dated<T>[] {
  const dated: Dated<T>[] = []
  for (const take of history) {
    const ms = takenAtMs(take)
    if (ms !== null) dated.push({ take, ms })
  }
  return dated.sort((a, b) => a.ms - b.ms)
}

/** `later` was sung within the week after `earlier`. */
function withinAWeek<T>(earlier: Dated<T>, later: Dated<T>): boolean {
  return later.ms - earlier.ms < CHECKUP_INTERVAL_MS
}

/** The take's range when its read is clean, and null otherwise. */
export function cleanRangeOf(summary: MirrorSummary): CheckupRange | null {
  const { lowMidi, highMidi } = summary
  if (lowMidi === null || highMidi === null) return null
  if (!isCleanRange({ lowMidi, highMidi })) return null
  return { lowMidi, highMidi, semitones: highMidi - lowMidi }
}

function widestCleanRange(takes: readonly CheckupTake[]): CheckupRange | null {
  let widest: CheckupRange | null = null
  for (const take of takes) {
    const range = cleanRangeOf(take.summary)
    if (
      range !== null &&
      (widest === null || range.semitones >= widest.semitones)
    )
      widest = range
  }
  return widest
}

function highest(values: ReadonlyArray<number | null>): number | null {
  let best: number | null = null
  for (const value of values) {
    if (value === null || !Number.isFinite(value)) continue
    if (best === null || value > best) best = value
  }
  return best
}

/** The best-of-two rule: each metric's best across the side's takes. */
export function bestOf(takes: readonly CheckupTake[]): CheckupReading {
  return {
    range: widestCleanRange(takes),
    accuracy: highest(takes.map((take) => take.summary.accuracy)),
    steadiness: highest(takes.map((take) => take.summary.steadiness)),
  }
}

function sideOf<T extends CheckupTake>(
  dated: readonly Dated<T>[],
): CheckupSide<T> {
  const takes = dated.map((entry) => entry.take)
  return { takes, ...bestOf(takes) }
}

function changeOf(
  metric: CheckupMetric,
  then: number | null,
  now: number | null,
): CheckupChange | null {
  if (then === null || now === null) return null
  const delta = now - then
  return {
    metric,
    then,
    now,
    delta,
    named: Math.abs(delta) >= CHECKUP_THRESHOLDS[metric],
  }
}

/**
 * Then and now, or null when the history does not yet hold a week. Then is
 * the oldest take and the next one within a week of it; Now is the newest
 * take and the one before it, when that one is within a week of it and not
 * already Then's. Takes in between are not read.
 */
export function thenAndNow<T extends CheckupTake>(
  history: readonly T[],
): ThenAndNow<T> | null {
  const dated = chronological(history)
  const last = dated.length - 1
  if (last < 1 || dated[last].ms - dated[0].ms < CHECKUP_INTERVAL_MS)
    return null

  const thenTakes = [dated[0]]
  if (withinAWeek(dated[0], dated[1])) thenTakes.push(dated[1])
  const nowTakes = [dated[last]]
  const before = dated[last - 1]
  if (!thenTakes.includes(before) && withinAWeek(before, dated[last]))
    nowTakes.unshift(before)

  const then = sideOf(thenTakes)
  const now = sideOf(nowTakes)
  return {
    then,
    now,
    changes: {
      range: changeOf(
        'range',
        then.range?.semitones ?? null,
        now.range?.semitones ?? null,
      ),
      accuracy: changeOf('accuracy', then.accuracy, now.accuracy),
      steadiness: changeOf('steadiness', then.steadiness, now.steadiness),
    },
    between: {
      from: thenTakes[thenTakes.length - 1].ms,
      to: nowTakes[0].ms,
    },
  }
}

// ── Words ────────────────────────────────────────────────────────

/** What a change under its threshold is called, whichever way it went. */
export const ABOUT_THE_SAME = 'About the same'

/**
 * A change in words: "3 semitones wider", "accuracy up 9", "steadiness down
 * 6"; `short` drops the metric's name ("Up 9") where a heading already says
 * it. Under the threshold it is "About the same", whichever way it moved.
 */
export function changeWords(
  change: CheckupChange,
  options: { short?: boolean } = {},
): string {
  if (!change.named) return ABOUT_THE_SAME
  const size = Math.abs(change.delta)
  if (change.metric === 'range') {
    const unit = size === 1 ? 'semitone' : 'semitones'
    return `${size} ${unit} ${change.delta > 0 ? 'wider' : 'narrower'}`
  }
  const way = change.delta > 0 ? 'up' : 'down'
  return options.short === true
    ? `${way === 'up' ? 'Up' : 'Down'} ${size}`
    : `${change.metric} ${way} ${size}`
}

/** "G2 to C4"; the card's tighter "G2–C4" with `joiner`. */
export function rangeNotes(range: CheckupRange, joiner = ' to '): string {
  return `${midiToNoteNameOctave(range.lowMidi)}${joiner}${midiToNoteNameOctave(range.highMidi)}`
}

/** Said when the history is this browser's rather than an account's:
 *  several people can sing on one browser (REQ-VPR-007). */
export const THIS_BROWSER_NOTE =
  "These readings are this browser's. Anyone who sings on it adds to them."

/** The note a view carries about whose readings these are: none for an
 *  account's history, which is one singer's. */
export function historyNote(signedIn: boolean): string | null {
  return signedIn ? null : THIS_BROWSER_NOTE
}

/** "19 Oct", with the year when it is not this one. */
export function takeDay(ms: number, now: number): string {
  const sameYear = new Date(ms).getFullYear() === new Date(now).getFullYear()
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  }).format(ms)
}

/** A side's dates: "5 Oct and 9 Oct", or one day. */
export function sideDays(side: CheckupSide, now: number): string {
  return side.takes
    .map((take) => takenAtMs(take))
    .filter((ms): ms is number => ms !== null)
    .map((ms) => takeDay(ms, now))
    .join(' and ')
}

/** From Then's first take to Now's last, for the card: "5 Oct – 19 Oct 2026". */
export function periodLine(comparison: ThenAndNow): string {
  const first = takenAtMs(comparison.then.takes[0]) ?? 0
  const last =
    takenAtMs(comparison.now.takes[comparison.now.takes.length - 1]) ?? first
  const format = (ms: number, withYear: boolean): string =>
    new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      ...(withYear ? { year: 'numeric' } : {}),
    }).format(ms)
  const sameYear =
    new Date(first).getFullYear() === new Date(last).getFullYear()
  return `${format(first, !sameYear)} – ${format(last, true)}`
}

// ── Practice in between ──────────────────────────────────────────

/** A saved practice session, as far as the count reads one. */
export interface PracticeSession {
  id?: string
  endedAt?: string | null
  startedAt?: string | null
  createdAt?: string | null
}

/** When a session happened: its end, else its start, else when it was saved
 *  (the order Progress reads them in). */
function sessionMs(session: PracticeSession): number | null {
  for (const at of [session.endedAt, session.startedAt, session.createdAt]) {
    if (at === null || at === undefined || at === '') continue
    const ms = Date.parse(at)
    if (Number.isFinite(ms)) return ms
  }
  return null
}

/** Sessions saved after Then's last take and before Now's first, each once. */
export function practiceBetween(
  sessions: readonly PracticeSession[],
  between: ThenAndNow['between'],
): number {
  const seen = new Set<string>()
  let count = 0
  for (const session of sessions) {
    if (session.id !== undefined) {
      if (seen.has(session.id)) continue
      seen.add(session.id)
    }
    const ms = sessionMs(session)
    if (ms !== null && ms > between.from && ms < between.to) count += 1
  }
  return count
}

/** "9 practice sessions in between", or nothing below one. */
export function practiceLine(count: number): string | null {
  if (count < 1) return null
  return `${count} practice ${count === 1 ? 'session' : 'sessions'} in between`
}

// ── The share card's facts ───────────────────────────────────────

export interface CheckupFact {
  value: string
  label: string
}

function readingText(
  metric: CheckupMetric,
  side: CheckupSide,
  value: number,
): string {
  return metric === 'range' && side.range !== null
    ? rangeNotes(side.range, '–')
    : String(value)
}

/** A change that reached its threshold: both measured values, and its words. */
function changeFact(
  change: CheckupChange,
  comparison: ThenAndNow,
): CheckupFact {
  const then = readingText(change.metric, comparison.then, change.then)
  const now = readingText(change.metric, comparison.now, change.now)
  return { value: `${then} → ${now}`, label: changeWords(change) }
}

/** Now's own reading of a metric, with no change claimed; none unmeasured. */
function nowFact(metric: CheckupMetric, now: CheckupSide): CheckupFact | null {
  const label = `${metric} now`
  if (metric === 'range') {
    return now.range === null
      ? null
      : { value: rangeNotes(now.range, '–'), label }
  }
  const value = now[metric]
  return value === null ? null : { value: String(value), label }
}

/**
 * What the then-and-now card prints, at most three: the changes that reached
 * their threshold, then the practice in between, then Now's own readings of
 * the metrics that did not move that far. Only measured values. A change under
 * its threshold is never on the card, not even as "about the same": a card is
 * read away from the panel's two columns, and inside the noise there is no
 * result to share (REQ-GVC-065, 066).
 */
export function thenAndNowFacts(
  comparison: ThenAndNow,
  practice: number,
): CheckupFact[] {
  const changes: CheckupFact[] = []
  const readings: CheckupFact[] = []
  for (const metric of CHECKUP_METRICS) {
    const change = comparison.changes[metric]
    if (change !== null && change.named) {
      changes.push(changeFact(change, comparison))
      continue
    }
    const reading = nowFact(metric, comparison.now)
    if (reading !== null) readings.push(reading)
  }
  const practiceFact: CheckupFact[] =
    practice >= 1
      ? [
          {
            value: String(practice),
            label: `practice ${practice === 1 ? 'session' : 'sessions'} in between`,
          },
        ]
      : []
  return [...changes, ...practiceFact, ...readings].slice(0, 3)
}
