// ============================================================
// Song runner compiler helpers — shared numeric and chunk identity rules.
// ============================================================

export const RUNNER_COMPILER_EPSILON = 1e-8

export function runnerCompilerApproximatelyEqual(
  left: number,
  right: number,
): boolean {
  return Math.abs(left - right) <= RUNNER_COMPILER_EPSILON
}

export function runnerChunkId(
  courseId: string,
  chunkBeats: number,
  beat: number,
): string {
  return `${courseId}-chunk-${Math.floor(beat / chunkBeats)}`
}

export function runnerIntervalsOverlap(
  leftStart: number,
  leftEnd: number,
  rightStart: number,
  rightEnd: number,
): boolean {
  return (
    leftStart < rightEnd - RUNNER_COMPILER_EPSILON &&
    rightStart < leftEnd - RUNNER_COMPILER_EPSILON
  )
}
