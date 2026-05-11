// ============================================================
// Vocal Analyzer — DSP utilities for vocal analysis features
// Phase 1: Intensity Mirroring, Breathiness Index, Slide Tracking
// ============================================================

// ── Types ──────────────────────────────────────────────────────

export interface EnvelopePoint {
  time: number
  rms: number
  db: number
}

export interface IntensityScore {
  /** Overall intensity match 0-100 */
  overallMatch: number
  /** Per-note intensity comparison */
  notes: Array<{
    time: number
    userDb: number
    referenceDb: number
    delta: number
    score: number
  }>
  avgUserDb: number
  avgReferenceDb: number
}

export interface BreathinessResult {
  /** Harmonic-to-noise ratio in dB (higher = more resonant/less breathy) */
  hnrDb: number
  /** Classification based on HNR */
  quality: 'breathy' | 'normal' | 'resonant' | 'pressed'
  /** 0-100 meter value */
  efficiency: number
}

export type SlideDirection = 'ascending' | 'descending' | 'stable'

export interface SlideEvent {
  startTime: number
  endTime: number
  durationMs: number
  startMidi: number
  endMidi: number
  semitoneSpan: number
  direction: SlideDirection
  /** How direct the slide was (straight line = 100, wobbly = low) */
  directness: number
  /** Classification */
  type: 'clean' | 'scoop' | 'fall' | 'overshoot' | 'wobble'
  /** 0-100 score */
  score: number
}

export interface SlideTrackingResult {
  slides: SlideEvent[]
  overallScore: number
  totalTransitions: number
  scoopCount: number
  cleanCount: number
}

// ── Phase 2 Types ──────────────────────────────────────────────

export interface VibratoResult {
  /** Vibrato rate in Hz (cycles per second of pitch modulation) */
  rateHz: number
  /** Vibrato depth in cents (peak-to-peak pitch variation) */
  depthCents: number
  /** Classification based on rate */
  classification: 'none' | 'slow-operatic' | 'natural' | 'nervous' | 'wide'
  /** Whether vibrato was detected at all */
  detected: boolean
  /** Confidence 0-100 */
  confidence: number
}

export interface HarmonicRichnessResult {
  /** Weighted harmonic amplitude relative to fundamental (0-100) */
  richnessScore: number
  /** Number of detectable harmonics above noise floor */
  harmonicCount: number
  /** Amplitudes of harmonics H1-H15 (normalized to H1=1) */
  harmonicProfile: number[]
  /** Classification */
  quality: 'thin' | 'normal' | 'rich' | 'very-rich'
}

export type ResonanceZone = 'chest' | 'mask' | 'head' | 'mixed'

export interface ResonanceResult {
  dominantZone: ResonanceZone
  /** Energy ratio in each zone (0-1, sum=1) */
  chestRatio: number
  maskRatio: number
  headRatio: number
  /** Spectral centroid in Hz */
  spectralCentroid: number
}

export interface FatigueCheckpoint {
  time: number
  hnrDb: number
  richnessScore: number
  pitchStability: number
}

export interface FatigueResult {
  /** Whether fatigue is suspected */
  fatigued: boolean
  /** Alert message if fatigued */
  alert: string | null
  /** Per-metric trend: negative = declining */
  trends: {
    hnrTrend: number
    richnessTrend: number
    stabilityTrend: number
  }
  /** Checkpoints collected */
  checkpoints: FatigueCheckpoint[]
}

// ── Intensity Mirroring ───────────────────────────────────────

/**
 * Compute RMS envelope from an array of amplitude samples.
 * Window size controls smoothing — larger = smoother envelope.
 */
export function computeRMSEnvelope(
  samples: Float32Array | number[],
  sampleRate: number,
  windowSize = 2048,
  hopSize = 512,
): EnvelopePoint[] {
  const points: EnvelopePoint[] = []
  const eps = 1e-12

  for (let i = 0; i < samples.length - windowSize; i += hopSize) {
    let sumSq = 0
    for (let j = i; j < i + windowSize && j < samples.length; j++) {
      sumSq += samples[j] * samples[j]
    }
    const rms = Math.sqrt(sumSq / windowSize)
    const db = 20 * Math.log10(Math.max(rms, eps))
    points.push({
      time: i / sampleRate,
      rms,
      db,
    })
  }

  return points
}

/**
 * Compare user intensity envelope against a reference envelope.
 * Handles different envelope lengths by linear interpolation to the longer timeline.
 */
