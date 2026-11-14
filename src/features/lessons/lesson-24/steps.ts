// ============================================================
// Lesson 24 steps — four steps, one drone chart, and Step 2's predict
// ============================================================
//
// Every step shows the one drone chart toy (`toyFor: () => 1`;
// drone-toy.ts), each in its own state (WEB-SPEC, Toys 2): close notes, the
// beads, the band on mi and the wave. The figure's label, its controls and
// its window follow the step through the deck's `onStep`, whatever the
// route, and opening a state stops what the toy plays; the step showing
// shown again, as the phone deck and the wide page swap at a rotation or a
// resize, stops nothing. The steps' own plays draw on the toy in their
// state: Step 1's 222 and its octave, Step 3's piano and pure mi, Step 4's
// wave and straight fifth.
//
// Until the cold open's choice the toy draws only the drone's band and
// every control is disabled under its lock line, and Step 2's predict is
// held too: its choices and both its plays disabled, its hint "Choose an
// answer at the top first." (Toys 3). The choice reaches here through
// `unlock`, which the cold open's predict calls (`onChoice`): the toy's
// Step 1 opens, Step 2's hint becomes "Choose an answer to unlock the two
// intervals.", its choices enable, and only then does its predict mount, so
// the hint the kit keeps is that second one. Its two plays draw on the toy
// in Step 2's state; its choice opens Step 2's controls and Steps 3 and 4's
// states and plays, and reaches free play and Sing it's listening path
// (`onStep2`); its reveal, once both intervals have been heard to their end
// with sound on, shows the step's text and Step 3's, which lean on the
// answer, and hides Step 3's held line (FACTS 46). The cold open's reveal
// shows Step 1's text, which says its answer (`revealStep1`).

import { clamp, q, qa } from '@/features/lessons/kit/dom'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import { playLights } from '@/features/lessons/kit/play-lights'
import { mountPredict } from '@/features/lessons/kit/predict'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { registerToy } from '@/features/lessons/kit/step-deck'
import type { DroneState } from './drone-picture'
import type { DroneToy } from './drone-toy'
import { mountDroneToy, PLAY_STATE } from './drone-toy'
import type { PlayKey } from './sounds'

/** Step 2's predict: its hints and its guesses, LESSON.md's. */
export const PREDICT_2 = {
  /** Until the cold open's choice, as the markup has it. */
  held: 'Choose an answer at the top first.',
  /** From the cold open's choice: the hint the kit keeps. */
  open: 'Choose an answer to unlock the two intervals.',
  hints: {
    chosen: 'Locked in. Play both intervals.',
    silent: 'Sound is off: nothing played. Turn sound on, then play it again.',
    again: 'Play either of them again.',
  },
  guess: (choice: string): string =>
    choice === 'fifth' ? 'You said: the fifth' : 'You said: the major third',
} as const

export interface Steps {
  readonly toy: DroneToy
  /** The cold open's choice is in: the toy's Step 1 opens, and Step 2's predict mounts. */
  unlock(): void
  /** The cold open's reveal: Step 1's text, which says its answer, shows. */
  revealStep1(): void
}

export interface StepsOptions {
  /** Step 2's choice, for free play's held states and Sing it's listening path. */
  readonly onStep2?: () => void
}

const LOCK = '<svg class="ico" aria-hidden="true"><use href="#i-lock"/></svg>'

/** Shows a step's held elements and hides its held line. */
function reveal(n: 1 | 3, selector: string): void {
  for (const el of qa(selector)) el.hidden = false
  const held = document.querySelector<HTMLElement>(`[data-held="${n}"]`)
  if (held !== null) held.hidden = true
}

/** A play on the chart, in its own step (`initSteps`). */
type PlayOn = (key: PlayKey, audible?: boolean) => Promise<boolean>

/** Opens Step 2's predict on the toy, with the hint the kit is to keep. */
function mountStep2(play: PlayOn, step2: () => void): void {
  const card = q('#predict2')
  q('.lock-hint', card).innerHTML = `${LOCK}${PREDICT_2.open}`
  for (const b of qa<HTMLButtonElement>('.choice', card)) b.disabled = false
  mountPredict(card, {
    play: (what, audible) => play(what as PlayKey, audible),
    hints: PREDICT_2.hints,
    revealOn: ['fifth', 'third'],
    revealAfter: 'all',
    guess: PREDICT_2.guess,
    onChoice: step2,
    reveal: [q('.reveal', card), ...qa('[data-reveal2]')],
    onReveal: () => {
      reveal(3, '[data-reveal2]')
    },
  })
}

/**
 * Mounts the stage's drone chart, held back until the cold open's choice,
 * and follows the deck: called before `deck.start()`, so an address that
 * names a step opens it.
 */
export function initSteps(deck: StepDeck, o: StepsOptions = {}): Steps {
  const toy = mountDroneToy(q('#toyChart'), {
    active: deck.toyActive(1),
    owner: NowPlaying,
  })
  registerToy({
    onStep(n, previous) {
      if (n === previous) return
      toy.setState(clamp(n, 1, 4) as DroneState)
    },
  })
  /**
   * Plays `key` on the chart, in its own step. On a wide page the next
   * step's text shows before the deck reaches it: a play there shows its
   * own step first, so the chart draws that step's state under that step's
   * heading, where the toy alone would change state under the step before's.
   * A phone brings the stage back into view from above the text, so what
   * the play draws is seen.
   */
  const playOn: PlayOn = (key, audible) => {
    if (PLAY_STATE[key] !== deck.current) deck.show(PLAY_STATE[key])
    deck.showToy()
    return toy.play(key, audible)
  }
  const light = playLights()
  const stepPlays = qa<HTMLButtonElement>('[data-step-play]')
  for (const b of stepPlays) {
    const key = b.dataset.stepPlay as PlayKey
    b.addEventListener('click', () => {
      if (b.disabled) return
      light(b, playOn(key))
    })
  }
  /** The steps' plays a choice opens: Step 1's with the cold open's, the rest with Step 2's. */
  const open = (cold: boolean, step2: boolean): void => {
    for (const b of stepPlays) {
      const needs2 = PLAY_STATE[b.dataset.stepPlay as PlayKey] > 1
      b.disabled = needs2 ? !step2 : !cold
    }
  }
  open(false, false)
  let cold = false
  let second = false
  const step2 = (): void => {
    if (second) return
    second = true
    toy.unlockStep2()
    open(true, true)
    o.onStep2?.()
  }
  return {
    toy,
    unlock() {
      if (cold) return
      cold = true
      toy.unlock()
      open(true, second)
      mountStep2(playOn, step2)
    },
    revealStep1() {
      reveal(1, '[data-reveal1]')
    },
  }
}
