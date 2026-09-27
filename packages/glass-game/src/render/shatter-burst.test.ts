// Instanced shatter burst regressions — varied micro debris stays bounded, timed and disposable.

import type { BufferGeometry, InstancedMesh, Material, MeshBasicMaterial, } from 'three'
import { Box3, Group, Matrix4, Vector3 } from 'three'
import { describe, expect, it, vi } from 'vitest'
import { createShatterBurst } from './shatter-burst'
import { SHATTER_MICRO_COUNTS } from './shatter-motion'

const BOUNDS = new Box3(
  new Vector3(-0.4, 0, -0.18),
  new Vector3(0.4, 0.9, 0.18),
)

describe('instanced shatter burst', () => {
  it('uses three visibly distinct chip silhouettes and one sparse glint draw', () => {
    const burst = createShatterBurst(
      'profiled-vase',
      'radial',
      BOUNDS,
      0xbcefe7,
    )
    const meshes = burst.root.children as InstancedMesh[]

    expect(burst.root.visible).toBe(false)
    expect(burst.root.userData).toMatchObject({
      shatterProfile: 'radial',
      chipCount: SHATTER_MICRO_COUNTS.radial.chips,
      glintCount: SHATTER_MICRO_COUNTS.radial.glints,
    })
    expect(meshes).toHaveLength(4)
    expect(meshes.slice(0, 3).map((mesh) => mesh.geometry.type)).toEqual([
      'TetrahedronGeometry',
      'OctahedronGeometry',
      'ConeGeometry',
    ])
    expect(meshes.slice(0, 3).reduce((sum, mesh) => sum + mesh.count, 0)).toBe(
      SHATTER_MICRO_COUNTS.radial.chips,
    )
    expect(meshes[3].count).toBe(SHATTER_MICRO_COUNTS.radial.glints)
    for (const chip of meshes.slice(0, 3)) {
      expect(chip.instanceColor).not.toBeNull()
      expect(chip.geometry.hasAttribute('color')).toBe(false)
      expect((chip.material as Material).vertexColors).toBe(false)
    }

    burst.dispose()
  })

  it('writes flight matrices in place, fades glints and hides outside the beat', () => {
    const burst = createShatterBurst('timed-pane', 'sheet', BOUNDS, 0xd9fff4)
    const chip = burst.root.children[0] as InstancedMesh
    const glints = burst.root.children[3] as InstancedMesh
    const matrix = new Matrix4()
    const origin = new Vector3()
    const later = new Vector3()

    burst.update(0.18, 0, true)
    expect(burst.root.visible).toBe(true)
    chip.getMatrixAt(0, matrix)
    origin.setFromMatrixPosition(matrix)
    expect(matrix.elements.every(Number.isFinite)).toBe(true)
    expect((glints.material as MeshBasicMaterial).opacity).toBeGreaterThan(0)

    burst.update(0.48, 0.5, true)
    chip.getMatrixAt(0, matrix)
    later.setFromMatrixPosition(matrix)
    expect(later.distanceTo(origin)).toBeGreaterThan(0.05)
    expect((glints.material as MeshBasicMaterial).opacity).toBeLessThan(0.5)

    burst.update(2.2, 1, false)
    expect(burst.root.visible).toBe(false)
    burst.dispose()
  })

  it('disposes each shared geometry and material once across repeated cleanup', () => {
    const parent = new Group()
    const burst = createShatterBurst(
      'disposed-wall',
      'ice-wall',
      BOUNDS,
      0xd9fff4,
    )
    parent.add(burst.root)
    const geometries = new Set<BufferGeometry>()
    const materials = new Set<Material>()
    for (const child of burst.root.children as InstancedMesh[]) {
      geometries.add(child.geometry)
      const owned = Array.isArray(child.material)
        ? child.material
        : [child.material]
      owned.forEach((material) => materials.add(material))
    }
    const geometryDisposals = [...geometries].map(() => vi.fn())
    const materialDisposals = [...materials].map(() => vi.fn())
    ;[...geometries].forEach((geometry, index) =>
      geometry.addEventListener('dispose', geometryDisposals[index]),
    )
    ;[...materials].forEach((material, index) =>
      material.addEventListener('dispose', materialDisposals[index]),
    )

    burst.dispose()
    burst.dispose()

    expect(parent.children).not.toContain(burst.root)
    geometryDisposals.forEach((dispose) =>
      expect(dispose).toHaveBeenCalledOnce(),
    )
    materialDisposals.forEach((dispose) =>
      expect(dispose).toHaveBeenCalledOnce(),
    )
  })
})
