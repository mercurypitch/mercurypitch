// ============================================================
// Lesson 10 steps — five steps, one chord-beads toy
// ============================================================
//
// Every step shows the one chord-beads toy (`toyFor: () => 1`), each in its
// own state (WEB-SPEC, Toys 1): a third; a third stacked on it; the third
// moved, and the root slid; the chord's pattern; the chord spread into its
// scale. Each step's controls are in the one toy, each marked with the steps
// it shows on (`data-part`, a list of step numbers), so no two controls on
// the stage ever share a name: Slow serves Steps 1, 2, 3 and 5, Step 4 has
// Slow · Fast, and Step 5 has a Major · Minor of its own, which waits for
// its predict. Here the page shell only: the figure's label and which parts
// show follow the step, through the deck's `onStep`, whatever the route
// (Next or Back, a swipe, the lesson menu, an address that names a step, the
// quiz's step links). The beads and their sounds are wired separately;
// until then a control does nothing.

import { q, qa } from '@/features/lessons/kit/dom'
import { registerToy } from '@/features/lessons/kit/step-deck'

/** Each step's figure label. */
export const FIG: Readonly<Record<number, string>> = {
  1: '<span class="fig">Fig. 1</span> Two beads, a third',
  2: '<span class="fig">Fig. 2</span> Three beads, two thirds',
  3: '<span class="fig">Fig. 3</span> Move the third',
  4: '<span class="fig">Fig. 4</span> The chord\'s pattern',
  5: '<span class="fig">Fig. 5</span> The chord in its scale',
}

/** The steps a part shows on, from its `data-part` list ("1 3 4"). */
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
export function initSteps(): void {
  const root = q('#toyChord')
  const label = q('[data-fig-label]', root)
  registerToy({
    onStep(n, previous) {
      // the step showing shown again, as the phone deck and the wide page
      // swap at a rotation or a resize, or Step 1 as the deck starts: the
      // markup already shows it
      if (n === previous) return
      showParts(root, n)
      label.innerHTML = FIG[n] ?? FIG[1]
    },
  })
}
