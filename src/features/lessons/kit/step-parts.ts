// ============================================================
// Lesson step parts — which of a stage's controls each step shows
// ============================================================
//
// A lesson whose steps share one toy (`toyFor: () => 1`) keeps every step's
// controls in that toy's markup, each marked with the steps it shows on:
// `data-part="3 4 5"` is Slow on Steps 3, 4 and 5. As the deck moves to a
// step, the toy shows that step's parts and hides the rest, so no two
// controls on the stage ever share an accessible name, and a part hidden
// in the markup is hidden before any script runs. Lessons 9, 10 and 12
// mark their stages this way.

import { qa } from './dom'

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
