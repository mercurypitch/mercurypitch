// Drum Night latency calibration — bounded robust estimates, never guesses.
// ============================================================

export const DRUM_LATENCY_MIN_MS = 0
export const DRUM_LATENCY_MAX_MS = 250
export const DRUM_LATENCY_MIN_SAMPLES = 5

export type DrumLatencyCalibrationStatus = 'empty' | 'collecting' | 'ready'

export interface DrumLatencyCalibrationResult {
  readonly status: DrumLatencyCalibrationStatus
  readonly estimateMs: number | null
  readonly sampleCount: number
  readonly inlierCount: number
  readonly spreadMs: number | null
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle]
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

/**
 * Estimate device/input latency from observed-minus-expected strike times.
 * Median absolute deviation rejects a wildly early/late human strike without
 * letting one sample move the applied compensation by hundreds of ms.
 */
export function estimateDrumInputLatency(
  samplesMs: readonly number[],
): DrumLatencyCalibrationResult {
  const finite = samplesMs.filter((sample) => Number.isFinite(sample))
  if (finite.length === 0) {
    return {
      status: 'empty',
      estimateMs: null,
      sampleCount: 0,
      inlierCount: 0,
      spreadMs: null,
    }
  }

  const center = median(finite)
  const deviations = finite.map((sample) => Math.abs(sample - center))
  const medianDeviation = median(deviations)
  const rejectionRadius = Math.max(12, medianDeviation * 3)
  const inliers = finite.filter(
    (sample) => Math.abs(sample - center) <= rejectionRadius,
  )
  const robustCenter = median(inliers)
  const robustSpread = median(
    inliers.map((sample) => Math.abs(sample - robustCenter)),
  )

  return {
    status: finite.length >= DRUM_LATENCY_MIN_SAMPLES ? 'ready' : 'collecting',
    estimateMs:
      finite.length >= DRUM_LATENCY_MIN_SAMPLES
        ? clamp(robustCenter, DRUM_LATENCY_MIN_MS, DRUM_LATENCY_MAX_MS)
        : null,
    sampleCount: finite.length,
    inlierCount: inliers.length,
    spreadMs: robustSpread,
  }
}

export class DrumLatencyCalibration {
  private samplesMs: number[] = []

  addStrike(expectedTimestampMs: number, observedTimestampMs: number): void {
    if (
      !Number.isFinite(expectedTimestampMs) ||
      !Number.isFinite(observedTimestampMs)
    ) {
      return
    }
    this.samplesMs.push(observedTimestampMs - expectedTimestampMs)
  }

  reset(): void {
    this.samplesMs = []
  }

  result(): DrumLatencyCalibrationResult {
    return estimateDrumInputLatency(this.samplesMs)
  }
}
