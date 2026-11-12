// ============================================================
// Lesson 20 free play — the staircase and the run, every switch from the steps
// ============================================================
//
// In the Wrap (WEB-SPEC, Sections 8): the steps' two toys unlocked and side
// by side, the staircase with every state, Leave out fa and ti, Major ·
// Minor and the Slide, and the run toy with every control, Tempo, Play the
// run, Play it smudged, Staccato · Legato and See it on the staff, with no
// reveal or quiz attached. Both follow Sing it's voice choice, each draws
// only while it is on screen, and every sound is the page's one. Leaving
// free play stops what it plays. It loads after first paint, as a chunk of
// its own (main.ts).

import { q } from '@/features/lessons/kit/dom'
import { watch } from '@/features/lessons/kit/frame-loop'
import { onLeave } from '@/features/lessons/kit/leave'
import { playLights } from '@/features/lessons/kit/play-lights'
import { VoiceChoice } from '@/features/lessons/kit/voice-choice'
import type { RunToy } from './run-toy'
import { mountRunToy, RUN_STATES } from './run-toy'
import type { StairsStep } from './stairs-step'
import { mountStairsStep, STAIRS_STATES } from './stairs-step'

export interface FreePlay {
  readonly stairs: StairsStep
  readonly run: RunToy
}

export function initFreePlay(): FreePlay {
  const root = q('#freePlay')
  const stairsRoot = q('#freeStairs', root)
  const runRoot = q('#freeRun', root)
  const light = playLights()
  const stairs = mountStairsStep(stairsRoot, {
    active: watch(q('canvas', stairsRoot)),
    voice: VoiceChoice.voice,
    state: STAIRS_STATES.free,
    light,
  })
  const run = mountRunToy(runRoot, {
    active: watch(q('canvas', runRoot)),
    voice: VoiceChoice.voice,
    state: RUN_STATES.free,
    light,
  })
  VoiceChoice.subscribe((v) => {
    stairs.setVoice(v)
    run.setVoice(v)
  })
  onLeave(root, () => {
    stairs.stop()
    run.stop()
  })
  return { stairs, run }
}
