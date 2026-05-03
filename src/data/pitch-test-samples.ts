// ============================================================
// Pitch Test Samples — Test data for algorithm comparison
// ============================================================

import type { TestNote, TestSample } from '@/lib/pitch-algorithm-tester'
import type { PitchAlgorithm } from '@/lib/pitch-detector'

/** Comprehensive test samples for pitch algorithm comparison */
export const TEST_SAMPLES: TestSample[] = [
  {
    id: 'octave-1',
    name: 'Octave 1 - Root Notes',
    notes: [
      { name: 'C4', frequency: 261.63, deviationCents: 0, description: 'Perfect C4' },
      { name: 'C#4', frequency: 277.18, deviationCents: 0, description: 'C#4' },
      { name: 'D4', frequency: 293.66, deviationCents: 0, description: 'D4' },
      { name: 'D#4', frequency: 311.13, deviationCents: 0, description: 'D#4' },
      { name: 'E4', frequency: 329.63, deviationCents: 0, description: 'E4' },
      { name: 'F4', frequency: 349.23, deviationCents: 0, description: 'F4' },
      { name: 'F#4', frequency: 369.99, deviationCents: 0, description: 'F#4' },
      { name: 'G4', frequency: 392.00, deviationCents: 0, description: 'G4' },
      { name: 'G#4', frequency: 415.30, deviationCents: 0, description: 'G#4' },
      { name: 'A4', frequency: 440.00, deviationCents: 0, description: 'A4 (Reference)' },
      { name: 'A#4', frequency: 466.16, deviationCents: 0, description: 'A#4' },
      { name: 'B4', frequency: 493.88, deviationCents: 0, description: 'B4' },
    ],
  },
  {
    id: 'octave-2',
    name: 'Octave 2 - Root Notes',
    notes: [
      { name: 'C5', frequency: 523.25, deviationCents: 0, description: 'C5' },
      { name: 'C#5', frequency: 554.37, deviationCents: 0, description: 'C#5' },
      { name: 'D5', frequency: 587.33, deviationCents: 0, description: 'D5' },
      { name: 'D#5', frequency: 622.25, deviationCents: 0, description: 'D#5' },
      { name: 'E5', frequency: 659.25, deviationCents: 0, description: 'E5' },
      { name: 'F5', frequency: 698.46, deviationCents: 0, description: 'F5' },
      { name: 'F#5', frequency: 739.99, deviationCents: 0, description: 'F#5' },
      { name: 'G5', frequency: 783.99, deviationCents: 0, description: 'G5' },
      { name: 'G#5', frequency: 830.61, deviationCents: 0, description: 'G#5' },
      { name: 'A5', frequency: 880.00, deviationCents: 0, description: 'A5' },
      { name: 'A#5', frequency: 932.33, deviationCents: 0, description: 'A#5' },
      { name: 'B5', frequency: 987.77, deviationCents: 0, description: 'B5' },
    ],
  },
  {
    id: 'intervals',
    name: 'Musical Intervals',
    notes: [
      { name: 'P1', frequency: 261.63, deviationCents: 0, description: 'Unison (C4)' },
      { name: 'm2', frequency: 277.18, deviationCents: 0, description: 'Minor 2nd' },
      { name: 'M2', frequency: 293.66, deviationCents: 0, description: 'Major 2nd' },
      { name: 'm3', frequency: 311.13, deviationCents: 0, description: 'Minor 3rd' },
      { name: 'M3', frequency: 329.63, deviationCents: 0, description: 'Major 3rd' },
      { name: 'P4', frequency: 349.23, deviationCents: 0, description: 'Perfect 4th' },
      { name: 'P5', frequency: 392.00, deviationCents: 0, description: 'Perfect 5th' },
      { name: 'm6', frequency: 415.30, deviationCents: 0, description: 'Minor 6th' },
      { name: 'M6', frequency: 440.00, deviationCents: 0, description: 'Major 6th' },
      { name: 'm7', frequency: 466.16, deviationCents: 0, description: 'Minor 7th' },
      { name: 'M7', frequency: 493.88, deviationCents: 0, description: 'Major 7th' },
      { name: 'P8', frequency: 523.25, deviationCents: 0, description: 'Perfect 8th' },
    ],
  },
  {
    id: 'sharp-flat',
    name: 'Sharp & Flat (Cents)',
    notes: [
      { name: '+50', frequency: 445.00, deviationCents: 50, description: '+50 cents sharp' },
      { name: '-50', frequency: 435.00, deviationCents: -50, description: '-50 cents flat' },
      { name: '+90', frequency: 466.16, deviationCents: 90, description: '+90 cents sharp' },
      { name: '-90', frequency: 415.30, deviationCents: -90, description: '-90 cents flat' },
      { name: '+100', frequency: 466.16, deviationCents: 100, description: '+100 cents sharp' },
      { name: '-100', frequency: 415.30, deviationCents: -100, description: '-100 cents flat' },
    ],
  },
  {
    id: 'noisy-low',
    name: 'Low Amplitude (High Noise)',
    notes: [
      { name: 'C4 Low', frequency: 261.63, deviationCents: 0, description: 'Low volume' },
      { name: 'A4 Low', frequency: 440.00, deviationCents: 0, description: 'Low volume' },
      { name: 'C5 Low', frequency: 523.25, deviationCents: 0, description: 'Low volume' },
    ],
  },
  {
    id: 'transitions',
    name: 'Frequency Transitions',
    notes: [
      { name: '261 Hz', frequency: 261.63, deviationCents: 0, description: 'C4' },
      { name: '330 Hz', frequency: 329.63, deviationCents: 0, description: 'E4' },
      { name: '440 Hz', frequency: 440.00, deviationCents: 0, description: 'A4' },
      { name: '523 Hz', frequency: 523.25, deviationCents: 0, description: 'C5' },
    ],
  },
]

