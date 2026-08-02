// ============================================================
// Voice Atlas contour codec — compact, versioned local pitch maps
// ============================================================
//
// Converts raw recorder frames into a bounded tuple payload. The wire format
// remains deliberately small because it is saved beside (not inside) the
// list-safe voice-take metadata and may be decoded years after capture.

export const VOICE_ATLAS_CONTOUR_VERSION = 1 as const
export const VOICE_ATLAS_TARGET_HZ = 30
export const VOICE_ATLAS_MAX_POINTS = 10_000
export const VOICE_ATLAS_DEFAULT_SOURCE = 'f0-stream-yin-v1' as const

export type VoiceAtlasSource = 'f0-stream-yin-v1' | 'practice-engine-v1'

export interface VoiceAtlasRawFrame {
  /** Seconds from the start of this recording. */
  t: number
  /** Fundamental frequency in Hz; zero represents an unvoiced frame. */
  f0: number
  /** Detector confidence, expected in the range 0..1. */
  conf: number
  /** Uncalibrated input level, expected in the range 0..1. */
  rms: number
}

/** [timeMs, MIDI cents or null, confidence byte, relative-level byte]. */
export type VoiceAtlasPointTuple = readonly [
  timeMs: number,
  midiCents: number | null,
  confidenceByte: number,
  levelByte: number,
]

/** Compact v1 wire payload; short keys are intentional. */
export interface VoiceAtlasContourPayloadV1 {
  v: typeof VOICE_ATLAS_CONTOUR_VERSION
  s: VoiceAtlasSource
  hz: number
  p: VoiceAtlasPointTuple[]
  r: readonly [minMidiCents: number, maxMidiCents: number] | null
  vr: number
}

export interface VoiceAtlasPoint {
  timeMs: number
  midiCents: number | null
  confidence: number
  level: number
}

export interface DecodedVoiceAtlasContour {
  version: typeof VOICE_ATLAS_CONTOUR_VERSION
  source: VoiceAtlasSource
  sampleRateHz: number
  points: VoiceAtlasPoint[]
  pitchRange: readonly [minMidiCents: number, maxMidiCents: number] | null
  voicedRatio: number
}

export interface EncodeVoiceAtlasContourOptions {
  source?: VoiceAtlasSource
}

const SOURCES: ReadonlySet<VoiceAtlasSource> = new Set([
  'f0-stream-yin-v1',
  'practice-engine-v1',
])

const MAX_TIME_MS = 24 * 60 * 60 * 1000
const MIN_MIDI_CENTS = 0
const MAX_MIDI_CENTS = 15_000

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
}

function toMidiCents(frequency: number): number | null {
  if (!Number.isFinite(frequency) || frequency <= 0) return null
  const midiCents = Math.round((69 + 12 * Math.log2(frequency / 440)) * 100)
  return midiCents >= MIN_MIDI_CENTS && midiCents <= MAX_MIDI_CENTS
    ? midiCents
    : null
}

function toByte(value: number): number {
  return Math.round(clamp01(value) * 255)
}

function isSource(value: unknown): value is VoiceAtlasSource {
  return typeof value === 'string' && SOURCES.has(value as VoiceAtlasSource)
}

function isIntegerInRange(
  value: unknown,
  minimum: number,
  maximum: number,
): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= minimum &&
    value <= maximum
  )
}

function selectBoundedFrames(
  frames: readonly VoiceAtlasRawFrame[],
): VoiceAtlasRawFrame[] {
  const valid = frames
    .filter(
      (frame) =>
        Number.isFinite(frame.t) &&
        frame.t >= 0 &&
        frame.t * 1000 <= MAX_TIME_MS,
    )
    .sort((left, right) => left.t - right.t)
  if (valid.length <= 1) return valid

  const duration = valid.at(-1)!.t
  const targetStep = 1 / VOICE_ATLAS_TARGET_HZ
  const boundedStep = Math.max(
    targetStep,
    duration / Math.max(1, VOICE_ATLAS_MAX_POINTS - 1),
  )
  const selected: VoiceAtlasRawFrame[] = [valid[0]!]
  let nextTime = valid[0]!.t + boundedStep
  for (let index = 1; index < valid.length - 1; index += 1) {
    const frame = valid[index]!
    if (frame.t + Number.EPSILON < nextTime) continue
    selected.push(frame)
    nextTime = frame.t + boundedStep
    if (selected.length >= VOICE_ATLAS_MAX_POINTS - 1) break
  }
  const last = valid.at(-1)!
  if (selected.at(-1) !== last && selected.length < VOICE_ATLAS_MAX_POINTS) {
    selected.push(last)
  }
  return selected
}

