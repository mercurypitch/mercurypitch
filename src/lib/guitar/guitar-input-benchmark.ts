// Input benchmark reports separate synthetic detector evidence from real-device validation.
// ============================================================

import { PitchDetector } from '../pitch-detector'
import { createAttackDetector } from './attack-detector'
import type { GuitarInputFixture } from './guitar-input-fixtures'
import type { GuitarInputProfileSnapshot } from './guitar-input-profile'

const RENDER_QUANTUM = 128
const MATCH_WINDOW_SECONDS = 0.04

export interface GuitarAttackBenchmarkMetrics {
  expectedAttacks: number
  detectedAttacks: number
  matchedAttacks: number
  missedAttacks: number
  falseAttacks: number
  /** Algorithmic detection delay only; this is not route or device latency. */
  detectorDelayMedianMs: number | null
  /** Algorithmic detection delay only; this is not route or device latency. */
  detectorDelayP95Ms: number | null
}

export interface GuitarPitchBenchmarkMetrics {
  expectedFrames: number
  detectedFrames: number
  wrongNoteFrames: number
  medianAbsoluteCentsError: number | null
  p95AbsoluteCentsError: number | null
  unavailableReason: string | null
}

export interface GuitarInputEvidenceReport {
  schemaVersion: 'guitar-input-evidence/v1'
  createdAt: string
  evidenceOrigin: 'synthetic-fixture' | 'real-device-run'
  hardwareValidation: 'not-run' | 'user-captured-unverified'
  fixture: { id: string; title: string; origin: 'synthetic' } | null
  input: GuitarInputProfileSnapshot
  runtime: {
    browser: string | null
    platform: string | null
    appVersion: string | null
  }
  take: {
    id: string
    lifecycle: 'recording' | 'completed' | 'cancelled'
    sampleRate: number
    timingSource: 'audio-clock' | 'frame-loop' | 'midi-clock'
    precision: 'sample-exact' | 'coarse-frame-loop' | 'high-resolution-midi'
    latencySeconds: number
    latencyProvenance: 'stored-round-trip' | 'midi-route-unmeasured' | 'none'
    latencyUncertaintySeconds: number | null
    eventCounts: { attacks: number; pitchChanges: number; releases: number }
    truncated: boolean
  } | null
  attack: GuitarAttackBenchmarkMetrics | null
  pitch: GuitarPitchBenchmarkMetrics | null
  rawAudioIncluded: false
}

export interface GuitarInputEvidenceReportInput {
  createdAt: string
  evidenceOrigin: GuitarInputEvidenceReport['evidenceOrigin']
  hardwareValidation: GuitarInputEvidenceReport['hardwareValidation']
  fixture: GuitarInputEvidenceReport['fixture']
  input: GuitarInputProfileSnapshot
  runtime?: Partial<GuitarInputEvidenceReport['runtime']>
  take: GuitarInputEvidenceReport['take']
  attack: GuitarAttackBenchmarkMetrics | null
  pitch: GuitarPitchBenchmarkMetrics | null
}

function percentile(
  values: readonly number[],
  fraction: number,
): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((left, right) => left - right)
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(fraction * sorted.length) - 1),
  )
  return sorted[index] ?? null
}

function matchAttacks(
  expectedSeconds: readonly number[],
  detectedSeconds: readonly number[],
): readonly number[] {
  const unused = new Set(detectedSeconds.map((_, index) => index))
  const delays: number[] = []
  for (const expected of expectedSeconds) {
    let bestIndex: number | null = null
    let bestDistance = Number.POSITIVE_INFINITY
    for (const index of unused) {
      const detected = detectedSeconds[index]
      if (detected === undefined) continue
      const distance = detected - expected
      if (
        distance < 0 ||
        distance > MATCH_WINDOW_SECONDS ||
        distance >= bestDistance
      ) {
        continue
      }
      bestDistance = distance
      bestIndex = index
    }
    if (bestIndex === null) continue
    unused.delete(bestIndex)
    delays.push(bestDistance)
  }
  return delays
}

