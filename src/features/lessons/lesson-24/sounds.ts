// ============================================================
// Lesson 24 sounds — the drone, the notes set against it, and their schedules
// ============================================================
//
// Every play on the page is the drone, A3 at 220 Hz, with the notes set
// against it (WEB-SPEC, Audio). Each is a straight tone in Merc's "ooh"
// partials with no modulator, bar Step 4's wave, Lesson 22's cold-open
// wave on the top note alone; each sits at the kit's note level; and all of
// a play's voices start in one task, so they share one audio time with
// every partial at phase 0, the drone first (FACTS 44, 69, 72). A play is
// data: its notes, from which the sound's contours (`linesOf`), the chart's
// lines (drone-picture.ts) and the brightness (kit/drone-beats.ts,
// `schedulesOf`) are all worked out, so the drawing and the sound share one
// clock and nothing is analysed from the audio.

import type { Schedule, SlideParts } from '@/features/lessons/kit/drone-beats'
import { slide, steady, waved } from '@/features/lessons/kit/drone-beats'
import { hz } from '@/features/lessons/kit/notes'
import type { Run, RunLine } from '@/features/lessons/kit/run'
import { playLines } from '@/features/lessons/kit/run'
import type { Vibrato } from '@/features/lessons/kit/sound'
import { contourOf } from '@/features/lessons/kit/sound'

/** The drone: A3, the page's do in its examples (FACTS 8). */
export const DRONE_HZ = 220
export const A3 = 57

/** The piano's mi and so over A3, C sharp 4 and E4, and the pure ones, 5 to 4 and 3 to 2 (FACTS 25, 29). */
export const PIANO = { mi: hz(61), so: hz(64) } as const
export const PURE = { mi: 275, so: 330 } as const

/** Which tuning Step 2's switch gives mi and so. */
export type Tuning = keyof typeof TUNED
const TUNED = { piano: PIANO, pure: PURE } as const

/** Lesson 22's cold-open wave, six swings a second at 50 cents either side, grown in over 0.3 s (FACTS 38). */
export const WIDE_WAVE: Vibrato = { rate: 6, extent: 50, growIn: 0.3 }

/** The kit's note level, for the drone and each note set against it (WEB-SPEC, Audio). */
export const NOTE_GAIN = 0.13

/** The cold open's slide: 224 Hz held 1.5 s, an exponential glide to 220 over 6 s, 220 held 2.5 s (FACTS 44). */
export const SLIDE: SlideParts = {
  from: 224,
  to: 220,
  hold: 1.5,
  glide: 6,
  after: 2.5,
}

/** A note set against the drone: a level note, the slide, or a note with Step 4's wave. */
export type PlayNote =
  | { readonly kind: 'level'; readonly hz: number }
  | { readonly kind: 'slide'; readonly parts: SlideParts }
  | { readonly kind: 'wave'; readonly hz: number }

/** A play: its length and the notes set against the drone, which sounds through it. */
export interface Play {
  readonly sec: number
  readonly notes: readonly PlayNote[]
}

/** Every play the cold open and the steps' figure sound. */
export type PlayKey =
  | 'pair'
  | 'slide'
  | '222'
  | '221'
  | '220.5'
  | '220'
  | 'octave'
  | 'fifth'
  | 'third'
  | 'mi'
  | 'so'
  | 'chord'
  | 'mi-piano'
  | 'mi-pure'
  | 'wave'
  | 'straight'

const level = (f: number): PlayNote => ({ kind: 'level', hz: f })

/** A play's notes and length (FACTS 41, 44, 69): mi, so and the chord in the switch's tuning. */
export function playFor(key: PlayKey, tuning: Tuning = 'piano'): Play {
  const t = TUNED[tuning]
  switch (key) {
    case 'pair':
      return { sec: 3, notes: [level(224)] }
    case 'slide':
      return { sec: 10, notes: [{ kind: 'slide', parts: SLIDE }] }
    case '222':
    case '221':
    case '220':
      return { sec: 3, notes: [level(Number(key))] }
    case '220.5':
      return { sec: 4, notes: [level(220.5)] }
    case 'octave':
      return { sec: 3, notes: [level(441)] }
    case 'fifth':
    case 'straight':
      return { sec: 4, notes: [level(PIANO.so)] }
    case 'third':
      return { sec: 4, notes: [level(PIANO.mi)] }
    case 'mi':
      return { sec: 3, notes: [level(t.mi)] }
    case 'so':
      return { sec: 3, notes: [level(t.so)] }
    case 'chord':
      return { sec: 4, notes: [level(t.mi), level(t.so)] }
    case 'mi-piano':
      return { sec: 3, notes: [level(PIANO.mi)] }
    case 'mi-pure':
      return { sec: 3, notes: [level(PURE.mi)] }
    case 'wave':
      return { sec: 4, notes: [{ kind: 'wave', hz: PIANO.so }] }
  }
}

/** Quick check 4's pair, by ear only: A3 with E4 at exactly 330 Hz, a pure fifth, 4.0 s, the same for everyone (FACTS 70, 77). */
export const QUIZ_PURE: Play = { sec: 4, notes: [level(PURE.so)] }

/** A note's frequency at the play's start. */
export const firstHz = (n: PlayNote): number =>
  n.kind === 'slide' ? n.parts.from : n.hz

/** Each voice's schedule, the drone's first: what the chart's brightness reads. */
export function schedulesOf(p: Play): Schedule[] {
  return [
    steady(DRONE_HZ, p.sec),
    ...p.notes.map((n) => {
      if (n.kind === 'slide') return slide(n.parts)
      if (n.kind === 'wave') return waved(n.hz, p.sec, WIDE_WAVE)
      return steady(n.hz, p.sec)
    }),
  ]
}

/** Each voice's contour, the drone's first, all from the play's start: one task, one audio time. */
export function linesOf(p: Play): RunLine[] {
  const held = (f: number): RunLine => ({
    t: 0,
    points: contourOf(f, [{ hold: p.sec }]),
    vibrato: null,
  })
  return [
    held(DRONE_HZ),
    ...p.notes.map((n): RunLine => {
      if (n.kind === 'slide') {
        const s = n.parts
        return {
          t: 0,
          points: contourOf(s.from, [
            { hold: s.hold },
            { glide: s.glide, to: s.to },
            { hold: s.after },
          ]),
          vibrato: null,
        }
      }
      if (n.kind === 'wave') return { ...held(n.hz), vibrato: WIDE_WAVE }
      return held(n.hz)
    }),
  ]
}

/** Starts a play, its voices in Merc's "ooh" at the note level, straight unless a note carries the wave. */
export const startPlay = (p: Play, audible: boolean): Run =>
  playLines(linesOf(p), {
    audible,
    kind: 'merc',
    gain: NOTE_GAIN,
    vibrato: null,
  })
