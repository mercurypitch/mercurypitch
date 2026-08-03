// ============================================================
// Challenge result art — which picture the after-run card wears
// ============================================================
//
// Four pieces, chosen by how the run actually went rather than by a flat
// pass/fail. One image used to serve every pass, so a 99 and a 56 were
// congratulated identically and the near-perfect run had nothing of its
// own; one image served every miss, so falling two points short looked the
// same as never finding the note.
//
// Deliberately NOT random. Each band has exactly one piece, so there is
// nothing to draw from and nothing to seed — reopening a result shows what
// it showed the first time, which a per-view shuffle could not promise.

import type { ChallengeResult } from './challenge-result-store'

export type ChallengeArtTier = 'perfect' | 'pass' | 'close' | 'miss'

/**
 * At or above this, the run gets the laurel.
 *
 * Absolute, not relative to the target: 98 means 98 whether the week asked
 * for 55 or for 90. The point of this band is that the singing was nearly
 * flawless, which an easy target cannot confer.
 */
export const PERFECT_SCORE = 98

/**
 * How far under the target still counts as "just short".
 *
 * Points, not a fraction. A fraction would make the band widen with the
 * target — 10% of 90 is nine points but 10% of 40 is four — and the
 * feeling being drawn here is "you nearly had it", which does not shrink
 * because the week was easy.
 */
export const CLOSE_BAND = 10

const ART: Record<ChallengeArtTier, string> = {
  perfect: '/challenges/challenge-perfect.webp',
  pass: '/challenges/challenge-pass.webp',
  close: '/challenges/challenge-close.webp',
  miss: '/challenges/challenge-miss.webp',
}

/** Which band a run falls in. Pure, so the thresholds are testable. */
export function challengeArtTier(
  score: number,
  targetScore: number,
): ChallengeArtTier {
  if (score >= PERFECT_SCORE) return 'perfect'
  if (score >= targetScore) return 'pass'
  // max(0, …) so a very low target cannot put the floor underground and
  // make every run "close" by arithmetic accident.
  if (score >= Math.max(0, targetScore - CLOSE_BAND)) return 'close'
  return 'miss'
}

/** The image for a finished run. */
export function challengeResultArt(result: ChallengeResult): string {
  return ART[challengeArtTier(result.score, result.targetScore)]
}

/** Every piece, for preloading and for the test that guards the mapping. */
export const CHALLENGE_RESULT_ART = ART
