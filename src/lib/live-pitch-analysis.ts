// ============================================================
// Live Pitch Analysis — Phase 1 & 2 real-time vocal metrics
// ============================================================

/** A single pitch sample from live mic input. */
export interface LivePitchSample {
  /** Frequency in Hz (0 = no pitch detected) */
  frequency: number
  /** Clarity/confidence (0-1) */
  clarity: number
  /** RMS amplitude (0-1) */
  amplitude: number
  /** Note name (e.g. "C4") */
  noteName: string
  /** Timestamp in seconds since recording start */
  timestamp: number
}

// ── Live Analysis Results ────────────────────────────────────

export interface IntensityResult {
  /** Average dB level across the buffer */
  avgDb: number
  /** Peak dB level */
  peakDb: number
  /** Dynamic range (peak - min) in dB */
  dynamicRange: number
  /** Whether the intensity is consistent (low variation) */
  isConsistent: boolean
}

export interface BreathinessResult {
  /** Breathiness score 0-100 (higher = more breathy) */
  score: number
  /** Classification label */
  label: 'Clear' | 'Light' | 'Breathy' | 'Very Breathy'
  /** Whether clarity suggests good cord closure */
  hasGoodClosure: boolean
}

export interface SlideResult {
  /** Number of slide events detected */
  count: number
  /** Average slide distance in semitones */
  avgDistance: number
  /** Whether slides are smooth (gradual) vs abrupt */
  isSmooth: boolean
}

export interface VibratoResult {
  /** Vibrato rate in Hz (typically 4-7 Hz for good vibrato) */
  rate: number
  /** Depth in cents (typically 10-50 cents) */
  depth: number
  /** Whether vibrato is detected at all */
  detected: boolean
  /** Quality label */
  quality: 'None' | 'Narrow' | 'Good' | 'Wide' | 'Wobbly'
}

export interface RichnessResult {
  /** Estimated harmonic richness score 0-100 */
  score: number
  /** Estimated number of detectable harmonics */
  harmonicCount: number
  /** Classification */
  label: 'Thin' | 'Moderate' | 'Rich' | 'Full'
}

export interface ResonanceResult {
  /** Primary resonance zone */
  zone: 'Chest' | 'Mixed' | 'Head' | 'Whistle'
  /** Confidence in zone detection (0-100) */
  confidence: number
  /** Average frequency */
  avgFrequency: number
}

// ── Phase 1: Intensity Mirroring ─────────────────────────────

/** Linear amplitude (0-1) → dB scale (−60 to 0) */
function ampToDb(amp: number): number {
  if (amp <= 0) return -60
  const db = 20 * Math.log10(amp)
  return Math.max(-60, db)
}

export function intensityFromPitchResults(
  samples: LivePitchSample[],
): IntensityResult {
  if (samples.length === 0) {
    return { avgDb: -60, peakDb: -60, dynamicRange: 0, isConsistent: false }
  }

  const dbs = samples.map((s) => ampToDb(s.amplitude))
  const avgDb = dbs.reduce((a, b) => a + b, 0) / dbs.length
  const peakDb = Math.max(...dbs)
  const minDb = Math.min(...dbs)
  const dynamicRange = peakDb - minDb
  const variance = dbs.reduce((s, v) => s + (v - avgDb) ** 2, 0) / dbs.length

  return {
    avgDb: Math.round(avgDb * 10) / 10,
    peakDb: Math.round(peakDb * 10) / 10,
    dynamicRange: Math.round(dynamicRange * 10) / 10,
    isConsistent: variance < 25,
  }
}

// ── Phase 2: Breathiness ─────────────────────────────────────

export function approximateBreathiness(
  samples: LivePitchSample[],
): BreathinessResult {
  if (samples.length === 0) {
    return { score: 0, label: 'Clear', hasGoodClosure: true }
  }

  // Breathiness correlates with: low pitch clarity, low amplitude,
  // high frequency instability. We approximate from clarity + amplitude.
  const avgClarity = samples.reduce((s, v) => s + v.clarity, 0) / samples.length
  const avgAmp = samples.reduce((s, v) => s + v.amplitude, 0) / samples.length

  // Low clarity = more breathy. Amplitude modulates this.
  const baseBreathiness = (1 - avgClarity) * 70
  const ampFactor = avgAmp < 0.1 ? 30 : avgAmp < 0.25 ? 15 : 0
  const score = Math.round(Math.min(100, baseBreathiness + ampFactor))

  let label: BreathinessResult['label']
  if (score < 20) label = 'Clear'
  else if (score < 40) label = 'Light'
  else if (score < 65) label = 'Breathy'
  else label = 'Very Breathy'

  return {
    score,
    label,
    hasGoodClosure: score < 40,
  }
}

