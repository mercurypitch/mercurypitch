// ============================================================
// Lesson 28 wrap — the practice card's rest version, and free play
// ============================================================
//
// The practice card names Karaoke Night, and Ear Lab's Cadence for the ear
// (WEB-SPEC, Practice links). After "Effortful", "Uncomfortable" or "Just
// listen today" the card takes Lesson 10's rest form, headed "Rest today",
// Karaoke Night's address in its words with no link (kit/comfort.ts
// `mountPractiseCard`): Sing it's ending is held in memory for the visit
// (`VisitEnding`), never stored, so a new visit opens on the full card.
// The season's close follows the same ending (main.ts, kit/next-card.ts).
//
// Free play (Toys 2, Free play) is the steps' toy again, on a card of its
// own under the season's close: the four states on one figure, a state
// switch of four buttons, one a step, each named by its step's heading,
// and every control. A learner can scroll here before the cold open's
// choice, so it draws the hero's ten empty bars and holds every control
// under the steps' lock line until then (`unlock`); a new visit holds them
// again (FACTS 46). Every play is the page's one sound, and the card off
// screen for 600 ms, or the page hidden, stops what it plays
// (kit/leave.ts).

import { mountPractiseCard } from '@/features/lessons/kit/comfort'
import { q } from '@/features/lessons/kit/dom'
import { onLeave } from '@/features/lessons/kit/leave'
import type { ScoreToy } from './score-toy'
import { mountScoreToy } from './score-toy'

/** Mounts free play's toy, its controls held for the cold open's choice; hands back the toy. */
export function initFreePlay(): ScoreToy {
  const root = q('#freePlay')
  const toy = mountScoreToy(root, {
    state: 1,
    strip: document.querySelector('[data-hero-strip]'),
  })
  onLeave(root, () => {
    toy.stop()
  })
  return toy
}

/** The practice card in the version Sing it's ending picks, and free play. */
export function initWrap(): { readonly free: ScoreToy } {
  mountPractiseCard(q('#practiseCard'))
  return { free: initFreePlay() }
}
