// ============================================================
// YIN core — the pitch pass, with no thread of its own
// ============================================================
//
// Extracted from PitchDetector so the same YIN code can run where the samples
// are: an AudioWorklet gets one of these and analyses on the audio render
// thread, while PitchDetector keeps using it on the main thread. Nothing here
// touches the DOM, `window`, timers or the network, because AudioWorkletGlobalScope
// has none of them — that constraint is the reason this file exists as a leaf.
//
// It is deliberately not a second implementation. PitchDetector delegates its
// YIN pass and its stability filter here, so a change to either lands in both
// callers at once and `pitch-yin-core.test.ts` asserts the two agree frame for
// frame.

import { adjustedThreshold, parabolicInterpolation, } from './pitch-detector-internals'

/**
 * Root-mean-square level of a time-domain buffer.
 *
 * Exported because the audio thread wants the level of every hop but the YIN
 * pass of only the recorded ones, and two copies of this loop would be two
 * chances to disagree about what "level" means.
 */
export function bufferRms(buffer: Float32Array): number {
  let sumSquares = 0
  for (let i = 0; i < buffer.length; i++) {
    sumSquares += buffer[i] * buffer[i]
  }
  return Math.sqrt(sumSquares / buffer.length)
}

/** Frequency-search bounds and strictness for one YIN pass. */
export interface YinSearchOptions {
  sampleRate: number
  /** 1–12; sets the absolute-threshold via `adjustedThreshold`. */
  sensitivity: number
  minFrequency: number
  maxFrequency: number
}

/**
 * One raw YIN pass over a time-domain buffer.
 *
 * `yinBuffer` is the caller's scratch space — `bufferSize / 2` floats, reused
 * every frame so the audio thread never allocates. The returned frequency has
 * had no stability filtering applied; see `createPitchStabiliser`.
 */
