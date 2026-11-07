// ============================================================
// Lesson 22 wrap — the practise card Sing it's ending picks, and free play
// ============================================================
//
// The practise card is Voice Mirror's (WEB-SPEC, Practice links) in the
// version the visit's ending picks (kit/comfort.ts `mountPractiseCard`):
// after "Effortful", "Uncomfortable" or "Just listen today", the rest
// version, Lesson 12's form with Lesson 5's words and no link, since Voice
// Mirror asks for the voice (REQ-GVC-055). The ending is held in memory
// for the visit (kit/comfort.ts `VisitEnding`), never stored, so a new
// visit opens on Voice Mirror's card.
//
// Free play (WEB-SPEC, Toys 2, item 5) is the steps' band chart toy again
// (vib-toy.ts) on a card of its own, in each of its four states, which its
// switch opens (`data-free-state`), with every control in each and no
// predict attached. It keeps the steps' holds, since a learner can scroll
// here before either choice (FACTS 24): until the cold open's choice every
// control, the switch with them, is disabled under the lock line and the
// chart draws only its band; until Step 3's choice its Play: two a second,
// Rate, Play at this rate and Drift wait under their own line. Both
// predicts' choices reach it through the toy it hands back (`unlock`,
// `unlockHeld`), as they reach the steps' toy, and a return visit holds it
// back again, since both predicts start fresh. Every play is the page's
// one sound, and the card off screen for 600 ms, or the page hidden, stops
// what it plays (kit/leave.ts).
//
// The tease still (Toys 7) is markup, in the next-lesson card's slot:
// Lesson 23's opening, which plays nothing.

import { mountPractiseCard } from '@/features/lessons/kit/comfort'
import { q, qa } from '@/features/lessons/kit/dom'
import { watch } from '@/features/lessons/kit/frame-loop'
import { onLeave } from '@/features/lessons/kit/leave'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { VibState } from './vib-picture'
import type { VibToy } from './vib-toy'
import { mountVibToy } from './vib-toy'

/** Mounts free play's band chart, held back as the steps' is, in Step 1's state; hands back the toy. */
export function initFreePlay(): VibToy {
  const root = q('#freePlay')
  const toy = mountVibToy(root, { active: watch(root), owner: NowPlaying })
  const states = qa<HTMLButtonElement>('[data-free-state]', root)
  for (const button of states)
    button.addEventListener('click', () => {
      if (button.disabled) return
      toy.setState(Number(button.dataset.freeState) as VibState)
      for (const b of states)
        b.setAttribute('aria-pressed', String(b === button))
    })
  onLeave(root, () => {
    toy.stop()
  })
  return toy
}

/** The practise card and free play; hands back free play's toy, for the predicts' choices to open. */
export function initWrap(): VibToy {
  mountPractiseCard(q('#practiseCard'))
  return initFreePlay()
}
