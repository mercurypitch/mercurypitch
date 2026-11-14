// ============================================================
// Lesson 28 Sing it's sounds — do, the count-in, the part under a take, and the plays
// ============================================================
//
// Every sound of Sing it (WEB-SPEC, Toys 6 and Audio): do, sung by Merc
// for the lower voice or Tavi for the higher on "ooh", 1.0 s at Merc's
// level; the count-in, one bar of the woodblock at 72 BPM, beat 1 higher,
// on the beat clock; the other part under a take, one voice along its
// contour (kit/take-part.ts), booked on the audio clock from bar 1's first
// beat, breathing where the learner breathes, after bars 2, 4 and 6, and
// its first 2.0 s alone for the quiet check; "Just listen today"'s Play
// the song, bars 1 to 8 with both parts note against note; and the alone
// path's first turn, the other part alone on "ooh", as the steps' Play
// Tavi's part plays it.

import type { Run as ClockRun, Spot } from '@/features/lessons/kit/beat-clock'
import type { Run, RunNote } from '@/features/lessons/kit/run'
import { playNotes } from '@/features/lessons/kit/run'
import type { Voice as Tone } from '@/features/lessons/kit/sound'
import { MERC_GAIN } from '@/features/lessons/kit/sound'
import type { TakePart } from '@/features/lessons/kit/take-part'
import { bookPart as bookTakePart, startCountIn as countIn, } from '@/features/lessons/kit/take-part'
import type { Voice } from '@/features/lessons/kit/voice-choice'
import type { Part } from './sing-plan'
import { BREATHS, COUNT_IN, DO, DO_SEC } from './sing-plan'
import { A, bothNotes, BPM, partNotes } from './song'

// the quiet before the count-in and the quiet check's length are the kit's
export { CHECK_SEC, QUIET_GAP_SEC } from '@/features/lessons/kit/take-part'

/** Do for `v` on "ooh" at Merc's level, 1.0 s. */
export const startDo = (v: Voice, audible: boolean): Run =>
  playNotes([{ t: 0, midi: DO[v], dur: DO_SEC }], {
    audible,
    kind: 'merc',
    gain: MERC_GAIN,
  })

/** The count-in: one bar of four clicks at 72 BPM, beat 1 higher, each told as it is heard. */
export const startCountIn = (
  audible: boolean,
  onClick: (beat: number) => void,
  onFrame: (spot: Spot) => void,
): ClockRun => countIn({ bpm: BPM, beats: COUNT_IN, audible, onClick, onFrame })

/** A part as the kit books it under a take: its notes, beats and breaths at 72 BPM. */
export const takePartOf = (p: Part): TakePart => ({
  midis: p.midis,
  beats: p.beats,
  bpm: BPM,
  breaths: BREATHS,
})

/**
 * The other part as one voice, booked `at` seconds from now on the audio
 * clock: all of it, or only its first `sec` seconds (the quiet check's 2.0
 * s). Null while sound cannot play.
 */
export const bookPart = (p: Part, at: number, sec?: number): Tone | null =>
  bookTakePart(takePartOf(p), at, sec)

/** Play the song: bars 1 to 8, both parts note against note, each at 0.2, 26.67 s. */
export const startSong = (
  audible: boolean,
  onNote?: (n: RunNote, i: number) => void,
): Run => playNotes(bothNotes(A), { audible, onNote })

/** Hear the other part first: Tavi's part alone for the lower voice, Merc's for the higher, 26.67 s. */
export const startFirst = (v: Voice, audible: boolean): Run =>
  playNotes(partNotes(v === 'lower' ? A.tavi : A.merc), { audible })
