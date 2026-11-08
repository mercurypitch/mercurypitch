// ============================================================
// Lesson 21 steps — five steps on four toys
// ============================================================
//
// The steps' stage (WEB-SPEC, Toys 1 to 4): Step 1's
// staircase on G beside the staff (stairs-step.ts); the circle of fifths
// beside the staff for Steps 2 and 3, Step 2 on its sharp side, C round to
// A, a scale at 0.3 s a note, and Step 3 on its flat side, C back to E
// flat, at 0.4 s, with Spell it and the white keys from F (circle-step.ts;
// FACTS 63); Find do in Step 4 (find-do.ts); and the walk round the circle
// in Step 5 (kit/circle.ts). The ring opens threaded by semitones, as
// Lesson 2's, and re-threads by fifths the first time Steps 2 or 3 show.
// Each staff is the learner's: the bass clef for the lower voice or none
// stored, the treble for the higher, and every one follows Sing it's voice
// choice at once. Each step's own controls are in its toy, marked with the
// steps they show on (`data-part`; kit/step-parts.ts); Step 3's inline play
// in its mix-up card plays F major spelled both ways on the stage. Every
// sound is the page's one (`NowPlaying`). The steps' stages name the cold
// open's answer, which the spec allows: the welcome tour holds them until
// the choice (FACTS 1a).

import type { CircleToy } from '@/features/lessons/kit/circle'
import { mountCircle } from '@/features/lessons/kit/circle'
import { PARTS } from '@/features/lessons/kit/circle-geometry'
import { q, qa } from '@/features/lessons/kit/dom'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import { playLights } from '@/features/lessons/kit/play-lights'
import { clefForVoice } from '@/features/lessons/kit/staff-places'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { registerToy } from '@/features/lessons/kit/step-deck'
import { showParts } from '@/features/lessons/kit/step-parts'
import { VoiceChoice } from '@/features/lessons/kit/voice-choice'
import type { CircleStep } from './circle-step'
import { mountCircleStep } from './circle-step'
import type { FindDo } from './find-do'
import { mountFindDo } from './find-do'
import { PACE } from './sounds'
import type { StairsStep } from './stairs-step'
import { mountStairsStep } from './stairs-step'

/** Five steps on four toys: the staircase, the circle with the staff (Steps 2 and 3), Find do and the walk. */
export const TOYS: Readonly<Record<number, number>> = {
  1: 1,
  2: 2,
  3: 2,
  4: 3,
  5: 4,
}

/** The learner's clef: the bass for the lower voice, or none stored, and the treble for the higher. */
export const learnerClef = () =>
  VoiceChoice.voice === null ? 'bass' : clefForVoice(VoiceChoice.voice)

/** The circle's figure label in each of its steps. */
const CIRCLE_FIG: Readonly<Record<number, string>> = {
  2: '<span class="fig">Fig. 2</span> The circle of fifths',
  3: '<span class="fig">Fig. 3</span> The circle of fifths',
}

export interface Steps {
  readonly stairs: StairsStep
  readonly circle: CircleStep
  readonly find: FindDo
  readonly walk: CircleToy
}

/**
 * Mounts the four toys and follows the deck: called before `deck.start()`,
 * so an address that names a step opens it.
 */
export function initSteps(deck: StepDeck): Steps {
  const light = playLights()
  const circleRoot = q('#toyCircle')
  const circleLabel = q('[data-fig-label]', circleRoot)
  const stairs = mountStairsStep(q('#toyStairs'), {
    active: deck.toyActive(1),
    clef: learnerClef(),
    light,
  })
  const circle = mountCircleStep(circleRoot, {
    active: deck.toyActive(2),
    part: PARTS.sharps,
    pace: PACE.circle,
    clef: learnerClef(),
    threading: 'semitones',
    light,
  })
  const find = mountFindDo(q('#toyFind'), { clef: learnerClef() })
  const walk = mountCircle(q('#toyWalk'), {
    active: deck.toyActive(4),
    part: PARTS.sharps,
    owner: NowPlaying,
  })

  // Step 3's mix-up card plays on the stage beside it
  for (const b of qa<HTMLButtonElement>('[data-staff-play="both-ways"]'))
    b.addEventListener('click', () => light(b, circle.bothWays()))

  // every staff follows Sing it's voice choice at once
  VoiceChoice.subscribe(() => {
    const c = learnerClef()
    stairs.setClef(c)
    circle.setClef(c)
    find.setClef(c)
  })

  registerToy({
    onStep(n, previous) {
      // the step showing shown again, as the phone deck and the wide page
      // swap at a rotation or a resize, or Step 1 as the deck starts
      if (n === previous) return
      showParts(circleRoot, n)
      if (n === 2 || n === 3) {
        circleLabel.innerHTML = CIRCLE_FIG[n]
        circle.setPart(
          n === 2 ? PARTS.sharps : PARTS.flats,
          n === 2 ? PACE.circle : PACE.step,
        )
        circle.circle.thread('fifths')
      }
    },
  })
  return { stairs, circle, find, walk }
}