/** Registered algorithms and their metadata */
export const REGISTERED_ALGORITHMS: Array<{ id: PitchAlgorithm; name: string; description: string; defaultThreshold: number; note?: string }> = [
  {
    id: 'yin' as PitchAlgorithm,
    name: 'YIN',
    description: 'Yin algorithm using difference function and cumulative mean normalization. Good balance of accuracy and speed.',
    defaultThreshold: 0.15,
  },
  {
    id: 'mpm' as PitchAlgorithm,
    name: 'McLeod Pitch Method',
    description: 'Uses Normalized Square Difference Function (NSDF) with positive-going zero crossings for octave discrimination. Generally more accurate than YIN.',
    defaultThreshold: 0.9,
  },
  {
    id: 'swift' as PitchAlgorithm,
    name: 'SwiftF0 ML',
    description: 'ML-based pitch detection using SwiftF0 model. Best for noisy environments, but requires ONNX model and 16kHz sample rate.',
    defaultThreshold: 0.1,
    note: 'Requires /models/swiftf0.onnx',
  },
]

/** Algorithm performance characteristics */
export const ALGORITHM_PERFORMANCE: Record<PitchAlgorithm, { avgTime: number; realtime: boolean }> = {
  yin: { avgTime: 12, realtime: true },
  mpm: { avgTime: 18, realtime: true },
  swift: { avgTime: 45, realtime: false }, // ML inference is slower but can be realtime with WASM optimization
}

/** Get all algorithms that support realtime use */
export function getRealtimeAlgorithms(): PitchAlgorithm[] {
  return ['yin', 'mpm'] as PitchAlgorithm[]
}

/** Get all algorithms including those for testing (realtime and ML) */
export function getAllTestableAlgorithms(): PitchAlgorithm[] {
  return (['yin', 'mpm', 'swift'] as PitchAlgorithm[]).filter((a: PitchAlgorithm) => ALGORITHM_PERFORMANCE[a] !== undefined)
}

/** Get algorithm difficulty classification */
export function getDifficultyClassification(score: number): {
  label: string
  color: string
} {
  if (score >= 95) {
    return { label: 'Excellent', color: 'text-green-400' }
  }
  if (score >= 85) {
    return { label: 'Very Good', color: 'text-emerald-400' }
  }
  if (score >= 70) {
    return { label: 'Good', color: 'text-blue-400' }
  }
  if (score >= 55) {
    return { label: 'Fair', color: 'text-yellow-400' }
  }
  if (score >= 40) {
    return { label: 'Poor', color: 'text-orange-400' }
  }
  return { label: 'Very Poor', color: 'text-red-400' }
}

/** Export for dynamic imports */
export default {
  TEST_SAMPLES,
  REGISTERED_ALGORITHMS,
  ALGORITHM_PERFORMANCE,
}
