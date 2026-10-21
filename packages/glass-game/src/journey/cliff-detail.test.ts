// Cliff detail tests — preserve shared donors and planted support while sculpting First Light.

import { BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, PlaneGeometry, Vector3, } from 'three'
import { expect, it, vi } from 'vitest'
import { createFirstLightCliffDetail } from './cliff-detail'
import { attachAuthoredCliffGarden } from './cliff-garden'

function frontFace(): BufferGeometry {
  return new PlaneGeometry(5.1, 2.32, 48, 32).translate(0, -1.16, 1)
}

it('gives the right cleft unequal walls and a rounded root without erasing its depth', () => {
  const centre = 1.48 - 0.88 * 0.21
  const offsets = [-0.55, -0.275, -0.004, 0, 0.004, 0.18, 0.36]
  const source = new BufferGeometry()
  source.setAttribute(
    'position',
    new Float32BufferAttribute(
      offsets.flatMap((x) => [centre + x, -0.88, 1]),
      3,
    ),
  )
  source.setAttribute(
    'normal',
    new Float32BufferAttribute(
      offsets.flatMap(() => [0, 0, 1]),
      3,
    ),
  )
  const geometry = createFirstLightCliffDetail(source)
  const positions = geometry.getAttribute('position')
  const recess = offsets.map((_, index) => 1 - positions.getZ(index))
  expect(recess[0]).toBeCloseTo(0, 6)
  expect(recess[6]).toBeCloseTo(0, 6)
  expect(recess[3]).toBeCloseTo(0.34, 6)
  // Similar half-depths sit farther from the centre on the wider left wall.
  expect(recess[1]).toBeGreaterThan(0.34 * 0.45)
  expect(recess[1]).toBeLessThan(0.34 * 0.55)
  expect(recess[5]).toBeGreaterThan(0.34 * 0.45)
  expect(recess[5]).toBeLessThan(0.34 * 0.55)
  expect(recess[3]! - recess[2]!).toBeLessThan(0.0004)
  expect(recess[3]! - recess[4]!).toBeLessThan(0.0004)
  geometry.dispose()
  source.dispose()
})

it('keeps the exposed cleft connected through successive limestone beds', () => {
  const depths = [0.9, 1.2, 1.55]
  const source = new BufferGeometry()
  source.setAttribute(
    'position',
    new Float32BufferAttribute(
      depths.flatMap((depth) => [1.48 - depth * 0.21, -depth, 1]),
      3,
    ),
  )
  source.setAttribute(
    'normal',
    new Float32BufferAttribute(
      depths.flatMap(() => [0, 0, 1]),
      3,
    ),
  )
  const geometry = createFirstLightCliffDetail(source)
  const positions = geometry.getAttribute('position')
  for (let i = 0; i < depths.length; i++) {
    expect(1 - positions.getZ(i)).toBeGreaterThan(0.3)
    expect(1 - positions.getZ(i)).toBeLessThan(0.4)
  }
  geometry.dispose()
  source.dispose()
})

