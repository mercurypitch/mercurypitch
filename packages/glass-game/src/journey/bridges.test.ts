// Journey bridge regression — curved stair surfaces have upright normals, no holes and seated endpoints.

import type { BufferGeometry, Mesh } from 'three'
import { MeshBasicMaterial, Raycaster, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { FLOATING_MUSEUM_JOURNEY } from '../content/museum-journey'
import { createJourneyBridgePath } from './bridge-path'
import { createJourneyBridge } from './bridges'

describe('museum bridge contact', () => {
  it.each(FLOATING_MUSEUM_JOURNEY.bridges)(
    '$id has continuous level treads across its usable width',
    (bridge) => {
      const material = new MeshBasicMaterial()
      const owned = new Set<BufferGeometry>()
      const root = createJourneyBridge(
        bridge,
        { ivory: material, gold: material },
        owned,
      )
      const deck = root.getObjectByName(`${bridge.id}-curved-promenade`) as Mesh
      const path = createJourneyBridgePath(bridge)
      const ray = new Raycaster()
      root.updateMatrixWorld(true)
      try {
        for (let step = 0; step <= 120; step++) {
          const t = Math.max(0.0001, Math.min(0.9999, step / 120))
          for (const across of [-0.45, 0, 0.45]) {
            const point = path.point(t, bridge.width * across)
            ray.set(new Vector3(point.x, 10, point.z), new Vector3(0, -1, 0))
            const hit = ray.intersectObject(deck, false)[0]
            expect(hit, `missing deck at t=${t}, width=${across}`).toBeDefined()
            expect(hit!.face!.normal.y).toBeCloseTo(1, 5)
            // At a curved riser boundary either adjacent tread owns the exact pixel.
            const rise =
              Math.abs(bridge.to[1] - bridge.from[1]) /
              Math.max(1, path.steps - 1)
            expect(
              Math.abs(hit!.point.y - path.surfaceHeight(t)),
            ).toBeLessThanOrEqual(rise + 0.00001)
          }
        }
        for (let step = 0; step < path.steps; step++) {
          const t = (step + 0.5) / path.steps,
            point = path.point(t)
          ray.set(new Vector3(point.x, 10, point.z), new Vector3(0, -1, 0))
          expect(ray.intersectObject(deck, false)[0]!.point.y).toBeCloseTo(
            path.surfaceHeight(t),
            5,
          )
        }
        expect(path.surfaceHeight(0)).toBe(bridge.from[1])
        expect(path.surfaceHeight(1)).toBe(bridge.to[1])
        for (let step = 1; step < path.steps; step++)
          expect(
            Math.abs(
              path.surfaceHeight(step / path.steps + 0.001) -
                path.surfaceHeight(step / path.steps - 0.001),
            ),
          ).toBeLessThanOrEqual(0.07)
      } finally {
        material.dispose()
        for (const geometry of owned) geometry.dispose()
      }
    },
  )
})