export function compareIntensity(
  userEnvelope: EnvelopePoint[],
  referenceEnvelope: EnvelopePoint[],
): IntensityScore {
  if (userEnvelope.length === 0 || referenceEnvelope.length === 0) {
    return {
      overallMatch: 0,
      notes: [],
      avgUserDb: 0,
      avgReferenceDb: 0,
    }
  }

  // Use reference envelope as the timeline, interpolate user values
  const notes: IntensityScore['notes'] = []
  let totalScore = 0
  let totalUserDb = 0
  let totalRefDb = 0

  for (const refPt of referenceEnvelope) {
    // Find closest user envelope point in time
    const userPt = findClosestByTime(userEnvelope, refPt.time)
    if (!userPt) continue

    const dbDelta = Math.abs(userPt.db - refPt.db)
    // Score: 0dB delta = 100, 12dB+ delta = 0
    const score = Math.max(0, 100 - (dbDelta / 12) * 100)

    notes.push({
      time: refPt.time,
      userDb: userPt.db,
      referenceDb: refPt.db,
      delta: dbDelta,
      score: Math.round(score),
    })

    totalScore += score
    totalUserDb += userPt.db
    totalRefDb += refPt.db
  }

  const avgUserDb = notes.length > 0 ? totalUserDb / notes.length : 0
  const avgRefDb = notes.length > 0 ? totalRefDb / notes.length : 0
  const overallMatch =
    notes.length > 0 ? Math.round(totalScore / notes.length) : 0

  return { overallMatch, notes, avgUserDb, avgReferenceDb: avgRefDb }
}

/**
 * Compute intensity profile from an array of pitch results.
 * Uses clarity values as a proxy for intensity when raw audio isn't available.
 */
export function intensityFromPitchResults(
  pitchResults: Array<{ time?: number; clarity: number; midi: number }>,
): {
  envelope: EnvelopePoint[]
  avgDb: number
  peakDb: number
  dynamicRange: number
} {
  if (pitchResults.length === 0) {
    return { envelope: [], avgDb: 0, peakDb: 0, dynamicRange: 0 }
  }

  const envelope: EnvelopePoint[] = []
  let sumDb = 0
  let peakDb = -Infinity

  for (let i = 0; i < pitchResults.length; i++) {
    const p = pitchResults[i]
    // Clarity (0-100+) maps roughly to intensity; normalize to dB-like scale
    const normClarity = Math.min(100, p.clarity)
    const db = normClarity > 0 ? 20 * Math.log10(normClarity / 50) : -60
    const time = p.time ?? i * 0.01

    envelope.push({ time, rms: normClarity / 100, db })
    sumDb += db
    if (db > peakDb) peakDb = db
  }

  const avgDb = sumDb / envelope.length
  const minDb = envelope.reduce((m, p) => Math.min(m, p.db), Infinity)
  const dynamicRange = peakDb - minDb

  return { envelope, avgDb, peakDb, dynamicRange }
}

// ── Breathiness Efficiency Index ───────────────────────────────

/**
 * Compute Harmonic-to-Noise Ratio (HNR) from a magnitude spectrum.
 *
 * Identifies harmonic peaks (integer multiples of f0), sums their power,
 * and compares against the total spectral power excluding DC.
 *
 * Returns HNR in dB. Typical values:
 *   < 10 dB — breathy/airy
 *   10-20 dB — normal speaking/singing
 *   20-30 dB — resonant/clear
 *   > 30 dB — pressed/strained
 */
export function computeHNR(
  magnitudeSpectrum: Float32Array | number[],
  sampleRate: number,
  fundamentalFreq: number,
  fftSize: number,
  maxHarmonics = 15,
): BreathinessResult {
  const binWidth = sampleRate / fftSize
  const f0Bin = Math.round(fundamentalFreq / binWidth)

  if (f0Bin < 1 || f0Bin >= magnitudeSpectrum.length) {
    return { hnrDb: 0, quality: 'breathy', efficiency: 0 }
  }

  let harmonicPower = 0
  let totalPower = 0
  const harmonicWindow = Math.max(1, Math.round(binWidth * 2 / binWidth)) // 2 bins around each harmonic

  for (let i = 1; i < magnitudeSpectrum.length; i++) {
    const mag = magnitudeSpectrum[i]
    const power = mag * mag
    totalPower += power

    // Check if this bin is near a harmonic of f0
    for (let h = 1; h <= maxHarmonics; h++) {
      const harmonicBin = f0Bin * h
      if (Math.abs(i - harmonicBin) <= harmonicWindow) {
        harmonicPower += power
        break
      }
    }
  }

  if (totalPower === 0) {
    return { hnrDb: 0, quality: 'breathy', efficiency: 0 }
  }

  const noisePower = Math.max(0, totalPower - harmonicPower)
  const hnrDb =
    noisePower > 0 ? 10 * Math.log10(harmonicPower / noisePower) : 40

  let quality: BreathinessResult['quality']
  if (hnrDb < 10) quality = 'breathy'
  else if (hnrDb < 20) quality = 'normal'
  else if (hnrDb < 30) quality = 'resonant'
  else quality = 'pressed'

  // Map HNR to 0-100 efficiency scale
  // < 5 dB = 0, 35 dB+ = 100
  const efficiency = Math.round(
    Math.max(0, Math.min(100, ((hnrDb - 5) / 30) * 100)),
  )

  return { hnrDb: Math.round(hnrDb * 10) / 10, quality, efficiency }
}

