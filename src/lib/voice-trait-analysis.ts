// ============================================================
// Voice trait analysis — contour traits shared with Vocal Analysis DSP
// ============================================================
//
// A Voice Atlas contour contains real timestamps but also phrase gaps and note
// changes. This adapter isolates continuous held regions before handing them
// to the existing vibrato and pitch-stability algorithms, so an entire melody
// is never mistaken for one sustained note.

import type { VibratoResult } from '@/lib/vocal-analyzer'
import { computePitchStability, detectVibrato } from '@/lib/vocal-analyzer'
import type { DecodedVoiceAtlasContour, VoiceAtlasPoint, } from '@/lib/voice-contour'

const MIN_CONFIDENCE = 0.55
const MIN_HELD_SPAN_MS = 500
const MAX_LOCAL_JUMP_CENTS = 175
const HOLD_WINDOW_MS = 500
const HOLD_STEP_MS = 250
const MAX_HOLD_RANGE_CENTS = 180

const NO_VIBRATO: VibratoResult = {
  rateHz: 0,
  depthCents: 0,
  classification: 'none',
  detected: false,
  confidence: 0,
}

export interface VoicePitchTraits {
  vibrato: VibratoResult
  /** Typical local standard deviation on held regions, expressed in cents. */
  heldCenterSpreadCents: number | null
  heldWindowCount: number
  voicedRatio: number
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null
  const ordered = [...values].sort((left, right) => left - right)
  const middle = Math.floor(ordered.length / 2)
  return ordered.length % 2 === 0
    ? (ordered[middle - 1]! + ordered[middle]!) / 2
    : ordered[middle]!
}

function continuousHeldSegments(
  contour: DecodedVoiceAtlasContour,
): VoiceAtlasPoint[][] {
  const maxGapMs = Math.max(120, (3 / contour.sampleRateHz) * 1000)
  const segments: VoiceAtlasPoint[][] = []
  let current: VoiceAtlasPoint[] = []

  const flush = (): void => {
    const span =
      current.length < 2 ? 0 : current.at(-1)!.timeMs - current[0]!.timeMs
    if (current.length >= 5 && span >= MIN_HELD_SPAN_MS) {
      segments.push(current)
    }
    current = []
  }

  for (const point of contour.points) {
    if (point.midiCents === null || point.confidence < MIN_CONFIDENCE) {
      flush()
      continue
    }
    const previous = current.at(-1)
    if (
      previous !== undefined &&
      (point.timeMs - previous.timeMs > maxGapMs ||
        previous.midiCents === null ||
        Math.abs(point.midiCents - previous.midiCents) > MAX_LOCAL_JUMP_CENTS)
    ) {
      flush()
    }
    current.push(point)
  }
  flush()
  return segments
}

function toPitchSample(point: VoiceAtlasPoint): {
  time: number
  midi: number
  freq: number
} {
  const midi = (point.midiCents ?? 0) / 100
  return {
    time: point.timeMs / 1000,
    midi,
    freq: 440 * 2 ** ((midi - 69) / 12),
  }
}

function heldCenterSpreads(segments: readonly VoiceAtlasPoint[][]): number[] {
  const spreads: number[] = []
  for (const segment of segments) {
    let nextWindowEnd = segment[0]!.timeMs + HOLD_WINDOW_MS
    for (let index = 0; index < segment.length; index += 1) {
      const point = segment[index]!
      if (point.timeMs + 1 < nextWindowEnd) continue
      const start = point.timeMs - HOLD_WINDOW_MS
      const window = segment.filter(
        (candidate) =>
          candidate.timeMs >= start && candidate.timeMs <= point.timeMs,
      )
      const pitches = window.flatMap((candidate) =>
        candidate.midiCents === null ? [] : [candidate.midiCents],
      )
      if (
        pitches.length >= 5 &&
        Math.max(...pitches) - Math.min(...pitches) <= MAX_HOLD_RANGE_CENTS
      ) {
        const score = computePitchStability(
          window.map((candidate) => ({
            time: candidate.timeMs / 1000,
            midi: (candidate.midiCents ?? 0) / 100,
            clarity: candidate.confidence,
          })),
          HOLD_WINDOW_MS,
        )
        // computePitchStability maps one semitone standard deviation to zero.
        // Inverting that mapping restores a neutral, directly readable spread.
        spreads.push(Math.max(0, 100 - score))
      }
      nextWindowEnd = point.timeMs + HOLD_STEP_MS
    }
  }
  return spreads
}

/** Build honest pitch traits from real, confidence-filtered contour regions. */
export function analyzeVoicePitchTraits(
  contour: DecodedVoiceAtlasContour | null,
): VoicePitchTraits | null {
  if (contour === null) return null
  const segments = continuousHeldSegments(contour)
  const vibratoReadings = segments.map((segment) =>
    detectVibrato(segment.map(toPitchSample)),
  )
  const detected = vibratoReadings
    .filter((reading) => reading.detected)
    .sort((left, right) => right.confidence - left.confidence)
  const spreads = heldCenterSpreads(segments)
  const typicalSpread = median(spreads)

  return {
    vibrato: detected[0] ?? NO_VIBRATO,
    heldCenterSpreadCents:
      typicalSpread === null ? null : Math.round(typicalSpread),
    heldWindowCount: spreads.length,
    voicedRatio: contour.voicedRatio,
  }
}

/** Median confident F0, used by the shared spectral worker as its anchor. */
export function voiceContourFundamentalHz(
  contour: DecodedVoiceAtlasContour | null,
): number | undefined {
  if (contour === null) return undefined
  const pitches = contour.points.flatMap((point) =>
    point.midiCents === null || point.confidence < MIN_CONFIDENCE
      ? []
      : [point.midiCents],
  )
  const midiCents = median(pitches)
  if (midiCents === null) return undefined
  return 440 * 2 ** (midiCents / 100 / 12 - 69 / 12)
}
