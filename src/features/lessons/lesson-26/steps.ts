// ============================================================
// Lesson 26 steps — four steps on one tune line, held for the cold open
// ============================================================
//
// The steps' stage (WEB-SPEC, Toys 2): one toy in four states
// (part-toy.ts), the kit's tune line with a second voice beside the tune.
// Step 1 walks the thirds up the scale; Step 2 shows "Twinkle" with its
// copy, the switch between C major's thirds and four semitones up; Step 3
// the part above or below, and Merc and Tavi; Step 4 the chord under the
// two parts. Each step's controls are marked with the steps they show on
// (`data-part`; kit/step-parts.ts), and each step's other plays sit in its
// text, where LESSON.md writes them, and play on the toy, which a phone
// brings back into view from above the text, so what it lights is seen.
//
// Until the cold open's choice (`unlock`) the toy draws the hero's plain
// "Twinkle" and every play, in the toy and in the text, waits disabled with
// its name kept (FACTS 40); Steps 1 and 2's words wait for the reveal
// (`reveal`), the held line "Hear the copy at the top to unlock this step."
// in their place (FACTS 41).

import { q, qa } from '@/features/lessons/kit/dom'
import { playLights } from '@/features/lessons/kit/play-lights'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { registerToy } from '@/features/lessons/kit/step-deck'
import type { PlayId, StepState } from './part-shapes'
import type { PartToy } from './part-toy'
import { mountPartToy } from './part-toy'

export interface Steps {
  readonly toy: PartToy
  /** The cold open's choice: the toy draws each step's state, and every play opens. */
  unlock(): void
  /** The cold open's reveal: Steps 1 and 2's words show, their held lines go. */
  reveal(): void
}

const isState = (n: number): n is StepState => n >= 1 && n <= 4

/**
 * Mounts the toy and follows the deck: called before `deck.start()`, so
 * an address that names a step opens it.
 */
export function initSteps(deck: StepDeck): Steps {
  const light = playLights()
  const root = q('#toyTune')
  const toy = mountPartToy(root, {
    active: deck.toyActive(1),
    state: 1,
    light,
  })

  const textPlays = qa<HTMLButtonElement>('[data-step-play]')
  for (const b of textPlays) {
    const id = b.dataset.stepPlay as PlayId
    b.addEventListener('click', () => {
      deck.showToy()
      light(b, toy.play(id))
    })
  }

  registerToy({
    onStep(n, previous) {
      // the step showing shown again, as the phone deck and the wide page
      // swap at a rotation or a resize, or Step 1 as the deck starts
      if (n === previous) return
      toy.setState(isState(n) ? n : 1)
    },
  })

  return {
    toy,
    unlock() {
      toy.unlock()
      for (const b of textPlays) b.disabled = false
    },
    reveal() {
      for (const el of qa('.held-line[data-held-line]')) el.hidden = true
      for (const el of qa('.held-body[data-held]')) el.hidden = false
    },
  }
}
