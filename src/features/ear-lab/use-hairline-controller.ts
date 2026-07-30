// ============================================================
// Hairline controller — 2AFC pitch discrimination on top of the
// shared threshold-run engine (use-threshold-run.ts).
//
// All the staircase/calibration machinery lives in the engine;
// this file is only the stimulus: two tones separated by the
// current staircase gap, higher-first at a coin flip, base pitch
// roved log-uniformly between rounds so absolute pitch memory
// cannot substitute for the discrimination being measured.
// ============================================================

import type { ThresholdDrill } from '@/lib/ear/drills'
import { useThresholdRun } from './use-threshold-run'

const TONE_MS = 500
const GAP_MS = 220

/** Rove the base log-uniformly across A3..A5. */
function roveBaseFreq(random: () => number): number {
  return 220 * 2 ** (random() * 2)
}

interface AudioLike {
  playTone: (freq: number, durationMs?: number) => Promise<void>
}

export function useHairlineController(
  drill: ThresholdDrill,
  audioEngine: AudioLike,
) {
  let higherFirst = false

  const run = useThresholdRun(drill, async (level, api) => {
    const base = roveBaseFreq(Math.random)
    higherFirst = Math.random() < 0.5
    const higher = base * 2 ** (level / 1200)

    api.step(1)
    await audioEngine.playTone(higherFirst ? higher : base, TONE_MS)
    if (api.cancelled()) return
    await new Promise((resolve) => setTimeout(resolve, GAP_MS))
    if (api.cancelled()) return
    api.step(2)
    await audioEngine.playTone(higherFirst ? base : higher, TONE_MS)
  })

  function answer(pick: 'first' | 'second'): void {
    run.answerCorrect((pick === 'first') === higherFirst)
  }

  return {
    ...run,
    levelCents: run.level,
    answer,
  }
}
