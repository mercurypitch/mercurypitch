// ============================================================
// Key Detection — barrel for musical-key estimation
// ============================================================
//
// Krumhansl-Schmuckler profile correlation over a pitch-class histogram.
// `key-profiles` holds the selectable template sets (Aarden-Essen,
// Krumhansl-Kessler, ...) as 12-vectors of scale-degree weights; the detector
// rotates each through all 12 tonics and scores the 24 candidate keys.

export * from './key-profiles'
export * from './key-detector'
