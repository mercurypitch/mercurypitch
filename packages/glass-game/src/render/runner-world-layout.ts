// Runner world layout — visible supports are cut from the same missing-floor spans as collision.
import type { CompiledRunnerCourse } from '../runner/contracts'

export interface RunnerFloorCell {
  readonly chunkId: string
  readonly minX: number
  readonly maxX: number
  readonly start: number
  readonly end: number
}

export function runnerFloorCells(
  course: CompiledRunnerCourse,
  chunkId: string,
): RunnerFloorCell[] {
  const chunk = course.chunks.find((item) => item.id === chunkId)
  if (!chunk) throw new Error(`Unknown runner chunk: ${chunkId}`)
  const halfLane = (course.laneCenters[2] - course.laneCenters[0]) / 4
  const left = course.laneCenters[0] - halfLane
  const right = course.laneCenters[2] + halfLane
  // A small solid apron surrounds the first and final standing positions.
  const start = chunk.index === 0 ? -4 : chunk.minCourseDistanceMeters
  const end =
    chunk.index === course.chunks.length - 1
      ? course.lengthMeters + 6
      : chunk.maxCourseDistanceMeters
  const gaps = course.obstacles.filter(
    (item) =>
      item.kind === 'gap' &&
      item.maxCourseDistanceMeters > start &&
      item.minCourseDistanceMeters < end,
  )
  const cuts = new Set([start, end])
  for (
    let distance = chunk.minCourseDistanceMeters;
    distance < end;
    distance += course.metersPerBeat * 4
  )
    if (distance > start) cuts.add(distance)
  for (const gap of gaps) {
    cuts.add(Math.max(start, gap.minCourseDistanceMeters))
    cuts.add(Math.min(end, gap.maxCourseDistanceMeters))
  }
  const distances = [...cuts].sort((a, b) => a - b)
  const cells: RunnerFloorCell[] = []
  for (let index = 0; index < distances.length - 1; index++) {
    const a = distances[index]!,
      b = distances[index + 1]!
    const midpoint = (a + b) / 2
    const spans = gaps
      .filter(
        (gap) =>
          midpoint >= gap.minCourseDistanceMeters &&
          midpoint < gap.maxCourseDistanceMeters,
      )
      .flatMap((gap) => (gap.kind === 'gap' ? gap.lateralSpans : []))
    const xs = [
      ...new Set([
        left,
        right,
        ...spans.flatMap((span) => [
          Math.max(left, span.minLateralX),
          Math.min(right, span.maxLateralX),
        ]),
      ]),
    ].sort((x, y) => x - y)
    for (let x = 0; x < xs.length - 1; x++) {
      const minX = xs[x]!,
        maxX = xs[x + 1]!,
        middleX = (minX + maxX) / 2
      if (
        maxX <= minX ||
        spans.some(
          (span) => middleX >= span.minLateralX && middleX <= span.maxLateralX,
        )
      )
        continue
      cells.push({ chunkId, minX, maxX, start: a, end: b })
    }
  }
  return cells
}

/** Camera retains all three lanes without snapping with individual lane changes. */
export function runnerCameraPose(aspect: number) {
  const safeAspect = Math.max(0.3, Math.min(3, aspect))
  const distance = Math.max(5.2, 3.3 / (Math.tan(Math.PI / 6) * safeAspect))
  const portraitPullback = distance - 5.2
  return {
    x: 0,
    y: 2.4 + portraitPullback * 0.28,
    z: distance,
    targetY: 0.65,
    targetZ: -4.4 - portraitPullback * 1.3,
  }
}
