// ============================================================
// Warmup steps — the shape the warm-up runtime walks
// ============================================================
//
// Standard vocal-pedagogy warmup blocks: relaxed breathing, gentle
// hums, lip trills, sirens, and a light ascending scale. A "pattern"
// (from a daily-routine segment or the exercise's own picker) selects
// which blocks run, so the routine warmup slots are actually guided
// instead of "warm up on your own".
//
// The blocks themselves no longer live here. They are authored Zen exercises
// in `warmup-exercises.ts`, and a `WarmupStep` is a projection of one — which
// is what makes a warm-up changeable without a deploy. This module keeps the
// pattern vocabulary, because six pattern ids are written into stored routine
// segments and into `segmentVariantLabel`, and those cannot move.

import { warmupPatternExercises, warmupStepFromExercise, } from './warmup-exercises'

export type WarmupStepKind = 'breath' | 'sing'

export interface WarmupStep {
  /** Short name shown large during the step ("Lip trills"). */
  name: string
  kind: WarmupStepKind
  /** One-line coaching instruction for the step. */
  instruction: string
  /**
   * For sing steps: semitone offsets relative to the singer's comfort note,
   * played as the reference melody before their sing-back window.
   */
  offsets?: number[]
  /** Sing-back / timer window in seconds. */
  seconds: number
}

export type WarmupPattern =
  | 'full'
  | 'gentle'
  | 'lip-trill'
  | 'sirens'
  | 'ascending-scale'
  | 'cooldown'

export const WARMUP_PATTERN_LABELS: Record<WarmupPattern, string> = {
  full: 'Full warmup',
  gentle: 'Gentle (breath + hums)',
  'lip-trill': 'Lip trills',
  sirens: 'Sirens',
  'ascending-scale': 'Scales',
  cooldown: 'Cool-down',
}

/** Resolve a routine/segment pattern string to a known pattern. */
export function normalizeWarmupPattern(
  pattern: string | undefined,
): WarmupPattern {
  switch (pattern) {
    case 'lip-trill':
    case 'sirens':
    case 'ascending-scale':
    case 'gentle':
    case 'cooldown':
      return pattern
    case 'free-sing':
    case 'humming':
      return 'cooldown'
    default:
      return 'full'
  }
}

export function buildWarmupSteps(pattern: WarmupPattern): WarmupStep[] {
  return warmupPatternExercises(pattern).map(warmupStepFromExercise)
}

export function warmupTotalSeconds(steps: WarmupStep[]): number {
  // Sing steps also spend ~0.45s per reference note before the sing window.
  return steps.reduce(
    (sum, s) => sum + s.seconds + (s.offsets?.length ?? 0) * 0.45,
    0,
  )
}