it('interrupts exposed beds while preserving support, outer bounds, UVs and topology', () => {
  const source = frontFace()
  const beforePositions = Array.from(source.getAttribute('position').array)
  const beforeNormals = Array.from(source.getAttribute('normal').array)
  const geometry = createFirstLightCliffDetail(source)
  const before = source.getAttribute('position')
  const after = geometry.getAttribute('position')
  const normals = geometry.getAttribute('normal')
  const displacement = new Vector3()
  let moved = 0
  let maximum = 0
  for (let i = 0; i < before.count; i++) {
    displacement
      .fromBufferAttribute(after, i)
      .sub(new Vector3().fromBufferAttribute(before, i))
    maximum = Math.max(maximum, displacement.length())
    if (displacement.lengthSq() > 0) moved++
    if (
      before.getY(i) >= -0.28 ||
      before.getY(i) <= -2.05 ||
      Math.abs(before.getX(i)) >= 2.35
    )
      expect(displacement.lengthSq()).toBe(0)
    expect(after.getX(i)).toBe(before.getX(i))
    expect(after.getY(i)).toBeGreaterThanOrEqual(-2.32)
    expect(after.getY(i)).toBeLessThanOrEqual(0)
    expect(after.getZ(i)).toBeLessThanOrEqual(before.getZ(i))
    expect(new Vector3().fromBufferAttribute(normals, i).length()).toBeCloseTo(
      1,
      6,
    )
  }
  expect(moved).toBeGreaterThan(400)
  expect(maximum).toBeGreaterThan(0.37)
  expect(maximum).toBeLessThan(0.41)
  expect(Array.from(geometry.index!.array)).toEqual(
    Array.from(source.index!.array),
  )
  expect(Array.from(geometry.getAttribute('uv').array)).toEqual(
    Array.from(source.getAttribute('uv').array),
  )
  expect(Array.from(source.getAttribute('position').array)).toEqual(
    beforePositions,
  )
  expect(Array.from(source.getAttribute('normal').array)).toEqual(beforeNormals)
  const index = geometry.index!
  const a = new Vector3()
  const b = new Vector3()
  const c = new Vector3()
  for (let i = 0; i < index.count; i += 3) {
    a.fromBufferAttribute(after, index.getX(i))
    b.fromBufferAttribute(after, index.getX(i + 1))
    c.fromBufferAttribute(after, index.getX(i + 2))
    expect(b.sub(a).cross(c.sub(a)).z).toBeGreaterThan(0)
  }
})

it('transports matching smooth normals identically across duplicated UV seams', () => {
  const source = new BufferGeometry()
  source.setAttribute(
    'position',
    new Float32BufferAttribute([-0.7, -0.9, 1, -0.7, -0.9, 1], 3),
  )
  source.setAttribute(
    'normal',
    new Float32BufferAttribute([0, 0, 1, 0, 0, 1], 3),
  )
  source.setAttribute('uv', new Float32BufferAttribute([0, 0, 1, 1], 2))
  const geometry = createFirstLightCliffDetail(source)
  const normals = geometry.getAttribute('normal')
  expect(new Vector3().fromBufferAttribute(normals, 0)).toEqual(
    new Vector3().fromBufferAttribute(normals, 1),
  )
  expect(Math.abs(normals.getX(0))).toBeGreaterThan(0.05)
})

it('preserves the winding of thin authored faces crossing the central cleft', () => {
  // These three faces from the resident 18k donor expose curvature that a
  // regular grid misses. A narrow central incision previously folded them.
  const faces = [
    [
      0.3337396681, -1.0922000408, 1.2172268629, 0.2459949255, -1.0703243017,
      1.2208768129, 0.4392640889, -1.1188025475, 1.2024464607,
    ],
    [
      0.3412994742, -1.1599961519, 0.5986337066, 0.3953318, -1.1695036888,
      0.6189448237, 0.4304436445, -1.1716469526, 0.618498683,
    ],
    [
      0.3089548945, -0.9970763922, 0.9124491215, 0.5251707435, -1.0739073753,
      1.062271595, 0.4115971625, -1.0369440317, 0.9864683747,
    ],
  ]
  for (const face of faces) {
    const source = new BufferGeometry()
    source.setAttribute('position', new Float32BufferAttribute(face, 3))
    source.computeVertexNormals()
    const beforeNormal = new Vector3().fromBufferAttribute(
      source.getAttribute('normal'),
      0,
    )
    const positions =
      createFirstLightCliffDetail(source).getAttribute('position')
    const a = new Vector3().fromBufferAttribute(positions, 0)
    const b = new Vector3().fromBufferAttribute(positions, 1)
    const c = new Vector3().fromBufferAttribute(positions, 2)
    expect(
      b.sub(a).cross(c.sub(a)).normalize().dot(beforeNormal),
    ).toBeGreaterThan(0)
  }
})

