// ============================================================
// Deterministic PRNG for the Ear Lab's tests.
//
// Every simulation in this folder (staircase convergence, Elo
// convergence, picker distributions, calibration pooling) is
// statistical, so it needs randomness that is reproducible or CI
// will flake on the tails. mulberry32: tiny, fast, good enough
// distribution for what these tests assert.
// ============================================================

/** Seeded uniform [0, 1). */
export function rng(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
