import type { ResolvedZenTarget, ZenExerciseDefinition, ZenPitchPoint, ZenRunScore, ZenScoringConfig, ZenViewport, } from './types'

export const DEFAULT_ZEN_LOOP_SECONDS = 8
export const DEFAULT_ZEN_VIEWPORT_SPAN = 24
export const MAX_ZEN_VIEWPORT_SPAN = 48
const COVERAGE_BIN_SECONDS = 0.1

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value))

const roundTo = (value: number, precision: number): number => {
  const factor = 10 ** precision
  return Math.round(value * factor) / factor
}

export function exerciseLoopDuration(exercise: ZenExerciseDefinition): number {
  return (exercise.loopBeats * 60) / exercise.bpm
}

export function resolveZenTargets(
  exercise: ZenExerciseDefinition,
  rootMidi: number,
): ResolvedZenTarget[] {
  const secondsPerBeat = 60 / exercise.bpm
  return exercise.targets.map((target) => ({
    ...target,
    startSec: target.startBeat * secondsPerBeat,
    endSec: (target.startBeat + target.durationBeats) * secondsPerBeat,
    startMidi: rootMidi + target.semitone,
    endMidi: rootMidi + (target.endSemitone ?? target.semitone),
  }))
}

export function targetMidiAt(
  targets: readonly ResolvedZenTarget[],
  timeSec: number,
): number | null {
  const target = targets.find(
    (candidate) => timeSec >= candidate.startSec && timeSec <= candidate.endSec,
  )
  if (target === undefined) return null
  if (target.endMidi === target.startMidi) return target.startMidi
  const progress = clamp(
    (timeSec - target.startSec) / (target.endSec - target.startSec),
    0,
    1,
  )
  return target.startMidi + (target.endMidi - target.startMidi) * progress
}

export function fitZenViewport(
  values: readonly number[],
  previous?: ZenViewport,
): ZenViewport {
  const valid = values.filter(
    (value) => Number.isFinite(value) && value >= 0 && value <= 127,
  )
  if (valid.length === 0) {
    return previous ?? { minMidi: 48, maxMidi: 72 }
  }

  const low = Math.min(...valid)
  const high = Math.max(...valid)

  if (
    previous !== undefined &&
    low >= previous.minMidi + 2 &&
    high <= previous.maxMidi - 2
  ) {
    return previous
  }

  const requiredSpan = Math.ceil(high - low + 4)
  const span = clamp(
    Math.max(DEFAULT_ZEN_VIEWPORT_SPAN, requiredSpan),
    DEFAULT_ZEN_VIEWPORT_SPAN,
    MAX_ZEN_VIEWPORT_SPAN,
  )
  const centre = (low + high) / 2
  let minMidi = Math.floor(centre - span / 2)
  minMidi = clamp(minMidi, 0, 127 - span)

  return { minMidi, maxMidi: minMidi + span }
}

function standardDeviation(values: readonly number[]): number {
  if (values.length < 2) return 0
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

export function scoreZenRun(
  points: readonly ZenPitchPoint[],
  targets: readonly ResolvedZenTarget[],
  config: ZenScoringConfig,
): ZenRunScore {
  const voiced = points.filter(
    (point): point is ZenPitchPoint & { midi: number } =>
      point.midi !== null && Number.isFinite(point.midi),
  )
  const matched = voiced
    .map((point) => {
      const targetIndex = targets.findIndex(
        (target) =>
          point.timeSec >= target.startSec && point.timeSec <= target.endSec,
      )
      const targetMidi = targetMidiAt(targets, point.timeSec)
      return targetMidi === null || targetIndex < 0
        ? null
        : {
            cents: (point.midi - targetMidi) * 100,
            targetIndex,
            timeSec: point.timeSec,
          }
    })
    .filter(
      (
        value,
      ): value is { cents: number; targetIndex: number; timeSec: number } =>
        value !== null,
    )

  // Coverage uses fixed time buckets instead of inferring cadence from the
  // singer's first and last voiced samples. Sparse, perfectly tuned blips can
  // fill only the buckets they actually occupy; a continuous phrase still
  // fills every 100 ms bucket even when frame delivery varies by device.
  const targetBinCounts = targets.map((target) =>
    Math.max(
      1,
      Math.ceil(
        Math.max(0, target.endSec - target.startSec) / COVERAGE_BIN_SECONDS,
      ),
    ),
  )
  const coveredBins = new Set<string>()
  for (const sample of matched) {
    const target = targets[sample.targetIndex]!
    const binCount = targetBinCounts[sample.targetIndex]!
    const bin = Math.min(
      binCount - 1,
      Math.max(
        0,
        Math.floor((sample.timeSec - target.startSec) / COVERAGE_BIN_SECONDS),
      ),
    )
    coveredBins.add(`${sample.targetIndex}:${bin}`)
  }
  const totalBins = Math.max(
    1,
    targetBinCounts.reduce((sum, count) => sum + count, 0),
  )
  const coverage = clamp(coveredBins.size / totalBins, 0, 1)

  const averageAbsoluteCents =
    matched.length === 0
      ? config.toleranceCents
      : matched.reduce((sum, sample) => sum + Math.abs(sample.cents), 0) /
        matched.length
  const pitch = clamp(1 - averageAbsoluteCents / config.toleranceCents, 0, 1)
  const residuals = matched.map((sample) => sample.cents)
  const steadiness = clamp(1 - standardDeviation(residuals) / 70, 0, 1)
  const weightTotal =
    config.pitchWeight + config.coverageWeight + config.steadinessWeight
  const total =
    weightTotal <= 0
      ? 0
      : (pitch * config.pitchWeight +
          coverage * config.coverageWeight +
          steadiness * config.steadinessWeight) /
        weightTotal

  return {
    total: Math.round(total * 100),
    pitch: Math.round(pitch * 100),
    coverage: Math.round(coverage * 100),
    steadiness: Math.round(steadiness * 100),
    averageCents: roundTo(averageAbsoluteCents, 1),
  }
}
