// ============================================================
// Lesson 9 steps — five steps, one ladder chart
// ============================================================
//
// Every step shows the one ladder chart (`toyFor: () => 1`), each in its own
// state (WEB-SPEC, Toys 1): a step and a leap over the folds; hear it first;
// the ladder; the five leaps in order; a landing. Each step's controls are
// in the one toy, each marked with the steps it shows on (`data-part`, a
// list of step numbers), so no two controls on the stage ever share a name
// and Slow serves all five. Here the page shell only: the figure's label and
// which parts show follow the step, through the deck's `onStep`, whatever
// the route (Next or Back, a swipe, the lesson menu, an address that names a
// step, the quiz's step links), and so does the chart's state
// (ladder-chart.ts), drawn only while the stage shows it. The steps' sounds
// are wired separately; until then a control does nothing.

import { q, qa } from '@/features/lessons/kit/dom'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { registerToy } from '@/features/lessons/kit/step-deck'
import type { LadderChart } from './ladder-chart'
import { mountLadderChart } from './ladder-chart'
import type { ChartState } from './ladder-data'

/** Each step's figure label. */
export const FIG: Readonly<Record<number, string>> = {
  1: '<span class="fig">Fig. 1</span> A step and a leap, and the folds slowed 220 times',
  2: '<span class="fig">Fig. 2</span> Hear it first, then leap',
  3: '<span class="fig">Fig. 3</span> Every rung of the ladder',
  4: '<span class="fig">Fig. 4</span> Five leaps, small ones first',
  5: '<span class="fig">Fig. 5</span> A landing, and an adjustment',
}

/** Each step's state of the chart (WEB-SPEC, Toys 1). */
export const STEP_STATE: Readonly<Record<number, ChartState>> = {
  1: 'step',
  2: 'hear',
  3: 'ladder',
  4: 'order',
  5: 'landing',
}

/** The steps a part shows on, from its `data-part` list ("1 2"). */
export const partSteps = (el: Element): readonly number[] =>
  (el.getAttribute('data-part') ?? '')
    .split(/\s+/)
    .filter((word) => word !== '')
    .map(Number)

/** Shows the parts of `root` that step `n` uses, and hides the rest. */
export function showParts(root: ParentNode, n: number): void {
  for (const el of qa<HTMLElement>('[data-part]', root))
    el.hidden = !partSteps(el).includes(n)
}

/** Follows the deck: registered before `deck.start()`, so an address that names a step opens it. */
export function initSteps(deck: StepDeck): LadderChart {
  const root = q('#toyLadder')
  const label = q('[data-fig-label]', root)
  const ladder = mountLadderChart(q('[data-ladder-viz]', root), {
    state: STEP_STATE[1],
    active: deck.toyActive(1),
  })
  registerToy({
    onStep(n, previous) {
      // the step showing shown again, as the phone deck and the wide page
      // swap at a rotation or a resize, or Step 1 as the deck starts: the
      // markup already shows it
      if (n === previous) return
      showParts(root, n)
      label.innerHTML = FIG[n] ?? FIG[1]
      ladder.show(STEP_STATE[n] ?? STEP_STATE[1])
    },
  })
  return ladder
}
