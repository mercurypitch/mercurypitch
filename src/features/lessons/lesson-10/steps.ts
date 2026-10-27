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
// its predict. The figure's label, which parts show and the chord beads'
// state follow the step, through the deck's `onStep`, whatever the route
// (Next or Back, a swipe, the lesson menu, an address that names a step, the
// quiz's step links): each step opens its state on C4, and leaving a step
// stops the beads' sound. The steps' own controls are wired once each
// step's plays are; until then a control does nothing, and the beads play
// only their own buttons' notes.

import { q, qa } from '@/features/lessons/kit/dom'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { registerToy } from '@/features/lessons/kit/step-deck'
import type { ChordBeads } from './chord-beads'
import { mountChordBeads } from './chord-beads'
import type { BeadState } from './chord-layout'

/** Each step's figure label. */
export const FIG: Readonly<Record<number, string>> = {
  1: '<span class="fig">Fig. 1</span> Two beads, a third',
  2: '<span class="fig">Fig. 2</span> Three beads, two thirds',
  3: '<span class="fig">Fig. 3</span> Move the third',
  4: '<span class="fig">Fig. 4</span> The chord\'s pattern',
  5: '<span class="fig">Fig. 5</span> The chord in its scale',
}

/** Each step's state of the chord beads (WEB-SPEC, Toys 1). */
export const STEP_STATE: Readonly<Record<number, BeadState>> = {
  1: 'thirds',
  2: 'stack',
  3: 'slide',
  4: 'pattern',
  5: 'scale',
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

/**
 * Mounts the stage's chord beads and follows the deck: registered before
 * `deck.start()`, so an address that names a step opens it.
 */
export function initSteps(deck: StepDeck): ChordBeads {
  const root = q('#toyChord')
  const label = q('[data-fig-label]', root)
  const beads = mountChordBeads(root, {
    state: STEP_STATE[1],
    active: deck.toyActive(1),
    owner: NowPlaying,
  })
  registerToy({
    onStep(n, previous) {
      // the step showing shown again, as the phone deck and the wide page
      // swap at a rotation or a resize, or Step 1 as the deck starts: the
      // markup already shows it
      if (n === previous) return
      showParts(root, n)
      label.innerHTML = FIG[n] ?? FIG[1]
      beads.setState(STEP_STATE[n] ?? STEP_STATE[1])
    },
  })
  return beads
}