// ── Phase 3: Slide Detection ─────────────────────────────────

function freqToSemitones(f1: number, f2: number): number {
  if (f1 <= 0 || f2 <= 0) return 0
  return 12 * Math.log2(f2 / f1)
}

export function detectSlides(samples: LivePitchSample[]): SlideResult {
  if (samples.length < 3) {
    return { count: 0, avgDistance: 0, isSmooth: false }
  }

  // Look for pitch transitions > 0.5 semitones across consecutive samples
  const voiced = samples.filter((s) => s.frequency > 0 && s.clarity > 0.3)
  if (voiced.length < 3) {
    return { count: 0, avgDistance: 0, isSmooth: false }
  }

  const slides: number[] = []
  let smoothCount = 0

  for (let i = 1; i < voiced.length; i++) {
    const dist = Math.abs(
      freqToSemitones(voiced[i - 1].frequency, voiced[i].frequency),
    )
    if (dist > 0.5 && dist < 12) {
      slides.push(dist)
      // Check if transition was smooth (gradual rather than sudden)
      if (dist < 3) smoothCount++
    }
  }

  if (slides.length === 0) {
    return { count: 0, avgDistance: 0, isSmooth: false }
  }

  const avgDistance = slides.reduce((a, b) => a + b, 0) / slides.length

  return {
    count: slides.length,
    avgDistance: Math.round(avgDistance * 10) / 10,
    isSmooth: smoothCount / slides.length > 0.5,
  }
}

// ── Phase 4: Vibrato Detection ────────────────────────────────

export function detectVibrato(samples: LivePitchSample[]): VibratoResult {
  if (samples.length < 10) {
    return { rate: 0, depth: 0, detected: false, quality: 'None' }
  }

  // Extract pitch contour from voiced samples
  const contour = samples
    .filter((s) => s.frequency > 0 && s.clarity > 0.25)
    .map((s) => s.frequency)

  if (contour.length < 10) {
    return { rate: 0, depth: 0, detected: false, quality: 'None' }
  }

  // Detect oscillations in pitch — count zero crossings of the
  // detrended signal (pitch minus moving average)
  const windowSize = Math.min(5, Math.floor(contour.length / 3))
  const detrended: number[] = []

  for (let i = 0; i < contour.length; i++) {
    let sum = 0
    let count = 0
    for (
      let j = Math.max(0, i - windowSize);
      j < Math.min(contour.length, i + windowSize + 1);
      j++
    ) {
      sum += contour[j]
      count++
    }
    const avg = sum / count
    detrended.push(contour[i] - avg)
  }

  // Count zero crossings
  let crossings = 0
  for (let i = 1; i < detrended.length; i++) {
    if (
      (detrended[i - 1] >= 0 && detrended[i] < 0) ||
      (detrended[i - 1] < 0 && detrended[i] >= 0)
    ) {
      crossings++
    }
  }

  // Estimate rate from crossings
  const duration =
    samples.length > 0
      ? samples[samples.length - 1].timestamp - samples[0].timestamp
      : 0
  const rate = duration > 0 ? crossings / (2 * duration) : 0

  // Estimate depth in cents
  const centsDeviations = detrended.map((d, i) =>
    Math.abs(freqToSemitones(contour[i], contour[i] + d) * 100),
  )
  const depth =
    centsDeviations.length > 0
      ? centsDeviations.reduce((a, b) => a + b, 0) / centsDeviations.length
      : 0

  const detected = rate > 2 && rate < 10 && depth > 5

  let quality: VibratoResult['quality']
  if (!detected) quality = 'None'
  else if (depth < 10) quality = 'Narrow'
  else if (rate >= 4 && rate <= 7 && depth >= 10 && depth <= 50)
    quality = 'Good'
  else if (depth > 60) quality = 'Wide'
  else quality = 'Wobbly'

  return {
    rate: Math.round(rate * 10) / 10,
    depth: Math.round(depth * 10) / 10,
    detected,
    quality,
  }
}

// ── Phase 5: Harmonic Richness ────────────────────────────────

