// ============================================================
// The voice's pitch, for First note's entry rules: YIN, and the first
// steady note
// ============================================================
//
// The entry rules (entry-rules.ts) ask two things of the vocal stem's
// pitch: what note it reads at a moment (`yinMidi`), and where the voice
// first holds a note near a line (`firstSteady`). Both are here.
//
// A STEADY NOTE held straight is STEADY_SEC of readings within
// STEADY_CENTS of their median. A rock or a metal singer's is seldom held
// straight: their vibrato swings a semitone or so either way, five to seven
// times a second, from the moment the note starts, and its readings never
// sat that close for that long (a vibrato of 60 cents left four of the
// example songs' 22 entries, one of 90 left none). So a note is steady too
// once its pitch, read as a running median over SWING_SEC (about one
// swing), holds within STEADY_CENTS for STEADY_SEC: over a swing, the median
// is the note the vibrato swings round. A running median wants SWING_HEARD
// of its readings to hear a pitch, so a reading YIN misses here and there (a
// rasp, a consonant, a split's artefact) does not break the note either. A
// slide, or a note and the next, do not hold, however the medians run.
//
// The straight reading is tried first, at every reading: it needs a fifth of
// a second where the running median needs a third, so a short first note
// held straight is found where it is. A note found by its running median
// (`swung`) starts where its first steady median sits, the middle of that
// median's span: the span's own start can reach back into the note before,
// a neighbour a semitone off whose swings come within a semitone of this
// one. Its note is the median of every reading the steady medians span,
// two swings of them. A first note sung with a vibrato and too short for
// the medians to hold is not told from the note after it, so a swung note
// must start soon after the voice comes in (entry-rules.ts,
// SWUNG_WITHIN_SEC): the line is left rather than ask for the second note.
//
// Node runs this file as it is, through its type stripping, from the
// script, as it does entry-rules.ts: so it imports nothing, and the types
// both files read the voice by are here (entry-rules.ts passes them on).

/** Work in steps: each yield is a place a reader may let the screen draw. */
export type RuleSteps<T> = Generator<void, T, undefined>

/** Mono samples and their rate. */
export interface Samples {
  readonly samples: Float32Array
  readonly rate: number
}

/** The vocal's loudness, and the levels the voice counts as on and read at. */
export interface VoiceLevel {
  readonly rms: readonly number[]
  readonly hopSec: number
  readonly on: number
  readonly read: number
}

/** The rate the YIN frame below is sized for; the script reads at it. */
export const VOCAL_RATE = 16_000

/** A steady note: this long, s, its pitch inside this much of its median, cents... */
export const STEADY_SEC = 0.2
export const STEADY_CENTS = 40
/** ...as a running median over this, s: about one swing of a vibrato... */
export const SWING_SEC = 0.15
/** ...taken where at least this share of its readings hear a pitch. */
const SWING_HEARD = 0.75

/** YIN's settings: the voice's range, its frame at VOCAL_RATE, its dip threshold. */
const F_MIN = 70
const F_MAX = 1000
const YIN_FRAME = 1024
const YIN_THRESHOLD = 0.15
/** Pitch readings every, s. */
const READ_STEP_SEC = 0.01

/** YIN's difference at each lag up to `maxLag`, over `width` samples from `start`. */
function differences(
  samples: Float32Array,
  start: number,
  width: number,
  maxLag: number,
): Float64Array {
  const diff = new Float64Array(maxLag + 1)
  for (let lag = 1; lag <= maxLag; lag++) {
    let sum = 0
    for (let i = 0; i < width; i++) {
      const d = samples[start + i] - samples[start + i + lag]
      sum += d * d
    }
    diff[lag] = sum
  }
  return diff
}

/** The differences, each over the running mean of those before it. */
function normalised(diff: Float64Array): Float64Array {
  const norm = new Float64Array(diff.length)
  norm[0] = 1
  let running = 0
  for (let lag = 1; lag < diff.length; lag++) {
    running += diff[lag]
    norm[lag] = running > 0 ? (diff[lag] * lag) / running : 1
  }
  return norm
}

/** The first lag that dips under YIN_THRESHOLD, at the dip's floor; -1 for none. */
function firstDip(norm: Float64Array, minLag: number, maxLag: number): number {
  for (let t = minLag; t < maxLag; t++) {
    if (norm[t] < YIN_THRESHOLD) {
      while (t + 1 < maxLag && norm[t + 1] < norm[t]) t++
      return t
    }
  }
  return -1
}

/**
 * One YIN reading at sample `start`, MIDI, or null where no pitch is
 * clear. The frame spans the same time at any rate as YIN_FRAME does at
 * VOCAL_RATE.
 */