it('keeps the resident thin left and right bed faces open through the deeper clefts', () => {
  // Measured resident-donor faces. Narrow 0.025 roots or extra sharp cuts
  // reverse these faces although a regular plane fixture does not catch it.
  const faces = [
    [
      -1.1134431362, -1.1583032608, 0.734210968, -1.1905326843, -1.1670669317,
      0.7267383933, -1.2373454571, -1.1719839573, 0.7149137259,
    ],
    [
      -1.0656163692, -0.7724103332, 1.0919588804, -1.226121664, -0.800906539,
      1.0853674412, -1.2921434641, -0.8124665618, 1.0339434147,
    ],
    [
      -1.0993349552, -1.021468997, 0.3758681417, -1.2139965296, -1.0439037085,
      0.3831856549, -1.2988715172, -1.0400389433, 0.36632061,
    ],
    [
      -0.8501548767, -0.8979905248, 0.736551106, -0.9179614186, -0.8823421001,
      0.782589674, -0.8782785535, -0.8900237679, 0.7525138855,
    ],
    [
      0.4773793519, -0.9940571785, 0.6616597772, 0.5596777201, -1.0022841692,
      0.6376699209, 0.4291681349, -0.9826574922, 0.7021603584,
    ],
    [
      0.7861927748, -0.606721282, 0.6510846615, 0.8536584377, -0.6103886962,
      0.6241704226, 0.9167127013, -0.6127044559, 0.5802080631,
    ],
    [
      1.793545723, -0.7393530607, 0.2924391627, 1.8470617533, -0.7383085489,
      0.3007385433, 1.7135823965, -0.7347535491, 0.3029239178,
    ],
    [
      -0.8667651415, -1.0572041273, 0.6624338627, -0.7825935483, -1.0354551077,
      0.6058541536, -0.8012441993, -1.0348463058, 0.6262417436,
    ],
    [
      -0.5543375015, -1.1798026562, 0.5522625446, -0.4619708657, -1.1832932234,
      0.5414884686, -0.5121936202, -1.1766370535, 0.53579247,
    ],
  ]
  for (const face of faces) {
    const source = new BufferGeometry()
    source.setAttribute('position', new Float32BufferAttribute(face, 3))
    source.computeVertexNormals()
    const beforeNormal = new Vector3().fromBufferAttribute(
      source.getAttribute('normal'),
      0,
    )
    const geometry = createFirstLightCliffDetail(source)
    const positions = geometry.getAttribute('position')
    const a = new Vector3().fromBufferAttribute(positions, 0)
    const b = new Vector3().fromBufferAttribute(positions, 1)
    const c = new Vector3().fromBufferAttribute(positions, 2)
    const cross = b.sub(a).cross(c.sub(a))
    expect(cross.length()).toBeGreaterThan(0.0001)
    expect(cross.normalize().dot(beforeNormal)).toBeGreaterThan(0.1)
    geometry.dispose()
    source.dispose()
  }
})

it('owns only First Light rock geometry and leaves the other islands and plants unchanged', () => {
  const source = frontFace()
  const material = new MeshBasicMaterial()
  const donor = new Group()
  const rock = new Mesh(source, material)
  rock.name = 'map_cliff_geometry'
  donor.add(rock)
  const sourceDispose = vi.spyOn(source, 'dispose')
  const materialDispose = vi.spyOn(material, 'dispose')
  const owned = new Set<BufferGeometry>()
  const islands = [
    'first-light-landmass',
    'twin-galleries-landmass',
    'resonance-conservatory-landmass',
  ]
  for (const island of islands) {
    const cliff = donor.clone(true)
    const foliage = new Group()
    const plant = new Mesh(source, material)
    foliage.add(plant)
    attachAuthoredCliffGarden(cliff, island, () => foliage, owned)
    const attachedRock = cliff.getObjectByName(rock.name) as Mesh
    expect(attachedRock.geometry === source).toBe(island !== islands[0])
    expect(attachedRock.material).toBe(material)
    expect(plant.geometry).toBe(source)
    expect(plant.position.toArray()).toEqual([0, 0, 0])
    expect(foliage.parent).toBe(cliff)
  }
  expect(owned.size).toBe(1)
  owned.forEach((geometry) => geometry.dispose())
  expect(sourceDispose).not.toHaveBeenCalled()
  expect(materialDispose).not.toHaveBeenCalled()
})

it('rejects an incomplete rock rather than manufacturing unlit normals', () => {
  const source = new BufferGeometry()
  source.setAttribute('position', new Float32BufferAttribute([0, -1, 1], 3))
  expect(() => createFirstLightCliffDetail(source)).toThrow(
    'matched positions and normals',
  )
})
