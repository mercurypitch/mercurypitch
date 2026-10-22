// ============================================================
// Lesson 8 sung line — its do, Move do and the readout
// ============================================================
//
// Pure (WEB-SPEC, Toys 6; Tests 9). The line is "Twinkle"'s first, from do
// = D3 for the lower voice or D4 for the higher, D3 D3 A3 A3 B3 B3 A3 or an
// octave up (FACTS 79), each inside every app preset of its voice (FACTS
// 67). Move do (kit/move-do.ts) shifts it a semitone at a time, up to four
// either way, and its readout names semitones, never letters, so no
// spelling is needed: "do: as written", "do: 1 semitone lower", "do: 4
// semitones higher, the highest".

import { clampMove, MOVE_MAX } from '@/features/lessons/kit/move-do'
import type { Voice } from '@/features/lessons/kit/voice-choice'
import { TWINKLE } from '@/features/lessons/lesson-06/melody'
import type { Syllable } from './patterns'
import { lineSyllables } from './patterns'

/** Do as written: D3 for the lower voice, D4 for the higher. */
export const LINE_DO: Readonly<Record<Voice, number>> = {
  lower: 50,
  higher: 62,
}

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
