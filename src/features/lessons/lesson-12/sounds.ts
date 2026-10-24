// ============================================================
// Lesson 12 sounds — every fixed sound on the page, as timed notes
// ============================================================
//
// Pure (WEB-SPEC, Audio and Tests 5; FACTS 68 to 74). A sound is a list of
// notes, each with its onset and length in seconds from the press, its
// level and its voice, so one run can carry a chord and the tune note over
// it and start both in the same timer task, as two runs on two timers could
// not. A chord is three soft voices at 0.075 each when it plays alone, and
// 0.05 each under Merc's "ooh" (0.2) or under the guide, so the tune or the
// root stands clear of it; a single note, a root or an arpeggio's note, is
// the soft tone's own 0.13 (FACTS 74).
//
// The note's shape is the kit's coming `RunNote` (`{ t, midi, dur }`, in
// `kit/run.ts`) with a gain and a voice kind on each note. None of those
// has landed on main, so `SoundNote` is local; once they have, it becomes
// `export type SoundNote = RunNote`.
//
// The chips sound from the key's own octave and the loop, its roots and
// the tunes sit five semitones lower in G (music.ts). Sing it is always in
// C, do on C4 for the lower voice and C5 for the higher, with the chords
// under both at the loop's own pitch (FACTS 59, 73); Move do moves the
// whole of it with `inKey`. Slow doubles every onset and length.

import type { VoiceOptions } from '@/features/lessons/kit/sound'
import type { Voice } from '@/features/lessons/kit/voice-choice'
import type { KeyName, TuneId } from './music'
import { BAR_SEC, chordsOf, loopOf, rootLine, tuneOf } from './music'

/** A note of a sound: when it starts and how long it lasts, seconds, with its level and voice. */
export interface SoundNote {
  readonly t: number
  readonly midi: number
  readonly dur: number
  readonly gain?: number
  readonly kind?: VoiceOptions['kind']
}

export type SoundNotes = readonly SoundNote[]

/** A single soft note: a tapped bead, a root, an arpeggio's note (the soft tone's 0.13). */
export const NOTE_GAIN = 0.13
/** Each voice of a chord that plays alone (FACTS 74). */
export const CHORD_GAIN = 0.075
/** Each voice of a chord under Merc's "ooh" or under the guide (FACTS 74). */
export const UNDER_GAIN = 0.05
/** Merc's "ooh" (the kit's 0.2). */
export const MERC_GAIN = 0.2

/** A chip's chord (FACTS 69). */
export const CHIP_SEC = 1.4
/** Play I, then vi: the quiet between the two, where the corner slides (FACTS 69). */
export const I_THEN_VI_SLIDE = { t: CHIP_SEC, dur: 0.3 } as const

/** The four words' timings (FACTS 70). */
export const WORD = {
  /** Diatonic: each of the seven chords, and the quiet between them. */
  chord: 0.6,
  chordGap: 0.1,
  /** Roman numeral: I, then V, and the quiet between. */
  pair: 1.2,
  pairGap: 0.3,
  /** Diminished and augmented: each note alone, then the three together. */
  note: 0.5,
  held: 1.2,
} as const

/** Sing it: each of Merc's notes, and the last do (FACTS 61). */
export const SING = { note: 1.6, last: 2.0 } as const

const soft = (
  midi: number,
  t: number,
  dur: number,
  gain = NOTE_GAIN,
): SoundNote => ({ t, midi, dur, gain, kind: 'soft' })

/** Three voices started together. */
const chord = (
  midis: readonly number[],
  t: number,
  dur: number,
  gain: number,
): SoundNote[] => midis.map((m) => soft(m, t, dur, gain))

const byOnset = (notes: SoundNote[]): SoundNote[] =>
  notes.sort((a, b) => a.t - b.t)

/** A chip's chord, 1.4 s, from the key's own octave: C4 E4 G4 to B4 D5 F5 in C (FACTS 69). */
export const chip = (degree: number, key: KeyName): SoundNote[] =>
  chord(chordsOf(key)[degree].midis, 0, CHIP_SEC, CHORD_GAIN)

/** Step 3's Play I, then vi: C4 E4 G4, the 0.3 s slide, then A3 C4 E4; 3.1 s (FACTS 69, 69a). */
export function iThenVi(key: KeyName): SoundNote[] {
  const [one, , six] = loopOf(key)
  return [
    ...chord(one.midis, 0, CHIP_SEC, CHORD_GAIN),
    ...chord(
      six.midis,
      I_THEN_VI_SLIDE.t + I_THEN_VI_SLIDE.dur,
      CHIP_SEC,
      CHORD_GAIN,
    ),
  ]
}

