// ============================================================
// Lesson 26 Sing it's sounds — the model, the count-in, the other part, and the listening play
// ============================================================
//
// Every sound of Sing it (WEB-SPEC, Audio; FACTS 79): Merc, or Tavi an
// octave above him for the higher voice, singing the learner's part alone
// on "ooh", 6.0 s at Merc's level, the model before each run; the count-in,
// one bar of the woodblock at 60 BPM, beat 1 higher, on the beat clock; the
// other part, one voice along its contour (kit/part-contour.ts), booked on
// the audio clock to start on bar 1's first beat, below Merc's level so the
// singer hears their own voice, the one sound a take keeps (kit/sound.ts
// `Sound.hush`), and its first 2.0 s alone for the quiet check; and "Just
// listen today"'s play, the tune alone, the part alone, then the two
// together, 1.0 s apart, 20.0 s, every voice at the note level, the two
// parts' notes sharing their onsets.

import type { Run as ClockRun, Spot } from '@/features/lessons/kit/beat-clock'
import { bars, BeatClock } from '@/features/lessons/kit/beat-clock'
import { partContour } from '@/features/lessons/kit/part-contour'
import type { Run, RunNote } from '@/features/lessons/kit/run'
import { playNotes } from '@/features/lessons/kit/run'
import type { Voice as Tone } from '@/features/lessons/kit/sound'
import { contourVoice, MERC_GAIN, NOTE_GAIN, } from '@/features/lessons/kit/sound'
import { bookWood } from '@/features/lessons/kit/woodblock'
import type { Part } from './sing-plan'
import { BEATS, BPM, COUNT_IN, PART_SEC } from './sing-plan'

/** The other part's level under a take and in the sing-along: under Merc's model, so the singer hears their own voice (the lab sets it; WEB-SPEC, Audio, Levels). */
export const PART_GAIN = 0.1
/** The woodblock's level, as the rhythm lessons click. */
export const WOOD_GAIN = 0.1
/** Seconds of quiet between the model and the count-in. */
export const QUIET_GAP_SEC = 0.4
/** Seconds of the other part the quiet check plays: its first two notes. */
export const CHECK_SEC = 2
/** "Just listen today"'s play: each part 6.0 s, 1.0 s apart: the tune, the part, then both (20.0 s). */
export const LISTEN = { gap: 1, sec: PART_SEC } as const
export const LISTEN_SEC = 3 * LISTEN.sec + 2 * LISTEN.gap

/** A part's notes as a run's, from `t0`, a beat a second. */
export function runNotes(midis: readonly number[], t0 = 0): RunNote[] {
  let t = t0
  return midis.map((midi, i) => {
    const dur = (BEATS[i] * 60) / BPM
    const n = { t, midi, dur }
    t += dur
    return n
  })
}

/** The model: the learner's part sung alone on "ooh" at Merc's level, 6.0 s, each note told as it starts. */
export const startModel = (
  midis: readonly number[],
  audible: boolean,
  onNote: (i: number) => void,
): Run =>
  playNotes(runNotes(midis), {
    audible,
    kind: 'merc',
    gain: MERC_GAIN,
    onNote: (_n, i) => {
      onNote(i)
    },
  })

/** One click of the count-in: beat 1 higher. */
export interface Click {
  readonly high: boolean
}

/** The count-in: one bar of four clicks at 60 BPM, beat 1 higher, each told as it is heard. */
export const startCountIn = (
  audible: boolean,
  onClick: (beat: number) => void,
  onFrame: (spot: Spot) => void,
): ClockRun =>
  BeatClock.start<Click>({
    bar: bars([
      {
        beats: COUNT_IN,
        hits: [0, 1, 2, 3].map((beat) => ({
          beat,
          data: { high: beat === 0 },
        })),
      },
    ]),
    bpm: () => BPM,
    audible,
    book: (c, when, bus) => {
      bookWood(bus, when, c.high, WOOD_GAIN)
    },
    onBeat: (spot) => {
      onClick(spot.beat)
    },
    onFrame,
  })

/**
 * The other part as one voice, booked `at` seconds from now on the audio
 * clock: all of it, or only its first `sec` seconds (the quiet check's 2.0
 * s). Null while sound cannot play.
 */
export function bookPart(
  midis: readonly number[],
  at: number,
  sec = PART_SEC,
): Tone | null {
  const notes: { midi: number; sec: number }[] = []
  let left = sec
  midis.forEach((midi, i) => {
    const len = Math.min((BEATS[i] * 60) / BPM, left)
    if (len > 1e-6) notes.push({ midi, sec: len })
    left -= len
  })
  return contourVoice(partContour(notes), {
    kind: 'merc',
    gain: PART_GAIN,
    at: Math.max(0, at),
  })
}

/** "Just listen today"'s notes: the tune alone, the part alone, then the two together, each part's notes in its own list. */
export function listenNotes(tune: Part, part: Part): RunNote[] {
  const step = LISTEN.sec + LISTEN.gap
  return [
    ...runNotes(tune.midis, 0),
    ...runNotes(part.midis, step),
    ...runNotes(tune.midis, 2 * step),
    ...runNotes(part.midis, 2 * step),
  ]
}

/** Starts "Just listen today"'s play in Merc's "ooh", every voice at the note level. */
export const startListen = (
  tune: Part,
  part: Part,
  audible: boolean,
  onNote: (n: RunNote, i: number) => void,
): Run =>
  playNotes(listenNotes(tune, part), {
    audible,
    kind: 'merc',
    gain: NOTE_GAIN,
    onNote,
  })
