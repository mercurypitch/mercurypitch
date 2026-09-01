// ============================================================
// Drum sample selection — one seeded pool per articulation key
// ============================================================
//
// Replaces the fixed layer+round-robin matrix with a pool pick: every
// candidate gets a velocity-range center, and a hit chooses the candidate
// nearest its velocity target plus seeded gaussian jitter and a recency
// penalty. With today's 2x2 kits this removes machine-gunning; deeper kits
// simply grow the pool (curated power values can later replace the range
// centers without changing this interface).

import { velocityCurveTarget } from './drum-hit-dynamics'
import type { DrumKitSampleResource, DrumVelocityCurve, } from './drum-kit-manifest'

export interface DrumSampleSelector {
  pick(
    pool: readonly DrumKitSampleResource[],
    velocity: number,
    curve?: DrumVelocityCurve,
  ): DrumKitSampleResource | null
  reset(): void
}

/** 32-bit FNV-1a over a tuple of numbers; order-sensitive. */
export function fnv1a32(...values: number[]): number {
  let hash = 0x811c9dc5
  for (const value of values) {
    // Mix all 32 bits of each value, byte by byte.
    let v = value >>> 0
    for (let byte = 0; byte < 4; byte += 1) {
      hash ^= v & 0xff
      hash = Math.imul(hash, 0x01000193)
      v >>>= 8
    }
  }
  return hash >>> 0
}

/** Deterministic uniform PRNG in [0, 1). */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const PENALTY_PREVIOUS = 0.3
const PENALTY_BEFORE_PREVIOUS = 0.12

function velocityUnit(velocity: number): number {
  const bounded = Math.min(127, Math.max(1, velocity))
  return (bounded - 1) / 126
}

function rangeCenter(resource: DrumKitSampleResource): number {
  return (
    resource.power ??
    velocityUnit((resource.velocityMin + resource.velocityMax) / 2)
  )
}

/** Mean gap between adjacent distinct centers; 0 for a single center. */
function jitterSigma(centers: readonly number[]): number {
  const distinct = [...new Set(centers)].sort((a, b) => a - b)
  if (distinct.length < 2) return 0
  let gaps = 0
  for (let index = 1; index < distinct.length; index += 1) {
    gaps += distinct[index] - distinct[index - 1]
  }
  return (0.5 * gaps) / (distinct.length - 1)
}

function gaussian(random: () => number): number {
  // Box-Muller; clamp the log argument away from zero.
  const u = Math.max(random(), 1e-12)
  const v = random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

export function createDrumSampleSelector(seed: number): DrumSampleSelector {
  const random = mulberry32(fnv1a32(seed, 0x5e1ec7))
  let previousId: string | null = null
  let beforePreviousId: string | null = null

  return {
    pick(pool, velocity, curve) {
      if (pool.length === 0) return null
      if (pool.length === 1) {
        beforePreviousId = previousId
        previousId = pool[0].id
        return pool[0]
      }
      const sorted = [...pool].sort((a, b) =>
        a.velocityMin !== b.velocityMin
          ? a.velocityMin - b.velocityMin
          : a.roundRobin - b.roundRobin,
      )
      const centers = sorted.map(rangeCenter)
      const sigma = jitterSigma(centers)
      const usesMeasuredPower = sorted.some(
        (resource) => resource.power !== undefined,
      )
      const target =
        curve === undefined && !usesMeasuredPower
          ? velocityUnit(velocity)
          : velocityCurveTarget(sorted[0].articulation, velocity, curve)
      let best: DrumKitSampleResource | null = null
      let bestScore = Number.POSITIVE_INFINITY
      for (let index = 0; index < sorted.length; index += 1) {
        const candidate = sorted[index]
        let score = Math.abs(centers[index] - target) + gaussian(random) * sigma
        if (candidate.id === previousId) score += PENALTY_PREVIOUS
        else if (candidate.id === beforePreviousId) {
          score += PENALTY_BEFORE_PREVIOUS
        }
        if (score < bestScore) {
          bestScore = score
          best = candidate
        }
      }
      beforePreviousId = previousId
      previousId = best === null ? null : best.id
      return best
    },
    reset() {
      previousId = null
      beforePreviousId = null
    },
  }
}
