// ============================================================
// Lesson 6 examples — every sound on the page, at FACTS 63 to 70's timings
// ============================================================
//
// A line plays at 0.5 s a crotchet and 1.0 s a minim (`line-c`, `line-fs`,
// `lines-c`, `swapped`; FACTS 63 to 65); Slow doubles every length. A pair,
// the sound of a gap, an ear-game round or a bare interval, is 0.6 s then
// 0.8 s, 0.15 s apart (FACTS 64, 66 to 69); a missed round plays again at
// 1.5 times the lengths. Sing it's versions are both lines at 0.6 s a
// crotchet and 1.2 s a minim, 9.6 s (FACTS 58, 70). Times are seconds from
// the press, every note timed from that one press so nothing drifts, and
// each note is its own voice, so "Twin-kle"'s repeated notes are heard as
// two (WEB-SPEC, Audio). The toys and games play the kit's soft tone;
// Merc's singing is Merc's "ooh".

import { hz } from '@/features/lessons/kit/notes'
import type { VoiceOptions } from '@/features/lessons/kit/sound'
import { Sound } from '@/features/lessons/kit/sound'
import type { MelodyNote } from './melody'
import { AULD, C4, FS4, lineMidis, swapSizes, TWINKLE } from './melody'

/** One note of an example: its MIDI number, its onset and its length, seconds. */
export interface NoteEvent {
  readonly midi: number
  readonly at: number
  readonly dur: number
}

/** A crotchet in the toys and the cold open (FACTS 63). */
export const BEAT_SEC = 0.5
/** A crotchet in Sing it's versions (FACTS 58). */
export const SING_BEAT_SEC = 0.6
/** A pair's two notes and the gap between them (FACTS 64). */
export const PAIR = { first: 0.6, second: 0.8, gap: 0.15 } as const
/** How much slower a missed round plays again (WEB-SPEC, Toys 4). */
export const MISS_SLOWER = 1.5

/** Notes with their lengths in crotchets, played in turn at `beat` seconds a crotchet. */
export function timed(
  notes: readonly { readonly midi: number; readonly beats: number }[],
  beat = BEAT_SEC,
  from = 0,
): NoteEvent[] {
  let at = from
  return notes.map((note) => {
    const e = { midi: note.midi, at, dur: note.beats * beat }
    at += e.dur
    return e
  })
}

/** A line of the tune from `start`, as notes with lengths. */
export const lineNotes = (
  line: readonly MelodyNote[],
  start: number,
): { midi: number; beats: number }[] =>
  lineMidis(line, start).map((midi, i) => ({ midi, beats: line[i].beats }))

/** The first line from `start` (`line-c` from C4, `line-fs` from F♯4); `slow` 2 doubles it. */
export const firstLine = (start: number, slow = 1): NoteEvent[] =>
  timed(lineNotes(TWINKLE[0], start), BEAT_SEC * slow)

/** Both lines from `start` (`lines-c` from C4), 8.0 s. */
export const bothLines = (start: number, slow = 1): NoteEvent[] =>
  timed(
    TWINKLE.flatMap((line) => lineNotes(line, start)),
    BEAT_SEC * slow,
  )

/** Step 4's swapped version from `start` (`swapped` from C4, FACTS 65). */
export function swappedLine(start: number, slow = 1): NoteEvent[] {
  const notes = lineNotes(TWINKLE[0], start)
  const swapped = swapSizes(notes.map((x) => x.midi))
  return timed(
    notes.map((x, i) => ({ midi: swapped[i], beats: x.beats })),
    BEAT_SEC * slow,
  )
}

/** Two notes one after the other, 0.6 s and 0.8 s, 0.15 s apart, times `slower`. */
export function pair(a: number, b: number, slower = 1): NoteEvent[] {
  return [
    { midi: a, at: 0, dur: PAIR.first * slower },
    {
      midi: b,
      at: (PAIR.first + PAIR.gap) * slower,
      dur: PAIR.second * slower,
    },
  ]
}

/** `line-c`: the first line from C4, 4.0 s. */
export const LINE_C: readonly NoteEvent[] = firstLine(C4)
/** `line-fs`: the same from F♯4. */
export const LINE_FS: readonly NoteEvent[] = firstLine(FS4)

/** Quiz question 1: `line-c`, 0.6 s of silence, then `line-fs` (FACTS 63). */
export const QUIZ_LINES: readonly NoteEvent[] = [
  ...LINE_C,
  ...LINE_FS.map((e) => ({ ...e, at: e.at + 4.6 })),
]

