// Pearl Current renderer regressions — host progress, runtime motion preference and owned cleanup.

import type { BufferGeometry, InstancedMesh, Material, Mesh } from 'three'
import { BufferAttribute, Group, Matrix4, Vector3 } from 'three'
import { describe, expect, it, vi } from 'vitest'
import { createPearlCurrentInterior } from './pearl-current'

function instancePosition(mesh: InstancedMesh, index: number): Vector3 {
  const matrix = new Matrix4()
  mesh.getMatrixAt(index, matrix)
  return new Vector3().setFromMatrixPosition(matrix)
}

function renderGeometries(group: Group): Set<BufferGeometry> {
  const geometries = new Set<BufferGeometry>()
  group.traverse((object) => {
    const mesh = object as Mesh
    if (mesh.isMesh) geometries.add(mesh.geometry)
  })
  return geometries
}

interface RenderVersions {
  readonly positions: readonly number[]
  readonly normals: readonly number[]
  readonly instances: readonly number[]
}

function bufferAttributeVersion(
  geometry: BufferGeometry,
  name: string,
): number {
  const attribute = geometry.getAttribute(name)
  if (!(attribute instanceof BufferAttribute))
    throw new TypeError(`Expected ${name} to be a BufferAttribute.`)
  return attribute.version
}

function renderVersions(group: Group): RenderVersions {
  const streams: Mesh[] = []
  group.traverse((object) => {
    const mesh = object as Mesh
    if (mesh.isMesh && mesh.name.startsWith('pearl-current-stream-'))
      streams.push(mesh)
  })
  streams.sort((left, right) => left.name.localeCompare(right.name))
  const instances = [
    'pearl-current-pearl-beads',
    'pearl-current-gold-junctions',
    'pearl-current-response-band',
  ].map(
    (name) =>
      (group.getObjectByName(name) as InstancedMesh).instanceMatrix.version,
  )
  return {
    positions: streams.map((stream) =>
      bufferAttributeVersion(stream.geometry, 'position'),
    ),
    normals: streams.map((stream) =>
      bufferAttributeVersion(stream.geometry, 'normal'),
    ),
    instances,
  }
}

function expectEveryVersionToAdvance(
  current: RenderVersions,
  previous: RenderVersions,
): void {
  for (const key of ['positions', 'normals', 'instances'] as const)
    expect(
      current[key].every((version, index) => version > previous[key][index]!),
    ).toBe(true)
}