export function approximateRichness(
  samples: LivePitchSample[],
): RichnessResult {
  if (samples.length === 0) {
    return { score: 0, harmonicCount: 0, label: 'Thin' }
  }

  // Harmonic richness is approximated from:
  // 1. Pitch clarity (clearer pitch → more harmonic structure)
  // 2. Amplitude (louder = more overtones captured)
  // 3. Frequency range diversity
  const avgClarity = samples.reduce((s, v) => s + v.clarity, 0) / samples.length
  const avgAmp = samples.reduce((s, v) => s + v.amplitude, 0) / samples.length

  const voiced = samples.filter((s) => s.frequency > 0)
  const freqRange =
    voiced.length > 1
      ? Math.max(...voiced.map((s) => s.frequency)) -
        Math.min(...voiced.map((s) => s.frequency))
      : 0

  // Clarity contributes up to 50, amplitude up to 30, range up to 20
  const clarityScore = avgClarity * 50
  const ampScore = Math.min(30, avgAmp * 150)
  const rangeScore = Math.min(20, (freqRange / 500) * 20)

  const score = Math.round(Math.min(100, clarityScore + ampScore + rangeScore))

  // Estimate harmonic count based on score and typical fundamental
  const estimatedFreq = voiced.length > 0 ? voiced[0].frequency : 440
  const maxPossibleHarmonics = Math.floor(8000 / estimatedFreq) // up to 8kHz
  const harmonicCount = Math.max(
    1,
    Math.round((score / 100) * Math.min(maxPossibleHarmonics, 20)),
  )

  let label: RichnessResult['label']
  if (score < 25) label = 'Thin'
  else if (score < 50) label = 'Moderate'
  else if (score < 75) label = 'Rich'
  else label = 'Full'

  return { score, harmonicCount, label }
}

// ── Phase 6: Resonance Zone Detection ─────────────────────────

export function approximateResonance(
  samples: LivePitchSample[],
): ResonanceResult {
  if (samples.length === 0) {
    return { zone: 'Chest', confidence: 0, avgFrequency: 0 }
  }

  const voiced = samples.filter((s) => s.frequency > 0)
  if (voiced.length === 0) {
    return { zone: 'Chest', confidence: 0, avgFrequency: 0 }
  }

  const avgFreq = voiced.reduce((s, v) => s + v.frequency, 0) / voiced.length
  const minFreq = Math.min(...voiced.map((s) => s.frequency))

  // Approximate resonance zones by frequency ranges:
  // Chest:    ~80–350 Hz  (E2–F4)
  // Mixed:    ~260–520 Hz (C4–C5)
  // Head:     ~440–880 Hz (A4–A5)
  // Whistle:  >800 Hz
  const chestScore =
    Math.max(0, 1 - Math.abs(avgFreq - 200) / 150) * 0.7 +
    (minFreq < 200 ? 0.3 : 0)
  const mixedScore =
    Math.max(0, 1 - Math.abs(avgFreq - 370) / 130) *
    (avgFreq > 250 && avgFreq < 550 ? 0.8 : 0.2)
  const headScore =
    Math.max(0, 1 - Math.abs(avgFreq - 600) / 200) *
    (avgFreq > 440 && avgFreq < 900 ? 0.8 : 0.2)
  const whistleScore =
    Math.max(0, 1 - Math.abs(avgFreq - 1000) / 300) *
    (avgFreq > 800 ? 0.9 : 0.1)

  const scores: Array<{ zone: ResonanceResult['zone']; score: number }> = [
    { zone: 'Chest', score: chestScore },
    { zone: 'Mixed', score: mixedScore },
    { zone: 'Head', score: headScore },
    { zone: 'Whistle', score: whistleScore },
  ]

  scores.sort((a, b) => b.score - a.score)

  return {
    zone: scores[0].zone,
    confidence: Math.round(Math.min(100, scores[0].score * 100)),
    avgFrequency: Math.round(avgFreq),
  }
}

// ── Convenience: run all analyses at once ────────────────────

export interface LiveAnalysisSnapshot {
  intensity: IntensityResult
  breathiness: BreathinessResult
  slides: SlideResult
  vibrato: VibratoResult
  richness: RichnessResult
  resonance: ResonanceResult
  sampleCount: number
}

export function analyzeLiveBuffer(
  samples: LivePitchSample[],
): LiveAnalysisSnapshot {
  return {
    intensity: intensityFromPitchResults(samples),
    breathiness: approximateBreathiness(samples),
    slides: detectSlides(samples),
    vibrato: detectVibrato(samples),
    richness: approximateRichness(samples),
    resonance: approximateResonance(samples),
    sampleCount: samples.length,
  }
}
