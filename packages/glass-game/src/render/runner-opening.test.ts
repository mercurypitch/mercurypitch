// Runner opening tests — connected banks, borrowed donors, bounded animation and visit ownership.
import type { InstancedMesh } from 'three'
import { BoxGeometry, BufferGeometry, Float32BufferAttribute, Group, Int16BufferAttribute, Matrix4, Mesh, MeshPhysicalMaterial, Texture, } from 'three'
import { describe, expect, it, vi } from 'vitest'
import { SINGING_CURRENT_RESPONSIVE } from '../runner/first-course'
import { createSongRunnerGame } from '../runner/game'
import { createRunnerOpening } from './runner-opening'
import { buildOpeningDonor } from './runner-opening-geometry'
import { createRunnerOpeningLayout } from './runner-opening-layout'
import { runnerTrackBounds } from './runner-world-layout'

const course = SINGING_CURRENT_RESPONSIVE
const base = createSongRunnerGame(course, { comfortableMidi: 57 }).snapshot()

function fixture(reducedMotion = false) {
  const material = new MeshPhysicalMaterial({ name: 'borrowed donor' })
  const texture = new Texture()
  material.map = texture
  const geometry = new BoxGeometry(0.2, 0.2, 0.2)
  const donor = (...names: string[]) => {
    const root = new Group()
    for (const name of names) {
      const prefab = new Group()
      prefab.name = name
      prefab.position.set(12, 3, 5)
      const child = new Mesh(geometry, material)
      child.position.y = 0.1
      prefab.add(child)
      root.add(prefab)
    }
    return root
  }
  const options = {
    course,
    museum: donor('museum_column'),
    garden: donor('garden_foliage', 'garden_perimeter', 'ivy_trail'),
    arcade: donor('meshy_garden_arcade'),
    canopy: donor('meshy_observatory_canopy'),
    marble: texture,
    finishes: {
      apply: vi.fn(),
      create: () => new MeshPhysicalMaterial({ map: texture }),
    },
    reducedMotion,
  }
  return { options, material, texture, geometry }
}

