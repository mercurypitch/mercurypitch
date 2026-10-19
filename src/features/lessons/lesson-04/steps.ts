// ============================================================
// Lesson 4 steps — five steps, one staircase, and step 3's predict
// ============================================================
//
// Every step shows the one staircase (`toyFor: () => 1`), each in its own
// state (WEB-SPEC, Toys 1): on C with the step sizes; Group; the slide with
// White keys only; the names switch; Stop on ti and Land on do. Step 3's
// predict sits in the step text after orange's line: a guess unlocks Play
// white keys from D and Play the pattern from D, each sliding the staircase
// to D first. The reveal waits until both have been heard, so it describes
// what was played, and it never calls a guess wrong.

import { q } from '@/features/lessons/kit/dom'
import type { ModeStore } from '@/features/lessons/kit/names'
import { mountPredict } from '@/features/lessons/kit/predict'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { registerToy } from '@/features/lessons/kit/step-deck'
import type { StairsStep, StairsToy } from './stairs-toy'
import { mountStairsToy } from './stairs-toy'
import type { NamesMode } from './stairs-words'

const D4 = 62

/** Each step's figure label. */
const FIG: Readonly<Record<number, string>> = {
  1: '<span class="fig">Fig. 1</span> The staircase',
  2: '<span class="fig">Fig. 2</span> Two groups and a joint',
  3: '<span class="fig">Fig. 3</span> Any start',
  4: '<span class="fig">Fig. 4</span> The names',
  5: '<span class="fig">Fig. 5</span> Ti and do',
}

const GUESS: Readonly<Record<string, string>> = {
  same: 'You said: same keys, same scale',
  changes: 'You said: it changes',
}

function initPredict(toy: StairsToy): void {
  mountPredict(q('#predictD'), {
    play: async (what, audible) => {
      await toy.slideTo(D4)
      if (what === 'white-d') await toy.playWhite(audible)
      else await toy.playUp(audible)
    },
    revealOn: ['white-d', 'major-d'],
    revealAfter: 'all',
    hints: {
      chosen: 'Locked in. Play both, and watch the staircase.',
      next: 'Now play the other one.',
      silent:
        'Sound is off, so nothing played. Turn sound on to hear them, then press Play the pattern from D.',
      again: 'Play them again, or slide the staircase to any start.',
    },
    guess: (choice) => GUESS[choice] ?? 'You said',
  })
}

export function initSteps(
  deck: StepDeck,
  names: ModeStore<NamesMode>,
): StairsToy {
  const root = q('#toyStairs')
  const toy = mountStairsToy(root, { active: deck.toyActive(1), names })
  const label = q('[data-fig-label]', root)
  registerToy({
    onStep(n) {
      toy.setStep(n as StairsStep)
      label.innerHTML = FIG[n] ?? FIG[1]
    },
  })
  initPredict(toy)
  return toy
}
