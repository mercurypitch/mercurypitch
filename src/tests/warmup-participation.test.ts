// ============================================================
// The warmup keeps its "no grades" promise (CLAUDE-JOURNEY-015)
// ============================================================
//
// The help sheet promises "There are no grades and no score here", and the
// shell now shows none for the warm-up (ExerciseShell.ungraded.test.tsx,
// warmup/WarmupExercise.test.tsx). The number the warm-up still keeps for
// the exercise history is the run's coverage: the share of target time the
// singer voiced, whatever the pitch. Before, the runtime banked each step's
// accuracy-weighted `score.total` (pitch, coverage and steadiness blended),
// a grade by any name, and the end screen graded it.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { EXERCISE_HELP } from '@/features/exercises/exercise-help'
import { EXERCISE_WARMUP } from '@/features/exercises/types'
import { warmupStepScore } from '@/features/exercises/warmup/warmup-steps'
import { validateGuidedDynamicClaim } from '@/lib/guided-voice/claims'

describe('warmupStepScore', () => {
  it('banks participation, not the accuracy-weighted total', () => {
    // A singer who hummed along the whole step but wandered in pitch:
    // low total, near-full coverage. The promise says they did the job.
    expect(warmupStepScore({ total: 40, coverage: 95 })).toBe(95)
  })

  it('banks nothing for a step with nothing scoreable', () => {
    // The breathing cycle finalizes without a score object; averaging a
    // zero for it would say the singer failed at breathing.
    expect(warmupStepScore(undefined)).toBeNull()
  })

  it('keeps a silent step at zero — participation is still measured', () => {
    expect(warmupStepScore({ total: 0, coverage: 0 })).toBe(0)
  })
})

describe('the promise and the mechanism stay wired together', () => {
  it('the help sheet promises no grades and no score, and what the end shows', () => {
    const body = EXERCISE_HELP[EXERCISE_WARMUP].body
    expect(body[2]).toBe(
      'There are no grades and no score here. The end screen just counts the steps you finished. Pick the block you need, or run the full warmup before practice.',
    )
  })

  it('the help claims nothing for the voice, and carries the stop line', () => {
    // No source the Find Your Pitch lessons read says a warm-up protects the
    // voice (Lesson 7 FACTS 20 and 76), so the help describes the routine
    // instead: gentle, at the series' speaking volume, with the stop rule.
    const body = EXERCISE_HELP[EXERCISE_WARMUP].body
    expect(body[0]).toBe(
      'A warmup is a gentle start: easy sounds, at about speaking volume, before anything harder. Stop immediately if anything feels uncomfortable.',
    )
    expect(body.join(' ')).not.toMatch(/protect|cords|stretch|muscle/i)
    for (const text of body) {
      expect(
        validateGuidedDynamicClaim({ surface: 'finding', text }).violations,
      ).toEqual([])
    }
  })

  it('the runtime routes through warmupStepScore, not score.total', () => {
    // The banking happens inside a component effect that a render test
    // cannot reach without the whole Zen session; pin the seam in source,
    // the export-filenames idiom.
    const source = readFileSync(
      'src/features/exercises/warmup/WarmupExercise.tsx',
      'utf8',
    )
    expect(source).toContain('warmupStepScore(')
    expect(source).not.toContain('.score?.total')
  })
})