/**
 * Approximate HNR from a set of pitch/frequency samples.
 * Uses frequency stability as a proxy: unstable pitch → breathier tone.
 * Real HNR requires FFT data; this is a lightweight fallback.
 */
export function approximateBreathiness(
  pitchResults: Array<{ freq: number; clarity: number }>,
): BreathinessResult {
  if (pitchResults.length < 3) {
    return { hnrDb: 0, quality: 'breathy', efficiency: 0 }
  }

  const validResults = pitchResults.filter((p) => p.freq > 20 && p.clarity > 0)

  if (validResults.length < 3) {
    return { hnrDb: 5, quality: 'breathy', efficiency: 15 }
  }

  // Clarity correlates with harmonic structure — higher clarity ≈ more harmonic
  const avgClarity =
    validResults.reduce((s, p) => s + p.clarity, 0) / validResults.length

  // Frequency stability: stable pitch suggests good harmonic structure
  const freqs = validResults.map((p) => p.freq)
  const avgFreq = freqs.reduce((a, b) => a + b, 0) / freqs.length
  const freqVariance =
    freqs.reduce((s, f) => s + (f - avgFreq) * (f - avgFreq), 0) / freqs.length
  const freqCV = Math.sqrt(freqVariance) / avgFreq // coefficient of variation

  // Combine clarity and stability into HNR estimate
  // High clarity + low variance = high HNR
  const clarityNorm = Math.min(100, avgClarity) / 100
  const stabilityNorm = Math.max(0, 1 - freqCV * 50) // freqCV ~0.02 is typical stable
  const estimatedHnr = 5 + clarityNorm * 20 + stabilityNorm * 10

  let quality: BreathinessResult['quality']
  if (estimatedHnr < 10) quality = 'breathy'
  else if (estimatedHnr < 20) quality = 'normal'
  else if (estimatedHnr < 30) quality = 'resonant'
  else quality = 'pressed'

  const efficiency = Math.round(
    Math.max(0, Math.min(100, ((estimatedHnr - 5) / 30) * 100)),
  )

  return { hnrDb: Math.round(estimatedHnr * 10) / 10, quality, efficiency }
}

// ── Micro-Tone Slide Tracking ──────────────────────────────────

/**
 * Detect and classify pitch slides/transitions from a continuous pitch stream.
 *
 * A "slide" is the path taken between two stable pitch regions.
 * This analyzes HOW the singer moves between notes, not just whether they hit the target.
 */
export function detectSlides(
  pitchSamples: Array<{
    time: number
    midi: number
    freq: number
  }>,
  stabilityThreshold = 3, // consecutive samples within 0.5 semitones to be "stable"
  minSlideSpan = 0.5, // minimum semitones to count as a slide
): SlideTrackingResult {
  if (pitchSamples.length < stabilityThreshold * 3) {
    return { slides: [], overallScore: 100, totalTransitions: 0, scoopCount: 0, cleanCount: 0 }
  }

  // Detect stable regions
  interface StableRegion {
    startIdx: number
    endIdx: number
    avgMidi: number
  }

  const stableRegions: StableRegion[] = []
  let regionStart = 0

  for (let i = 1; i < pitchSamples.length; i++) {
    const midiDiff = Math.abs(pitchSamples[i].midi - pitchSamples[i - 1].midi)
    if (midiDiff > 0.5) {
      // End of a stable region
      if (i - regionStart >= stabilityThreshold) {
        const regionSamples = pitchSamples.slice(regionStart, i)
        const avgMidi =
          regionSamples.reduce((s, p) => s + p.midi, 0) / regionSamples.length
        stableRegions.push({ startIdx: regionStart, endIdx: i - 1, avgMidi })
      }
      regionStart = i
    }
  }

  // Don't forget the last region
  if (pitchSamples.length - regionStart >= stabilityThreshold) {
    const regionSamples = pitchSamples.slice(regionStart)
    const avgMidi =
      regionSamples.reduce((s, p) => s + p.midi, 0) / regionSamples.length
    stableRegions.push({
      startIdx: regionStart,
      endIdx: pitchSamples.length - 1,
      avgMidi,
    })
  }

  // Analyze transitions between stable regions
  const slides: SlideEvent[] = []

  for (let r = 0; r < stableRegions.length - 1; r++) {
    const from = stableRegions[r]
    const to = stableRegions[r + 1]
    const transitionSamples = pitchSamples.slice(from.endIdx, to.startIdx + 1)

    if (transitionSamples.length < 2) continue

    const semitoneSpan = Math.abs(to.avgMidi - from.avgMidi)
    if (semitoneSpan < minSlideSpan) continue

    const direction: SlideDirection =
      to.avgMidi > from.avgMidi ? 'ascending' : 'descending'
    const durationMs =
      (transitionSamples[transitionSamples.length - 1].time -
        transitionSamples[0].time) *
      1000

    // Measure directness: how close to a straight line the pitch path is
    const directness = computeDirectness(
      transitionSamples,
      from.avgMidi,
      to.avgMidi,
    )

    // Classify slide type
    const type = classifySlide(
      transitionSamples,
      from.avgMidi,
      to.avgMidi,
      direction,
    )

    const score = scoreSlide(type, directness, semitoneSpan)

    slides.push({
      startTime: transitionSamples[0].time,
      endTime: transitionSamples[transitionSamples.length - 1].time,
      durationMs: Math.round(durationMs),
      startMidi: Math.round(from.avgMidi * 10) / 10,
      endMidi: Math.round(to.avgMidi * 10) / 10,
      semitoneSpan: Math.round(semitoneSpan * 10) / 10,
      direction,
      directness: Math.round(directness * 100),
      type,
      score: Math.round(score),
    })
  }

  const scoopCount = slides.filter((s) => s.type === 'scoop').length
  const cleanCount = slides.filter((s) => s.type === 'clean').length
  const overallScore =
    slides.length > 0
      ? Math.round(slides.reduce((s, sl) => s + sl.score, 0) / slides.length)
      : 100

  return {
    slides,
    overallScore,
    totalTransitions: slides.length,
    scoopCount,
    cleanCount,
  }
}

