// ============================================================
// rhythm-take — a rhythm tapped back, judged against its call.
//
// Pulse's call is a bar of onsets (two, when the pattern crosses the
// barline); the player taps it back whenever they are ready — the
// first tap anchors the take (`anchorTaps`) and stands for the first
// onset. Each remaining onset must be met by a tap inside the item's
// tolerance, in order — a tap can serve one onset only — and any tap
// that serves none is an extra. The tolerance follows the finest
// subdivision in the pattern: the grid a sixteenth sits on is finer
// than a quarter's, so the window that counts as "met" is too.
//
// Pure: beats and milliseconds in, verdicts out. The tap ledger
// (`tap-input.ts`) has already subtracted the round trip.
// ============================================================

import type { EarBankItem } from './banks'

export type Subdivision = 'quarters' | 'eighths' | 'triplets' | 'sixteenths'

const SUBDIVISIONS: readonly Subdivision[] = [
  'quarters',
  'eighths',
  'triplets',
  'sixteenths',
]

/** The window either side of an onset that still counts as met.
 *  Sized for a pointer or the space bar, not a drum pad: each stays
 *  under half the subdivision's spacing at the drill tempo, so a tap
 *  can never be credited to two neighbouring onsets. */
export const TOLERANCE_MS: Record<Subdivision, number> = {
  quarters: 120,
  eighths: 100,
  triplets: 85,
  sixteenths: 65,
}

const EPSILON = 1e-6

function onGrid(beat: number, division: number): boolean {
  const scaled = beat * division
  return Math.abs(scaled - Math.round(scaled)) < EPSILON
}

/** The finest grid every onset of the pattern sits on. */
export function finestSubdivision(onsetsBeats: readonly number[]): Subdivision {
  if (onsetsBeats.every((b) => onGrid(b, 1))) return 'quarters'
  if (onsetsBeats.every((b) => onGrid(b, 2))) return 'eighths'
  if (onsetsBeats.every((b) => onGrid(b, 3))) return 'triplets'
  return 'sixteenths'
}

export function toleranceFor(item: Pick<EarBankItem, 'payload'>): number {
  return TOLERANCE_MS[finestSubdivision(item.payload)]
}

/** How many beats a pattern spans: one bar of four, or two when any
 *  onset crosses the barline. */
export function barBeats(onsetsBeats: readonly number[]): number {
  return onsetsBeats.some((b) => b >= 4) ? 8 : 4
}

/** Re-base a take onto its own first tap: the tap becomes the first
 *  onset, exactly on time, and every later tap keeps its distance
 *  from it. This is what lets the player start whenever they are
 *  ready — the bar is theirs from the first touch, and a constant
 *  input delay cancels out entirely. Empty in, empty out. */
export function anchorTaps(
  tapsMs: readonly number[],
  firstOnsetMs: number,
): number[] {
  const anchor = tapsMs[0]
  if (anchor === undefined) return []
  return tapsMs.map((t) => t - anchor + firstOnsetMs)
}

export interface TakeVerdict {
  /** Per onset, in call order. */
  met: boolean[]
  /** Per onset: the serving tap's deviation in ms (negative early),
   *  or null when the onset was missed. */
  deviations: Array<number | null>
  /** Taps inside the response bar that served no onset. */
  extras: number[]
  correct: boolean
}

/** Judge a take. `tapsMs` and `onsetsMs` share the origin of the
 *  response bar; taps that land before it (minus the tolerance) are
 *  the player getting ready, not extras. `barMs` bounds the bar so a
 *  tap after it does not count either way. */
export function judgeTake(
  tapsMs: readonly number[],
  onsetsMs: readonly number[],
  toleranceMs: number,
  barMs: number,
): TakeVerdict {
  const taps = [...tapsMs]
    .filter((t) => t >= -toleranceMs && t <= barMs + toleranceMs)
    .sort((a, b) => a - b)
  const served = new Set<number>()
  const met: boolean[] = []
  const deviations: Array<number | null> = []
  let cursor = 0
  for (const onset of onsetsMs) {
    let found = -1
    for (let i = cursor; i < taps.length; i++) {
      if (Math.abs(taps[i] - onset) <= toleranceMs) {
        found = i
        break
      }
      if (taps[i] > onset + toleranceMs) break
    }
    if (found === -1) {
      met.push(false)
      deviations.push(null)
      continue
    }
    served.add(found)
    cursor = found + 1
    met.push(true)
    deviations.push(taps[found] - onset)
  }
  const extras = taps.filter((_, i) => !served.has(i))
  return {
    met,
    deviations,
    extras,
    correct: met.every(Boolean) && extras.length === 0,
  }
}

/** Rating thresholds at which a player clears each subdivision's
 *  items about three times in four (Elo's 75% point sits ~190 above
 *  the item; the bank's seeds sit at ~950, ~1200, ~1450, ~1620). */
const TIER_AT: ReadonlyArray<[Subdivision, number]> = [
  ['sixteenths', 1810],
  ['triplets', 1640],
  ['eighths', 1390],
  ['quarters', 1140],
]

/** The finest subdivision a rating clears, or null below the first. */
export function clearedSubdivision(rating: number): Subdivision | null {
  for (const [tier, at] of TIER_AT) if (rating >= at) return tier
  return null
}

export function subdivisionIndex(subdivision: Subdivision): number {
  return SUBDIVISIONS.indexOf(subdivision)
}
