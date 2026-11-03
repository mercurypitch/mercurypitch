// ============================================================
// TV stage lane judge — the singer's pitch, judged as the ribbon judges it
// ============================================================
//
// Each of the singer's readings is held against the note sounding at its
// moment, as the phone's ribbon holds the live pitch against the note under
// its now marker (stem-mixer/zen-pitch-ribbon.ts, judgeSinger): octave
// agnostic, within 50 cents is on the note. On the note is a hit, past it
// is off, and singing with no note sounding is free, never judged: red
// means wrong, never resting. Restated here because a library module
// cannot reach into a feature; lane-judge.test.ts holds the two to the same
// answers.
//
// The trail is drawn where it is judged: a reading against a note is moved
// into that note's octave, so a singer an octave from the record rides the
// note they are matched to. A free reading goes to the octave nearest the
// middle of the band, where the ribbon would clamp it to an edge.
//
// Tests: src/lib/tv-stage/lane-judge.test.ts.

import type { LaneBand, SortedNotes } from './lane-band'
import { noteAt } from './lane-band'
import type { TvStageNote, TvStageReading } from './protocol'

/** The ribbon's tolerance, and the score's: within it is on the note. */
export const JUDGE_TOLERANCE_CENTS = 50

/** Readings further apart than this, in seconds, are not one stroke. */
const TRAIL_GAP_SEC = 0.15

/** How a reading went: on the note, off it, or sung with no note sounding. */
export type Verdict = 'hit' | 'off' | 'free'

/** A reading as the trail draws it: when, at what height, and how it went. */
export interface TrailPoint {
  readonly time: number
  /** The MIDI number it is drawn at: in the octave it was judged in. */
  readonly midi: number
  readonly verdict: Verdict
  /** The note it was judged against, or null for a free one. */
  readonly note: TvStageNote | null
}

/** Cents folded into one octave, -600 to 600: the score's fold. */
export function foldCents(cents: number): number {
  const wrapped = ((cents % 1200) + 1200) % 1200
  return wrapped > 600 ? wrapped - 1200 : wrapped
}

/** One reading, held against the note sounding then. */
export function judgeReading(
  midi: number,
  note: TvStageNote | null,
): { readonly verdict: Verdict; readonly midi: number } {
  if (note === null) return { verdict: 'free', midi }
  const cents = foldCents((midi - note.midi) * 100)
  return {
    verdict: Math.abs(cents) <= JUDGE_TOLERANCE_CENTS ? 'hit' : 'off',
    midi: note.midi + cents / 100,
  }
}

/** `midi` moved by whole octaves to lie nearest `centre`. */
export function nearestOctave(midi: number, centre: number): number {
  return midi + 12 * Math.round((centre - midi) / 12)
}

/**
 * The singer's readings from `from` up to `position`, judged and placed (see
 * the header), oldest first.
 */
export function trailPoints(
  sorted: SortedNotes,
  trail: readonly TvStageReading[],
  span: { readonly from: number; readonly position: number },
  band: LaneBand,
): TrailPoint[] {
  const centre = (band.low + band.high) / 2
  const points: TrailPoint[] = []
  for (const [time, midi] of trail) {
    if (time < span.from || time > span.position) continue
    const note = noteAt(sorted, time)
    const judged = judgeReading(midi, note)
    points.push({
      time,
      midi: note === null ? nearestOctave(midi, centre) : judged.midi,
      verdict: judged.verdict,
      note,
    })
  }
  return points
}

/** Whether two points in a row are one stroke: close in time and in height. */
export function joined(previous: TrailPoint, point: TrailPoint): boolean {
  return (
    point.time - previous.time <= TRAIL_GAP_SEC &&
    Math.abs(point.midi - previous.midi) <= 6
  )
}

/** A stroke shorter than this, in seconds, is a flicker of the detector. */
const STROKE_LEAST_SEC = 0.09

/**
 * The points cut into strokes where the singer stopped or leapt. A flicker
 * (a stroke shorter than `STROKE_LEAST_SEC`, which the detector makes of a
 * breath or a consonant) is dropped, unless it is the newest: that one may
 * be a note just begun.
 */
export function strokesOf(points: readonly TrailPoint[]): TrailPoint[][] {
  const strokes: TrailPoint[][] = []
  let stroke: TrailPoint[] = []
  const keep = (done: TrailPoint[]): void => {
    if (done.at(-1)!.time - done[0].time >= STROKE_LEAST_SEC) strokes.push(done)
  }
  for (const point of points) {
    const previous = stroke.at(-1)
    if (previous !== undefined && !joined(previous, point)) {
      keep(stroke)
      stroke = []
    }
    stroke.push(point)
  }
  if (stroke.length > 0) strokes.push(stroke)
  return strokes
}

/**
 * Where `note` was sung on pitch, as spans of song time: runs of hits
 * against it, a reading's worth either side, cut at the note's ends and at
 * `position`.
 */
export function litSpans(
  note: TvStageNote,
  points: readonly TrailPoint[],
  position: number,
): Array<readonly [number, number]> {
  const spans: Array<[number, number]> = []
  const reach = TRAIL_GAP_SEC / 3
  for (const point of points) {
    if (point.note !== note || point.verdict !== 'hit') continue
    const from = Math.max(note.t0, point.time - reach)
    const to = Math.min(note.t1, position, point.time + reach)
    const last = spans.at(-1)
    if (last !== undefined && from <= last[1] + reach)
      last[1] = Math.max(last[1], to)
    else if (to > from) spans.push([from, to])
  }
  return spans
}