describe('Pearl Current interior', () => {
  it('holds the response band at host progress while ambient current motion advances', () => {
    const interior = createPearlCurrentInterior()
    const initialGeometries = renderGeometries(interior.group)
    const charges = interior.group.getObjectByName(
      'pearl-current-response-band',
    ) as InstancedMesh
    const beads = interior.group.getObjectByName(
      'pearl-current-pearl-beads',
    ) as InstancedMesh

    interior.update({
      deltaSeconds: 0,
      response: 'charge',
      progress: 0.16,
    })
    const firstBand = instancePosition(charges, 0)
    const firstBead = instancePosition(beads, 0)
    interior.update({
      deltaSeconds: 0.1,
      response: 'charge',
      progress: 0.16,
    })
    const secondBand = instancePosition(charges, 0)
    const secondBead = instancePosition(beads, 0)

    expect(secondBand.distanceTo(firstBand)).toBeLessThan(1e-9)
    expect(secondBead.distanceTo(firstBead)).toBeGreaterThan(0.0001)
    const updatedGeometries = renderGeometries(interior.group)
    expect(updatedGeometries.size).toBe(initialGeometries.size)
    expect(
      [...updatedGeometries].every((geometry) =>
        initialGeometries.has(geometry),
      ),
    ).toBe(true)
    interior.dispose()
  })

  it('freezes in place when reduced motion is enabled and reset restores the authored first frame', () => {
    const interior = createPearlCurrentInterior()
    const beads = interior.group.getObjectByName(
      'pearl-current-pearl-beads',
    ) as InstancedMesh
    const initial = instancePosition(beads, 0)
    interior.update({
      deltaSeconds: 0.1,
      response: 'rest',
      progress: 0,
    })
    expect(instancePosition(beads, 0).distanceTo(initial)).toBeGreaterThan(
      0.0001,
    )
    interior.configure({ reducedMotion: true })
    const frozen = instancePosition(beads, 0)

    interior.update({
      deltaSeconds: 1,
      response: 'rest',
      progress: 0,
    })
    expect(instancePosition(beads, 0).distanceTo(frozen)).toBeLessThan(1e-9)
    interior.reset()
    expect(instancePosition(beads, 0).distanceTo(initial)).toBeLessThan(1e-6)
    interior.dispose()
  })

  it('dirties dynamic buffers only when ambient or authoritative response state changes', () => {
    const interior = createPearlCurrentInterior()
    const initial = renderVersions(interior.group)

    interior.update({
      deltaSeconds: 0,
      response: 'rest',
      progress: 0,
      paused: true,
    })
    expect(renderVersions(interior.group)).toEqual(initial)

    interior.configure({ reducedMotion: true })
    interior.update({
      deltaSeconds: 1,
      response: 'rest',
      progress: 0,
    })
    expect(renderVersions(interior.group)).toEqual(initial)

    interior.update({
      deltaSeconds: 0,
      response: 'charge',
      progress: 0.55,
      strength: 0.55,
    })
    const charged = renderVersions(interior.group)
    expectEveryVersionToAdvance(charged, initial)
    interior.update({
      deltaSeconds: 1,
      response: 'charge',
      progress: 0.55,
      strength: 0.55,
    })
    expect(renderVersions(interior.group)).toEqual(charged)

    interior.reset()
    const reset = renderVersions(interior.group)
    expectEveryVersionToAdvance(reset, charged)
    interior.reset()
    expect(renderVersions(interior.group)).toEqual(reset)

    interior.configure({ reducedMotion: false })
    interior.update({
      deltaSeconds: 0.1,
      response: 'rest',
      progress: 0,
    })
    expectEveryVersionToAdvance(renderVersions(interior.group), reset)
    interior.dispose()
  })

  it('keeps hidden response meshes renderable for shader precompile', () => {
    const interior = createPearlCurrentInterior({ reducedMotion: true })
    const charges = interior.group.getObjectByName(
      'pearl-current-response-band',
    ) as InstancedMesh

    expect(interior.group.visible).toBe(true)
    expect(charges.visible).toBe(true)
    expect(instancePosition(charges, 0).length()).toBeGreaterThan(0)
    const matrix = new Matrix4()
    const scale = new Vector3()
    charges.getMatrixAt(0, matrix)
    scale.setFromMatrixScale(matrix)
    expect(scale.x).toBeLessThan(0.0001)
    interior.dispose()
  })

  it('disposes each owned resource once and detaches its group', () => {
    const parent = new Group()
    const interior = createPearlCurrentInterior()
    parent.add(interior.group)
    const geometries = new Set<BufferGeometry>()
    const materials = new Set<Material>()
    interior.group.traverse((object) => {
      const mesh = object as Mesh
      if (!mesh.isMesh) return
      geometries.add(mesh.geometry)
      const owned = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material]
      owned.forEach((material) => materials.add(material))
    })
    const geometryEvents = [...geometries].map(() => vi.fn())
    const materialEvents = [...materials].map(() => vi.fn())
    ;[...geometries].forEach((geometry, index) =>
      geometry.addEventListener('dispose', geometryEvents[index]!),
    )
    ;[...materials].forEach((material, index) =>
      material.addEventListener('dispose', materialEvents[index]!),
    )

    interior.dispose()
    interior.dispose()

    expect(interior.group.parent).toBeNull()
    geometryEvents.forEach((listener) =>
      expect(listener).toHaveBeenCalledOnce(),
    )
    materialEvents.forEach((listener) =>
      expect(listener).toHaveBeenCalledOnce(),
    )
  })
})