function computeDirectness(
  samples: Array<{ midi: number }>,
  startMidi: number,
  endMidi: number,
): number {
  if (samples.length < 2) return 1

  const span = endMidi - startMidi
  if (Math.abs(span) < 0.1) return 1

  // Ideal path: straight line from start to end
  let deviation = 0
  for (let i = 0; i < samples.length; i++) {
    const ideal =
      startMidi + (span * i) / (samples.length - 1)
    deviation += Math.abs(samples[i].midi - ideal)
  }

  const avgDeviation = deviation / samples.length
  // Directness: 0 deviation = 1.0, large deviation → 0
  return Math.max(0, 1 - avgDeviation / Math.abs(span))
}

function classifySlide(
  samples: Array<{ midi: number }>,
  startMidi: number,
  endMidi: number,
  direction: SlideDirection,
): SlideEvent['type'] {
  if (samples.length < 3) return 'clean'

  const mids = samples.map((s) => s.midi)
  const target = endMidi

  // Check for overshoot: goes past target then comes back
  const extremes = direction === 'ascending' ? Math.max(...mids) : Math.min(...mids)
  const overshootThreshold =
    direction === 'ascending'
      ? target + 0.75
      : target - 0.75

  if (
    (direction === 'ascending' && extremes > overshootThreshold) ||
    (direction === 'descending' && extremes < overshootThreshold)
  ) {
    return 'overshoot'
  }

  // Check for wobble: high deviation from straight line
  const span = endMidi - startMidi
  let totalChange = 0
  for (let i = 1; i < mids.length; i++) {
    totalChange += Math.abs(mids[i] - mids[i - 1])
  }
  const wobbleRatio = totalChange / (Math.abs(span) + 0.01)
  if (wobbleRatio > 2.5) return 'wobble'

  // Check for scoop: approaches target from below (for ascending) or above (for descending)
  const earlySamples = mids.slice(0, Math.max(2, Math.floor(mids.length * 0.3)))
  const earlyAvg = earlySamples.reduce((a, b) => a + b, 0) / earlySamples.length

  const lateSamples = mids.slice(-Math.max(2, Math.floor(mids.length * 0.3)))
  const lateAvg = lateSamples.reduce((a, b) => a + b, 0) / lateSamples.length

  // If the last portion is still approaching the target from the "wrong" direction
  if (direction === 'ascending') {
    // Check if early portion is significantly below the straight-line midpoint
    const midPoint = (startMidi + target) / 2
    if (earlyAvg < midPoint - 0.5 && lateAvg < target - 0.3) return 'scoop'
    if (lateAvg < target - 0.3) return 'scoop'
  } else {
    const midPoint = (startMidi + target) / 2
    if (earlyAvg > midPoint + 0.5 && lateAvg > target + 0.3) return 'fall'
    if (lateAvg > target + 0.3) return 'fall'
  }

  return 'clean'
}

function scoreSlide(
  type: SlideEvent['type'],
  directness: number,
  semitoneSpan: number,
): number {
  // Base score depends on slide type
  let score: number
  switch (type) {
    case 'clean':
      score = 85
      break
    case 'scoop':
    case 'fall':
      // Small scoops are stylistic; large ones are problems
      score = semitoneSpan < 2 ? 70 : 50
      break
    case 'overshoot':
      score = 40
      break
    case 'wobble':
      score = 30
      break
    default:
      score = 60
  }

  // Adjust for directness
  if (directness > 0.9) score += 10
  else if (directness < 0.5) score -= 15

  return Math.max(0, Math.min(100, score))
}

// ── Phase 2.1: Vibrato Detection ──────────────────────────────

