// ============================================================
// Lesson 28 steps — four steps on one score, held for the cold open
// ============================================================
//
// The steps' stage (WEB-SPEC, Toys 2 and 3): one toy in four states
// (score-toy.ts), the song on two staffs. Step 1 plays the song's two
// phrases, each tag fading in over its last bar; Step 2 the three ways from
// bar 7, perfect, interrupted and plagal; Step 3 the form strip over the
// section sounding; Step 4 a part alone at a tap on its staff, or both.
// Each step's controls are marked with the steps they show on
// (`data-part`; kit/step-parts.ts), and each step's other plays sit in its
// text, where LESSON.md writes them, and play on the toy, which a phone
// brings back into view from above the text, so what it lights is seen.
//
// Until the cold open's choice (`unlock`) the toy draws the hero's ten
// empty bars and every play, in the toy and in the text, waits disabled
// with its name kept (FACTS 46); Step 2's text waits for the reveal
// (`reveal`), the held line "Hear both ways at the top to unlock this
// step." in its place.

import { q, qa } from '@/features/lessons/kit/dom'
import { playLights } from '@/features/lessons/kit/play-lights'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { registerToy } from '@/features/lessons/kit/step-deck'
import type { ScorePlayId, StepState } from './score-plays'
import type { ScoreToy } from './score-toy'
import { mountScoreToy } from './score-toy'

export interface Steps {
  readonly toy: ScoreToy
  /** The cold open's choice: the toy draws each step's state, and every play opens. */
  unlock(): void
  /** The cold open's reveal: Step 2's text shows, its held line goes. */
  reveal(): void
}

const isState = (n: number): n is StepState => n >= 1 && n <= 4

/**
 * Mounts the toy and follows the deck: called before `deck.start()`, so
 * an address that names a step opens it.
 */
export function initSteps(deck: StepDeck): Steps {
  const light = playLights()
  const toy = mountScoreToy(q('#toyScore'), {
    state: 1,
    strip: document.querySelector('[data-hero-strip]'),
    light,
  })

  const textPlays = qa<HTMLButtonElement>('[data-step-play]')
  for (const b of textPlays) {
    const id = b.dataset.stepPlay as ScorePlayId
    // on a wide page the next step's text shows before the deck reaches
    // it: a play there shows its own step first, so the toy draws that
    // step's state under that step's heading (Toys 2)
    const step = Number(b.closest<HTMLElement>('[data-step]')?.dataset.step)
    b.addEventListener('click', () => {
      if (isState(step) && step !== deck.current) deck.show(step)
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
