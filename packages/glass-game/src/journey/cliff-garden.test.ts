// Cliff garden tests — retiring apron ornaments preserves the terrace and donor.

import { BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, } from 'three'
import { expect, it, vi } from 'vitest'
import { removeLegacyCliffApron } from './cliff-garden'

it('removes interleaved hanging gold ribs while retaining upper and crossing trim', () => {
  const terrace = new Group()
  const geometry = new BufferGeometry()
  geometry.setAttribute(
    'position',
    new Float32BufferAttribute(
      [
        0, -0.1, 0, 1, -0.1, 0, 0, 0, 1, 0, -1.2, 0, 1, -0.8, 0, 0, -0.28, 1, 0,
        -0.3, 0, 1, -0.2, 0, 0, -0.1, 1,
      ],
      3,
    ),
  )
  geometry.setAttribute(
    'uv',
    new Float32BufferAttribute(
      [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
      2,
    ),
  )
  geometry.setIndex([3, 4, 5, 0, 1, 2, 6, 7, 8])
  const gold = new MeshBasicMaterial()
  gold.name = 'map_champagne_gold'
  const trim = new Mesh(geometry, gold)
  trim.name = 'map_platform_mesh'
  const apron = new Group()
  apron.name = 'map_platform_mesh_4'
  terrace.add(trim, apron)
  const sourceIndices = Array.from(geometry.index!.array)
  const sourcePositions = Array.from(geometry.attributes.position!.array)
  const sourceUvs = Array.from(geometry.attributes.uv!.array)
  const sourceDispose = vi.spyOn(geometry, 'dispose')
  const owned = new Set<BufferGeometry>()

  removeLegacyCliffApron(terrace, owned)

  expect(terrace.getObjectByName(apron.name)).toBeUndefined()
  expect(Array.from(trim.geometry.index!.array)).toEqual([0, 1, 2, 6, 7, 8])
  expect(trim.geometry).not.toBe(geometry)
  expect(trim.material).toBe(gold)
  expect(Array.from(trim.geometry.attributes.position!.array)).toEqual(
    sourcePositions,
  )
  expect(Array.from(trim.geometry.attributes.uv!.array)).toEqual(sourceUvs)
  expect(Array.from(geometry.index!.array)).toEqual(sourceIndices)
  expect(owned).toEqual(new Set([trim.geometry]))
  owned.forEach((resource) => resource.dispose())
  expect(sourceDispose).not.toHaveBeenCalled()
})

it('leaves a differently named ornament outside the legacy apron selection', () => {
  const terrace = new Group()
  const geometry = new BufferGeometry()
  geometry.setAttribute(
    'position',
    new Float32BufferAttribute([0, -1, 0, 1, -1, 0, 0, -0.5, 1], 3),
  )
  geometry.setIndex([0, 1, 2])
  const ornament = new Mesh(geometry, new MeshBasicMaterial())
  ornament.name = 'new-terrace-ornament'
  terrace.add(ornament)
  const owned = new Set<BufferGeometry>()
  removeLegacyCliffApron(terrace, owned)
  expect(ornament.geometry).toBe(geometry)
  expect(owned.size).toBe(0)
})
