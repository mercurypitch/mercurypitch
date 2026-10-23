// ============================================================
// Lesson 2 cold open — the hero spiral, the climb and the first predict
// ============================================================
//
// The hero's stage holds a spiral copy of its own (DECISIONS 81) between Merc
// and Tavi, under the kit's stars, with Tavi's guess and Merc's reply in
// the bubbles over it. The predict card under the stage asks whether every
// gap between the letters holds a note; a choice unlocks Play the climb,
// which plays the thirteen notes A3 to A4 on the hero spiral, lighting each
// bead and counting the steps, Merc singing along on A3 and Tavi on
// A4. The reveal follows the climb (twelve steps, not fourteen), and Tavi
// celebrates once. Which gaps hold no note, and why, is left to steps 3 and
// 4, so step 3's predict is not given away.

import { q } from '@/features/lessons/kit/dom'
import { watch } from '@/features/lessons/kit/frame-loop'
import { mountSky } from '@/features/lessons/kit/hero-sky'
import type { Which } from '@/features/lessons/kit/merc-duo'
import { mercCelebrate, mercSing } from '@/features/lessons/kit/merc-duo'
import { mountPredict } from '@/features/lessons/kit/predict'
import type { NoteEvent } from './examples'
import type { SpiralCopy } from './spiral-copy'
import { mountSpiralCopy } from './spiral-copy'

/** The climb's first note is Merc's A3, its last Tavi's A4. */
function singAlong(e: NoteEvent): void {
  const which: Which | null =
    e.midi === 57 ? 'blue' : e.midi === 69 ? 'orange' : null
  if (which === null) return
  mercSing(which, e.midi, true)
  window.setTimeout(() => mercSing(which, e.midi, false), e.dur * 1000)
}

const GUESS: Readonly<Record<string, string>> = {
  every: 'You said: every gap',
  some: 'You said: only some',
}

export function initColdOpen(): SpiralCopy {
  const stage = q('#heroStage')
  mountSky(stage)
  const hero = mountSpiralCopy(q('#heroSpiral'), {
    active: watch(stage),
    onClimbNote: singAlong,
  })
  mountPredict(q('#predict'), {
    play: (_what, audible) => hero.climb.run(audible),
    revealOn: ['climb'],
    hints: {
      chosen: 'Locked in. Play the climb: A3 up to A4, one step at a time.',
      silent:
        'Sound is off, so nothing played. Turn sound on to hear the climb, then press Play the climb.',
      again: 'Play the climb again, or tap any bead on the spiral.',
    },
    guess: (choice) => GUESS[choice] ?? 'You said',
    onReveal: () => mercCelebrate('orange', 1600),
  })
  return hero
}
