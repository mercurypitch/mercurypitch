// Journey label projection tests — earned fascia stars remain clear of stage badges through camera inspection.

import type { BufferGeometry, Object3D } from 'three'
import { Mesh, MeshBasicMaterial, PerspectiveCamera, Vector3 } from 'three'
import { afterAll, describe, expect, it } from 'vitest'
import { FLOATING_MUSEUM_JOURNEY } from '../content/museum-journey'
import { clampJourneyOrbit, JOURNEY_DEFAULT_ORBIT, journeyCameraView, projectJourneyStage, projectJourneyStageLabel, } from './camera'
import { journeyMarkerPoint } from './landmarks'
import { createJourneyMedallion, createJourneyMedallionGeometry, } from './medallions'

const owned = new Set<BufferGeometry>()
const geometry = createJourneyMedallionGeometry(owned)
const material = new MeshBasicMaterial()
const pods = FLOATING_MUSEUM_JOURNEY.stages.map((stage, index) => {
  const pod = createJourneyMedallion(stage, index, geometry, {
    ivory: material,
    gold: material,
    jade: material,
  })
  pod.root.updateMatrixWorld(true)
  return pod
})

afterAll(() => {
  for (const item of owned) item.dispose()
  material.dispose()
})

function cameraFor(
  stageIndex: number,
  width: number,
  height: number,
  zoom = 0,
  yaw: number = JOURNEY_DEFAULT_ORBIT.yaw,
  pitch: number = JOURNEY_DEFAULT_ORBIT.pitch,
): PerspectiveCamera {
  const stage = FLOATING_MUSEUM_JOURNEY.stages[stageIndex]!
  const view = journeyCameraView(width, height, stage.focus, zoom)
  const orbit = clampJourneyOrbit(yaw, pitch, zoom)
  const planar = Math.cos(orbit.pitch) * view.distance
  const camera = new PerspectiveCamera(34, width / height, 0.1, 80)
  camera.position.set(
    view.target[0] + Math.sin(orbit.yaw) * planar,
    view.target[1] + Math.sin(orbit.pitch) * view.distance,
    view.target[2] + Math.cos(orbit.yaw) * planar,
  )
  camera.lookAt(...view.target)
  camera.updateMatrixWorld()
  return camera
}

function lowestRenderedVertex(
  objects: readonly Object3D[],
  camera: PerspectiveCamera,
  height: number,
): number {
  const scratch = new Vector3()
  let lowest = -Infinity
  for (const root of objects) {
    root.traverse((object) => {
      if (!(object instanceof Mesh)) return
      const positions = object.geometry.getAttribute('position')
      for (let vertex = 0; vertex < positions.count; vertex++) {
        scratch
          .fromBufferAttribute(positions, vertex)
          .applyMatrix4(object.matrixWorld)
          .project(camera)
        lowest = Math.max(lowest, (-scratch.y * 0.5 + 0.5) * height)
      }
    })
  }
  return lowest
}

describe('pod stage label clearance', () => {
  it('clears the earned Conservatory stars in the reported portrait tablet view', () => {
    const camera = cameraFor(3, 768, 1024)
    const point = journeyMarkerPoint(FLOATING_MUSEUM_JOURNEY.stages[3]!)
    const label = projectJourneyStageLabel(
      point,
      camera,
      768,
      1024,
      new Vector3(),
    )
    const starBottom = lowestRenderedVertex(pods[3]!.stars, camera, 1024)
    // Independently measured from the actual captured tablet view, not the label helper.
    expect(starBottom).toBeCloseTo(639.652, 2)
    expect(label.x).toBeCloseTo(373.998, 2)
    // CSS: 12px leader, then (44px target - 32px bordered badge)/2, minus 3px selected ring.
    const selectedBadgeTop = Math.round(label.y) + 12 + 6 - 3
    expect(selectedBadgeTop - starBottom).toBeGreaterThanOrEqual(8)
  })

  it('keeps badges below the actual pod silhouette at supported viewports and orbit bounds', () => {
    const scratch = new Vector3()
    for (const [width, height] of [
      [390, 844],
      [844, 390],
      [768, 1024],
      [1600, 900],
    ] as const) {
      for (const zoom of [0, 0.5, 1]) {
        for (const [yaw, pitch] of [
          [-0.14, 0.45],
          [-4, 0],
          [-4, 2],
          [4, 0],
          [4, 2],
        ] as const) {
          for (let index = 0; index < pods.length; index++) {
            const camera = cameraFor(index, width, height, zoom, yaw, pitch)
            const point = journeyMarkerPoint(
              FLOATING_MUSEUM_JOURNEY.stages[index]!,
            )
            const center = projectJourneyStage(
              point,
              camera,
              width,
              height,
              scratch,
            )
            const label = projectJourneyStageLabel(
              point,
              camera,
              width,
              height,
              scratch,
            )
            expect(label.visible).toBe(center.visible)
            expect(label.x).toBe(center.x)
            if (!center.visible) continue
            const bodyBottom = lowestRenderedVertex(
              [pods[index]!.root],
              camera,
              height,
            )
            expect(label.y).toBeGreaterThanOrEqual(bodyBottom)
          }
        }
      }
    }
  })

  it('does not make offscreen stage centers focusable through a visible envelope edge', () => {
    const camera = cameraFor(3, 768, 1024)
    const scratch = new Vector3()
    const point = [100, 0.16, 0] as const
    const center = projectJourneyStage(point, camera, 768, 1024, scratch)
    expect(center.visible).toBe(false)
    expect(projectJourneyStageLabel(point, camera, 768, 1024, scratch)).toEqual(
      center,
    )
  })
})