describe('opening promenade', () => {
  it('keeps both water channels outside the playable road and joins their sections', () => {
    const bounds = runnerTrackBounds(course)
    const placements = createRunnerOpeningLayout(course)
    for (const side of [-1, 1]) {
      const water = placements.filter(
        (p) => p.kind === 'water' && Math.sign(p.position[0]) === side,
      )
      expect(water).toHaveLength(7)
      for (const p of water) {
        const near = p.position[0] - (side * p.scale[0]) / 2
        expect(side * near).toBeGreaterThan(
          side * (side < 0 ? bounds.left : bounds.right),
        )
        expect(p.position[1]).toBeCloseTo(course.groundFeetY + 0.04)
      }
      for (let i = 1; i < water.length; i++)
        expect(
          Math.abs(water[i]!.position[2] - water[i - 1]!.position[2]),
        ).toBeCloseTo(water[i]!.scale[2])
      // The structure ends before the first real course gap, preserving the jump read.
      expect(
        Math.min(...water.map((p) => p.position[2] - p.scale[2] / 2)),
      ).toBe(-40)
      const deck = placements.find(
        (p) =>
          p.kind === 'plinth' &&
          p.scale[2] === 42 &&
          Math.sign(p.position[0]) === side,
      )!
      expect(deck.position[1] + deck.scale[1] / 2).toBeLessThan(
        course.groundFeetY,
      )
      expect(deck.position[0] - (side * deck.scale[0]) / 2).toBeCloseTo(
        side < 0 ? bounds.left : bounds.right,
      )
      for (const arcade of placements.filter(
        (p) => p.kind === 'arcade' && Math.sign(p.position[0]) === side,
      ))
        expect(
          placements.some(
            (p) =>
              p.kind === 'plinth' &&
              p.position[0] === arcade.position[0] &&
              p.position[2] === arcade.position[2] &&
              Math.abs(p.position[1] + p.scale[1] / 2 - arcade.position[1]) <
                1e-8,
          ),
        ).toBe(true)
    }
  })

  it('moves a fixed set of instances with course progress, freezes pause and restores checkpoints', () => {
    const { options } = fixture()
    const opening = createRunnerOpening(options)
    const children = [...opening.root.children] as InstancedMesh[]
    expect(children.every((mesh) => mesh.isInstancedMesh)).toBe(true)
    const water = children.find((mesh) => mesh.name.includes('-water-'))!
    const normalMap = (water.material as MeshPhysicalMaterial).normalMap!
    opening.update({ ...base, status: 'running', courseDistanceMeters: 12 }, 9)
    expect(opening.root.position.z).toBe(12)
    expect(normalMap.offset.y).toBeCloseTo(0.1 / 6)
    opening.update({ ...base, status: 'paused', courseDistanceMeters: 12 }, 0.1)
    opening.update(
      { ...base, status: 'running', courseDistanceMeters: 12 },
      Number.NaN,
    )
    expect(normalMap.offset.y).toBeCloseTo(0.1 / 6)
    opening.update({ ...base, courseDistanceMeters: 48 }, 0)
    expect(opening.root.visible).toBe(false)
    expect(opening.metrics()).toEqual({ drawBatches: 0, triangles: 0 })
    opening.update({ ...base, courseDistanceMeters: 3 }, 0)
    expect(opening.root.visible).toBe(true)
    expect(opening.root.children).toEqual(children)
    expect(opening.metrics().triangles).toBeGreaterThan(0)
    opening.dispose()
  })

  it('disposes owned meshes, buffers and materials once while retaining donor textures', () => {
    const { options, geometry, material, texture } = fixture(true)
    const opening = createRunnerOpening(options)
    const meshes = opening.root.children as InstancedMesh[]
    const owned = [
      ...new Set(
        meshes.flatMap((mesh) => [
          mesh,
          mesh.geometry,
          mesh.material as MeshPhysicalMaterial,
        ]),
      ),
    ]
    const disposal = owned.map((value) => vi.spyOn(value, 'dispose'))
    const borrowed = [geometry, material, texture].map((value) =>
      vi.spyOn(value, 'dispose'),
    )
    const water = meshes.find((mesh) => mesh.name.includes('-water-'))!
    opening.update({ ...base, status: 'running' }, 0.1)
    const normalMap = (water.material as MeshPhysicalMaterial).normalMap!
    expect(normalMap.offset.y).toBe(0)
    const normalDispose = vi.spyOn(normalMap, 'dispose')
    opening.dispose()
    opening.dispose()
    opening.update(base, 0.1)
    expect(opening.root.children).toHaveLength(0)
    disposal.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1))
    borrowed.forEach((spy) => expect(spy).not.toHaveBeenCalled())
    expect(normalDispose).toHaveBeenCalledOnce()
  })

  it('cleans partially built resources when an authored donor is missing', () => {
    const { options } = fixture()
    options.arcade.clear()
    const bufferDisposal = vi.spyOn(BufferGeometry.prototype, 'dispose')
    const materialDisposal = vi.spyOn(MeshPhysicalMaterial.prototype, 'dispose')
    try {
      expect(() => createRunnerOpening(options)).toThrow(
        'meshy_garden_arcade is missing',
      )
      expect(bufferDisposal).toHaveBeenCalled()
      expect(materialDisposal).toHaveBeenCalled()
    } finally {
      bufferDisposal.mockRestore()
      materialDisposal.mockRestore()
    }
  })
})

describe('opening donor transforms', () => {
  it('removes prefab placement but preserves child geometry, UVs and material identity', () => {
    const { options, material, geometry } = fixture()
    const parts = buildOpeningDonor(options.museum, 'museum_column')
    expect(parts).toHaveLength(1)
    const part = parts[0]!
    part.geometry.computeBoundingBox()
    expect(part.geometry.boundingBox!.min.y).toBeCloseTo(0)
    expect(part.geometry.boundingBox!.max.y).toBeCloseTo(0.2)
    expect(part.geometry.boundingBox!.max.x).toBeCloseTo(0.1)
    expect(part.geometry).not.toBe(geometry)
    expect(part.material).toBe(material)
    expect(part.geometry.getAttribute('uv').array).toEqual(
      geometry.getAttribute('uv').array,
    )
    part.geometry.dispose()
  })

  it('promotes quantized positions before transforms beyond their encoding range', () => {
    const root = new Group()
    root.name = 'quantized'
    const geometry = new BufferGeometry()
    geometry.setAttribute(
      'position',
      new Int16BufferAttribute([0, 0, 0, 32767, 0, 0, 0, 32767, 0], 3, true),
    )
    geometry.setAttribute(
      'normal',
      new Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3),
    )
    geometry.setIndex([0, 1, 2])
    const mesh = new Mesh(geometry, new MeshPhysicalMaterial())
    mesh.applyMatrix4(new Matrix4().makeTranslation(3, 4, 0))
    root.add(mesh)
    const result = buildOpeningDonor(root, 'quantized')[0]!
    expect(result.geometry.getAttribute('position').array).toBeInstanceOf(
      Float32Array,
    )
    result.geometry.computeBoundingBox()
    expect(result.geometry.boundingBox!.min.x).toBe(3)
    expect(result.geometry.boundingBox!.max.y).toBe(5)
    expect(geometry.getAttribute('position').array).toBeInstanceOf(Int16Array)
    result.geometry.dispose()
  })
})
