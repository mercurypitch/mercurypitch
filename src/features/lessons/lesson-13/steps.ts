// ============================================================
// Lesson 13 steps — five steps, one vowel figure
// ============================================================
//
// Every step shows the one vowel figure (`toyFor: () => 1`), each in its own
// state (WEB-SPEC, Toys 1): the harmonics one at a time, then all; the
// resonance curves with ‘ee’ and ‘ah’; ‘ee’, ‘ah’ and ‘oo’; the five vowels
// on one note, with the picker and the names row; and ‘ah’ in the lower and
// the higher voice. The steps sing in Merc's lower voice, A3, whatever
// `fyp-voice` holds, since Step 5 compares the two voices; Step 5's switch
// changes it for the visit and stores nothing (FACTS 48).
//
// Each step's own controls are in the one toy, marked with the step they
// show on (`data-part`; kit/step-parts.ts), so no two controls on the stage
// share a name. The figure's label, the parts shown and the figure's state
// follow the step through the deck's `onStep`, whatever the route (Next or
// Back, a swipe, the lesson menu, an address that names a step, the quiz's
// step links): leaving a step stops its sound and anything it has queued,
// and opens the next step's state; the step showing shown again, as a
// layout switch shows it, stops nothing.

import { q } from '@/features/lessons/kit/dom'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import { playLights } from '@/features/lessons/kit/play-lights'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { registerToy } from '@/features/lessons/kit/step-deck'
import { showParts } from '@/features/lessons/kit/step-parts'
import type { Controls } from './controls'
import { bindControls } from './controls'
import type { Still, VowelFigure } from './figure'
import { mountFigure } from './figure'

/** Each step's figure label. */
export const FIG: Readonly<Record<number, string>> = {
  1: '<span class="fig">Fig. 1</span> The harmonics of one note',
  2: '<span class="fig">Fig. 2</span> The resonances under ‘ee’ and ‘ah’',
  3: '<span class="fig">Fig. 3</span> ‘Ee’, ‘ah’ and ‘oo’',
  4: '<span class="fig">Fig. 4</span> Five vowels, one note',
  5: '<span class="fig">Fig. 5</span> ‘Ah’ in two voices',
}

/** Each step's opening state: its still, the harmonics shown and the curves (WEB-SPEC, Toys 1). */
export const OPENING: Readonly<
  Record<number, { readonly still: Still; readonly n: number }>
> = {
  1: { still: { voice: 'lower', vowel: null, n: 1 }, n: 1 },
  2: { still: { voice: 'lower', vowel: 'ee' }, n: 1 },
  3: { still: { voice: 'lower', vowel: 'ee' }, n: 1 },
  4: { still: { voice: 'lower', vowel: 'ee' }, n: 1 },
  5: { still: { voice: 'lower', vowel: 'ah' }, n: 1 },
}

/** Opens step `n`'s state on the figure: its still, the lower voice, no curves. */
export function openStep(
  n: number,
  figure: VowelFigure,
  controls: Controls,
): void {
  const o = OPENING[n] ?? OPENING[1]
  controls.reset('lower', o.n, false)
  figure.show(o.still)
}

/**
 * Mounts the stage's vowel figure and follows the deck: registered before
 * `deck.start()`, so an address that names a step opens it.
 */
export function initSteps(deck: StepDeck): VowelFigure {
  const root = q('#toyVowels')
  const label = q('[data-fig-label]', root)
  const figure = mountFigure(q('[data-vowel-viz]', root), {
    active: deck.toyActive(1),
    owner: NowPlaying,
  })
  const controls = bindControls(root, figure, playLights())
  openStep(1, figure, controls)
  registerToy({
    onStep(n, previous) {
      if (n === previous) return
      showParts(root, n)
      label.innerHTML = FIG[n] ?? FIG[1]
      openStep(n, figure, controls)
    },
  })
  return figure
}