export function analyseYinBuffer(
  buffer: Float32Array,
  yinBuffer: Float32Array,
  options: YinSearchOptions,
): { frequency: number; confidence: number } {
  const halfSize = yinBuffer.length

  // Step 1: Difference function (raw, no normalization)
  for (let tau = 0; tau < halfSize; tau++) {
    yinBuffer[tau] = 0
    for (let i = 0; i < halfSize; i++) {
      const delta = buffer[i] - buffer[i + tau]
      yinBuffer[tau] += delta * delta
    }
  }

  // Step 2: Cumulative mean normalized difference
  yinBuffer[0] = 1
  let cumulativeSum = 0
  for (let tau = 1; tau < halfSize; tau++) {
    cumulativeSum += yinBuffer[tau]
    yinBuffer[tau] *= tau / cumulativeSum
  }

  // Step 3: Absolute threshold — find first tau below threshold
  //
  // Bounded by the caller's frequency range, and that bound is load-bearing
  // rather than tidy. A plucked string is rich in harmonics, so the
  // difference function dips almost as deep at twice the true period as at
  // the period itself; searching past the range lets YIN settle in that
  // second dip and report an octave too low. Below the range the old code
  // then threw the frame away at step 4 — so an unbounded search cost real
  // notes as well as inventing wrong ones. Searching only where an answer is
  // allowed makes the best in-range candidate win instead.
  const threshold = adjustedThreshold(options.sensitivity)
  const minTau = Math.max(
    2,
    Math.floor(options.sampleRate / options.maxFrequency),
  )
  const maxTau = Math.min(
    halfSize,
    Math.ceil(options.sampleRate / options.minFrequency) + 1,
  )
  let tauEstimate = -1
  for (let tau = minTau; tau < maxTau; tau++) {
    if (yinBuffer[tau] < threshold) {
      // Descend into the valley to find the local minimum
      while (tau + 1 < maxTau && yinBuffer[tau + 1] < yinBuffer[tau]) {
        tau++
      }
      // Also skip past any flat bottom
      while (tau + 1 < maxTau && yinBuffer[tau + 1] === yinBuffer[tau]) {
        tau++
      }
      // Verify local minimum: neighbors should be >= current value
      const isMinimum =
        (tau <= minTau || yinBuffer[tau - 1] >= yinBuffer[tau]) &&
        (tau + 1 >= maxTau || yinBuffer[tau + 1] >= yinBuffer[tau])
      if (isMinimum) {
        tauEstimate = tau
        break
      }
      // Not a true minimum — keep scanning
    }
  }

  if (tauEstimate === -1) {
    return { frequency: 0, confidence: 0 }
  }

  // Bounding the search has one cost worth paying for: a tone ABOVE the
  // range no longer has its own period in view, so the first dip that is in
  // view belongs to a multiple of it, and the detector would answer with a
  // sub-harmonic that sits comfortably inside the range. Answering with a
  // note nobody played is worse than answering nothing, so if a shorter
  // period explains the signal at least as well, the real pitch is out of
  // range and this says so.
  for (const divisor of [2, 3]) {
    const shorterTau = Math.round(tauEstimate / divisor)
    if (shorterTau < 2 || shorterTau >= minTau) continue
    if (
      yinBuffer[shorterTau] < threshold &&
      yinBuffer[shorterTau] <= yinBuffer[tauEstimate] * 1.2
    ) {
      return { frequency: 0, confidence: 0 }
    }
  }

  // Octave error correction: check if tau/2 (one octave up) is also a
  // valid period candidate. If the higher-octave dip is below threshold
  // and comparable in depth, prefer it — this avoids sub-harmonic errors
  // where YIN locks onto 2× the actual period.
  //
  // The same promotion at tau·2/3 — the fifth-low flavour of this mistake,
  // the largest error class against a real bass stem — was tried here and
  // measured a no-op: the dip at the true period is SHALLOW (that is why
  // the threshold search skipped it), so a gate that demands a deep dip
  // there never fires. Fixing the fifth class needs evidence from the
  // spectrum, not from this buffer.
  const octaveTau = Math.round(tauEstimate / 2)
  if (
    octaveTau >= minTau &&
    yinBuffer[octaveTau] < threshold * 1.5 &&
    yinBuffer[octaveTau] < yinBuffer[tauEstimate] * 1.8
  ) {
    // Verify it's a local minimum
    const isOctaveMin =
      yinBuffer[octaveTau - 1] >= yinBuffer[octaveTau] &&
      (octaveTau + 1 >= halfSize ||
        yinBuffer[octaveTau + 1] >= yinBuffer[octaveTau])
    if (isOctaveMin) {
      tauEstimate = octaveTau
    }
  }

  // Step 4: Parabolic interpolation for sub-sample accuracy
  const betterTau = parabolicInterpolation(tauEstimate, yinBuffer)
  const frequency = options.sampleRate / betterTau

  // Reject frequencies outside the valid range
  if (frequency < options.minFrequency || frequency > options.maxFrequency) {
    return { frequency: 0, confidence: 0 }
  }

  // Confidence: depth of the dip at the winning tau. A value near 0
  // means a very deep dip (high confidence); near 1 means barely below
  // threshold (low confidence).
  return { frequency, confidence: 1 - yinBuffer[tauEstimate] }
}

/** Weighted-median smoother over the recent accepted frequencies. */
export interface PitchStabiliser {
  stabilise: (frequency: number) => number
  reset: () => void
  /** How many readings the window currently holds. */
  size: () => number
}

/**
 * Apply weighted median filter with outlier rejection.
 *
 * Detects real note changes by looking for consecutive consistent readings at
 * a new frequency — this avoids rejecting legitimate note transitions
 * (e.g., P5 = 50% jump) as outliers.
 */
