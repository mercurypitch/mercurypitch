// ============================================================
// Lesson 24 wrap — the practise card Sing it's ending picks, and free play
// ============================================================
//
// The practise card is Drone Intonation's (WEB-SPEC, Practice links) in the
// version the visit's ending picks (kit/comfort.ts `mountPractiseCard`):
// after "Effortful", "Uncomfortable" or "Just listen today", the rest
// version, with no link, since the drill asks for the voice (REQ-GVC-055).
// The ending is held in memory for the visit (kit/comfort.ts
// `VisitEnding`), never stored, so a new visit opens on the drill's card.
//
// Free play (WEB-SPEC, Toys 2, item 5) is the steps' drone chart again
// (drone-toy.ts) on a card of its own, in each of its four states, which
// its switch opens (`data-free-state`), with every control in each and no
// predict attached. It keeps the steps' holds, since a learner can scroll
// here before either choice (FACTS 46): until the cold open's choice every
// control, the switch with it, is disabled under the lock line and the
// chart draws only the drone's band; until Step 2's choice the three later
// states open held, under the figure's own line, Step 2's among them since
// no predict sits beside it here, with every play that sets the piano's mi
// or so against the drone waiting (drone-toy.ts, `free`). Both predicts'
// choices reach it through what this hands back (`unlock`, `unlockStep2`),
// as they reach the steps' toy, and a return visit holds it back again,
// since both predicts start fresh. Every play is the page's one sound, and
// the card off screen for 600 ms, or the page hidden, stops what it plays
// (kit/leave.ts).
//
// The tease still (Toys 7) is markup, in the next-lesson card's slot:
// Lesson 25's opening, which plays nothing.

import { mountPractiseCard } from '@/features/lessons/kit/comfort'
import { q, qa } from '@/features/lessons/kit/dom'
import { watch } from '@/features/lessons/kit/frame-loop'
import { onLeave } from '@/features/lessons/kit/leave'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { DroneState } from './drone-picture'
import type { DroneToy } from './drone-toy'
import { mountDroneToy } from './drone-toy'

/** Free play: its toy, and the two choices that open it. */
export interface FreePlay {
  readonly toy: DroneToy
  /** The cold open's choice: the switch and Step 1's controls. */
  unlock(): void
  /** Step 2's choice: what the later states held back. */
  unlockStep2(): void
}

const isState = (n: number): n is DroneState => n >= 1 && n <= 4

/** Mounts free play's drone chart, held back as the steps' is, in Step 1's state. */
export function initFreePlay(): FreePlay {
  const root = q('#freePlay')
  const toy = mountDroneToy(root, {
    active: watch(root),
    owner: NowPlaying,
    free: true,
  })
  const states = qa<HTMLButtonElement>('[data-free-state]', root)
  for (const button of states)
    button.addEventListener('click', () => {
      const n = Number(button.dataset.freeState)
      if (button.disabled || !isState(n)) return
      toy.setState(n)
      for (const b of states)
        b.setAttribute('aria-pressed', String(b === button))
    })
  onLeave(root, () => {
    toy.stop()
  })
  return {
    toy,
    unlock() {
      toy.unlock()
      for (const b of states) b.disabled = false
    },
    unlockStep2() {
      toy.unlockStep2()
    },
  }
}

/** The practise card and free play; hands back free play, for the predicts' choices to open. */
export function initWrap(): FreePlay {
  mountPractiseCard(q('#practiseCard'))
  return initFreePlay()
}
