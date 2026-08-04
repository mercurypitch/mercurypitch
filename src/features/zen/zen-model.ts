import { SIGNAL_FLOOR_RMS } from '@/lib/input-health'
import { rmsToDb } from '@/lib/mic-level'
import type { ResolvedZenTarget, ZenExerciseDefinition, ZenPitchPoint, ZenRunScore, ZenScoringConfig, ZenTargetKind, ZenViewport, } from './types'

export const DEFAULT_ZEN_LOOP_SECONDS = 8
export const DEFAULT_ZEN_VIEWPORT_SPAN = 24
export const MAX_ZEN_VIEWPORT_SPAN = 48
const COVERAGE_BIN_SECONDS = 0.1

/**
 * The dB spread at which an amplitude block's steadiness reaches zero.
 *
 * A sustained hiss wanders a couple of dB; twelve is the difference between
 * holding one and letting it collapse halfway through. Deliberately generous —
 * this is a warm-up, not a compressor.
 */
const LEVEL_STABILITY_RANGE_DB = 12

/** What a block asks for. Absent means pitch, which is every v1 exercise. */
export function targetKind(target: { kind?: ZenTargetKind }): ZenTargetKind {
  return target.kind ?? 'pitch'
}

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value))

const roundTo = (value: number, precision: number): number => {
  const factor = 10 ** precision
  return Math.round(value * factor) / factor
}

export function exerciseLoopDuration(exercise: ZenExerciseDefinition): number {
  return (exercise.loopBeats * 60) / exercise.bpm
}

/**
 * The MIDI values worth framing the canvas around — pitch blocks only.
 *
 * Amplitude and breath blocks carry a semitone the schema demanded and
 * nothing reads; letting them into the fit would drag the viewport toward the
 * root for exercises whose notes are nowhere near it.
 */
export function pitchTargetMidis(
  targets: readonly ResolvedZenTarget[],
): number[] {
  return targets
    .filter((target) => targetKind(target) === 'pitch')
    .flatMap((target) => [target.startMidi, target.endMidi])
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
  // Only pitch blocks have a note to be at. A hiss or a held breath sitting
  // in this window is not a target the singer is missing by an octave.
  const target = targets.find(
    (candidate) =>
      targetKind(candidate) === 'pitch' &&
      timeSec >= candidate.startSec &&
      timeSec <= candidate.endSec,
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

/**
 * How well an amplitude block was sustained.
 *
 * Two questions, both answerable from the level alone: was a sound there
 * (coverage, in the same 100 ms buckets pitch coverage uses), and was it held
 * steady (the spread of its loudness in dB). A hiss that starts strong and
 * dies out is the exact failure a warm-up is trying to train away, and a
 * timer could never see it.
 *
 * Returns null when the exercise has no amplitude blocks — not zero, which
 * would drag every ordinary exercise's total down.
 */
export function scoreLevelTargets(
  points: readonly ZenPitchPoint[],
  targets: readonly ResolvedZenTarget[],
  config: ZenScoringConfig,
): { coverage: number; stability: number; score: number } | null {
  const levelTargets = targets.filter(
    (target) => targetKind(target) === 'amplitude',
  )
  if (levelTargets.length === 0) return null

  const binCounts = levelTargets.map((target) =>
    Math.max(
      1,
      Math.ceil(
        Math.max(0, target.endSec - target.startSec) / COVERAGE_BIN_SECONDS,
      ),
    ),
  )
  const coveredBins = new Set<string>()
  const audibleDb: number[] = []

  for (const point of points) {
    const level = point.level
    if (level === undefined || !Number.isFinite(level)) continue
    const index = levelTargets.findIndex(
      (target) =>
        point.timeSec >= target.startSec && point.timeSec <= target.endSec,
    )
    if (index < 0) continue
    // Below the floor is not a quiet hiss, it is no hiss. Counting it would
    // score the silence between attempts as a steady tone.
    if (level < SIGNAL_FLOOR_RMS) continue

    const target = levelTargets[index]!
    const binCount = binCounts[index]!
    const bin = Math.min(
      binCount - 1,
      Math.max(
        0,
        Math.floor((point.timeSec - target.startSec) / COVERAGE_BIN_SECONDS),
      ),
    )
    coveredBins.add(`${index}:${bin}`)
    audibleDb.push(rmsToDb(level))
  }

  const totalBins = Math.max(
    1,
    binCounts.reduce((sum, count) => sum + count, 0),
  )
  const coverage = clamp(coveredBins.size / totalBins, 0, 1)
  const stability =
    audibleDb.length < 2
      ? 0
      : clamp(1 - standardDeviation(audibleDb) / LEVEL_STABILITY_RANGE_DB, 0, 1)

  // Reuse the exercise's own weights rather than inventing a second set:
  // coverage means the same thing here, and stability is steadiness by
  // another measure. Pitch weight has no counterpart, so it does not apply.
  const weightTotal = config.coverageWeight + config.steadinessWeight
  const score =
    weightTotal <= 0
      ? coverage
      : (coverage * config.coverageWeight +
          stability * config.steadinessWeight) /
        weightTotal

  return { coverage, stability, score }
}

const targetSeconds = (targets: readonly ResolvedZenTarget[]): number =>
  targets.reduce(
    (sum, target) => sum + Math.max(0, target.endSec - target.startSec),
    0,
  )

export function scoreZenRun(
  points: readonly ZenPitchPoint[],
  allTargets: readonly ResolvedZenTarget[],
  config: ZenScoringConfig,
): ZenRunScore {
  // Pitch scoring only ever looks at pitch blocks. An exercise made entirely
  // of them — every exercise authored before kinds existed — comes out of
  // this identical to before.
  const targets = allTargets.filter((target) => targetKind(target) === 'pitch')
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
  const pitchTotal =
    weightTotal <= 0
      ? 0
      : (pitch * config.pitchWeight +
          coverage * config.coverageWeight +
          steadiness * config.steadinessWeight) /
        weightTotal

  // An exercise that is half hiss earns half its score from the hiss. Blending
  // by sung seconds rather than by block count keeps an eight-beat sustain
  // from being outvoted by four quick notes.
  const level = scoreLevelTargets(points, allTargets, config)
  const pitchSec = targetSeconds(targets)
  const levelSec = targetSeconds(
    allTargets.filter((target) => targetKind(target) === 'amplitude'),
  )
  const total =
    level === null || pitchSec + levelSec <= 0
      ? pitchTotal
      : (pitchTotal * pitchSec + level.score * levelSec) / (pitchSec + levelSec)

  return {
    total: Math.round(total * 100),
    pitch: Math.round(pitch * 100),
    coverage: Math.round(coverage * 100),
    steadiness: Math.round(steadiness * 100),
    averageCents: roundTo(averageAbsoluteCents, 1),
    ...(level === null ? {} : { level: Math.round(level.score * 100) }),
  }
}
