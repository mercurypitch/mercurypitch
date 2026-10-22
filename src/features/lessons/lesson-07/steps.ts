// ============================================================
// Lesson 7 steps — five steps, one range chart, and Step 5's predict
// ============================================================
//
// Every step shows the one range chart (`toyFor: () => 1`), each in its own
// state (WEB-SPEC, Toys 1): Merc's siren; the siren in three sounds;
// "Twinkle" on the column; the push gauge; two singers and the six voice
// types. Leaving a step stops what the chart was sounding, whatever the
// route: Next or Back, a swipe, the lesson menu, an address that names a
// step and the quiz's step links all come through the deck's `onStep`. The
// step showing, shown again as the phone deck and the wide page swap,
// changes nothing, so a siren playing plays on. Step 5's predict needs no
// sound (Lesson 5's pattern): the choice shows its reveal and the rest of
// the step, which answer it too, and unlocks the two singers and Show all
// six. It never calls a guess wrong.

import { q, qa } from '@/features/lessons/kit/dom'
import { reducedMotion } from '@/features/lessons/kit/motion-switch'
import { mountPredict } from '@/features/lessons/kit/predict'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { registerToy } from '@/features/lessons/kit/step-deck'
import type { RangeState, RangeToy } from './range-toy'
import { mountRangeToy } from './range-toy'

/** Each step's figure label. */
export const FIG: Readonly<Record<number, string>> = {
  1: '<span class="fig">Fig. 1</span> Merc\'s siren on the column',
  2: '<span class="fig">Fig. 2</span> One siren, three sounds',
  3: '<span class="fig">Fig. 3</span> “Twinkle” on the column',
  4: '<span class="fig">Fig. 4</span> The push gauge',
  5: '<span class="fig">Fig. 5</span> Two singers, six voice types',
}

/** The chart's state in each step. */
export const STEP_STATE: Readonly<Record<number, RangeState>> = {
  1: 'siren',
  2: 'sounds',
  3: 'song',
  4: 'push',
  5: 'types',
}

/** The reveal's first line, by the choice: never "right" or "wrong". */
export const TYPES_GUESS: Readonly<Record<string, string>> = {
  same: 'You said: yes, the same type',
  'not-always': 'You said: not always',
}

function initTypesPredict(toy: RangeToy): void {
  const step = q('#step-5')
  const root = q('#predictTypes', step)
  const reveal = q('.reveal', root)
  const hint = q('.lock-hint', root)
  mountPredict(root, {
    // the answer needs no sound: it comes with the choice
    play: () => Promise.resolve(),
    plays: [],
    reveal: [],
    hints: { chosen: '', silent: '', again: '' },
    unlocks: toy.typeControls,
    onChoice: (choice) => {
      hint.hidden = true
      q('.mono', reveal).textContent = TYPES_GUESS[choice] ?? 'You said'
      for (const el of [reveal, ...qa('[data-types-reveal]', step)]) {
        el.hidden = false
        if (!reducedMotion())
          el.animate(
            [
              { transform: 'translateY(10px)', opacity: 0 },
              { transform: 'none', opacity: 1 },
            ],
            { duration: 600, easing: 'cubic-bezier(.16, 1, .3, 1)' },
          )
      }
      // the pressed choice is now disabled: keep the keyboard's place on what it revealed
      reveal.tabIndex = -1
      reveal.focus({ preventScroll: true })
    },
  })
}

export function initSteps(deck: StepDeck): RangeToy {
  const root = q('#toyRange')
  const toy = mountRangeToy(root, { active: deck.toyActive(1) })
  const label = q('[data-fig-label]', root)
  registerToy({
    onStep(n, previous) {
      // the step showing shown again, as the phone deck and the wide page
      // swap at a rotation or a resize: nothing changes, so a siren plays on
      if (n === previous) return
      // a step left behind keeps nothing sounding
      toy.stop()
      toy.setState(STEP_STATE[n] ?? 'siren')
      label.innerHTML = FIG[n] ?? FIG[1]
    },
  })
  initTypesPredict(toy)
  return toy
}
