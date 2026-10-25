// ============================================================
// Move do — do a semitone lower or higher, and the count-in on it
// ============================================================
//
// Lesson 4's control (its FACTS 52), which Lessons 6 and 8 copied and
// Lessons 9, 10, 12 and 14 ask for: two buttons, `data-move-do="-1"` and
// `data-move-do="1"`, each moving do a whole semitone, up to four either
// way unless a page passes a reach for each side (Lesson 12's: four lower,
// three higher). At its end a button is `aria-disabled`, never `disabled`,
// so the keyboard's place stays on it and a screen reader hears that it is
// unavailable. A click still reaches it, so each page's handler returns
// first when its button is `aria-disabled`: a press at the end neither
// moves do nor stops what plays. A page keeps its own wiring, readout and
// labels; this is the reach, the step and the ends. The count-in sits
// beside it because it plays do where Move do left it:
// Lesson 4's and Lesson 6's (FACTS 63 and 70 there), do once and softly,
// 0.8 s at half a tapped note's level, then 0.2 s of quiet, before the
// guide's sweep. It hands back its voice, so a page whose run can be cut
// short stops it.

import { clamp } from './dom'
import { hz } from './notes'
import type { Voice } from './sound'
import { Sound } from './sound'

/** Move do's reach either way, semitones. */
export const MOVE_MAX = 4

/** How far Move do goes each way, in semitones from where the page sets do. */
export interface MoveReach {
  readonly lower: number
  readonly higher: number
}

/** The reach a page has unless it passes its own: `MOVE_MAX` both ways. */
export const MOVE_REACH: MoveReach = { lower: MOVE_MAX, higher: MOVE_MAX }

/** Move do, kept whole and within its reach. */
export const clampMove = (
  shift: number,
  reach: MoveReach = MOVE_REACH,
): number => clamp(Math.round(shift), -reach.lower, reach.higher)

/** Move do after a press of `button`: its `data-move-do` step, within the reach. */
export const nextShift = (
  shift: number,
  button: HTMLElement,
  reach: MoveReach = MOVE_REACH,
): number => clampMove(shift + Number(button.dataset.moveDo), reach)

/** Marks `aria-disabled` the button that would take do past its reach, and only that one. */
export function setMoveEnds(
  buttons: readonly HTMLButtonElement[],
  shift: number,
  reach: MoveReach = MOVE_REACH,
): void {
  for (const b of buttons) {
    const d = Number(b.dataset.moveDo)
    const end =
      (d < 0 && shift <= -reach.lower) || (d > 0 && shift >= reach.higher)
    b.setAttribute('aria-disabled', String(end))
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
