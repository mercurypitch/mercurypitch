// ============================================================
// Voice Atlas Render Model — honest shared coordinates for take comparison
// ============================================================
//
// Earlier and Later always inhabit one real-time and pitch space. A shorter
// take therefore ends sooner instead of being stretched to resemble its pair,
// and unvoiced frames remain visible gaps instead of invented melody.

import type { DecodedVoiceAtlasContour } from '@/lib/voice-contour'

const MIN_PITCH_SPAN_CENTS = 600
const MIN_PITCH_PADDING_CENTS = 100
const MIN_RENDER_CONFIDENCE = 0.35
const MAX_TIME_TICKS = 6
const MAX_PITCH_TICKS = 7

export type VoiceAtlasTrailKey = 'earlier' | 'later'
export type VoiceAtlasTrailState =
  | 'missing'
  | 'legacy'
  | 'unavailable'
  | 'energy-only'
  | 'mapped'

export type VoiceAtlasAvailability =
  | 'empty'
  | 'legacy'
  | 'unavailable'
  | 'energy-only'
  | 'single-trail'
  | 'twin-trails'

export interface VoiceAtlasTakeInput {
  contour: DecodedVoiceAtlasContour | null
  durationSeconds: number
  /** True when metadata says analysis was saved but it cannot be decoded. */
  analysisExpected?: boolean
}

export interface VoiceAtlasModelInput {
  earlier: VoiceAtlasTakeInput | null
  later: VoiceAtlasTakeInput | null
}

export interface VoiceAtlasPitchDomain {
  minMidiCents: number
  maxMidiCents: number
}

export interface VoiceAtlasRenderPoint {
  timeSeconds: number
  /** Position in the shared real-time domain, from 0 to 1. */
  x: number
  /** Null is an observed unvoiced frame, not missing render data. */
  midiCents: number | null
  /** Position in the shared pitch domain, from 0 at the top to 1 at the bottom. */
  y: number | null
  confidence: number
  /** Per-trail relative level; each trail's observed peak is 1. */
  level: number
}

export interface VoiceAtlasRenderSegment {
  startSeconds: number
  endSeconds: number
  points: readonly VoiceAtlasRenderPoint[]
}

export interface VoiceAtlasTrailModel {
  key: VoiceAtlasTrailKey
  state: VoiceAtlasTrailState
  durationSeconds: number
  observedPeakLevel: number
  points: readonly VoiceAtlasRenderPoint[]
  segments: readonly VoiceAtlasRenderSegment[]
}

export interface VoiceAtlasTimeTick {
  seconds: number
  x: number
  label: string
}

export interface VoiceAtlasPitchTick {
  midiCents: number
  y: number
  label: string
}

export interface VoiceAtlasRenderModel {
  availability: VoiceAtlasAvailability
  durationSeconds: number
  pitchDomain: VoiceAtlasPitchDomain | null
  earlier: VoiceAtlasTrailModel
  later: VoiceAtlasTrailModel
  contourTrailCount: number
  voicedTrailCount: number
  timeTicks: readonly VoiceAtlasTimeTick[]
  pitchTicks: readonly VoiceAtlasPitchTick[]
}

interface DecodedContourPointView {
  timeMs: number
  midiCents: number | null
  confidence: number
  level: number
}

interface PreparedPoint {
  timeSeconds: number
  midiCents: number | null
  confidence: number
  rawLevel: number
}

