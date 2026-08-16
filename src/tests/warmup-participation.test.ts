// ============================================================
// The warmup keeps its "no grades" promise (CLAUDE-JOURNEY-015)
// ============================================================
//
// Both the help sheet and the idle card promise "There are no grades
// here — the score just reflects that you sang along", but the runtime
// banked each step's accuracy-weighted `score.total` (pitch, coverage
// and steadiness blended) — a grade by any name. The banked number is
// now the run's coverage: the share of target time the singer voiced,
// whatever the pitch. That is what "you sang along" measures.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { EXERCISE_HELP } from '@/features/exercises/exercise-help'
import { EXERCISE_WARMUP } from '@/features/exercises/types'
import { warmupStepScore } from '@/features/exercises/warmup/warmup-steps'

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
  it('the help sheet still makes the promise', () => {
    const body = EXERCISE_HELP[EXERCISE_WARMUP].body.join(' ')
    expect(body).toContain('There are no grades here')
    expect(body).toContain('you sang along')
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
