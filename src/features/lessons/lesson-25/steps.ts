// ============================================================
// Lesson 25 steps — four steps on one toy
// ============================================================
//
// The steps' stage (WEB-SPEC, Toys 1): one toy in four states
// (minor-toy.ts), Lesson 10's minor staircase on A with its chord column
// over the learner's staff. Step 1 holds natural minor with Raise te and
// the column; Step 2 harmonic minor with its le-to-ti stair outlined;
// Step 3 harmonic minor with Raise le and Play the scale; Step 4 the
// staircase that redraws, over the staff with its signature and the small
// staff in the other clef. Each step's controls are marked with the steps
// they show on (`data-part`; kit/step-parts.ts), and each step's other
// plays sit in its text, where LESSON.md writes them, and play on the toy.
// The toy holds Step 1's Raise te and the column back until the cold
// open's choice (`unlock`), and its clef follows Sing it's voice choice at
// once. Every sound is the page's one (`NowPlaying`).

import { q, qa } from '@/features/lessons/kit/dom'
import { playLights } from '@/features/lessons/kit/play-lights'
import type { Clef } from '@/features/lessons/kit/staff-places'
import { clefForVoice } from '@/features/lessons/kit/staff-places'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { registerToy } from '@/features/lessons/kit/step-deck'
import { showParts } from '@/features/lessons/kit/step-parts'
import type { Voice } from '@/features/lessons/kit/voice-choice'
import { VoiceChoice } from '@/features/lessons/kit/voice-choice'
import type { MinorState, MinorToy } from './minor-toy'
import { MINOR_STATES, mountMinorToy } from './minor-toy'
import type { PlayId } from './sounds'

/** The learner's clef: the bass for the lower voice, or none stored, and the treble for the higher. */
export const clefOf = (v: Voice | null): Clef =>
  v === null ? 'bass' : clefForVoice(v)

/** The four steps' states, by step. */
const STEP_STATES: Readonly<Record<number, MinorState>> = MINOR_STATES

export interface Steps {
  readonly toy: MinorToy
}

/**
 * Mounts the toy and follows the deck: called before `deck.start()`, so an
 * address that names a step opens it.
 */
export function initSteps(deck: StepDeck): Steps {
  const light = playLights()
  const root = q('#toyMinor')
  const toy = mountMinorToy(root, {
    active: deck.toyActive(1),
    clef: clefOf(VoiceChoice.voice),
    state: MINOR_STATES[1],
    light,
  })

  // each step's plays in its text play on the toy, which a phone brings
  // back into view from above the text, so what it lights is seen. On a
  // wide page the next step's text shows before the deck reaches it: a play
  // there shows its own step first, so the toy draws that step's state
  // under that step's heading
  for (const b of qa<HTMLButtonElement>('[data-step-play]')) {
    const id = b.dataset.stepPlay as PlayId
    const step = Number(b.closest<HTMLElement>('[data-step]')?.dataset.step)
    b.addEventListener('click', () => {
      if (step in STEP_STATES && step !== deck.current) deck.show(step)
      deck.showToy()
      light(b, toy.play(id))
    })
  }

  // the toy follows Sing it's voice choice at once
  VoiceChoice.subscribe((v) => toy.setClef(clefOf(v)))

  registerToy({
    onStep(n, previous) {
      // the step showing shown again, as the phone deck and the wide page
      // swap at a rotation or a resize, or Step 1 as the deck starts
      if (n === previous) return
      showParts(root, n)
      toy.setState(STEP_STATES[n] ?? MINOR_STATES[1])
    },
  })
  return { toy }
}
