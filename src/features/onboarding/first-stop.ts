// ============================================================
// First Light — which room to light on the Map (pure)
// ============================================================
//
// Turns what we just heard into one recommendation with a reason.
// The reason matters as much as the room: "your tone wavers — let's
// steady it" reads as an observation, "recommended for you" reads as
// a guess.
//
// Thresholds are not invented. Both scoring curves in
// src/lib/mirror/metrics.ts have their knee at 70 — `matchScore`
// returns 70 at 35 cents of deviation, `steadinessScore` returns 70
// at 20 cents of wobble — so 70 is the line the maths itself draws
// between "solid" and "worth working on".
//
// See docs/plans/onboarding-first-light.md.

import type { MirrorResult } from '@/lib/mirror/metrics'
import type { RoomId } from './rooms'

/** Below this, a 0–100 score counts as the thing to work on first. */
export const WEAK_SCORE = 70

/**
 * Under one octave of comfortable range is worth growing before
 * anything else. Most untrained adult singers measure 1.5–2 octaves.
 */
export const NARROW_RANGE_SEMITONES = 12

export interface FirstStop {
  room: RoomId
  /** Optional drill or week within the room. */
  detail: string | null
  /** Shown on the card, in the coach's voice. Never a verdict. */
  reason: string
}

/** Where someone with nothing measured should start. */
const DEFAULT_STOP: FirstStop = {
  room: 'practice',
  detail: null,
  reason: 'Start here — everything else branches off it.',
}

/**
 * Pick the first stop from a voiceprint. Pass null (short track, or
 * the mic was denied) to get the neutral default.
 *
 * When both scored dimensions are weak the LOWER one wins rather than
 * a fixed priority order — the singer should be sent to whichever is
 * actually further behind. Range is only consulted once both scores
 * are solid, because it is measured in semitones and cannot be
 * compared against a 0–100 score.
 */
export function pickFirstStop(result: MirrorResult | null): FirstStop {
  if (result === null) return DEFAULT_STOP

  const steadiness = result.steadiness?.score ?? null
  const accuracy = result.accuracy?.score ?? null

  const steadyWeak = steadiness !== null && steadiness < WEAK_SCORE
  const accurateWeak = accuracy !== null && accuracy < WEAK_SCORE

  // Both weak → send them to whichever is further behind.
  if (steadyWeak && accurateWeak) {
    return steadiness <= (accuracy ?? Infinity)
      ? STEADINESS_STOP
      : ACCURACY_STOP
  }
  if (steadyWeak) return STEADINESS_STOP
  if (accurateWeak) return ACCURACY_STOP

  const semitones = result.range?.semitones ?? null
  if (semitones !== null && semitones < NARROW_RANGE_SEMITONES) {
    return RANGE_STOP
  }

  // Nothing measured at all (every task failed to produce a result)
  // is not the same as everything being strong — don't congratulate.
  if (steadiness === null && accuracy === null && semitones === null) {
    return DEFAULT_STOP
  }

  return STRONG_STOP
}

const STEADINESS_STOP: FirstStop = {
  room: 'exercises',
  detail: 'Long Note',
  reason: "Your tone wavers when you hold — let's steady it.",
}

const ACCURACY_STOP: FirstStop = {
  room: 'exercises',
  detail: 'Interval Trainer',
  reason: 'Your ear is close but not yet locked onto the note.',
}

const RANGE_STOP: FirstStop = {
  room: 'ascent',
  detail: 'Range week',
  reason: "There's more voice up there than you're using.",
}

const STRONG_STOP: FirstStop = {
  room: 'karaoke',
  detail: null,
  reason: "That was solid — you're ready to sing a real song.",
}
