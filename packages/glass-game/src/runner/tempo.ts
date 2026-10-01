// ============================================================
// Song runner tempo — exact piecewise beat, time, and distance conversion.
// ============================================================

import type { CompiledRunnerTempoSegment } from './contracts'

const EPSILON = 1e-9

export interface RunnerTempoPoint {
  readonly atBeat: number
  readonly bpm: number
}

function segmentAtBeat(
  segments: readonly CompiledRunnerTempoSegment[],
  beat: number,
): CompiledRunnerTempoSegment {
  return (
    segments.find(
      (segment, index) =>
        beat >= segment.startBeat - EPSILON &&
        (beat < segment.endBeat - EPSILON ||
          (index === segments.length - 1 && beat <= segment.endBeat + EPSILON)),
    ) ?? segments.at(-1)!
  )
}

function segmentAtSeconds(
  segments: readonly CompiledRunnerTempoSegment[],
  seconds: number,
): CompiledRunnerTempoSegment {
  return (
    segments.find(
      (segment, index) =>
        seconds >= segment.startCourseSeconds - EPSILON &&
        (seconds < segment.endCourseSeconds - EPSILON ||
          (index === segments.length - 1 &&
            seconds <= segment.endCourseSeconds + EPSILON)),
    ) ?? segments.at(-1)!
  )
}

export function compileRunnerTempoSegments(
  points: readonly RunnerTempoPoint[],
  lengthBeats: number,
): readonly CompiledRunnerTempoSegment[] {
  if (!Number.isFinite(lengthBeats) || lengthBeats <= 0)
    throw new Error('Runner lengthBeats must be finite and positive.')
  if (points.length === 0 || points[0]?.atBeat !== 0)
    throw new Error('Runner tempo map must begin at beat 0.')
  let seconds = 0
  return points.map((point, index) => {
    const endBeat = points[index + 1]?.atBeat ?? lengthBeats
    if (
      !Number.isFinite(point.atBeat) ||
      !Number.isFinite(point.bpm) ||
      point.bpm <= 0 ||
      point.atBeat < 0 ||
      endBeat <= point.atBeat ||
      endBeat > lengthBeats
    )
      throw new Error(`Runner tempo point ${index} is invalid.`)
    const duration = ((endBeat - point.atBeat) * 60) / point.bpm
    const segment: CompiledRunnerTempoSegment = {
      startBeat: point.atBeat,
      endBeat,
      startCourseSeconds: seconds,
      endCourseSeconds: seconds + duration,
      bpm: point.bpm,
    }
    seconds += duration
    return segment
  })
}

export function runnerBeatToSeconds(
  segments: readonly CompiledRunnerTempoSegment[],
  beat: number,
): number {
  if (segments.length === 0 || !Number.isFinite(beat))
    throw new Error('Runner beat conversion requires finite compiled tempo.')
  const first = segments[0]!
  const last = segments.at(-1)!
  if (beat < first.startBeat - EPSILON || beat > last.endBeat + EPSILON)
    throw new Error(`Runner beat ${beat} is outside the compiled course.`)
  const segment = segmentAtBeat(segments, beat)
  return (
    segment.startCourseSeconds +
    ((Math.min(beat, segment.endBeat) - segment.startBeat) * 60) / segment.bpm
  )
}

export function runnerSecondsToBeat(
  segments: readonly CompiledRunnerTempoSegment[],
  seconds: number,
): number {
  if (segments.length === 0 || !Number.isFinite(seconds))
    throw new Error('Runner time conversion requires finite compiled tempo.')
  const first = segments[0]!
  const last = segments.at(-1)!
  if (
    seconds < first.startCourseSeconds - EPSILON ||
    seconds > last.endCourseSeconds + EPSILON
  )
    throw new Error(`Runner time ${seconds} is outside the compiled course.`)
  const segment = segmentAtSeconds(segments, seconds)
  return (
    segment.startBeat +
    ((Math.min(seconds, segment.endCourseSeconds) -
      segment.startCourseSeconds) *
      segment.bpm) /
      60
  )
}

export function runnerBeatToDistance(
  beat: number,
  metersPerBeat: number,
): number {
  return beat * metersPerBeat
}

export function runnerForwardSpeedAtSeconds(
  segments: readonly CompiledRunnerTempoSegment[],
  seconds: number,
  metersPerBeat: number,
): number {
  return (segmentAtSeconds(segments, seconds).bpm * metersPerBeat) / 60
}