/** Quiz question 3: C4 then F4, a perfect fourth up (FACTS 69). */
export const QUIZ_FOURTH: readonly NoteEvent[] = pair(60, 65)

/** The four words (FACTS 66). */
export const WORD_SOUNDS: Readonly<Record<string, readonly NoteEvent[]>> = {
  interval: pair(60, 67),
  step: pair(69, 67),
  leap: pair(62, 67),
  // C4 C4 G4 G4, 0.5 s of silence, then F♯4 F♯4 C♯5 C♯5
  transpose: [
    ...timed([60, 60, 67, 67].map((midi) => ({ midi, beats: 1 }))),
    ...timed(
      [66, 66, 73, 73].map((midi) => ({ midi, beats: 1 })),
      BEAT_SEC,
      2.5,
    ),
  ],
}

/** The anchor board's five rows (FACTS 68): each tune's snippet and its bare interval. */
export interface Anchor {
  readonly id: 'm2' | 'M2' | 'P4' | 'P5' | 'P8'
  readonly semitones: number
  readonly tune: readonly NoteEvent[]
  readonly interval: readonly NoteEvent[]
}

export const ANCHORS: readonly Anchor[] = [
  {
    id: 'm2',
    semitones: 1,
    // "How I won-der": F4 F4 E4 E4, and "I" to "won-"
    tune: timed([65, 65, 64, 64].map((midi) => ({ midi, beats: 1 }))),
    interval: pair(65, 64),
  },
  {
    id: 'M2',
    semitones: 2,
    // "lit-tle star": A4 A4 G4, the star a minim
    tune: timed([
      { midi: 69, beats: 1 },
      { midi: 69, beats: 1 },
      { midi: 67, beats: 2 },
    ]),
    interval: pair(69, 67),
  },
  {
    id: 'P4',
    semitones: 5,
    tune: timed(AULD),
    interval: pair(60, 65),
  },
  {
    id: 'P5',
    semitones: 7,
    // "twin-kle, twin-kle": C4 C4 G4 G4
    tune: timed([60, 60, 67, 67].map((midi) => ({ midi, beats: 1 }))),
    interval: pair(60, 67),
  },
  {
    id: 'P8',
    semitones: 12,
    // Lesson 1's two As, 0.8 s each
    tune: [
      { midi: 57, at: 0, dur: 0.8 },
      { midi: 69, at: 0.95, dur: 0.8 },
    ],
    interval: pair(57, 69),
  },
]

/** Seconds from an example's start to the end of its last note. */
export const lengthOf = (events: readonly NoteEvent[]): number =>
  events.reduce((end, e) => Math.max(end, e.at + e.dur), 0)

/** Every length `by` times longer, onsets with them. */
export const slower = (events: readonly NoteEvent[], by: number): NoteEvent[] =>
  events.map((e) => ({ midi: e.midi, at: e.at * by, dur: e.dur * by }))

export interface PlayOptions {
  /** Decided once, by the press: silent plays still run their visuals. */
  readonly audible: boolean
  /** The kit's soft tone (default) or Merc's "ooh". */
  readonly kind?: VoiceOptions['kind']
  readonly onNote?: (e: NoteEvent, i: number) => void
}

/** A sound in flight: resolves when its last note has ended, or at once when stopped. */
export interface Playing {
  readonly done: Promise<void>
  stop(): void
}

/** Plays an example note by note, each its own voice, with `onNote` hearing each as it starts. */
export function playNotes(
  events: readonly NoteEvent[],
  o: PlayOptions,
): Playing {
  const timers: number[] = []
  const voices: { stop(release?: number): void }[] = []
  let finish: () => void = () => undefined
  const done = new Promise<void>((resolve) => {
    finish = resolve
  })
  events.forEach((e, i) => {
    timers.push(
      window.setTimeout(() => {
        if (o.audible) {
          const v = Sound.voice(hz(e.midi), { kind: o.kind, dur: e.dur })
          if (v !== null) voices.push(v)
        }
        o.onNote?.(e, i)
      }, e.at * 1000),
    )
  })
  timers.push(window.setTimeout(finish, lengthOf(events) * 1000))
  return {
    done,
    stop() {
      timers.forEach((id) => window.clearTimeout(id))
      voices.forEach((v) => v.stop(0.08))
      finish()
    },
  }
}
