// ============================================================
// Guitar pitch evidence profiles keep capture and rehearsal comparisons explicit.
// ============================================================

import type { PitchDetectorOptions } from '@/lib/pitch-detector'
import { PitchDetector } from '@/lib/pitch-detector'

export type GuitarPitchProfile = 'recording' | 'rehearsal'
export type GuitarPitchConfiguration = Required<
  Pick<
    PitchDetectorOptions,
    | 'algorithm'
    | 'bufferSize'
    | 'minFrequency'
    | 'maxFrequency'
    | 'minAmplitude'
    | 'minConfidence'
    | 'stabilize'
  >
>

// These are different policies, not a claim that one detector is more accurate.
// Rehearsal still owns its adaptive analyser size and tuner frequency override.
const PROFILES: Record<GuitarPitchProfile, GuitarPitchConfiguration> = {
  recording: {
    algorithm: 'yin',
    bufferSize: 4096,
    minFrequency: 28,
    maxFrequency: 2200,
    minAmplitude: 0.006,
    minConfidence: 0.65,
    stabilize: false,
  },
  rehearsal: {
    algorithm: 'mpm',
    bufferSize: 4096,
    minFrequency: 55,
    maxFrequency: 1600,
    minAmplitude: 0.018,
    minConfidence: 0.38,
    stabilize: true,
  },
}

export function guitarPitchConfiguration(
  profile: GuitarPitchProfile,
  overrides: Partial<GuitarPitchConfiguration> = {},
): GuitarPitchConfiguration {
  return { ...PROFILES[profile], ...overrides }
}

export function createGuitarPitchDetector(
  sampleRate: number,
  configuration: GuitarPitchConfiguration,
): PitchDetector {
  return new PitchDetector({ ...configuration, sampleRate, telemetry: 'off' })
}
