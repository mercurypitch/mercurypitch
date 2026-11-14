// ============================================================
// Take part — the count-in before a take in time, and the other part under it
// ============================================================
//
// Two sounds a take sung in time has round it (Lesson 26 WEB-SPEC, Audio;
// Lesson 28 WEB-SPEC, Audio, A part under a take): the count-in, one bar
// of the woodblock on the beat clock, beat 1 higher, each click told as it
// is heard; and the other part, one voice along its contour
// (kit/part-contour.ts), built before the take opens and booked on the
// audio clock to start on bar 1's first beat, below Merc's level so the
// singer hears their own voice, the one sound a take keeps (kit/sound.ts
// `Sound.hush`): all of it, or only its first seconds, the quiet check's
// 2.0 s. A part may breathe where the learner breathes: its level falls to
// a quarter for the last half beat of each note a breath follows, so it
// leaves the learner room there. Lesson 26 moved both here from its page,
// at its own tempo, so Lesson 28 takes them at 72 beats a minute.

import type { Run as ClockRun, Spot } from './beat-clock'
import { bars, BeatClock } from './beat-clock'
import type { PartNote } from './part-contour'
import { partContour } from './part-contour'
import type { Voice as Tone } from './sound'
import { contourVoice } from './sound'
import { bookWood } from './woodblock'

/** The other part's level under a take and in the sing-along: under Merc's model, so the singer hears their own voice (the lab sets it; Lesson 26 WEB-SPEC, Audio, Levels). */
export const PART_GAIN = 0.1
/** The woodblock's level, as the rhythm lessons click. */
export const WOOD_GAIN = 0.1
/** Seconds of quiet between the model and the count-in. */
export const QUIET_GAP_SEC = 0.4
/** Seconds of the other part the quiet check plays. */
export const CHECK_SEC = 2

/** A part sung under a take: each note's MIDI note and its length in beats, at `bpm`. */
export interface TakePart {
  readonly midis: readonly number[]
  readonly beats: readonly number[]
  readonly bpm: number
  /** The notes a breath follows, by index: each falls to a quarter for its last half beat. */
  readonly breaths?: readonly number[]
}

/** A part's whole length, seconds. */
export const partSeconds = (p: TakePart): number =>
  (p.beats.reduce((a, b) => a + b, 0) * 60) / p.bpm

/** One click of the count-in: beat 1 higher. */
export interface Click {
  readonly high: boolean
}

export interface CountIn {
  readonly bpm: number
  /** Its clicks, one a beat: a bar of 4/4 is four. */
  readonly beats: number
  readonly audible: boolean
  /** Hears each click as it sounds, its beat from 0. */
  readonly onClick: (beat: number) => void
  readonly onFrame: (spot: Spot) => void
}

/** The count-in: one bar of clicks, one a beat at `bpm`, beat 1 higher, each told as it is heard. */
export const startCountIn = (c: CountIn): ClockRun =>
  BeatClock.start<Click>({
    bar: bars([
      {
        beats: c.beats,
        hits: Array.from({ length: c.beats }, (_v, beat) => ({
          beat,
          data: { high: beat === 0 },
        })),
      },
    ]),
    bpm: () => c.bpm,
    audible: c.audible,
    book: (k, when, bus) => {
      bookWood(bus, when, k.high, WOOD_GAIN)
    },
    onBeat: (spot) => {
      c.onClick(spot.beat)
    },
    onFrame: c.onFrame,
  })

/**
 * A part's notes as its contour takes them: all of it, or only its first
 * `sec` seconds; a breath on each note it follows that is sung whole.
 */
export function partNotes(p: TakePart, sec = partSeconds(p)): PartNote[] {
  const beat = 60 / p.bpm
  const breaths = new Set(p.breaths ?? [])
  const notes: PartNote[] = []
  let left = sec
  p.midis.forEach((midi, i) => {
    const whole = (p.beats[i] ?? 0) * beat
    const len = Math.min(whole, left)
    left -= len
    if (len <= 1e-6) return
    const breath = breaths.has(i) && len >= whole - 1e-6 ? beat / 2 : 0
    notes.push(breath > 0 ? { midi, sec: len, breath } : { midi, sec: len })
  })
  return notes
}

/**
 * The other part as one voice, booked `at` seconds from now on the audio
 * clock: all of it, or only its first `sec` seconds (the quiet check's 2.0
 * s). Null while sound cannot play.
 */
export function bookPart(p: TakePart, at: number, sec?: number): Tone | null {
  return contourVoice(partContour(partNotes(p, sec)), {
    kind: 'merc',
    gain: PART_GAIN,
    at: Math.max(0, at),
  })
}