/**
 * Detect vibrato from a continuous pitch stream.
 *
 * Vibrato is periodic modulation of pitch, typically 4-8 Hz with
 * ±25-50 cents depth. We run an FFT on the pitch time series
 * (in cents, relative to a smoothed baseline) to find the dominant
 * modulation frequency.
 */
export function detectVibrato(
  pitchSamples: Array<{ time: number; freq: number; midi: number }>,
  sampleRateEstimate = 100, // approximate Hz of pitch sample stream
): VibratoResult {
  if (pitchSamples.length < sampleRateEstimate * 0.25) {
    return { rateHz: 0, depthCents: 0, classification: 'none', detected: false, confidence: 0 }
  }

  // Convert to cents around a smoothed baseline
  const cents: number[] = []
  let baselineSum = 0
  for (const p of pitchSamples) {
    baselineSum += p.midi
  }
  const baselineMidi = baselineSum / pitchSamples.length

  for (const p of pitchSamples) {
    cents.push((p.midi - baselineMidi) * 100)
  }

  // Remove DC offset
  const dcOffset = cents.reduce((a, b) => a + b, 0) / cents.length
  const centered = cents.map((c) => c - dcOffset)

  // Compute FFT on the pitch modulation signal
  // Use radix-2, zero-padded
  const n = nextPow2(centered.length)
  const real = new Float64Array(n)
  const imag = new Float64Array(n)
  for (let i = 0; i < centered.length; i++) {
    real[i] = centered[i]
  }

  fft64(real, imag, n, false)

  // Find dominant frequency in 3-10 Hz range (vibrato band)
  const binWidth = sampleRateEstimate / n
  const minBin = Math.max(1, Math.round(3 / binWidth))
  const maxBin = Math.min(n / 2 - 1, Math.round(10 / binWidth))

  let maxMag = 0
  let maxBinIdx = minBin

  for (let i = minBin; i <= maxBin; i++) {
    const mag = Math.sqrt(real[i] * real[i] + imag[i] * imag[i])
    if (mag > maxMag) {
      maxMag = mag
      maxBinIdx = i
    }
  }

  const rateHz = maxBinIdx * binWidth

  // Measure depth: peak-to-peak cents of the modulation
  const depthCents = measureVibratoDepth(centered, rateHz, sampleRateEstimate)

  // Determine if vibrato is present
  // Significance: peak magnitude relative to mean magnitude in band
  let meanMag = 0
  let count = 0
  for (let i = minBin; i <= maxBin; i++) {
    meanMag += Math.sqrt(real[i] * real[i] + imag[i] * imag[i])
    count++
  }
  meanMag /= count

  const significance = meanMag > 0 ? maxMag / meanMag : 0
  const detected = significance > 2.0 && depthCents > 10

  let classification: VibratoResult['classification']
  if (!detected || depthCents < 10) {
    classification = 'none'
  } else if (rateHz < 4.5) {
    classification = 'slow-operatic'
  } else if (rateHz <= 7) {
    classification = 'natural'
  } else if (depthCents > 80) {
    classification = 'wide'
  } else {
    classification = 'nervous'
  }

  const confidence = Math.round(Math.min(95, significance * 15))

  return {
    rateHz: Math.round(rateHz * 10) / 10,
    depthCents: Math.round(depthCents),
    classification,
    detected,
    confidence,
  }
}

function measureVibratoDepth(
  cents: number[],
  rateHz: number,
  sampleRate: number,
): number {
  if (rateHz < 1) return 0

  // Bandpass-filter the cents around the detected vibrato rate
  // Simple approach: compute envelope of the filtered signal
  const periodSamples = Math.round(sampleRate / rateHz)
  if (periodSamples < 2 || periodSamples > cents.length) return 0

  // Compute RMS over sliding windows of vibrato period length
  const rmsValues: number[] = []
  const halfPeriod = Math.max(1, Math.floor(periodSamples / 2))

  for (let i = 0; i < cents.length - halfPeriod; i += halfPeriod) {
    let sumSq = 0
    const windowSize = Math.min(periodSamples, cents.length - i)
    for (let j = i; j < i + windowSize; j++) {
      sumSq += cents[j] * cents[j]
    }
    rmsValues.push(Math.sqrt(sumSq / windowSize))
  }

  if (rmsValues.length === 0) return 0

  // Depth = 2 * mean RMS (peak-to-peak estimate)
  const meanRms = rmsValues.reduce((a, b) => a + b, 0) / rmsValues.length
  return meanRms * 2
}

// ── Phase 2.2: Harmonic Richness Score ────────────────────────

/**
 * Compute harmonic richness from a magnitude spectrum.
 *
 * Identifies harmonics H1-H15 of the fundamental, normalizes to H1,
 * and produces a weighted richness score. A "rich" voice has substantial
 * energy in higher harmonics; a "thin" voice has only the first few.
 */
