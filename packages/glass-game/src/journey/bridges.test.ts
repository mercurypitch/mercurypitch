// Journey bridge regression — curved stair surfaces have upright normals, no holes and seated endpoints.

import type { BufferGeometry, Mesh } from 'three'
import { InstancedMesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { FLOATING_MUSEUM_JOURNEY } from '../content/museum-journey'
import { createJourneyBridgePath } from './bridge-path'
import { createJourneyBridge } from './bridges'
import { journeyBridgeDistanceXZ } from './vegetation-placement'

const SKYBRIDGES = FLOATING_MUSEUM_JOURNEY.bridges.filter(
  (bridge) => bridge.kind === 'skybridge',
)

describe('museum marble bridge structure', () => {
  it.each(SKYBRIDGES)(
    '$id has supported cornices and an open central arch',
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
        for (const t of [0.05, 0.25, 0.5, 0.75, 0.95]) {
          const slopeY = bridge.from[1] + (bridge.to[1] - bridge.from[1]) * t
          for (const side of [-1, 1]) {
            const point = path.point(t, side * (bridge.width * 0.5 + 0.01))
            ray.set(new Vector3(point.x, 10, point.z), new Vector3(0, -1, 0))
            const coping = ray.intersectObject(deck, false)[0]
            expect(
              coping,
              `missing marble cornice at ${t}/${side}`,
            ).toBeDefined()
            expect(coping!.point.y).toBeCloseTo(slopeY - 0.075, 3)
            // The cornice slopes; the walking treads below are tested as level.
            expect(coping!.face!.normal.y).toBeGreaterThan(0)
            ray.set(new Vector3(point.x, -10, point.z), new Vector3(0, 1, 0))
            const underside = ray.intersectObject(deck, false)[0]
            expect(
              underside,
              `open marble underside at ${t}/${side}`,
            ).toBeDefined()
            expect(underside!.point.y).toBeLessThanOrEqual(slopeY - 0.2)
            expect(underside!.face!.normal.y).toBeLessThan(0)
          }
        }
        const center = path.point(0.46)
        ray.set(
          new Vector3(center.x, center.y - 0.19, center.z),
          new Vector3(0, -1, 0),
        )
        expect(ray.intersectObject(deck, false)).toHaveLength(0)
        let triangles = 0
        root.traverse((object) => {
          const mesh = object as Mesh
          if (!mesh.isMesh) return
          expect(owned.has(mesh.geometry)).toBe(true)
          const count = mesh instanceof InstancedMesh ? mesh.count : 1
          triangles +=
            ((mesh.geometry.index?.count ??
              mesh.geometry.getAttribute('position').count) /
              3) *
            count
        })
        expect(triangles).toBeLessThanOrEqual(2800)
      } finally {
        root.traverse((object) => {
          if (object instanceof InstancedMesh) object.dispose()
        })
        material.dispose()
        for (const geometry of owned) geometry.dispose()
      }
    },
  )

  it('rejects a tight bend before the inner deck or cornice folds across itself', () => {
    const bridge = SKYBRIDGES[0]!
    expect(() => createJourneyBridgePath({ ...bridge, curve: -1.4 })).toThrow(
      /bend/i,
    )
    const path = createJourneyBridgePath(bridge)
    const middle = path.point(0.5)
    const straightMiddle = new Vector3(...bridge.from).lerp(
      new Vector3(...bridge.to),
      0.5,
    )
    expect(
      Math.hypot(middle.x - straightMiddle.x, middle.z - straightMiddle.z),
    ).toBeGreaterThan(0.25)
  })

  it.each(SKYBRIDGES)(
    '$id reserves planting space along the full turned deck',
    (bridge) => {
      const path = createJourneyBridgePath(bridge)
      for (let index = 0; index <= 32; index++) {
        const center = path.point(index / 32)
        expect(journeyBridgeDistanceXZ(bridge, center)).toBeLessThan(1e-10)
        for (const side of [-1, 1]) {
          const edge = path.point(
            index / 32,
            side * (bridge.width * 0.5 + 0.055),
          )
          expect(journeyBridgeDistanceXZ(bridge, edge)).toBeLessThan(
            bridge.width * 0.5 + 0.08,
          )
        }
      }
    },
  )
})

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
