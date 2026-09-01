// ============================================================
// Performance Take Audio — bounded PCM replay preparation
// ============================================================
//
// Event-driven Night stages render a player-only waveform instead of tapping
// a mixed output bus. These helpers keep WAV encoding, duration, and compact
// History peaks consistent without requiring a live AudioContext.

import { encodeMonoPcmSamplesToWav } from '@/lib/audio-buffer-wav'
import type { PreparedPerformanceTakeAudio } from '@/lib/domain/performance-take'

const DEFAULT_PEAK_BUCKETS = 72

export function computeMonoPerformancePeaks(
  samples: Float32Array,
  buckets = DEFAULT_PEAK_BUCKETS,
): Float32Array {
  const bucketCount = Math.max(1, Math.floor(buckets))
  const peaks = new Float32Array(bucketCount)
  if (samples.length === 0) return peaks
  const samplesPerBucket = Math.max(1, Math.ceil(samples.length / bucketCount))
  let maximum = 0
  for (let bucket = 0; bucket < bucketCount; bucket += 1) {
    const start = bucket * samplesPerBucket
    const end = Math.min(samples.length, start + samplesPerBucket)
    let peak = 0
    for (let frame = start; frame < end; frame += 1) {
      peak = Math.max(peak, Math.abs(samples[frame] ?? 0))
    }
    peaks[bucket] = peak
    maximum = Math.max(maximum, peak)
  }
  if (maximum > 0.001) {
    for (let bucket = 0; bucket < bucketCount; bucket += 1) {
      peaks[bucket] = (peaks[bucket] ?? 0) / maximum
    }
  }
  return peaks
}

export function preparePcmPerformanceTake(input: {
  samples: Float32Array
  sampleRate: number
  capturedAt: string
}): PreparedPerformanceTakeAudio | null {
  if (
    input.samples.length === 0 ||
    !Number.isFinite(input.sampleRate) ||
    input.sampleRate <= 0
  ) {
    return null
  }
  let peakAmplitude = 0
  for (let frame = 0; frame < input.samples.length; frame += 1) {
    peakAmplitude = Math.max(peakAmplitude, Math.abs(input.samples[frame] ?? 0))
  }
  if (peakAmplitude <= 0.0001) return null
  const wav = encodeMonoPcmSamplesToWav(input.samples, input.sampleRate)
  return {
    blob: new Blob([wav], { type: 'audio/wav' }),
    durationMs: Math.round((input.samples.length / input.sampleRate) * 1000),
    peaks: computeMonoPerformancePeaks(input.samples),
    capturedAt: input.capturedAt,
  }
}