/** The loop, I V vi IV, two seconds a chord, 8.0 s (FACTS 68); at 0.05 a voice under a tune. */
export const loop = (key: KeyName, gain = CHORD_GAIN): SoundNote[] =>
  loopOf(key).flatMap((c, bar) => chord(c.midis, bar * BAR_SEC, BAR_SEC, gain))

/** Step 4's roots alone: C4 G3 A3 F3, two seconds each, soft, 8.0 s (FACTS 71). */
export const roots = (key: KeyName): SoundNote[] =>
  rootLine(key)
    .slice(0, 4)
    .map((m, bar) => soft(m, bar * BAR_SEC, BAR_SEC))

/** A tune play: Merc's "ooh" over the loop at 0.05 a voice, 8.0 s (FACTS 68, 72). */
export const tune = (id: TuneId, key: KeyName): SoundNote[] =>
  byOnset([
    ...loop(key, UNDER_GAIN),
    ...tuneOf(id, key).map((n) => ({
      t: n.t,
      midi: n.midi,
      dur: n.dur,
      gain: MERC_GAIN,
      kind: 'merc' as const,
    })),
  ])

/** An arpeggio, each note alone, then the three together (FACTS 70). */
const arpeggio = (midis: readonly number[]): SoundNote[] => [
  ...midis.map((m, i) => soft(m, i * WORD.note, WORD.note)),
  ...chord(midis, midis.length * WORD.note, WORD.held, CHORD_GAIN),
]

const C_CHORDS = chordsOf('C')
const C_LOOP = loopOf('C')

/** The four words' plays: 4.8, 2.7, 2.7 and 2.7 s (FACTS 70). */
export const WORD_SOUNDS: Readonly<
  Record<'diatonic' | 'numeral' | 'diminished' | 'augmented', SoundNotes>
> = {
  // C major's seven chords as the chips voice them
  diatonic: C_CHORDS.flatMap((c, i) =>
    chord(c.midis, i * (WORD.chord + WORD.chordGap), WORD.chord, CHORD_GAIN),
  ),
  // I, then V, as the loop voices them
  numeral: [
    ...chord(C_LOOP[0].midis, 0, WORD.pair, CHORD_GAIN),
    ...chord(C_LOOP[1].midis, WORD.pair + WORD.pairGap, WORD.pair, CHORD_GAIN),
  ],
  // B3 D4 F4: vii° an octave under its chip
  diminished: arpeggio(C_CHORDS[6].midis.map((m) => m - 12)),
  // C4 E4 G♯4: two major thirds, no chord of the key
  augmented: arpeggio([60, 64, 68]),
}

/** Sing it's chords alone, I V vi IV and I, two seconds each, 10.0 s: the guide's (FACTS 61, 73). */
export const GUIDE: SoundNotes = [...C_LOOP, C_LOOP[0]].flatMap((c, bar) =>
  chord(c.midis, bar * BAR_SEC, BAR_SEC, UNDER_GAIN),
)

/**
 * Merc's notes over the chords, 10.0 s: do so la fa do, each 1.6 s with
 * 0.4 s after it and the last do 2.0 s, on C4 for the lower voice and C5
 * for the higher (FACTS 59, 61, 73), each root starting with its chord.
 */
export function singAlong(voice: Voice): SoundNote[] {
  const up = voice === 'higher' ? 12 : 0
  const line = rootLine('C')
  return byOnset([
    ...GUIDE,
    ...line.map((m, i) => ({
      t: i * BAR_SEC,
      midi: m + up,
      dur: i === line.length - 1 ? SING.last : SING.note,
      gain: MERC_GAIN,
      kind: 'merc' as const,
    })),
  ])
}

/** Every onset and length `by` times longer: Slow is 2 (WEB-SPEC, Toys 1 and 5). */
export const slow = (sound: SoundNotes, by = 2): SoundNote[] =>
  sound.map((n) => ({ ...n, t: n.t * by, dur: n.dur * by }))

/** Every note `by` semitones higher, or lower when negative: G is -5, Move do -4 to +3. */
export const inKey = (sound: SoundNotes, by: number): SoundNote[] =>
  sound.map((n) => ({ ...n, midi: n.midi + by }))

/** Seconds from a sound's start to the end of its last-ending note. */
export const lengthOf = (sound: SoundNotes): number =>
  sound.reduce((end, n) => Math.max(end, n.t + n.dur), 0)
