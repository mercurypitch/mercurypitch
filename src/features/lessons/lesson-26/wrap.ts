// ============================================================
// Lesson 26 wrap — the practice card's rest version, and free play
// ============================================================
//
// The practice card names Harmony Stack, a Jam room's mode, and Drone
// Intonation's thirds on a drone (WEB-SPEC, Practice links; FACTS 63 to
// 66). After "Effortful", "Uncomfortable" or "Just listen today" the card
// takes Lesson 10's rest form, headed "Rest today", its rest line in the
// drills' place (kit/comfort.ts `mountPractiseCard`): Sing it's ending is
// held in memory for the visit (`VisitEnding`), never stored, so a new
// visit opens on the full card.
//
// Free play (Toys 2, Free play) is the steps' toy again, on a card of its
// own under the next-lesson card: the four states on one stage, a state
// switch of four buttons, one a step, each named by its step's heading,
// and every control. A learner can scroll here before the cold open's
// choice, so it draws the hero's plain "Twinkle" and holds every control
// under the steps' lock line until then (`unlock`); a new visit holds them
// again (FACTS 40). Every play is the page's one sound, and the card off
// screen for 600 ms, or the page hidden, stops what it plays
// (kit/leave.ts).
//
// The tease still (Toys 6) is markup, in the next-lesson card's slot:
// Lesson 27's ring of rooms, V lit and I faint, which plays nothing.

import { mountPractiseCard } from '@/features/lessons/kit/comfort'
import { q } from '@/features/lessons/kit/dom'
import { watch } from '@/features/lessons/kit/frame-loop'
import { onLeave } from '@/features/lessons/kit/leave'
import type { PartToy } from './part-toy'
import { mountPartToy } from './part-toy'

/** Mounts free play's toy, its controls held for the cold open's choice; hands back the toy. */
export function initFreePlay(): PartToy {
  const root = q('#freePlay')
  const toy = mountPartToy(root, {
    active: watch(q('[data-tune-canvas]', root)),
    state: 1,
  })
  onLeave(root, () => {
    toy.stop()
  })
  return toy
}

/** The practice card in the version Sing it's ending picks, and free play. */
export function initWrap(): { readonly free: PartToy } {
  mountPractiseCard(q('#practiseCard'))
  return { free: initFreePlay() }
}
