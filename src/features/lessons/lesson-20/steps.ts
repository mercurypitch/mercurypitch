// ============================================================
// Lesson 20 steps — four steps on two toys
// ============================================================
//
// The steps' stage (WEB-SPEC, Toys 1 and 5): the staircase for Steps 1 and
// 2 (stairs-step.ts), fa and ti left out in Step 1 and the five from la in
// Step 2; Merc's run as beads on a string for Steps 3 and 4 (run-toy.ts),
// Tempo and Play it smudged in Step 3, Staccato · Legato in Step 4. Each
// step's inline plays play on the stage beside it, lit while they sound:
// Play C major, then the five (Step 1); Play both and Play it on C (Step
// 2); Play staccato, then legato (Step 4). Both toys follow Sing it's voice
// choice at once: the staircase on C3 or C4, the run Merc's from D3 or
// Tavi's from D4, the staff in the bass or the treble clef. Every sound is
// the page's one (`NowPlaying`).

import { q, qa } from '@/features/lessons/kit/dom'
import { playLights } from '@/features/lessons/kit/play-lights'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { registerToy } from '@/features/lessons/kit/step-deck'
import { VoiceChoice } from '@/features/lessons/kit/voice-choice'
import type { RunToy } from './run-toy'
import { mountRunToy, RUN_STATES } from './run-toy'
import type { StairsStep } from './stairs-step'
import { mountStairsStep, STAIRS_STATES } from './stairs-step'

/** Four steps on two toys: the staircase, then the run. */
export const toyFor = (step: number): number => (step <= 2 ? 1 : 2)

export interface Steps {
  readonly stairs: StairsStep
  readonly run: RunToy
}

/**
 * Mounts the two toys and follows the deck: called before `deck.start()`,
 * so an address that names a step opens it.
 */
export function initSteps(deck: StepDeck): Steps {
  const light = playLights()
  const stairs = mountStairsStep(q('#toyStairs'), {
    active: deck.toyActive(1),
    voice: VoiceChoice.voice,
    state: STAIRS_STATES[1],
    light,
  })
  const run = mountRunToy(q('#toyRun'), {
    active: deck.toyActive(2),
    voice: VoiceChoice.voice,
    state: RUN_STATES[3],
    light,
  })

  const PLAYS: Readonly<Record<string, () => Promise<boolean>>> = {
    'major-five': () => stairs.majorThenFive(),
    both: () => stairs.both(),
    'on-c': () => stairs.onC(),
    touch: () => run.touchBoth(),
  }
  for (const b of qa<HTMLButtonElement>('[data-step-play]')) {
    const play = PLAYS[b.dataset.stepPlay ?? '']
    if (play !== undefined) b.addEventListener('click', () => light(b, play()))
  }

  // both toys follow Sing it's voice choice at once
  VoiceChoice.subscribe((v) => {
    stairs.setVoice(v)
    run.setVoice(v)
  })

  registerToy({
    onStep(n, previous) {
      // the step showing shown again, as the phone deck and the wide page
      // swap at a rotation or a resize, or Step 1 as the deck starts
      if (n === previous) return
      if (n === 1 || n === 2) stairs.setState(STAIRS_STATES[n])
      else stairs.stop()
      if (n === 3 || n === 4) run.setState(RUN_STATES[n])
      else run.stop()
    },
  })
  return { stairs, run }
}