interface PreparedTrail {
  key: VoiceAtlasTrailKey
  take: VoiceAtlasTakeInput | null
  points: readonly PreparedPoint[]
  peakLevel: number
  maxPitchGapSeconds: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function finiteNonNegative(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0
}

function decodedPoints(
  contour: DecodedVoiceAtlasContour,
): readonly DecodedContourPointView[] {
  return contour.points
}

function prepareTrail(
  key: VoiceAtlasTrailKey,
  take: VoiceAtlasTakeInput | null,
): PreparedTrail {
  if (take?.contour === null || take === null) {
    return { key, take, points: [], peakLevel: 0, maxPitchGapSeconds: 0 }
  }

  const points = decodedPoints(take.contour)
    .filter(
      (point) =>
        Number.isFinite(point.timeMs) &&
        point.timeMs >= 0 &&
        (point.midiCents === null || Number.isFinite(point.midiCents)),
    )
    .map((point) => {
      const confidence = clamp(
        Number.isFinite(point.confidence) ? point.confidence : 0,
        0,
        1,
      )
      return {
        timeSeconds: point.timeMs / 1000,
        midiCents: confidence >= MIN_RENDER_CONFIDENCE ? point.midiCents : null,
        confidence,
        rawLevel: finiteNonNegative(point.level),
      }
    })
    .sort((left, right) => left.timeSeconds - right.timeSeconds)

  const expectedStep = 1 / Math.max(1, take.contour.sampleRateHz)
  const intervals = points
    .slice(1)
    .map((point, index) => point.timeSeconds - points[index]!.timeSeconds)
    .filter((interval) => Number.isFinite(interval) && interval > 0)
    .sort((left, right) => left - right)
  const medianInterval =
    intervals.length >= 4
      ? intervals[Math.floor(intervals.length / 2)]!
      : expectedStep

  return {
    key,
    take,
    points,
    peakLevel: points.reduce(
      (peak, point) => Math.max(peak, point.rawLevel),
      0,
    ),
    // A few missed frames are normal. Longer holes are unknown territory and
    // must not be connected into an invented pitch gesture.
    maxPitchGapSeconds: Math.max(expectedStep, medianInterval) * 3,
  }
}

function sharedDurationSeconds(trails: readonly PreparedTrail[]): number {
  let duration = 0
  for (const trail of trails) {
    duration = Math.max(
      duration,
      finiteNonNegative(trail.take?.durationSeconds ?? 0),
      trail.points.at(-1)?.timeSeconds ?? 0,
    )
  }
  return duration
}

function createPitchDomain(
  trails: readonly PreparedTrail[],
): VoiceAtlasPitchDomain | null {
  const voiced = trails.flatMap((trail) =>
    trail.points.flatMap((point) =>
      point.midiCents === null ? [] : [point.midiCents],
    ),
  )
  if (voiced.length === 0) return null

  const observedMin = Math.min(...voiced)
  const observedMax = Math.max(...voiced)
  const observedSpan = observedMax - observedMin
  const padding = Math.max(
    MIN_PITCH_PADDING_CENTS,
    Math.ceil((observedSpan * 0.12) / 100) * 100,
  )
  let min = observedMin - padding
  let max = observedMax + padding

  if (max - min < MIN_PITCH_SPAN_CENTS) {
    const center = (min + max) / 2
    min = center - MIN_PITCH_SPAN_CENTS / 2
    max = center + MIN_PITCH_SPAN_CENTS / 2
  }

  return {
    minMidiCents: Math.floor(min / 100) * 100,
    maxMidiCents: Math.ceil(max / 100) * 100,
  }
}

function renderTrail(
  trail: PreparedTrail,
  durationSeconds: number,
  pitchDomain: VoiceAtlasPitchDomain | null,
): VoiceAtlasTrailModel {
  if (trail.take === null) {
    return {
      key: trail.key,
      state: 'missing',
      durationSeconds: 0,
      observedPeakLevel: 0,
      points: [],
      segments: [],
    }
  }
  if (trail.take.contour === null) {
    return {
      key: trail.key,
      state: trail.take.analysisExpected === true ? 'unavailable' : 'legacy',
      durationSeconds: finiteNonNegative(trail.take.durationSeconds),
      observedPeakLevel: 0,
      points: [],
      segments: [],
    }
  }
  if (trail.points.length === 0) {
    return {
      key: trail.key,
      state: 'unavailable',
      durationSeconds: finiteNonNegative(trail.take.durationSeconds),
      observedPeakLevel: 0,
      points: [],
      segments: [],
    }
  }

  const xDivisor = Math.max(durationSeconds, Number.EPSILON)
  const pitchSpan = pitchDomain
    ? pitchDomain.maxMidiCents - pitchDomain.minMidiCents
    : 0
  const points = trail.points.map<VoiceAtlasRenderPoint>((point) => ({
    timeSeconds: point.timeSeconds,
    x: clamp(point.timeSeconds / xDivisor, 0, 1),
    midiCents: point.midiCents,
    y:
      point.midiCents === null || pitchDomain === null
        ? null
        : clamp(
            1 - (point.midiCents - pitchDomain.minMidiCents) / pitchSpan,
            0,
            1,
          ),
    confidence: point.confidence,
    level:
      trail.peakLevel > 0 ? clamp(point.rawLevel / trail.peakLevel, 0, 1) : 0,
  }))

  const segments: VoiceAtlasRenderSegment[] = []
  let run: VoiceAtlasRenderPoint[] = []
  const finishRun = (): void => {
    if (run.length === 0) return
    segments.push({
      startSeconds: run[0].timeSeconds,
      endSeconds: run[run.length - 1].timeSeconds,
      points: run,
    })
    run = []
  }
  let previousVoicedSeconds: number | null = null
  for (const point of points) {
    if (point.midiCents === null) {
      finishRun()
      previousVoicedSeconds = null
      continue
    }
    if (
      previousVoicedSeconds !== null &&
      point.timeSeconds - previousVoicedSeconds > trail.maxPitchGapSeconds
    ) {
      finishRun()
    }
    run.push(point)
    previousVoicedSeconds = point.timeSeconds
  }
  finishRun()

  return {
    key: trail.key,
    state: segments.length > 0 ? 'mapped' : 'energy-only',
    durationSeconds: finiteNonNegative(trail.take.durationSeconds),
    observedPeakLevel: trail.peakLevel,
    points,
    segments,
  }
}

function availabilityFor(
  earlier: VoiceAtlasTrailModel,
  later: VoiceAtlasTrailModel,
): VoiceAtlasAvailability {
  const trails = [earlier, later]
  if (trails.every((trail) => trail.state === 'missing')) return 'empty'
  if (
    trails.every(
      (trail) => trail.state === 'missing' || trail.state === 'legacy',
    )
  ) {
    return 'legacy'
  }
  if (
    trails.every((trail) =>
      ['missing', 'legacy', 'unavailable'].includes(trail.state),
    )
  ) {
    return 'unavailable'
  }
  const voicedCount = trails.filter((trail) => trail.state === 'mapped').length
  if (voicedCount === 2) return 'twin-trails'
  if (voicedCount === 1) return 'single-trail'
  return 'energy-only'
}

function formatTime(seconds: number): string {
  if (seconds > 0 && seconds < 1) return `${seconds.toFixed(1)}s`
  const rounded = Math.round(seconds)
  const minutes = Math.floor(rounded / 60)
  return `${minutes}:${String(rounded % 60).padStart(2, '0')}`
}

function chooseTimeStep(durationSeconds: number): number {
  const choices = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600]
  return (
    choices.find(
      (candidate) => durationSeconds / candidate <= MAX_TIME_TICKS - 1,
    ) ?? choices[choices.length - 1]
  )
}

