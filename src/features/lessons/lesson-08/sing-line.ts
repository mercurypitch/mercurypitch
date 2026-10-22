// ============================================================
// Lesson 8 sung line — its do, Move do and the readout
// ============================================================
//
// Pure (WEB-SPEC, Toys 6; Tests 9). The line is "Twinkle"'s first, from do
// = D3 for the lower voice or D4 for the higher, D3 D3 A3 A3 B3 B3 A3 or an
// octave up (FACTS 79), each inside every app preset of its voice (FACTS
// 67). Move do shifts it a semitone at a time, up to four either way, and
// its readout names semitones, never letters, so no spelling is needed:
// "do: as written", "do: 1 semitone lower", "do: 4 semitones higher, the
// highest".

import { clamp } from '@/features/lessons/kit/dom'
import type { Voice } from '@/features/lessons/kit/voice-choice'
import { TWINKLE } from '@/features/lessons/lesson-06/melody'
import type { Syllable } from './patterns'
import { lineSyllables } from './patterns'

/** Do as written: D3 for the lower voice, D4 for the higher. */
export const LINE_DO: Readonly<Record<Voice, number>> = {
  lower: 50,
  higher: 62,
}

/** Move do's reach either way, semitones. */
export const MOVE_MAX = 4

/** Move do, kept whole and within its reach. */
export const clampMove = (shift: number): number =>
  clamp(Math.round(shift), -MOVE_MAX, MOVE_MAX)

/** Do for the voice and Move do. */
export const lineDo = (voice: Voice, shift: number): number =>
  LINE_DO[voice] + clampMove(shift)

/** The first line's seven syllables from do. */
export const lineFrom = (doMidi: number): Syllable[] =>
  lineSyllables(TWINKLE[0], doMidi)

/** The readout under Move do. */
export function doReadout(shift: number): string {
  const s = clampMove(shift)
  if (s === 0) return 'do: as written'
  const n = Math.abs(s)
  const way = s < 0 ? 'lower' : 'higher'
  const end = n === MOVE_MAX ? `, the ${s < 0 ? 'lowest' : 'highest'}` : ''
  return `do: ${n} ${n === 1 ? 'semitone' : 'semitones'} ${way}${end}`
}
