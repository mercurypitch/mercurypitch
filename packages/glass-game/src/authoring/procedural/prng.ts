// Deterministic pseudorandom number generator (Mulberry32) for procedural level generation.

export class ProceduralPrng {
  private state: number

  constructor(seed: number | string) {
    if (typeof seed === 'string') {
      let hash = 0
      for (let i = 0; i < seed.length; i++) {
        hash = (Math.imul(31, hash) + seed.charCodeAt(i)) | 0
      }
      this.state = hash >>> 0
    } else {
      this.state = (seed | 0) >>> 0
    }
    if (this.state === 0) {
      this.state = 0x6d2b79f5
    }
  }

  /** Emits a float in [0, 1). */
  next(): number {
    let t = (this.state += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  /** Random float between min (inclusive) and max (exclusive). */
  range(min: number, max: number): number {
    return min + (max - min) * this.next()
  }

  /** Random integer between min (inclusive) and max (inclusive). */
  int(min: number, max: number): number {
    const lo = Math.ceil(min)
    const hi = Math.floor(max)
    return Math.floor(lo + (hi - lo + 1) * this.next())
  }

  /** Picks a random element from a non-empty array. */
  pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new Error('Cannot pick from empty array.')
    }
    return items[Math.floor(this.next() * items.length)]
  }

  /** Shuffles a copy of an array using Fisher-Yates. */
  shuffle<T>(items: readonly T[]): T[] {
    const copy = [...items]
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1))
      const temp = copy[i]
      copy[i] = copy[j]
      copy[j] = temp
    }
    return copy
  }
}
