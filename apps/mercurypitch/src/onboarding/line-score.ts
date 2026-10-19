// ============================================================
// The sung line's score: the Karaoke engine's verdict, note by note
// ============================================================
//
// The Karaoke room scores a singer with createPitchCompareEngine
// (src/lib/pitch-compare-engine.ts): fed the reference's pitch and the
// mic's, it judges a note once the reference has held it 130 ms, within 50
// cents, octave-agnostic, and calls the note hit when half of its judged
// frames are in tune. The line is scored by that engine, on its defaults.
//
// ON THE LINE'S OWN CLOCK. The room's engine is fed the room's frames. Here
// the line is walked every STEP_SEC from its first onset to its last note's
// end, each step reading the voice from the newest frame at or before it
// (held up to HOLD_SEC). Every note gets the same number of steps whether
// the screen draws sixty frames a second or twenty, so the engine sees each
// of the ten as a note. The last NOTE_GAP_SEC of each note is no note: the
// engine joins a reference that moves a semitone or less, and the line
// steps a semitone once.
//
// A FIRST TRY IS LATE. With nothing playing to sing over, a singer answers
// the cursor a little after it. The line is scored at each lag from 0 to
// MAX_LAG_SEC, and the lag that hears the most notes stands: the score is
// about the pitch, not the reflex.
//
// WHAT MERC SAYS OF IT (lineVerdict, onboarding-copy.ts) is read from the
// notes missed (lineFacts): sung flat, sung sharp, a mix, or not sung, and
// whether by a hair (within a semitone).

import { createPitchCompareEngine } from '@/lib/pitch-compare-engine'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import { midiFloatToFreq } from '@/lib/pitch-pipeline/log-pitch'
import { heardFrame } from './range-take'
import type { TimedNote } from './sung-line'
import { highNote } from './sung-line'

/** The line is walked this often, s. */
export const STEP_SEC = 0.01
/** A frame stands for the voice this long after it, at most, s. */
export const HOLD_SEC = 0.12
/** The end of each note that is no note, s. */
export const NOTE_GAP_SEC = 0.05
/** The latest a singer's answer is taken to be, s. */
export const MAX_LAG_SEC = 0.4
/** The lags tried, this far apart, s. */
export const LAG_STEP_SEC = 0.05
/** Within this, cents, a note missed was missed by a hair. */
export const HAIR_CENTS = 100

/** One note's verdict. */
export interface NoteVerdict {
  readonly hit: boolean
  /** The steps the engine judged: the voice was on, the note settled. */
  readonly judged: number
  /** The middle of its judged offsets, cents, octave folded; null unjudged. */
  readonly cents: number | null
}

export interface LineScore {
  /** Notes hit, as the engine counts them. */
  readonly hit: number
  /** Notes the engine judged the line by: all ten. */
  readonly total: number
  readonly notes: readonly NoteVerdict[]
  /** The lag the voice was read at, s. */
  readonly lag: number
}

