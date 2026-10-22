// ============================================================
// Move do — do a semitone lower or higher, and the count-in on it
// ============================================================
//
// Lesson 4's control (its FACTS 52), which Lessons 6 and 8 copied and
// Lessons 9, 10, 12 and 14 ask for: two buttons, `data-move-do="-1"` and
// `data-move-do="1"`, each moving do a whole semitone, up to four either
// way, and each disabled at its end. A page keeps its own wiring, readout
// and labels; this is the reach, the step and the ends. The count-in sits
// beside it because it plays do where Move do left it: Lesson 4's and
// Lesson 6's (FACTS 63 and 70 there), do once and softly, 0.8 s at half a
// tapped note's level, then 0.2 s of quiet, before the guide's sweep. It
// hands back its voice, so a page whose run can be cut short stops it.

import { clamp } from './dom'
import { hz } from './notes'
import type { Voice } from './sound'
import { Sound } from './sound'

/** Move do's reach either way, semitones. */
export const MOVE_MAX = 4

/** Move do, kept whole and within its reach. */
export const clampMove = (shift: number): number =>
  clamp(Math.round(shift), -MOVE_MAX, MOVE_MAX)

/** Move do after a press of `button`: its `data-move-do` step, within the reach. */
export const nextShift = (shift: number, button: HTMLElement): number =>
  clampMove(shift + Number(button.dataset.moveDo))

/** Disables the button that would take do past its reach, and only that one. */
export function setMoveEnds(
  buttons: readonly HTMLButtonElement[],
  shift: number,
): void {
  for (const b of buttons) {
    const d = Number(b.dataset.moveDo)
    b.disabled = (d < 0 && shift <= -MOVE_MAX) || (d > 0 && shift >= MOVE_MAX)
  }
}

/** The count-in: do for 0.8 s at half a tapped note's level (the soft tone's 0.13), then 0.2 s of quiet. */
export const COUNT_IN = { note: 0.8, quiet: 0.2, gain: 0.065 } as const
export const COUNT_IN_SEC = COUNT_IN.note + COUNT_IN.quiet

/** Plays the count-in on `doMidi` when `audible`; its voice, or null when nothing sounds. */
export function countIn(doMidi: number, audible: boolean): Voice | null {
  return audible
    ? Sound.voice(hz(doMidi), { dur: COUNT_IN.note, gain: COUNT_IN.gain })
    : null
}
