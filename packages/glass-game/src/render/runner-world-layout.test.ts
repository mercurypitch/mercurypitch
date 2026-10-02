// Runner support tests — visible cuts and camera framing stay tied to compiled gameplay.
import { PerspectiveCamera, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { SINGING_CURRENT } from '../runner/first-course'
import { runnerBeatToSeconds } from '../runner/tempo'
import { RUNNER_GAP_APRON_METERS, RUNNER_GAP_LIP_RADIUS_METERS, RUNNER_MERC_VISUAL_HEIGHT_METERS, runnerCameraFollowTarget, runnerCameraPose, runnerFloorCells, runnerGapArtSpans, runnerLaneDividerXs, runnerTrackBounds, stepRunnerCameraFollow, } from './runner-world-layout'

const course = SINGING_CURRENT
const cells = course.chunks.flatMap((chunk) =>
  runnerFloorCells(course, chunk.id),
)

function floorAt(distance: number, x: number) {
  return cells.some(
    (cell) =>
      distance > cell.start &&
      distance < cell.end &&
      x > cell.minX &&
      x < cell.maxX,
  )
}

describe('runner visible support', () => {
  it('has no drawable floor inside either full-width jump gap, including lane seams', () => {
    for (const gap of course.obstacles) {
      if (gap.kind !== 'gap') continue
      const middle =
        (gap.minCourseDistanceMeters + gap.maxCourseDistanceMeters) / 2
      for (const x of [-2.8, -2, -1.01, -0.99, 0, 0.99, 1.01, 2, 2.8])
        expect(floorAt(middle, x)).toBe(false)
      for (const x of course.laneCenters) {
        expect(floorAt(gap.minCourseDistanceMeters - 0.01, x)).toBe(true)
        expect(floorAt(gap.maxCourseDistanceMeters + 0.01, x)).toBe(true)
      }
    }
  })
  it('keeps solid floor everywhere else and never extends beyond the lane edges', () => {
    for (const cell of cells) {
      expect(cell.maxX).toBeGreaterThan(cell.minX)
      expect(cell.end).toBeGreaterThan(cell.start)
      expect(cell.minX).toBeGreaterThanOrEqual(-3)
      expect(cell.maxX).toBeLessThanOrEqual(3)
    }
    for (
      let distance = -3.995;
      distance < course.lengthMeters + 5.99;
      distance += 0.031
    ) {
      const insideGap = course.obstacles.some(
        (gap) =>
          gap.kind === 'gap' &&
          distance >= gap.minCourseDistanceMeters &&
          distance <= gap.maxCourseDistanceMeters,
      )
      if (!insideGap)
        for (const x of course.laneCenters)
          expect(floorAt(distance, x)).toBe(true)
    }
  })

  it('cuts calm opaque aprons to the exact meter-scale approach and landing edges', () => {
    for (const gap of course.obstacles) {
      if (gap.kind !== 'gap') continue
      const apronCells = cells.filter(
        (cell) => cell.gapApron && cell.minX < 0 && cell.maxX > 0,
      )
      const approach = apronCells.filter(
        (cell) =>
          cell.start >=
            gap.minCourseDistanceMeters - RUNNER_GAP_APRON_METERS - 1e-9 &&
          cell.end <= gap.minCourseDistanceMeters + 1e-9,
      )
      const landing = apronCells.filter(
        (cell) =>
          cell.start >= gap.maxCourseDistanceMeters - 1e-9 &&
          cell.end <=
            gap.maxCourseDistanceMeters + RUNNER_GAP_APRON_METERS + 1e-9,
      )
      expect(Math.min(...approach.map((cell) => cell.start))).toBeCloseTo(
        gap.minCourseDistanceMeters - RUNNER_GAP_APRON_METERS,
        9,
      )
      expect(Math.max(...approach.map((cell) => cell.end))).toBeCloseTo(
        gap.minCourseDistanceMeters,
        9,
      )
      expect(
        approach.reduce((sum, cell) => sum + cell.end - cell.start, 0),
      ).toBeCloseTo(RUNNER_GAP_APRON_METERS, 9)
      expect(Math.min(...landing.map((cell) => cell.start))).toBeCloseTo(
        gap.maxCourseDistanceMeters,
        9,
      )
      expect(Math.max(...landing.map((cell) => cell.end))).toBeCloseTo(
        gap.maxCourseDistanceMeters + RUNNER_GAP_APRON_METERS,
        9,
      )
      expect(
        landing.reduce((sum, cell) => sum + cell.end - cell.start, 0),
      ).toBeCloseTo(RUNNER_GAP_APRON_METERS, 9)
    }
  })
  it.each([320 / 844, 390 / 844, 768 / 1024, 1280 / 800, 844 / 390])(
    'keeps the legacy-wide route framed at aspect %s',
    (aspect) => {
      const legacyLanes = [-2, 0, 2] as const
      const pose = runnerCameraPose(aspect, legacyLanes)
      const camera = new PerspectiveCamera(pose.fovDegrees, aspect, 0.08, 75)
      camera.position.set(pose.x, pose.y, pose.z)
      camera.lookAt(pose.targetX, pose.targetY, pose.targetZ)
      camera.updateMatrixWorld()
      for (const x of [-2.3, 2.3]) {
        const projected = new Vector3(x, 0.35, 0).project(camera)
        expect(Math.abs(projected.x)).toBeLessThan(0.92)
        expect(Math.abs(projected.y)).toBeLessThan(0.8)
      }
    },
  )

  it.each([320 / 740, 390 / 844, 768 / 1024, 1280 / 800, 844 / 390])(
    'makes compact Merc 12–16%% tall while every imminent lane remains visible at aspect %s',
    (aspect) => {
      const laneCenters = [-1.25, 0, 1.25] as const
      const pose = runnerCameraPose(aspect, laneCenters)
      for (const playerX of laneCenters) {
        const followX = runnerCameraFollowTarget(playerX, laneCenters, aspect)
        const camera = new PerspectiveCamera(pose.fovDegrees, aspect, 0.08, 75)
        camera.position.set(pose.x + followX, pose.y, pose.z)
        camera.lookAt(pose.targetX + followX, pose.targetY, pose.targetZ)
        camera.updateMatrixWorld()
        const feet = new Vector3(playerX, 0, 0).project(camera)
        const crown = new Vector3(
          playerX,
          RUNNER_MERC_VISUAL_HEIGHT_METERS,
          0,
        ).project(camera)
        const heightFraction = Math.abs(crown.y - feet.y) / 2
        expect(heightFraction).toBeGreaterThanOrEqual(0.12)
        expect(heightFraction).toBeLessThanOrEqual(0.16)
        expect(Math.abs((feet.x + crown.x) / 2)).toBeLessThan(0.62)
        for (const laneX of laneCenters) {
          const projected = new Vector3(laneX, 0.5, -3).project(camera)
          expect(Math.abs(projected.x)).toBeLessThan(0.95)
        }
      }
    },
  )

  it('strengthens portrait follow, eases it monotonically and leaves legacy framing centered', () => {
    const compact = [-1.25, 0, 1.25] as const
    const target = runnerCameraFollowTarget(1.25, compact, 390 / 844)
    expect(target).toBeGreaterThan(
      runnerCameraFollowTarget(1.25, compact, 844 / 390),
    )
    const first = stepRunnerCameraFollow(0, target, 1 / 60)
    const second = stepRunnerCameraFollow(first, target, 1 / 60)
    expect(first).toBeGreaterThan(0)
    expect(second).toBeGreaterThan(first)
    expect(second).toBeLessThan(target)
    expect(runnerCameraFollowTarget(2, [-2, 0, 2])).toBe(0)
  })

  it('derives visual lane seams from compact and legacy lane centers', () => {
    expect(runnerLaneDividerXs({ laneCenters: [-1.25, 0, 1.25] })).toEqual([
      -0.625, 0.625,
    ])
    expect(runnerLaneDividerXs({ laneCenters: [-2, 0, 2] })).toEqual([-1, 1])
  })

  it('projects a timed runway before each exact gap and keeps landing art on support', () => {
    const { left, right } = runnerTrackBounds(course)
    const spans = course.chunks.flatMap((chunk) =>
      runnerGapArtSpans(course, chunk.id),
    )
    const gaps = course.obstacles.filter((obstacle) => obstacle.kind === 'gap')
    expect(spans).toHaveLength(gaps.length)
    for (const span of spans) {
      const gap = gaps.find((candidate) => candidate.id === span.gapId)!
      const cueStartSeconds = runnerBeatToSeconds(
        course.tempoSegments,
        span.projectedRunwayStart / course.metersPerBeat,
      )
      const cueEndSeconds = runnerBeatToSeconds(
        course.tempoSegments,
        span.projectedRunwayEnd / course.metersPerBeat,
      )
      expect(cueEndSeconds - cueStartSeconds).toBeCloseTo(0.8, 8)
      expect(span.projectedRunwayEnd).toBeLessThan(span.takeoffLipStart)
      expect(span.takeoffLipEnd - span.takeoffLipStart).toBeCloseTo(
        RUNNER_GAP_LIP_RADIUS_METERS * 2,
        8,
      )
      expect(span.takeoffLipEnd).toBe(span.gapStart)
      expect(span.gapStart).toBe(gap.minCourseDistanceMeters)
      expect(span.gapEnd).toBe(gap.maxCourseDistanceMeters)
      expect(span.landingBandStart).toBe(span.gapEnd)
      expect(span.landingBandEnd).toBeLessThanOrEqual(
        gap.landingEndCourseDistanceMeters,
      )
      expect(span.landingBandEnd - span.landingBandStart).toBeCloseTo(0.16, 8)
      expect(span.minX).toBe(left)
      expect(span.maxX).toBe(right)
    }
  })
})