export function computeHarmonicRichness(
  magnitudeSpectrum: Float32Array | number[],
  sampleRate: number,
  fundamentalFreq: number,
  fftSize: number,
): HarmonicRichnessResult {
  const binWidth = sampleRate / fftSize
  const f0Bin = Math.round(fundamentalFreq / binWidth)

  if (f0Bin < 1 || f0Bin * 15 >= magnitudeSpectrum.length) {
    return {
      richnessScore: 0,
      harmonicCount: 0,
      harmonicProfile: [],
      quality: 'thin',
    }
  }

  // Extract harmonic amplitudes
  const harmonicAmps: number[] = []
  const window = Math.max(1, Math.round(binWidth / binWidth)) // 1-bin window

  for (let h = 1; h <= 15; h++) {
    const bin = f0Bin * h
    if (bin >= magnitudeSpectrum.length) break

    // Take the max magnitude in a small window around the harmonic
    let maxAmp = 0
    for (let w = -window; w <= window; w++) {
      const idx = bin + w
      if (idx >= 0 && idx < magnitudeSpectrum.length) {
        maxAmp = Math.max(maxAmp, magnitudeSpectrum[idx])
      }
    }
    harmonicAmps.push(maxAmp)
  }

  if (harmonicAmps.length === 0 || harmonicAmps[0] === 0) {
    return {
      richnessScore: 0,
      harmonicCount: 0,
      harmonicProfile: [],
      quality: 'thin',
    }
  }

  // Normalize to H1
  const h1 = harmonicAmps[0]
  const normalized = harmonicAmps.map((a) => a / h1)

  // Count detectable harmonics (above 5% of H1, typical noise floor)
  let harmonicCount = 0
  for (let h = 0; h < normalized.length; h++) {
    if (normalized[h] > 0.05) harmonicCount++
  }

  // Compute richness score: weighted sum of harmonics above H1
  // Higher harmonics get higher weight (they're harder to produce)
  let weightedSum = 0
  const weights = [0, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0]
  for (let h = 1; h < normalized.length; h++) {
    weightedSum += normalized[h] * weights[h] * 100
  }

  const richnessScore = Math.round(
    Math.min(100, weightedSum / (normalized.length - 1)),
  )

  let quality: HarmonicRichnessResult['quality']
  if (harmonicCount >= 12 && richnessScore > 40) quality = 'very-rich'
  else if (harmonicCount >= 8 && richnessScore > 25) quality = 'rich'
  else if (harmonicCount >= 4 && richnessScore > 10) quality = 'normal'
  else quality = 'thin'

  return {
    richnessScore,
    harmonicCount,
    harmonicProfile: normalized.map((a) => Math.round(a * 1000) / 1000),
    quality,
  }
}

/**
 * Lightweight harmonic richness estimate from pitch data only (no spectrum).
 * Uses pitch stability and clarity as proxies.
 */
export function approximateRichness(
  pitchResults: Array<{ freq: number; clarity: number }>,
): { richnessScore: number; harmonicCount: number; quality: HarmonicRichnessResult['quality'] } {
  if (pitchResults.length < 3) {
    return { richnessScore: 0, harmonicCount: 0, quality: 'thin' }
  }

  const valid = pitchResults.filter((p) => p.freq > 20 && p.clarity > 0)
  if (valid.length < 3) {
    return { richnessScore: 10, harmonicCount: 2, quality: 'thin' }
  }

  const avgClarity = valid.reduce((s, p) => s + p.clarity, 0) / valid.length
  const clarityNorm = Math.min(100, avgClarity) / 100

  // Higher clarity → more detectable harmonics
  const harmonicCount = Math.round(3 + clarityNorm * 10)
  const richnessScore = Math.round(clarityNorm * 60 + 10)

  let quality: HarmonicRichnessResult['quality']
  if (harmonicCount >= 12) quality = 'very-rich'
  else if (harmonicCount >= 8) quality = 'rich'
  else if (harmonicCount >= 4) quality = 'normal'
  else quality = 'thin'

  return { richnessScore, harmonicCount, quality }
}

// ── Phase 2.3: Resonance Zone Detection ────────────────────────

/**
 * Detect resonance zone (chest/mask/head) from spectral energy distribution.
 *
 * Chest:   energy concentrated in 200-800 Hz
 * Mask:    energy concentrated in 800-2500 Hz
 * Head:    energy concentrated in 2500+ Hz
 *
 * Uses spectral centroid and energy-band ratios.
 */
