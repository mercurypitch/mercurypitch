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

// ── Helpers ────────────────────────────────────────────────────

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