/** The newest frame at or before `t`, held up to HOLD_SEC: its pitch, else 0. */
function voiceAt(frames: readonly PitchFrame[], t: number): number {
  let lo = 0
  let hi = frames.length - 1
  let found = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (frames[mid].t <= t) {
      found = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  if (found < 0) return 0
  const frame = frames[found]
  return t - frame.t <= HOLD_SEC && heardFrame(frame) ? frame.f0 : 0
}

function middle(values: readonly number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const half = sorted.length >> 1
  return sorted.length % 2 === 1
    ? sorted[half]
    : (sorted[half - 1] + sorted[half]) / 2
}

interface Reading extends LineScore {
  /** In-tune steps, all notes: the tie-break between two lags. */
  readonly inTune: number
}

/** The line read at one lag: the engine's count and each note's verdict. */
function readAt(
  frames: readonly PitchFrame[],
  notes: readonly TimedNote[],
  lag: number,
): Reading {
  const engine = createPitchCompareEngine()
  const tally = notes.map(() => ({ judged: 0, hits: 0, cents: [] as number[] }))
  const start = notes[0].from
  const end = notes[notes.length - 1].to
  const steps = Math.round((end - start) / STEP_SEC)
  let note = 0
  let inTune = 0
  for (let i = 0; i <= steps; i++) {
    const t = start + i * STEP_SEC
    while (note < notes.length - 1 && t >= notes[note].to) note += 1
    const sounding = t >= notes[note].from && t < notes[note].to - NOTE_GAP_SEC
    const reference = sounding ? midiFloatToFreq(notes[note].midi) : 0
    const point = engine.push(t, reference, voiceAt(frames, t + lag))
    if (point === null || !sounding) continue
    const own = tally[note]
    own.judged += 1
    own.cents.push(point.centsOff)
    if (point.inTolerance) {
      own.hits += 1
      inTune += 1
    }
  }
  const stats = engine.noteStats()
  return {
    hit: stats.notesHit,
    total: stats.notesTotal,
    notes: tally.map((own) => ({
      // The engine's rule (pitch-compare-engine.ts noteHitRatio).
      hit: own.judged > 0 && own.hits / own.judged >= 0.5,
      judged: own.judged,
      cents: middle(own.cents),
    })),
    lag,
    inTune,
  }
}

/**
 * The line's score from the frames of the singer's turn: at the lag that
 * hears the most notes, then the most in-tune steps, then the earliest.
 */
export function scoreLine(
  frames: readonly PitchFrame[],
  notes: readonly TimedNote[],
): LineScore {
  let best = readAt(frames, notes, 0)
  const lags = Math.round(MAX_LAG_SEC / LAG_STEP_SEC)
  for (let k = 1; k <= lags; k++) {
    const reading = readAt(frames, notes, k * LAG_STEP_SEC)
    if (
      reading.hit > best.hit ||
      (reading.hit === best.hit && reading.inTune > best.inTune)
    ) {
      best = reading
    }
  }
  const { hit, total, notes: verdicts, lag } = best
  return { hit, total, notes: verdicts, lag }
}

/** Whether a voice was heard at all while the line was the singer's. */
export function heardInLine(
  frames: readonly PitchFrame[],
  notes: readonly TimedNote[],
): boolean {
  const from = notes[0].from
  const to = notes[notes.length - 1].to + MAX_LAG_SEC
  return frames.some(
    (frame) => frame.t >= from && frame.t <= to && heardFrame(frame),
  )
}

/** How the notes missed went: all flat, all sharp, all unsung, or a mix. */
export type MissTrend = 'flat' | 'sharp' | 'unsung' | 'mixed'

/** What Merc's word on the line is read from. */
export interface LineFacts {
  readonly hit: number
  readonly total: number
  /** Null when every note was hit. */
  readonly trend: MissTrend | null
  /** Every note missed and sung was within HAIR_CENTS. */
  readonly slight: boolean
  /** Sung flat, and the line's two high notes among them. */
  readonly highFlat: boolean
}

/** The facts of a score, for Merc's word on it. */
export function lineFacts(score: LineScore): LineFacts {
  const missed = score.notes
    .map((verdict, index) => ({ ...verdict, index }))
    .filter((verdict) => !verdict.hit)
  const sung = missed.filter((verdict) => verdict.cents !== null)
  const flat = sung.filter((verdict) => (verdict.cents ?? 0) < 0)
  let trend: MissTrend | null = null
  if (missed.length > 0) {
    if (sung.length === 0) trend = 'unsung'
    else if (sung.length < missed.length) trend = 'mixed'
    else if (flat.length === sung.length) trend = 'flat'
    else if (flat.length === 0) trend = 'sharp'
    else trend = 'mixed'
  }
  const highs = score.notes
    .map((_, index) => index)
    .filter((index) => highNote(index))
  return {
    hit: score.hit,
    total: score.total,
    trend,
    slight:
      sung.length > 0 &&
      sung.every((verdict) => Math.abs(verdict.cents ?? 0) <= HAIR_CENTS),
    highFlat:
      trend === 'flat' &&
      highs.every((index) => missed.some((verdict) => verdict.index === index)),
  }
}
