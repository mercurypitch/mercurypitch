// Static prop batching regressions — transformed bounds, activation and ownership match individual meshes.

import type { InstancedMesh } from 'three'
import { Box3, BoxGeometry, Group, Matrix4, Mesh, MeshPhysicalMaterial, Vector3, } from 'three'
import { expect, it, vi } from 'vitest'
import { createStaticDecorationBatch } from './static-decoration-batch'

function fixture() {
  const source = new Group()
  source.position.set(0.2, 0.1, -0.3)
  const nested = new Group()
  nested.scale.set(0.3, 0.7, 0.4)
  nested.rotation.y = 0.2
  const mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshPhysicalMaterial())
  mesh.position.y = 0.5
  mesh.castShadow = true
  nested.add(mesh)
  source.add(nested)
  const members = [new Group(), new Group()]
  members[0]!.position.set(-2, 0, 3)
  members[0]!.rotation.y = 1.1
  members[0]!.scale.setScalar(0.82)
  members[1]!.position.set(3, 0.5, -1)
  const owner = new Group()
  return { source, mesh, members, owner }
}

it('preserves nested source transforms and rotated/scaled placements while sharing geometry', () => {
  const { source, mesh, members, owner } = fixture()
  const batch = createStaticDecorationBatch(source, members, owner)!
  const instanced = owner.children[0] as InstancedMesh
  expect(instanced.isInstancedMesh).toBe(true)
  expect(instanced.count).toBe(2)
  expect(instanced.geometry).toBe(mesh.geometry)
  expect(instanced.material).toBe(mesh.material)
  expect(instanced.castShadow).toBe(true)
  const ordinary = new Group()
  for (const member of members) {
    const copy = member.clone()
    copy.add(source.clone(true))
    ordinary.add(copy)
  }
  const expected = new Box3().setFromObject(ordinary)
  const actual = new Box3().setFromObject(owner)
  expect(actual.min.distanceTo(expected.min)).toBeLessThan(1e-6)
  expect(actual.max.distanceTo(expected.max)).toBeLessThan(1e-6)
  batch.dispose()
  mesh.geometry.dispose()
  mesh.material.dispose()
})

it('compacts active members without losing their placement and releases only instance-owned buffers', () => {
  const { source, mesh, members, owner } = fixture()
  const batch = createStaticDecorationBatch(source, members, owner)!
  const instanced = owner.children[0] as InstancedMesh
  members[0]!.visible = false
  batch.update()
  expect(instanced.count).toBe(1)
  const matrix = new Matrix4()
  instanced.getMatrixAt(0, matrix)
  const expected = new Matrix4().multiplyMatrices(
    members[1]!.matrix,
    mesh.matrixWorld,
  )
  expect(
    new Vector3()
      .setFromMatrixPosition(matrix)
      .distanceTo(new Vector3().setFromMatrixPosition(expected)),
  ).toBeLessThan(1e-6)
  members[1]!.visible = false
  batch.update()
  expect(owner.visible).toBe(false)
  expect(instanced.count).toBe(0)
  members[0]!.visible = true
  batch.update()
  expect(owner.visible).toBe(true)
  expect(instanced.count).toBe(1)
  const bufferDisposed = vi.fn()
  instanced.addEventListener('dispose', bufferDisposed)
  const geometryDisposed = vi.spyOn(mesh.geometry, 'dispose')
  const materialDisposed = vi.spyOn(mesh.material, 'dispose')
  batch.dispose()
  expect(bufferDisposed).toHaveBeenCalledTimes(1)
  expect(geometryDisposed).not.toHaveBeenCalled()
  expect(materialDisposed).not.toHaveBeenCalled()
  mesh.geometry.dispose()
  mesh.material.dispose()
})

it('leaves refractive, transparent and authored hidden props on their individual path', () => {
  const { source, mesh, members, owner } = fixture()
  mesh.material.transmission = 0.9
  expect(createStaticDecorationBatch(source, members, owner)).toBeUndefined()
  mesh.material.transmission = 0
  mesh.material.transparent = true
  expect(createStaticDecorationBatch(source, members, owner)).toBeUndefined()
  mesh.material.transparent = false
  mesh.visible = false
  expect(createStaticDecorationBatch(source, members, owner)).toBeUndefined()
  expect(owner.children).toHaveLength(0)
  mesh.geometry.dispose()
  mesh.material.dispose()
})