export function runGuitarAttackFixtureBenchmark(
  fixture: GuitarInputFixture,
): GuitarAttackBenchmarkMetrics {
  const detector = createAttackDetector({ sampleRate: fixture.sampleRate })
  const detectedSeconds: number[] = []
  for (let start = 0; start < fixture.samples.length; start += RENDER_QUANTUM) {
    const block = fixture.samples.subarray(
      start,
      Math.min(start + RENDER_QUANTUM, fixture.samples.length),
    )
    for (const attack of detector.process(block)) {
      detectedSeconds.push((start + attack.offsetSamples) / fixture.sampleRate)
    }
  }
  const delaysSeconds = matchAttacks(
    fixture.expectedAttackSeconds,
    detectedSeconds,
  )
  const delaysMs = delaysSeconds.map((delay) => delay * 1000)
  const median = percentile(delaysMs, 0.5)
  const p95 = percentile(delaysMs, 0.95)
  return {
    expectedAttacks: fixture.expectedAttackSeconds.length,
    detectedAttacks: detectedSeconds.length,
    matchedAttacks: delaysSeconds.length,
    missedAttacks: fixture.expectedAttackSeconds.length - delaysSeconds.length,
    falseAttacks: detectedSeconds.length - delaysSeconds.length,
    detectorDelayMedianMs: median,
    detectorDelayP95Ms: p95,
  }
}

export function runGuitarPitchFixtureBenchmark(
  fixture: GuitarInputFixture,
): GuitarPitchBenchmarkMetrics {
  if (fixture.pitchTruth.kind === 'unavailable') {
    return {
      expectedFrames: 0,
      detectedFrames: 0,
      wrongNoteFrames: 0,
      medianAbsoluteCentsError: null,
      p95AbsoluteCentsError: null,
      unavailableReason: fixture.pitchTruth.reason,
    }
  }

  const windowFrames = 2048
  const detector = new PitchDetector({
    algorithm: 'mpm',
    sampleRate: fixture.sampleRate,
    bufferSize: windowFrames,
    minFrequency: 55,
    maxFrequency: 1600,
    minConfidence: 0.38,
    minAmplitude: 0.018,
    stabilize: false,
  })
  const errors: number[] = []
  let wrongNoteFrames = 0
  for (const point of fixture.pitchTruth.points) {
    const center = Math.round(point.atSeconds * fixture.sampleRate)
    const start = center - Math.floor(windowFrames / 2)
    if (start < 0 || start + windowFrames > fixture.samples.length) continue
    const detected = detector.detect(
      fixture.samples.subarray(start, start + windowFrames),
    )
    if (!(detected.frequency > 0)) continue
    const centsError = Math.abs(
      1200 * Math.log2(detected.frequency / point.frequencyHz),
    )
    errors.push(centsError)
    const expectedMidi = Math.round(
      69 + 12 * Math.log2(point.frequencyHz / 440),
    )
    const detectedMidi = Math.round(
      69 + 12 * Math.log2(detected.frequency / 440),
    )
    if (detectedMidi !== expectedMidi) wrongNoteFrames += 1
  }

  return {
    expectedFrames: fixture.pitchTruth.points.length,
    detectedFrames: errors.length,
    wrongNoteFrames,
    medianAbsoluteCentsError: percentile(errors, 0.5),
    p95AbsoluteCentsError: percentile(errors, 0.95),
    unavailableReason:
      errors.length === 0
        ? 'The detector returned no clarity-qualified pitch frames.'
        : null,
  }
}

export function buildGuitarInputEvidenceReport(
  input: GuitarInputEvidenceReportInput,
): GuitarInputEvidenceReport {
  return {
    schemaVersion: 'guitar-input-evidence/v1',
    createdAt: input.createdAt,
    evidenceOrigin: input.evidenceOrigin,
    hardwareValidation: input.hardwareValidation,
    fixture: input.fixture === null ? null : { ...input.fixture },
    input: { ...input.input },
    runtime: {
      browser: input.runtime?.browser ?? null,
      platform: input.runtime?.platform ?? null,
      appVersion: input.runtime?.appVersion ?? null,
    },
    take:
      input.take === null
        ? null
        : {
            ...input.take,
            eventCounts: { ...input.take.eventCounts },
          },
    attack: input.attack === null ? null : { ...input.attack },
    pitch: input.pitch === null ? null : { ...input.pitch },
    rawAudioIncluded: false,
  }
}

export function serializeGuitarInputEvidenceReport(
  report: GuitarInputEvidenceReport,
): string {
  return `${JSON.stringify(report, null, 2)}\n`
}
