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
  /**
   * The approach run before the first block, from the authored count-in —
   * time the singer spends watching the playhead come, not singing.
   */
  leadInSeconds?: number
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

/**
 * The breather between steps: the finished loop settles, the next step's
 * name is announced, then its own lead-in begins. Together with the
 * count-in this is what stands between the breathing step and the first
 * sung note — the collision the owner reported.
 */
export const WARMUP_STEP_GAP_SECONDS = 1.5

export function warmupTotalSeconds(steps: WarmupStep[]): number {
  // Loop time plus each step's lead-in, plus the gap between steps. The
  // 0.45 s-per-note term this used to carry priced reference tones deleted
  // in 7a4821dc; it survived two releases as pure fiction.
  const stepSeconds = steps.reduce(
    (sum, s) => sum + s.seconds + (s.leadInSeconds ?? 0),
    0,
  )
  return stepSeconds + WARMUP_STEP_GAP_SECONDS * Math.max(0, steps.length - 1)
}