export function detectResonance(
  magnitudeSpectrum: Float32Array | number[],
  sampleRate: number,
  fftSize: number,
): ResonanceResult {
  const binWidth = sampleRate / fftSize

  const chestLo = Math.round(200 / binWidth)
  const chestHi = Math.round(800 / binWidth)
  const maskLo = Math.round(800 / binWidth)
  const maskHi = Math.round(2500 / binWidth)
  const headLo = Math.round(2500 / binWidth)
  const headHi = Math.round(sampleRate / 2 / binWidth)

  let chestEnergy = 0
  let maskEnergy = 0
  let headEnergy = 0
  let totalEnergy = 0
  let weightedFreqSum = 0

  for (let i = 0; i < magnitudeSpectrum.length; i++) {
    const mag = magnitudeSpectrum[i]
    const power = mag * mag
    totalEnergy += power
    weightedFreqSum += power * (i * binWidth)

    if (i >= chestLo && i <= chestHi) chestEnergy += power
    if (i >= maskLo && i <= maskHi) maskEnergy += power
    if (i >= headLo && i <= headHi) headEnergy += power
  }

  if (totalEnergy === 0) {
    return {
      dominantZone: 'chest',
      chestRatio: 0,
      maskRatio: 0,
      headRatio: 0,
      spectralCentroid: 0,
    }
  }

  const chestRatio = chestEnergy / totalEnergy
  const maskRatio = maskEnergy / totalEnergy
  const headRatio = headEnergy / totalEnergy
  const spectralCentroid = weightedFreqSum / totalEnergy

  let dominantZone: ResonanceZone
  if (maskRatio > chestRatio && maskRatio > headRatio) {
    dominantZone = 'mask'
  } else if (headRatio > chestRatio && headRatio > maskRatio) {
    dominantZone = 'head'
  } else if (
    (chestRatio > 0.1 && maskRatio > 0.1 && Math.abs(chestRatio - maskRatio) < 0.05) ||
    (maskRatio > 0.1 && headRatio > 0.1 && Math.abs(maskRatio - headRatio) < 0.05) ||
    (chestRatio > 0.1 && headRatio > 0.1 && Math.abs(chestRatio - headRatio) < 0.05)
  ) {
    dominantZone = 'mixed'
  } else {
    dominantZone = 'chest'
  }

  return {
    dominantZone,
    chestRatio: Math.round(chestRatio * 1000) / 1000,
    maskRatio: Math.round(maskRatio * 1000) / 1000,
    headRatio: Math.round(headRatio * 1000) / 1000,
    spectralCentroid: Math.round(spectralCentroid),
  }
}

/**
 * Lightweight resonance estimate from pitch data.
 * Uses the pitch range as a proxy: lower pitches → chest, mid → mask, high → head.
 */
export function approximateResonance(
  pitchResults: Array<{ freq: number }>,
): ResonanceResult {
  if (pitchResults.length === 0) {
    return {
      dominantZone: 'chest',
      chestRatio: 0,
      maskRatio: 0,
      headRatio: 0,
      spectralCentroid: 0,
    }
  }

  const freqs = pitchResults.filter((p) => p.freq > 20).map((p) => p.freq)
  if (freqs.length === 0) {
    return {
      dominantZone: 'chest',
      chestRatio: 0,
      maskRatio: 0,
      headRatio: 0,
      spectralCentroid: 0,
    }
  }

  const avgFreq = freqs.reduce((a, b) => a + b, 0) / freqs.length

  // Rough resonance mapping based on average frequency
  let chestRatio: number
  let maskRatio: number
  let headRatio: number

  if (avgFreq < 300) {
    chestRatio = 0.7
    maskRatio = 0.25
    headRatio = 0.05
  } else if (avgFreq < 500) {
    chestRatio = 0.4
    maskRatio = 0.5
    headRatio = 0.1
  } else if (avgFreq < 800) {
    chestRatio = 0.2
    maskRatio = 0.6
    headRatio = 0.2
  } else {
    chestRatio = 0.1
    maskRatio = 0.4
    headRatio = 0.5
  }

  let dominantZone: ResonanceZone
  if (maskRatio > chestRatio && maskRatio > headRatio) dominantZone = 'mask'
  else if (headRatio > chestRatio && headRatio > maskRatio) dominantZone = 'head'
  else if (Math.abs(chestRatio - maskRatio) < 0.1) dominantZone = 'mixed'
  else dominantZone = 'chest'

  return {
    dominantZone,
    chestRatio: Math.round(chestRatio * 1000) / 1000,
    maskRatio: Math.round(maskRatio * 1000) / 1000,
    headRatio: Math.round(headRatio * 1000) / 1000,
    spectralCentroid: Math.round(avgFreq),
  }
}

// ── Phase 2.4: Vocal Fatigue Tracker ───────────────────────────

/**
 * Analyze collected checkpoints for vocal fatigue trends.
 *
 * Fatigue indicators:
 *   - HNR decreasing (breathier as voice tires)
 *   - Harmonic richness declining (fewer overtones)
 *   - Pitch stability worsening (more wavering)
 *
 * Returns trend slopes and fatigue alert if 2+ metrics are declining.
 */
