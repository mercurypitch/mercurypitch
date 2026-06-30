// ============================================================
// Key-profile templates for Krumhansl-Schmuckler key detection.
//
// Each profile is a 12-vector of scale-degree weights starting at the tonic
// (index 0 = tonic, 1 = minor 2nd, ... 11 = major 7th). The 24 key templates
// are produced by cyclically rotating the major/minor base profiles through
// all 12 tonics.
// ============================================================

export type Mode = 'major' | 'minor'

export interface KeyProfileSet {
  major: number[]
  minor: number[]
}

// Aarden-Essen — derived from folksong pitch-class counts; strong on melodies,
// which is our case (we detect from a monophonic vocal melody).
export const AARDEN_ESSEN: KeyProfileSet = {
  major: [
    17.7661, 0.145624, 14.9265, 0.160186, 19.8049, 11.3587, 0.291248, 22.062,
    0.145624, 8.15494, 0.232998, 4.95122,
  ],
  minor: [
    18.2648, 0.737619, 14.0499, 16.8599, 0.702494, 14.4362, 0.702494, 18.6161,
    4.56621, 1.93186, 7.37619, 1.75623,
  ],
}

// Krumhansl-Kessler — the classic perception-derived baseline.
export const KRUMHANSL_KESSLER: KeyProfileSet = {
  major: [
    6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88,
  ],
  minor: [
    6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17,
  ],
}
