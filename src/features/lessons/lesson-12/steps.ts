// ============================================================
// Lesson 12 steps — five steps, one ring of rooms
// ============================================================
//
// Every step shows the one ring-of-rooms toy (`toyFor: () => 1`), each in
// its own state (WEB-SPEC, Toys 1): the seven chords of C major built one
// chip at a time; their numerals, with the key switch C · G; the corner
// that slides from I to vi, with the names switch; the loop of four, with
// its roots; and the tunes over the loop. The chord strip's seven chips
// serve every step; each step's own controls are in the one toy, each
// marked with the steps it shows on (`data-part`, a list of step numbers),
// so no two controls on the stage ever share a name: Slow serves Steps 3, 4
// and 5. Here the page shell only: the figure's label and which parts show
// follow the step, through the deck's `onStep`, whatever the route (Next or
// Back, a swipe, the lesson menu, an address that names a step, the quiz's
// step links). The rooms and their sounds are wired separately; until then
// a control does nothing.

import { q } from '@/features/lessons/kit/dom'
import { registerToy } from '@/features/lessons/kit/step-deck'
import { showParts } from '@/features/lessons/kit/step-parts'

/** Each step's figure label. */
export const FIG: Readonly<Record<number, string>> = {
  1: '<span class="fig">Fig. 1</span> C major\'s seven chords',
  2: '<span class="fig">Fig. 2</span> The numerals, in two keys',
  3: '<span class="fig">Fig. 3</span> The chord on la',
  4: '<span class="fig">Fig. 4</span> The four-chord loop',
  5: '<span class="fig">Fig. 5</span> Two tunes over the loop',
}

/** Follows the deck: registered before `deck.start()`, so an address that names a step opens it. */
export function initSteps(): void {
  const root = q('#toyRooms')
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
