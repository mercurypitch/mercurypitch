// ============================================================
// Sing along — a Merc sings each note of a run as it sounds
// ============================================================
//
// Lesson 4's (hero.ts), which Lesson 6's cold open copied: a Merc sings
// each note of a run as it starts, and falls quiet once the last one has
// ended. The quiet waits on a timer, one per Merc, and any note that Merc
// starts before it fires cancels it, so a replay begun within the last
// note's length is never quieted by the play before it (Lesson 6's
// review). A play cut short quiets its Merc at once and cancels the timer
// too (`stopSingAlong`).

import type { Which } from './merc-duo'
import { mercSing } from './merc-duo'

/** A note of a run: its MIDI number and its length, seconds. */
export interface SungNote {
  readonly midi: number
  readonly dur: number
}

/** Each Merc's quiet still to come, after a run's last note. */
const quiet: Record<Which, number> = { blue: 0, orange: 0 }

/** A Merc sings along with a run: each note as it starts, quiet once the last has ended. */
export function singAlong(
  which: Which,
): (e: SungNote, i: number, count: number) => void {
  return (e, i, count) => {
    window.clearTimeout(quiet[which])
    mercSing(which, e.midi, true)
    if (i === count - 1)
      quiet[which] = window.setTimeout(
        () => mercSing(which, e.midi, false),
        e.dur * 1000,
      )
  }
}

/** A run cut short: its Merc falls quiet now, and the quiet still to come is cancelled. */
export function stopSingAlong(which: Which, midi: number): void {
  window.clearTimeout(quiet[which])
  mercSing(which, midi, false)
}
