// ============================================================
// Level health — how an input's level reads: clipping, hot, good, quiet, silent, or a room as loud as the player
// ============================================================
//
// Guitar Night reads its worklet's block peaks with this, and any room that
// meters an input should read them the same way: one set of thresholds, in
// one order. The hints are still Guitar Night's words ("the guitar"), and
// the types keep its name to say so; a room that shows them for another
// instrument gives them its own words first.
//
// Whether anything has come in at all since a take asked for input is a
// different question, with its own grace period: @/lib/input-health.

export type GuitarInputHealth =
  | 'silent'
  | 'quiet'
  | 'good'
  | 'hot'
  | 'clipping'
  | 'noisy'
  | 'uncertain'

export interface GuitarInputHealthReading {
  state: GuitarInputHealth
  /** Plain-language, one line, no numbers the player cannot act on. */
  hint: string
}

/**
 * Turn a level and a background estimate into something worth showing. The
 * order of the checks is the order the problems matter in: a clipped signal is
 * unusable, a room louder than the guitar is unusable, and everything else is
 * advice.
 */
export function describeInputHealth(
  peak: number,
  noiseFloor: number,
): GuitarInputHealthReading {
  if (peak >= 0.98) {
    return {
      state: 'clipping',
      hint: 'Too loud to read — turn the input down.',
    }
  }
  if (peak < 0.012) {
    return { state: 'silent', hint: 'Nothing coming in yet.' }
  }
  if (noiseFloor > 0.03 && noiseFloor >= peak * 0.5) {
    return {
      state: 'noisy',
      hint: 'The room is nearly as loud as the guitar — play closer or quieten it.',
    }
  }
  if (peak >= 0.8) {
    return { state: 'hot', hint: 'Close to clipping — ease the input down.' }
  }
  if (peak < 0.05) {
    return { state: 'quiet', hint: 'Very quiet — play harder or move closer.' }
  }
  return { state: 'good', hint: 'Input level looks good.' }
}

/**
 * Background level, estimated from a stream of block peaks. Falls instantly and
 * rises slowly, so it settles onto the quietest thing heard recently rather
 * than onto the playing.
 */
export interface NoiseFloorFollower {
  push(blockPeak: number, blockSeconds: number): number
  value(): number
  reset(): void
}

export function createNoiseFloorFollower(riseSeconds = 3): NoiseFloorFollower {
  let floor = 0
  let seeded = false
  return {
    push(blockPeak, blockSeconds) {
      if (!seeded) {
        floor = blockPeak
        seeded = true
        return floor
      }
      if (blockPeak < floor) {
        floor = blockPeak
        return floor
      }
      const rise =
        riseSeconds > 0 ? 1 - Math.exp(-blockSeconds / riseSeconds) : 1
      floor += (blockPeak - floor) * rise
      return floor
    },
    value: () => floor,
    reset() {
      floor = 0
      seeded = false
    },
  }
}
