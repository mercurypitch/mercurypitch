// Journey medallion tests — real surfaces support Merc and expose selectable progress badges within the existing budget.

import type { BufferGeometry, Object3D } from 'three'
import { Box3, Mesh, MeshStandardMaterial, Raycaster, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { FLOATING_MUSEUM_JOURNEY } from '../content/museum-journey'
import { JOURNEY_MEDALLION_CLEARANCE_Y, JOURNEY_MEDALLION_SURFACE_Y, } from './landmarks'
import { createJourneyMedallion, createJourneyMedallionGeometry, } from './medallions'
import { createJourneyProgressDisplay } from './progress'
import { JOURNEY_TERRACE_SURFACE_OFFSET } from './terrace-layout'

function fixture() {
  const owned = new Set<BufferGeometry>()
  const geometry = createJourneyMedallionGeometry(owned)
  const material = new MeshStandardMaterial()
  const materials = { ivory: material, gold: material, jade: material }
  const markers = FLOATING_MUSEUM_JOURNEY.stages.map((stage, index) =>
    createJourneyMedallion(stage, index, geometry, materials),
  )
  for (const marker of markers) marker.root.updateMatrixWorld(true)
  return {
    owned,
    geometry,
    markers,
    dispose() {
      for (const item of owned) item.dispose()
      material.dispose()
    },
  }
}

describe('museum jewel plinths', () => {
  it('keeps actual enamel, relief and rim below Merc while footing reaches each terrace', () => {
    const f = fixture()
    try {
      for (const [index, marker] of f.markers.entries()) {
        const stage = FLOATING_MUSEUM_JOURNEY.stages[index]!
        const landmass = FLOATING_MUSEUM_JOURNEY.landmasses.find(
          (island) => island.id === stage.islandId,
        )!
        const bounds = new Box3().setFromObject(marker.root)
        expect(bounds.min.y).toBeLessThan(
          landmass.position[1] + JOURNEY_TERRACE_SURFACE_OFFSET,
        )
        expect(bounds.max.y).toBeLessThan(
          stage.position[1] + JOURNEY_MEDALLION_CLEARANCE_Y,
        )
        expect(bounds.min.x).toBeGreaterThanOrEqual(stage.position[0] - 0.5)
        expect(bounds.max.x).toBeLessThanOrEqual(stage.position[0] + 0.5)
        expect(bounds.min.z).toBeGreaterThanOrEqual(stage.position[2] - 0.5)
        expect(bounds.max.z).toBeLessThanOrEqual(stage.position[2] + 0.5)
        for (const [x, z] of [
          [0, 0],
          [-0.16, 0.08],
          [0.16, 0.08],
        ]) {
          const hit = new Raycaster(
            new Vector3(
              stage.position[0] + x!,
              stage.position[1] + 1,
              stage.position[2] + z!,
            ),
            new Vector3(0, -1, 0),
          ).intersectObject(marker.root, true)[0]!
          expect(hit).toBeDefined()
          expect(hit.point.y).toBeGreaterThanOrEqual(
            stage.position[1] + JOURNEY_MEDALLION_SURFACE_Y - 0.000001,
          )
          expect(hit.point.y).toBeLessThan(
            stage.position[1] + JOURNEY_MEDALLION_CLEARANCE_Y,
          )
          expect(hit.object.userData.journeyStageId).toBe(stage.id)
        }
        // This also catches an inward-facing lathe profile: its visible upper
        // bevel must be the first surface, not the hidden ivory underneath.
        const rim = new Raycaster(
          new Vector3(
            stage.position[0] + 0.45,
            stage.position[1] + 1,
            stage.position[2],
          ),
          new Vector3(0, -1, 0),
        ).intersectObject(marker.root, true)[0]!
        expect(rim.object.name).toBe(`${stage.id}-medallion-ring`)
        expect(rim.point.y).toBeGreaterThan(stage.position[1] + 0.15)
        expect(rim.point.y).toBeLessThan(
          stage.position[1] + JOURNEY_MEDALLION_CLEARANCE_Y,
        )
        const face = marker.root.getObjectByName(`${stage.id}-medallion-face`)!
        const shoulder = new Raycaster(
          new Vector3(
            stage.position[0] + 0.37,
            stage.position[1] + 1,
            stage.position[2],
          ),
          new Vector3(0, -1, 0),
        ).intersectObject(face)[0]!
        expect(shoulder.point.y).toBeLessThan(
          stage.position[1] + JOURNEY_MEDALLION_SURFACE_Y - 0.001,
        )
        expect(shoulder.normal!.y).toBeLessThan(0.995)
        expect(shoulder.normal!.y).toBeGreaterThan(0.5)
      }
    } finally {
      f.dispose()
    }
  })

  it('shows saved stars on the forward fascia without changing progress or stage ownership', () => {
    const f = fixture()
    const display = createJourneyProgressDisplay(FLOATING_MUSEUM_JOURNEY, {
      starMarkers: new Map(
        f.markers.map((marker, index) => [
          FLOATING_MUSEUM_JOURNEY.stages[index]!.id,
          marker.stars,
        ]),
      ),
      portraitSurfaces: new Map(),
      portraitMysteries: new Map(),
    })
    try {
      for (const [index, marker] of f.markers.entries()) {
        const stage = FLOATING_MUSEUM_JOURNEY.stages[index]!
        expect(marker.stars.map((star) => star.visible)).toEqual([
          false,
          false,
          false,
        ])
        display.setProgress([{ stageId: stage.id, stars: 2 }])
        expect(marker.stars.map((star) => star.visible)).toEqual([
          true,
          true,
          false,
        ])
        display.setProgress([{ stageId: stage.id, stars: 3 }])
        expect(marker.stars.map((star) => star.visible)).toEqual([
          true,
          true,
          true,
        ])
        for (const [slot, star] of marker.stars.entries()) {
          const normal = new Vector3(0, 0, 1).applyQuaternion(star.quaternion)
          const center = star.getWorldPosition(new Vector3())
          const hits = new Raycaster(
            center.clone().addScaledVector(normal, 0.2),
            normal.clone().negate(),
          ).intersectObject(marker.root, true)
          expect(hits[0]?.object).toBe(star)
          expect(star.userData.journeyStageId).toBe(stage.id)
          expect(star.userData.journeyStarSlot).toBe(slot + 1)
          expect(normal.z).toBeGreaterThan(0.9)
          expect(Math.abs(normal.y)).toBeLessThan(0.000001)
        }
        display.setProgress([])
        expect(marker.stars.map((star) => star.visible)).toEqual([
          false,
          false,
          false,
        ])
      }
    } finally {
      display.dispose()
      f.dispose()
    }
  })

  it('shares owned shapes across stages and stays within the old five-draw body and triangle budget', () => {
    const f = fixture()
    try {
      const colors = f.geometry.face.getAttribute('color')
      const positions = f.geometry.face.getAttribute('position')
      expect(colors.count).toBe(positions.count)
      expect(
        Array.from(colors.array).every(
          (value) => Number.isFinite(value) && value >= 0 && value <= 1,
        ),
      ).toBe(true)
      const center = Array.from(
        { length: positions.count },
        (_, index) => index,
      ).find(
        (index) =>
          Math.hypot(positions.getX(index), positions.getZ(index)) < 0.001,
      )!
      const shoulder = Array.from(
        { length: positions.count },
        (_, index) => index,
      ).find(
        (index) =>
          Math.hypot(positions.getX(index), positions.getZ(index)) > 0.4,
      )!
      expect(colors.getY(center)).toBeGreaterThan(colors.getY(shoulder))
      expect(f.geometry.plinth.getAttribute('color')).toBeUndefined()
      expect(f.geometry.crown.getAttribute('color')).toBeUndefined()
      const resources = new Set<BufferGeometry>()
      for (const marker of f.markers) {
        const body = marker.root.children.filter(
          (child): child is Mesh => child instanceof Mesh,
        )
        expect(body).toHaveLength(5)
        expect(body.filter((mesh) => mesh.castShadow)).toHaveLength(1)
        expect(
          body.reduce(
            (total, mesh) =>
              total +
              (mesh.geometry.index?.count ??
                mesh.geometry.getAttribute('position').count) /
                3,
            0,
          ),
        ).toBeLessThanOrEqual(1552)
        marker.root.traverse((object: Object3D) => {
          if (object instanceof Mesh) {
            expect(f.owned.has(object.geometry)).toBe(true)
            resources.add(object.geometry)
          }
        })
      }
      expect(resources.size).toBe(f.owned.size)
      expect(resources.size).toBe(6)
    } finally {
      f.dispose()
    }
  })
})
