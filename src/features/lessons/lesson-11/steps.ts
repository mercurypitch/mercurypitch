// ============================================================
// Lesson 11 steps — five steps, one range chart
// ============================================================
//
// Every step shows the one range chart (`toyFor: () => 1`), each in its own
// state (WEB-SPEC, Toys 1): one note in each gear; Merc's slide, slowed,
// with the stretch gauge; three model slides; five slides across a
// narrowing seam; and a figure flipped on purpose or with the switch
// hidden. Each state's controls are in the one toy, each marked with the
// step it shows on (`data-part`, kit/step-parts.ts), so no two controls on
// the stage ever share a name. Here the page shell only: the figure's label and which
// parts show follow the step, through the deck's `onStep`, whatever the
// route (Next or Back, a swipe, the lesson menu, an address that names a
// step, the quiz's step links). The chart and its sounds are wired
// separately; until then a control does nothing.

import { q } from '@/features/lessons/kit/dom'
import { registerToy } from '@/features/lessons/kit/step-deck'
import { showParts } from '@/features/lessons/kit/step-parts'

/** The chart's five step states, in step order. */
export const STATES = ['gears', 'slide', 'three', 'smoother', 'styles'] as const
export type StepState = (typeof STATES)[number]

/** Each step's figure label. */
export const FIG: Readonly<Record<number, string>> = {
  1: '<span class="fig">Fig. 1</span> One note in each gear',
  2: '<span class="fig">Fig. 2</span> Merc\'s slide, slowed',
  3: '<span class="fig">Fig. 3</span> Three model slides',
  4: '<span class="fig">Fig. 4</span> Five slides, one narrowing seam',
  5: '<span class="fig">Fig. 5</span> One figure, two ways',
}

/** The state a step shows. */
export const stateOf = (n: number): StepState => STATES[n - 1] ?? 'gears'

/** Follows the deck: registered before `deck.start()`, so an address that names a step opens it. */
export function initSteps(): void {
  const root = q('#toyRange')
  const label = q('[data-fig-label]', root)
  registerToy({
    onStep(n, previous) {
      // the step showing shown again, as the phone deck and the wide page
      // swap at a rotation or a resize, or Step 1 as the deck starts: the
      // markup already shows it
      if (n === previous) return
      root.dataset.state = stateOf(n)
      showParts(root, n)
      label.innerHTML = FIG[n] ?? FIG[1]
    },
  })
}