export function analyzeFatigue(
  checkpoints: FatigueCheckpoint[],
): FatigueResult {
  if (checkpoints.length < 3) {
    return {
      fatigued: false,
      alert: null,
      trends: { hnrTrend: 0, richnessTrend: 0, stabilityTrend: 0 },
      checkpoints,
    }
  }

  // Compute linear trend slopes
  const hnrTrend = computeTrend(checkpoints.map((c) => c.hnrDb))
  const richnessTrend = computeTrend(
    checkpoints.map((c) => c.richnessScore),
  )
  const stabilityTrend = computeTrend(
    checkpoints.map((c) => c.pitchStability),
  )

  // Normalize trends to % change over the session
  const first = checkpoints[0]
  const hnrChange =
    first.hnrDb > 0 ? (hnrTrend / first.hnrDb) * 100 : 0
  const richnessChange =
    first.richnessScore > 0
      ? (richnessTrend / first.richnessScore) * 100
      : 0
  const stabilityChange =
    first.pitchStability > 0
      ? (stabilityTrend / first.pitchStability) * 100
      : 0

  // Count declining metrics
  let decliningCount = 0
  if (hnrChange < -5) decliningCount++
  if (richnessChange < -5) decliningCount++
  if (stabilityChange < -5) decliningCount++

  const fatigued = decliningCount >= 2

  let alert: string | null = null
  if (fatigued) {
    if (decliningCount === 3) {
      alert =
        'Significant vocal fatigue detected. Your harmonics, breath support, and pitch stability are all declining. Consider resting your voice.'
    } else {
      const issues: string[] = []
      if (hnrChange < -5) issues.push('breath support is weakening')
      if (richnessChange < -5)
        issues.push('high-end harmonics are dropping')
      if (stabilityChange < -5)
        issues.push('pitch stability is declining')
      alert = `Your ${issues.join(' and ')} — it may be time to rest.`
    }
  }

  return {
    fatigued,
    alert,
    trends: {
      hnrTrend: Math.round(hnrChange * 10) / 10,
      richnessTrend: Math.round(richnessChange * 10) / 10,
      stabilityTrend: Math.round(stabilityChange * 10) / 10,
    },
    checkpoints,
  }
}

/**
 * Compute trend slope using simple linear regression.
 * Returns total change over the series (last - first estimate).
 */
function computeTrend(values: number[]): number {
  if (values.length < 2) return 0

  const n = values.length
  let sumX = 0
  let sumY = 0
  let sumXY = 0
  let sumX2 = 0

  for (let i = 0; i < n; i++) {
    sumX += i
    sumY += values[i]
    sumXY += i * values[i]
    sumX2 += i * i
  }

  const denominator = n * sumX2 - sumX * sumX
  if (denominator === 0) return 0

  const slope = (n * sumXY - sumX * sumY) / denominator
  return slope * (n - 1) // total change over the series
}

// ── DFT/FFT Utilities ──────────────────────────────────────────

function nextPow2(n: number): number {
  let p = 1
  while (p < n) p <<= 1
  return p
}

function fft64(
  real: Float64Array,
  imag: Float64Array,
  n: number,
  inverse: boolean,
): void {
  // Bit-reversal permutation
  let j = 0
  for (let i = 0; i < n; i++) {
    if (i < j) {
      ;[real[i], real[j]] = [real[j], real[i]]
      ;[imag[i], imag[j]] = [imag[j], imag[i]]
    }
    let k = n >> 1
    while (k > 0 && j & k) {
      j &= ~k
      k >>= 1
    }
    j |= k
  }

  // Cooley-Tukey
  const sign = inverse ? 1 : -1
  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1
    const angle = (2 * Math.PI) / len
    const wReal = Math.cos(angle)
    const wImag = sign * Math.sin(angle)

    for (let i = 0; i < n; i += len) {
      let curReal = 1
      let curImag = 0

      for (let k = 0; k < half; k++) {
        const evenR = real[i + k]
        const evenI = imag[i + k]
        const oddR = real[i + k + half]
        const oddI = imag[i + k + half]

        const tR = curReal * oddR - curImag * oddI
        const tI = curReal * oddI + curImag * oddR

        real[i + k] = evenR + tR
        imag[i + k] = evenI + tI
        real[i + k + half] = evenR - tR
        imag[i + k + half] = evenI - tI

        const nextR = curReal * wReal - curImag * wImag
        const nextI = curReal * wImag + curImag * wReal
        curReal = nextR
        curImag = nextI
      }
    }
  }
}

// ── Phase 1 Helpers (continued) ────────────────────────────────

function findClosestByTime<T extends { time: number }>(
  points: T[],
  targetTime: number,
): T | null {
  if (points.length === 0) return null

  let closest = points[0]
  let closestDist = Math.abs(points[0].time - targetTime)

  // Binary search for O(log n)
  let lo = 0
  let hi = points.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const dist = Math.abs(points[mid].time - targetTime)
    if (dist < closestDist) {
      closestDist = dist
      closest = points[mid]
    }
    if (points[mid].time < targetTime) {
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }

  return closestDist < 0.1 ? closest : null // reject if > 100ms away
}