export function yinMidi(
  samples: Float32Array,
  start: number,
  rate: number,
): number | null {
  const frame = Math.round((YIN_FRAME * rate) / VOCAL_RATE)
  const maxLag = Math.floor(rate / F_MIN)
  const minLag = Math.floor(rate / F_MAX)
  const width = frame - maxLag
  if (start < 0 || start + frame > samples.length) return null
  const norm = normalised(differences(samples, start, width, maxLag))
  const lag = firstDip(norm, minLag, maxLag)
  if (lag < 1) return null
  const a = norm[lag - 1]
  const b = norm[lag]
  const c = norm[lag + 1]
  const den = a - 2 * b + c
  const shift = den === 0 ? 0 : (0.5 * (a - c)) / den
  return 69 + 12 * Math.log2(rate / (lag + shift) / 440)
}

export function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2
}

interface Reading {
  readonly t: number
  readonly midi: number | null
}

/** A steady note: where it starts and where its last reading ends, s, and its note. */
export interface SteadyNote {
  readonly t: number
  readonly until: number
  readonly midi: number
  /** Found by its running median (a vibrato), not held straight. */
  readonly swung: boolean
}

/** Where the last of `readings` ends, s. */
function endOf(readings: readonly Reading[]): number {
  return readings[readings.length - 1].t + READ_STEP_SEC
}

/** The voice's pitch at `t`, s: none where it is quieter than it is read at. */
function readingAt(vocal: Samples, level: VoiceLevel, t: number): Reading {
  const voiced = (level.rms[Math.floor(t / level.hopSec)] ?? 0) >= level.read
  return {
    t,
    midi: voiced
      ? yinMidi(vocal.samples, Math.round(t * vocal.rate), vocal.rate)
      : null,
  }
}

/**
 * The median pitch of readings `from` to `to` (exclusive), or null where
 * fewer than `share` of them hear one.
 */
function heardMedian(
  readings: readonly Reading[],
  from: number,
  to: number,
  share: number,
): number | null {
  const midis: number[] = []
  for (let i = from; i < to; i++) {
    const midi = readings[i].midi
    if (midi !== null) midis.push(midi)
  }
  return midis.length > 0 && midis.length >= (to - from) * share
    ? median(midis)
    : null
}

/** The last `span` readings as a note held straight, or null. */
function heldStraight(
  readings: readonly Reading[],
  span: number,
): SteadyNote | null {
  const first = readings.length - span
  if (first < 0) return null
  const midis: number[] = []
  for (let i = first; i < readings.length; i++) {
    const midi = readings[i].midi
    if (midi === null) return null
    midis.push(midi)
  }
  const centre = median(midis)
  return midis.some((midi) => Math.abs(midi - centre) * 100 > STEADY_CENTS)
    ? null
    : {
        t: readings[first].t,
        until: endOf(readings),
        midi: centre,
        swung: false,
      }
}

/** The note running medians `swings` hold, or null where one is missing or strays. */
function heldNote(swings: readonly (number | null)[]): number | null {
  if (swings.some((swing) => swing === null)) return null
  const centre = median(swings as number[])
  return swings.some(
    (swing) => Math.abs((swing as number) - centre) * 100 > STEADY_CENTS,
  )
    ? null
    : centre
}

/**
 * The note steady running medians found, the first of them the median of
 * readings `first` to `first + swing - 1`: it starts where that median sits,
 * the middle of its span, and is the median of every reading from `first`.
 */
function swungNote(
  readings: readonly Reading[],
  first: number,
  swing: number,
  centre: number,
): SteadyNote {
  return {
    t: readings[first + Math.floor(swing / 2)].t,
    until: endOf(readings),
    midi: heardMedian(readings, first, readings.length, 0) ?? centre,
    swung: true,
  }
}

/**
 * The voice's first steady note from `from` to `to`, s, or null. Read as
 * it goes: a note is judged once its last reading is in, so the first that
 * holds is the first a reading of the whole span would find. A step after
 * each reading.
 */
export function* firstSteady(
  vocal: Samples,
  level: VoiceLevel,
  from: number,
  to: number,
): RuleSteps<SteadyNote | null> {
  const span = Math.round(STEADY_SEC / READ_STEP_SEC)
  const swing = Math.round(SWING_SEC / READ_STEP_SEC)
  const readings: Reading[] = []
  // swings[i]: the median of readings i to i + swing - 1.
  const swings: (number | null)[] = []
  for (let t = from; t < to; t += READ_STEP_SEC) {
    readings.push(readingAt(vocal, level, t))
    yield
    const straight = heldStraight(readings, span)
    if (straight !== null) return straight
    if (readings.length < swing) continue
    swings.push(
      heardMedian(
        readings,
        readings.length - swing,
        readings.length,
        SWING_HEARD,
      ),
    )
    if (swings.length < span) continue
    const centre = heldNote(swings.slice(-span))
    if (centre !== null) {
      return swungNote(readings, swings.length - span, swing, centre)
    }
  }
  return null
}