export function encodeVoiceAtlasContour(
  frames: readonly VoiceAtlasRawFrame[],
  options: EncodeVoiceAtlasContourOptions = {},
): VoiceAtlasContourPayloadV1 {
  const source = options.source ?? VOICE_ATLAS_DEFAULT_SOURCE
  const sampled = selectBoundedFrames(frames)
  const points: VoiceAtlasPointTuple[] = sampled.map((frame) => [
    Math.round(frame.t * 1000),
    toMidiCents(frame.f0),
    toByte(frame.conf),
    toByte(frame.rms),
  ])
  const voicedPitches = points.flatMap((point) =>
    point[1] === null ? [] : [point[1]],
  )
  const pitchRange =
    voicedPitches.length === 0
      ? null
      : ([Math.min(...voicedPitches), Math.max(...voicedPitches)] as const)

  return {
    v: VOICE_ATLAS_CONTOUR_VERSION,
    s: source,
    hz: VOICE_ATLAS_TARGET_HZ,
    p: points,
    r: pitchRange,
    vr:
      points.length === 0
        ? 0
        : Math.round((voicedPitches.length / points.length) * 1000) / 1000,
  }
}

export function decodeVoiceAtlasContour(
  value: unknown,
): DecodedVoiceAtlasContour | null {
  let payload: unknown = value
  if (typeof value === 'string') {
    try {
      payload = JSON.parse(value) as unknown
    } catch {
      return null
    }
  }
  if (
    typeof payload !== 'object' ||
    payload === null ||
    Array.isArray(payload)
  ) {
    return null
  }
  const candidate = payload as Partial<VoiceAtlasContourPayloadV1>
  if (
    candidate.v !== VOICE_ATLAS_CONTOUR_VERSION ||
    !isSource(candidate.s) ||
    typeof candidate.hz !== 'number' ||
    !Number.isFinite(candidate.hz) ||
    candidate.hz <= 0 ||
    candidate.hz > 240 ||
    !Array.isArray(candidate.p) ||
    candidate.p.length > VOICE_ATLAS_MAX_POINTS ||
    typeof candidate.vr !== 'number' ||
    !Number.isFinite(candidate.vr) ||
    candidate.vr < 0 ||
    candidate.vr > 1
  ) {
    return null
  }

  const points: VoiceAtlasPoint[] = []
  let previousTime = -1
  for (const tuple of candidate.p) {
    if (!Array.isArray(tuple) || tuple.length !== 4) return null
    const [timeMs, midiCents, confidenceByte, levelByte] = tuple
    if (
      !isIntegerInRange(timeMs, 0, MAX_TIME_MS) ||
      timeMs < previousTime ||
      !(
        midiCents === null ||
        isIntegerInRange(midiCents, MIN_MIDI_CENTS, MAX_MIDI_CENTS)
      ) ||
      !isIntegerInRange(confidenceByte, 0, 255) ||
      !isIntegerInRange(levelByte, 0, 255)
    ) {
      return null
    }
    previousTime = timeMs
    points.push({
      timeMs,
      midiCents,
      confidence: confidenceByte / 255,
      level: levelByte / 255,
    })
  }

  let pitchRange: readonly [number, number] | null = null
  if (candidate.r !== null) {
    if (
      !Array.isArray(candidate.r) ||
      candidate.r.length !== 2 ||
      !isIntegerInRange(candidate.r[0], MIN_MIDI_CENTS, MAX_MIDI_CENTS) ||
      !isIntegerInRange(candidate.r[1], MIN_MIDI_CENTS, MAX_MIDI_CENTS) ||
      candidate.r[0] > candidate.r[1]
    ) {
      return null
    }
    pitchRange = [candidate.r[0], candidate.r[1]]
  }

  return {
    version: VOICE_ATLAS_CONTOUR_VERSION,
    source: candidate.s,
    sampleRateHz: candidate.hz,
    points,
    pitchRange,
    voicedRatio: candidate.vr,
  }
}

export function voiceAtlasSourceLabel(source: VoiceAtlasSource): string {
  return source === 'practice-engine-v1'
    ? 'MercuryPitch practice engine'
    : 'MercuryPitch pitch stream'
}
