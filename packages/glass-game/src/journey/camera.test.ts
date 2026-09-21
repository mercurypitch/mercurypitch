// Journey camera tests — wide overviews and portrait selection stay visible without changing chapter identity.

import { PerspectiveCamera, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { FLOATING_MUSEUM_JOURNEY } from '../content/museum-journey'
import { clampJourneyOrbit, journeyCameraView, projectJourneyStage, } from './camera'

describe('journey overview camera', () => {
  it('keeps desktop selection as a subtle focus shift', () => {
    const left = journeyCameraView(1100, 700, [-6, 1, 3])
    const right = journeyCameraView(1100, 700, [5, 2, -3])
    expect(Math.abs(left.target[0] - right.target[0])).toBeLessThan(0.75)
    expect(left.distance).toBe(right.distance)
  })

  it('frames the selected island on phones and portrait tablets', () => {
    for (const [width, height] of [
      [320, 640],
      [768, 1024],
    ] as const) {
      const first = journeyCameraView(width, height, [-5.7, 1.05, 2.75])
      const twins = journeyCameraView(width, height, [0.25, 1.65, 0.1])
      expect(first.target).toEqual([-5.7, 1.05, 2.75])
      expect(twins.target).toEqual([0.25, 1.65, 0.1])
    }
  })

  it('keeps every gallery anchor inside the landscape tablet overview', () => {
    const view = journeyCameraView(1024, 768, [0.25, 1.65, 0.1])
    const desktop = journeyCameraView(1600, 900, [0.25, 1.65, 0.1])
    expect(view.distance).toBeGreaterThan(desktop.distance)
    const camera = new PerspectiveCamera(34, 1024 / 768, 0.1, 80)
    const planar = Math.cos(0.45) * view.distance
    camera.position.set(
      view.target[0] + Math.sin(-0.14) * planar,
      view.target[1] + Math.sin(0.45) * view.distance,
      view.target[2] + Math.cos(-0.14) * planar,
    )
    camera.lookAt(...view.target)
    camera.updateMatrixWorld()
    for (const stage of FLOATING_MUSEUM_JOURNEY.stages) {
      const projection = projectJourneyStage(
        stage.position,
        camera,
        1024,
        768,
        new Vector3(),
      )
      expect(projection.visible).toBe(true)
      expect(projection.x).toBeGreaterThan(90)
      expect(projection.x).toBeLessThan(934)
    }
  })

  it('bounds manual orbit away from flat and reversed views', () => {
    expect(clampJourneyOrbit(-4, 0)).toEqual({ yaw: -0.34, pitch: 0.38 })
    expect(clampJourneyOrbit(4, 2)).toEqual({ yaw: 0.08, pitch: 0.58 })
  })

  it('projects visible labels into container pixels and rejects offscreen ones', () => {
    const camera = new PerspectiveCamera(34, 2, 0.1, 80)
    camera.position.set(10, 10, 14)
    camera.lookAt(0, 0, 0)
    camera.updateMatrixWorld()
    camera.updateProjectionMatrix()
    const scratch = new Vector3()
    const center = projectJourneyStage([0, 0, 0], camera, 800, 400, scratch)
    expect(center.visible).toBe(true)
    expect(center.x).toBeCloseTo(400)
    expect(center.y).toBeCloseTo(200)
    expect(
      projectJourneyStage([100, 0, 0], camera, 800, 400, scratch).visible,
    ).toBe(false)
  })
})
