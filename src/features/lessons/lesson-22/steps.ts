// ============================================================
// Lesson 22 steps — four steps, one band chart, and Step 3's predict
// ============================================================
//
// Every step shows the one band chart toy (`toyFor: () => 1`; vib-toy.ts),
// each in its own state (WEB-SPEC, Toys 2): a level line, a wave and a
// swell; rate and extent; the wave and its middle; the sung wave beside
// the app's mark. The figure's label, which controls show and the chart's
// state follow the step, through the deck's `onStep`, whatever the route:
// opening a state stops what the toy plays. The step showing shown again,
// as the phone deck and the wide page swap at a rotation or a resize,
// stops nothing.
//
// Until the cold open's choice the toy draws only its band and every
// control is disabled under its lock line, and Step 3's predict is held
// too: its choices and both its plays disabled, its hint "Choose an answer
// at the top first." (WEB-SPEC, Toys 3). The choice reaches here through
// `unlock`, which the cold open's predict calls (`onChoice`): the toy opens,
// Step 3's hint becomes "Choose an answer to unlock the slow wave.", its
// choices and Play: six a second enable, and only then does its predict
// mount, so the hint the kit keeps and puts back after a free play heard
// before a choice (kit/predict.ts) is that second one. Its two plays draw on
// the toy in Step 3's state. Its choice unlocks the toy's Rate, Play at
// this rate and Drift, and reaches free play and the quick check
// (`onHeld`), so the slow wave cannot sound anywhere before it; the reveal
// shows its four parts once the slow wave has been heard to its end with
// sound on: the reveal, Tavi's line, the mix-up card, and Try with Notice.
// No Merc reacts to it: Merc and Tavi live in the hero. The step has no Go
// deeper drawer: its one item, "Which middle?", is Length's first cut
// (WEB-SPEC, Length), and FACTS 19 keeps its numbers.

import { clamp, q, qa } from '@/features/lessons/kit/dom'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import { mountPredict } from '@/features/lessons/kit/predict'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { registerToy } from '@/features/lessons/kit/step-deck'
import type { PlayKey } from './sounds'
import type { VibState } from './vib-picture'
import type { VibToy } from './vib-toy'
import { mountVibToy } from './vib-toy'

/** Step 3's predict: its hints and its guesses, LESSON.md's (FACTS 21, 24). */
export const PREDICT_3 = {
  /** Until the cold open's choice, as the markup has it. */
  held: 'Choose an answer at the top first.',
  /** From the cold open's choice: the hint the kit keeps. */
  open: 'Choose an answer to unlock the slow wave.',
  hints: {
    chosen: 'Locked in. Play the slow wave.',
    silent: 'Sound is off: nothing played. Turn sound on, then play it again.',
    again: 'Play either wave again.',
  },
  guess: (choice: string): string =>
    choice === 'one'
      ? 'You said: still one note'
      : 'You said: a note that moves',
} as const

export interface Steps {
  readonly toy: VibToy
  /** The cold open's choice is in: the toy opens, and Step 3's predict mounts. */
  unlock(): void
}

export interface StepsOptions {
  /** Step 3's choice, for free play's held plays and the quick check's question 3. */
  readonly onHeld?: () => void
}

const LOCK = '<svg class="ico" aria-hidden="true"><use href="#i-lock"/></svg>'

/** Opens Step 3's predict on the toy, with the hint the kit is to keep. */
function mountStep3(toy: VibToy, o: StepsOptions): void {
  const card = q('#predict3')
  q('.lock-hint', card).innerHTML = `${LOCK}${PREDICT_3.open}`
  for (const b of qa<HTMLButtonElement>(
    '.choice, [data-play][data-free]',
    card,
  ))
    b.disabled = false
  mountPredict(card, {
    play: (what, audible) => toy.play(what as PlayKey, audible),
    hints: PREDICT_3.hints,
    revealOn: ['two'],
    guess: PREDICT_3.guess,
    onChoice: () => {
      toy.unlockHeld()
      o.onHeld?.()
    },
    reveal: [q('.reveal', card), ...qa('[data-reveal3]')],
  })
}

/**
 * Mounts the stage's band chart, held back until the cold open's choice,
 * and follows the deck: called before `deck.start()`, so an address that
 * names a step opens it.
 */
export function initSteps(deck: StepDeck, o: StepsOptions = {}): Steps {
  const toy = mountVibToy(q('#toyChart'), {
    active: deck.toyActive(1),
    owner: NowPlaying,
  })
  registerToy({
    onStep(n, previous) {
      if (n === previous) return
      toy.setState(clamp(n, 1, 4) as VibState)
    },
  })
  let open = false
  return {
    toy,
    unlock() {
      if (open) return
      open = true
      toy.unlock()
      mountStep3(toy, o)
    },
  }
}
