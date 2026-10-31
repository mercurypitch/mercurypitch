// ============================================================
// The result's words, per tier — pure, for every surface that shows one
// ============================================================
//
// The app's result card and the native Legend room say the same thing about
// the same take. Kept out of ChallengeResultCard.tsx so the room can read it
// without the card, its portal and its stores.

import type { ChallengeResult } from './challenge-result-store'

/** Headline + line per tier, pure for tests. */
export function challengeResultCopy(result: ChallengeResult): {
  headline: string
  line: string
} {
  if (result.tier === 'beat-founder') {
    return {
      headline: 'You beat the Founder',
      line: `${result.score}% on "${result.title}" — the top of the mountain just changed hands.`,
    }
  }
  if (result.tier === 'completed') {
    return {
      headline: 'Legend complete',
      line: `${result.score}% on "${result.title}" — target was ${result.targetScore}%. That run is on the board.`,
    }
  }
  return {
    headline: 'Not this time',
    line: `You reached ${result.score}% — the Legend asks for ${result.targetScore}%. Every run trains the climb.`,
  }
}