function createTimeTicks(durationSeconds: number): VoiceAtlasTimeTick[] {
  if (durationSeconds <= 0) return [{ seconds: 0, x: 0, label: '0:00' }]
  const step = chooseTimeStep(durationSeconds)
  const ticks: VoiceAtlasTimeTick[] = []
  for (let seconds = 0; seconds <= durationSeconds; seconds += step) {
    ticks.push({
      seconds,
      x: seconds / durationSeconds,
      label: formatTime(seconds),
    })
  }
  const last = ticks[ticks.length - 1]
  if (durationSeconds - last.seconds > step * 0.35) {
    ticks.push({
      seconds: durationSeconds,
      x: 1,
      label: formatTime(durationSeconds),
    })
  }
  return ticks
}

const NOTE_NAMES = [
  'C',
  'C♯',
  'D',
  'D♯',
  'E',
  'F',
  'F♯',
  'G',
  'G♯',
  'A',
  'A♯',
  'B',
] as const

function formatPitch(midiCents: number): string {
  const midi = Math.round(midiCents / 100)
  const noteIndex = ((midi % 12) + 12) % 12
  return `${NOTE_NAMES[noteIndex]}${Math.floor(midi / 12) - 1}`
}

function createPitchTicks(
  domain: VoiceAtlasPitchDomain | null,
): VoiceAtlasPitchTick[] {
  if (domain === null) return []
  const span = domain.maxMidiCents - domain.minMidiCents
  const steps = [100, 200, 300, 500, 600, 1200]
  const step =
    steps.find((candidate) => span / candidate <= MAX_PITCH_TICKS - 1) ?? 1200
  const first = Math.ceil(domain.minMidiCents / step) * step
  const ticks: VoiceAtlasPitchTick[] = []
  for (
    let midiCents = first;
    midiCents <= domain.maxMidiCents;
    midiCents += step
  ) {
    ticks.push({
      midiCents,
      y: 1 - (midiCents - domain.minMidiCents) / span,
      label: formatPitch(midiCents),
    })
  }
  return ticks
}

export function buildVoiceAtlasRenderModel(
  input: VoiceAtlasModelInput,
): VoiceAtlasRenderModel {
  const prepared = [
    prepareTrail('earlier', input.earlier),
    prepareTrail('later', input.later),
  ] as const
  const durationSeconds = sharedDurationSeconds(prepared)
  const pitchDomain = createPitchDomain(prepared)
  const earlier = renderTrail(prepared[0], durationSeconds, pitchDomain)
  const later = renderTrail(prepared[1], durationSeconds, pitchDomain)
  const rendered = [earlier, later]

  return {
    availability: availabilityFor(earlier, later),
    durationSeconds,
    pitchDomain,
    earlier,
    later,
    contourTrailCount: rendered.filter(
      (trail) => trail.state === 'mapped' || trail.state === 'energy-only',
    ).length,
    voicedTrailCount: rendered.filter((trail) => trail.state === 'mapped')
      .length,
    timeTicks: createTimeTicks(durationSeconds),
    pitchTicks: createPitchTicks(pitchDomain),
  }
}
