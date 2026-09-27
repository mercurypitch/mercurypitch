// Rigid donor motion tests — one shared draw matches rotated support and simulation offsets.

import { BoxGeometry, Matrix4, Mesh, MeshStandardMaterial, PerspectiveCamera, Vector3, } from 'three'
import { describe, expect, it, vi } from 'vitest'
import type { PlatformDefinition, PlatformRuntimeSnapshot } from '../contracts'
import { createCloudwayPlatformViewSelector } from './cloudway-platform-culling'
import { createRigidPlatformBatch, updateRigidPlatformBatch, } from './rigid-platform-batch'

const platform: PlatformDefinition = {
  id: 'raft',
  minX: -1,
  maxX: 1,
  minZ: -1,
  maxZ: 1,
  top: 0,
  thickness: 0.3,
  kind: 'deck',
  material: 'stone',
}

describe('rigid platform instance motion', () => {
  it('applies world motion after the rotated donor transform, freezes and removes inactive supports', () => {
    const donor = new Mesh(
      new BoxGeometry(2, 0.3, 2),
      new MeshStandardMaterial(),
    )
    donor.position.set(0, -0.15, 0)
    donor.updateMatrixWorld(true)
    const base = new Matrix4().makeRotationY(Math.PI / 2).setPosition(3, 1, 5)
    const batch = createRigidPlatformBatch(donor, [
      { platform, placement: base },
      {
        platform: { ...platform, id: 'other' },
        placement: new Matrix4().makeTranslation(-2, 1, 5),
      },
    ])
    const current: PlatformRuntimeSnapshot = {
      id: 'raft',
      offset: { x: 2, y: 0.2, z: 3 },
      phase: 'moving',
      phaseProgress: 0.5,
      collisionEnabled: true,
    }
    const runtime = new Map([['raft', current]])
    updateRigidPlatformBatch(batch, true, new Set(['raft', 'other']), runtime)
    expect(batch.mesh.count).toBe(2)
    expect(batch.mesh.geometry).toBe(donor.geometry)
    const matrix = new Matrix4()
    batch.mesh.getMatrixAt(0, matrix)
    expect(new Vector3().setFromMatrixPosition(matrix).toArray()).toEqual([
      5,
      expect.closeTo(1.05),
      8,
    ])
    expect(batch.mesh.boundingBox!.max.z).toBeGreaterThanOrEqual(9)
    const write = vi.spyOn(batch.mesh, 'setMatrixAt')
    updateRigidPlatformBatch(batch, true, new Set(['raft', 'other']), runtime)
    expect(write).not.toHaveBeenCalled()
    updateRigidPlatformBatch(batch, true, new Set(['other']), runtime)
    expect(batch.mesh.count).toBe(1)
    batch.mesh.getMatrixAt(0, matrix)
    expect(new Vector3().setFromMatrixPosition(matrix).x).toBe(-2)
    updateRigidPlatformBatch(batch, false, new Set(['raft', 'other']), runtime)
    expect(batch.mesh.count).toBe(0)
    expect(batch.mesh.userData.excludeFromCameraCollision).toBe(true)
    batch.mesh.dispose()
    donor.geometry.dispose()
    donor.material.dispose()
  })
  it('compacts hidden and fully fogged instances without changing their physical platform definitions', () => {
    const donor = new Mesh(
      new BoxGeometry(2, 0.3, 2),
      new MeshStandardMaterial(),
    )
    donor.updateMatrixWorld(true)
    const platforms = [2, 8, 40].map((z, index) => ({
      ...platform,
      id: `p${index}`,
      minZ: z - 1,
      maxZ: z + 1,
    }))
    const batch = createRigidPlatformBatch(
      donor,
      platforms.map((p) => ({
        platform: p,
        placement: new Matrix4().makeTranslation(0, 0, (p.minZ + p.maxZ) / 2),
      })),
    )
    const selector = createCloudwayPlatformViewSelector({
      shadowDirection: { x: 0, y: -1, z: 0 },
      shadowReceiverMinimumY: 0,
    })
    const camera = new PerspectiveCamera(48, 1, 0.1, 100)
    camera.position.set(0, 3, -3)
    camera.lookAt(0, 0, 8)
    selector.update(camera, [])
    const ids = new Set(platforms.map((p) => p.id))
    updateRigidPlatformBatch(batch, true, ids, new Map(), selector.includes)
    expect(batch.mesh.count).toBe(2)
    camera.lookAt(0, 3, -20)
    selector.update(camera, [])
    updateRigidPlatformBatch(batch, true, ids, new Map(), selector.includes)
    expect(batch.mesh.count).toBe(0)
    expect(platforms[2]!.minZ).toBe(39)
    batch.mesh.dispose()
    donor.geometry.dispose()
    donor.material.dispose()
  })
})
