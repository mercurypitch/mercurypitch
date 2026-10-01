// Runner support tests — visible cuts and camera framing stay tied to compiled gameplay.
import { PerspectiveCamera, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { SINGING_CURRENT } from '../runner/first-course'
import { runnerCameraPose, runnerFloorCells } from './runner-world-layout'

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
  it.each([320 / 844, 390 / 844, 768 / 1024, 1280 / 800, 844 / 390])(
    'frames both outside lanes at aspect %s',
    (aspect) => {
      const pose = runnerCameraPose(aspect)
      const camera = new PerspectiveCamera(60, aspect, 0.08, 65)
      camera.position.set(pose.x, pose.y, pose.z)
      camera.lookAt(0, pose.targetY, pose.targetZ)
      camera.updateMatrixWorld()
      for (const x of [-2.3, 2.3]) {
        const projected = new Vector3(x, 0.35, 0).project(camera)
        expect(Math.abs(projected.x)).toBeLessThan(0.92)
        expect(Math.abs(projected.y)).toBeLessThan(0.8)
      }
    },
  )
})
