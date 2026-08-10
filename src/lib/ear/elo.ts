// ============================================================
// Ear Lab — Elo over a calibrated item bank (Ruler B).
//
// Naming a chord quality has no continuous unit, so identification
// drills borrow what adaptive-learning systems settled on: an Elo
// rating against items whose difficulty is frozen once calibrated.
// Because the item scale cannot drift, "Harmony 1420, up from 1180"
// stays meaningful even though the items being served got harder —
// which is precisely what percent-correct cannot do.
// ============================================================

/** Where a new ear starts. Mid-scale, so the first few items move it
 *  hard in whichever direction the answers point. */
export const DEFAULT_RATING = 1200

/** Elo's logistic width: 400 points ≈ a 10:1 odds difference. */
export const RATING_SCALE = 400

/** Attempts before an item's difficulty is frozen. After this the
 *  item is a fixed yardstick — the scale must stop moving or the
 *  whole "your rating rose" claim dissolves. */
export const CALIBRATION_ATTEMPTS = 200

/** Below this, a player rating is still settling; show it as a range
 *  rather than a number, and keep it off the certificate. */
export const PROVISIONAL_ATTEMPTS = 10

export interface Rating {
  rating: number
  attempts: number
}

export interface KFactorConfig {
  max: number
  min: number
  /** Attempts at which the step has fallen halfway to `min`. */
  decay: number
}

/** Players move fast at first, then settle. */
export const PLAYER_K: KFactorConfig = { max: 64, min: 8, decay: 12 }

/** Items move slower than the players rating them — one confused
 *  beginner should not restate what an item is worth. */
export const ITEM_K: KFactorConfig = { max: 24, min: 2, decay: 40 }

export function newRating(rating: number = DEFAULT_RATING): Rating {
  return { rating, attempts: 0 }
}

export function isProvisional(rating: Rating): boolean {
  return rating.attempts < PROVISIONAL_ATTEMPTS
}

/** Elo's step size, shrinking with experience: quick convergence for
 *  a new ear, stable readings once it is known. */
export function kFactor(attempts: number, config: KFactorConfig): number {
  return config.min + (config.max - config.min) / (1 + attempts / config.decay)
}

/** Probability of a correct answer, floored by the guess rate.
 *
 *  A 7-button scale-degree item comes up right 1/7 of the time on
 *  luck alone. Modelling that floor (the lower asymptote of a 3PL
 *  curve) keeps wide-choice drills from handing out rating for
 *  nothing — without it, `Home` inflates against `Leap`. */
export function expectedScore(
  rating: number,
  difficulty: number,
  guessRate = 0,
): number {
  const skill = 1 / (1 + 10 ** ((difficulty - rating) / RATING_SCALE))
  return guessRate + (1 - guessRate) * skill
}

export function updateRating(
  player: Rating,
  difficulty: number,
  correct: boolean,
  guessRate = 0,
): Rating {
  const expected = expectedScore(player.rating, difficulty, guessRate)
  const k = kFactor(player.attempts, PLAYER_K)
  return {
    rating: player.rating + k * ((correct ? 1 : 0) - expected),
    attempts: player.attempts + 1,
  }
}

/** The mirror update, for items still earning their difficulty. A
 *  correct answer means the item was easier than its rating claimed,
 *  so difficulty falls — hence the inverted sign. */
export function updateItemDifficulty(
  item: Rating,
  playerRating: number,
  correct: boolean,
  guessRate = 0,
): Rating {
  if (item.attempts >= CALIBRATION_ATTEMPTS) return item
  const expected = expectedScore(playerRating, item.rating, guessRate)
  const k = kFactor(item.attempts, ITEM_K)
  return {
    rating: item.rating - k * ((correct ? 1 : 0) - expected),
    attempts: item.attempts + 1,
  }
}

export function isCalibrated(item: Rating): boolean {
  return item.attempts >= CALIBRATION_ATTEMPTS
}

/** The item difficulty that lands a player at `pCorrect`. Feed the
 *  scheduler ~0.75 to sit in the desirable-difficulty band: hard
 *  enough to teach, easy enough to stay. */
export function targetDifficulty(
  rating: number,
  pCorrect = 0.75,
  guessRate = 0,
): number {
  // Undo the guess floor, then invert the logistic.
  const skill = (pCorrect - guessRate) / (1 - guessRate)
  // A target at or under the guess rate is unreachable by skill, and
  // one at 1 needs infinite ability; pin both to the bank's edges.
  if (skill <= 0) return Number.NEGATIVE_INFINITY
  if (skill >= 1) return Number.POSITIVE_INFINITY
  return rating + RATING_SCALE * Math.log10(1 / skill - 1)
}
