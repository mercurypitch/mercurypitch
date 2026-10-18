// Archive curtain tests — a finite pleated screen visibly gathers and owns only its bounded decoration.

import type { Mesh } from 'three'
import { describe, expect, it, vi } from 'vitest'
import { ARCHIVE_HUSH_ROOMS, GLASS_ARCHIVE_HUSH, } from '../content/archive-hush-room'
import { createArchiveCurtain } from './archive-curtain'

describe('archive acoustic curtain', () => {
  it('adds no curtain to the introductory room', () => {
    expect(createArchiveCurtain([], 0)).toBeUndefined()
  })

  it.each([1, 2])(
    'gathers and closes the bounded screen for room %s without adding a light or shadow pass',
    (index) => {
      const room = ARCHIVE_HUSH_ROOMS[index]!
      const targets = GLASS_ARCHIVE_HUSH.breakables.filter(({ id }) =>
        room.curtainVesselIds.includes(id),
      )
      const curtain = createArchiveCurtain(targets, room.centerZ)!
      const cloth = curtain.root.getObjectByName('archive-curtain-cloth')!
      const openWidth = cloth.scale.x
      curtain.update(true, 1)
      expect(cloth.scale.x).toBeGreaterThan(openWidth * 5)
      expect(cloth.position.x).toBeCloseTo(0)
      expect(
        curtain.root.getObjectByName('archive-curtain-tieback')!.visible,
      ).toBe(false)
      expect(
        curtain.root.getObjectByName('archive-curtain-sound-path'),
      ).toBeDefined()
      let triangles = 0
      let meshes = 0
      curtain.root.traverse((object) => {
        expect(object.type).not.toMatch(/Light$/)
        const mesh = object as Mesh
        if (!mesh.isMesh) return
        meshes++
        expect(mesh.castShadow).toBe(false)
        const positions = mesh.geometry.getAttribute('position')
        for (let i = 0; i < positions.count; i++) {
          expect(
            Number.isFinite(
              positions.getX(i) + positions.getY(i) + positions.getZ(i),
            ),
          ).toBe(true)
        }
        triangles += (mesh.geometry.index?.count ?? positions.count) / 3
      })
      expect(meshes).toBeLessThanOrEqual(15)
      expect(triangles).toBeLessThan(2_200)
      const pleats = cloth.children[0] as Mesh
      const dispose = vi.spyOn(pleats.geometry, 'dispose')
      curtain.update(false, 1)
      expect(cloth.scale.x).toBe(openWidth)
      curtain.dispose()
      curtain.dispose()
      expect(dispose).toHaveBeenCalledTimes(1)
    },
  )
})