export function createPitchStabiliser(options?: {
  maxHistory?: number
  enabled?: boolean
}): PitchStabiliser {
  const maxHistory = options?.maxHistory ?? 5
  const enabled = options?.enabled ?? true
  let pitchHistory: number[] = []

  return {
    size: () => pitchHistory.length,
    reset: () => {
      pitchHistory.length = 0
    },
    stabilise: (frequency: number): number => {
      if (!enabled) return frequency

      pitchHistory.push(frequency)
      if (pitchHistory.length > maxHistory) {
        pitchHistory.shift()
      }

      if (pitchHistory.length < 3) {
        return frequency
      }

      // Note-change detection: if the last two readings are consistent
      // with each other (< 5% apart) but far from the older history
      // (> 15% from its median), treat it as a confirmed note change.
      const len = pitchHistory.length
      const secondNewest = pitchHistory[len - 2]!
      const newest = pitchHistory[len - 1]!
      const lastTwoConsistent =
        Math.abs(newest - secondNewest) / Math.min(newest, secondNewest) < 0.05

      if (lastTwoConsistent && len >= 4) {
        const oldValues = pitchHistory.slice(0, -2)
        const oldSorted = [...oldValues].sort((a, b) => a - b)
        const oldMedian = oldSorted[Math.floor(oldSorted.length / 2)]!
        if (Math.abs(newest - oldMedian) / oldMedian > 0.15) {
          // Confirmed note change — flush history to new frequency
          pitchHistory = [newest, secondNewest]
          return frequency
        }
      }

      const sorted = [...pitchHistory].sort((a, b) => a - b)
      const median = sorted[Math.floor(sorted.length / 2)]

      // Reject outliers beyond 15% deviation from median
      if (Math.abs(frequency - median) / median > 0.15) {
        return median
      }

      return frequency
    },
  }
}

/** Everything one live F0 frame needs decided, in one place. */
export interface YinFrameOptions extends YinSearchOptions {
  bufferSize: number
  /** RMS gate — below this the frame is silence, not a pitch. */
  minAmplitude: number
  minConfidence: number
  stabilize?: boolean
  maxHistory?: number
}

export interface YinFrame {
  /** RMS of the analysed buffer, reported whether or not a pitch was found. */
  rms: number
  /** Stabilised frequency in Hz, 0 when the frame was rejected. */
  frequency: number
  /** Dip-depth confidence, 0 when the frame was rejected. */
  confidence: number
  accepted: boolean
  /** The confidence floor this frame was judged against. */
  confidenceFloor: number
}

export interface YinFrameAnalyser {
  analyse: (buffer: Float32Array) => YinFrame
  /** Drop the stability window — call when a new take starts. */
  reset: () => void
}

const REJECTED_FRAME = { frequency: 0, confidence: 0, accepted: false } as const

/**
 * The whole live-frame decision: RMS gate, YIN pass, stability filter, then
 * the confidence floor — in that order, because that is the order
 * `PitchDetector.detect()` applies them and `pitch-yin-core.test.ts` asserts
 * the two agree frame for frame.
 *
 * The floor cannot actually reject a YIN frame at the settings this app runs:
 * a tau is only ever picked when its normalised dip is already below
 * `adjustedThreshold(sensitivity)`, so the confidence that comes back exceeds
 * `1 - threshold` and clears any floor below it. It is kept because a caller
 * that raises `minConfidence` past that point is entitled to be obeyed.
 */
export function createYinFrameAnalyser(
  options: YinFrameOptions,
): YinFrameAnalyser {
  const yinBuffer = new Float32Array(Math.floor(options.bufferSize / 2))
  const stabiliser = createPitchStabiliser({
    maxHistory: options.maxHistory,
    enabled: options.stabilize ?? true,
  })
  const confidenceFloor = Math.max(
    adjustedThreshold(options.sensitivity),
    options.minConfidence,
  )

  return {
    reset: stabiliser.reset,
    analyse: (buffer: Float32Array): YinFrame => {
      const rms = bufferRms(buffer)
      // The RMS gate is checked before YIN so silence costs one pass over the
      // buffer instead of the O(n²) difference function.
      if (rms < options.minAmplitude) {
        return { rms, confidenceFloor, ...REJECTED_FRAME }
      }

      const raw = analyseYinBuffer(buffer, yinBuffer, options)
      if (raw.frequency === 0)
        return { rms, confidenceFloor, ...REJECTED_FRAME }

      const frequency = stabiliser.stabilise(raw.frequency)
      if (raw.confidence < confidenceFloor) {
        return { rms, confidenceFloor, ...REJECTED_FRAME }
      }
      return {
        rms,
        frequency,
        confidence: raw.confidence,
        accepted: true,
        confidenceFloor,
      }
    },
  }
}
