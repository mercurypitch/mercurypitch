// Dome geometry tests — retain authored landmarks and bound the separated glazing's ownership and cost.

import type { Material } from 'three'
import { BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, Raycaster, Vector3, } from 'three'
import { expect, it, vi } from 'vitest'
import { createFirstLightDomeGeometry, createTempleFrameGeometry, createTemplePaneGeometry, retainTempleOrnament, } from './dome-geometry'

function donorGeometry(): BufferGeometry {
  const geometry = new BufferGeometry()
  // Cornice, replaced shell, finial, and central underside respectively.
  const vertices = [
    0.84, 1.76, -0.16, 0.86, 1.76, -0.14, 0.84, 1.78, -0.14, 0.65, 2.1, -0.16,
    0.66, 2.1, -0.14, 0.65, 2.12, -0.14, 0.01, 2.5, -0.16, 0.03, 2.5, -0.14,
    0.01, 2.52, -0.14, -0.1, 1.7, -0.16, 0.1, 1.7, -0.16, 0, 1.7, -0.06,
  ]
  geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3))
  geometry.setAttribute(
    'uv',
    new Float32BufferAttribute(
      Array.from({ length: 24 }, (_, n) => n / 24),
      2,
    ),
  )
  geometry.setIndex(Array.from({ length: 12 }, (_, n) => n))
  geometry.computeVertexNormals()
  return geometry
}

function fixture() {
  const root = new Group()
  const source = donorGeometry()
  const material = new MeshStandardMaterial()
  const roofs: Mesh[] = []
  for (const name of [
    'first-light-isle',
    'twin-galleries-isle',
    'resonance-conservatory-isle',
  ]) {
    const stage = new Group()
    stage.name = name
    const roof = new Mesh(source, material)
    roof.name = 'map_temple_teal_dome'
    roof.position.set(0.1, 0.2, 0.3)
    roof.rotation.y = 0.4
    roof.scale.setScalar(0.9)
    stage.add(roof)
    root.add(stage)
    roofs.push(roof)
  }
  return { root, source, material, roofs }
}

it('retains cornice and finial attributes exactly while removing the shell and central ceiling', () => {
  const donor = donorGeometry()
  const before = donor.clone()
  const retained = retainTempleOrnament(donor)
  expect(retained.index!.count).toBe(6)
  expect(retained.getAttribute('position').count).toBe(6)
  for (const attribute of ['position', 'normal', 'uv']) {
    const source = donor.getAttribute(attribute)
    const target = retained.getAttribute(attribute)
    for (const [resultIndex, sourceIndex] of [0, 1, 2, 6, 7, 8].entries())
      for (let component = 0; component < source.itemSize; component += 1)
        expect(target.getComponent(resultIndex, component)).toBe(
          source.getComponent(sourceIndex, component),
        )
    expect(source.array).toEqual(before.getAttribute(attribute).array)
  }
  expect(donor.index!.array).toEqual(before.index!.array)
})

it.each([
  ['panes', createTemplePaneGeometry, 1536],
  ['frames', createTempleFrameGeometry, 5184],
] as const)(
  'keeps %s finite, outward wound and inside the measured donor roof bounds',
  (_, create, triangles) => {
    const geometry = create()
    expect(geometry.index!.count / 3).toBe(triangles)
    const position = geometry.getAttribute('position')
    const normal = geometry.getAttribute('normal')
    expect([...position.array, ...normal.array].every(Number.isFinite)).toBe(
      true,
    )
    const a = new Vector3()
    const b = new Vector3()
    const c = new Vector3()
    const meanNormal = new Vector3()
    for (let offset = 0; offset < geometry.index!.count; offset += 3) {
      const ids = [0, 1, 2].map((n) => geometry.index!.getX(offset + n))
      a.fromBufferAttribute(position, ids[0])
      b.fromBufferAttribute(position, ids[1])
      c.fromBufferAttribute(position, ids[2])
      const cross = b.sub(a).cross(c.sub(a))
      expect(cross.lengthSq()).toBeGreaterThan(1e-15)
      meanNormal.set(0, 0, 0)
      for (const index of ids)
        meanNormal.add(new Vector3().fromBufferAttribute(normal, index))
      expect(cross.dot(meanNormal)).toBeGreaterThan(0)
    }
    const bounds = geometry.boundingBox!
    expect(bounds.min.x).toBeGreaterThan(-0.95402)
    expect(bounds.max.x).toBeLessThan(0.95478)
    expect(bounds.min.z).toBeGreaterThan(-1.02689)
    expect(bounds.max.z).toBeLessThan(0.69281)
    expect(bounds.min.y).toBeGreaterThan(1.8)
    expect(bounds.max.y).toBeLessThan(2.4)
  },
)

it('leaves both glazing ends open instead of rebuilding an opaque ceiling', () => {
  const geometry = createTemplePaneGeometry()
  const glass = new Mesh(geometry, new MeshStandardMaterial())
  glass.updateMatrixWorld()
  const axialRay = new Raycaster(
    new Vector3(0, 3, -0.16),
    new Vector3(0, -1, 0),
  )
  expect(axialRay.intersectObject(glass)).toHaveLength(0)
  const shellRay = new Raycaster(
    new Vector3(0.55, 3, -0.16),
    new Vector3(0, -1, 0),
  )
  expect(shellRay.intersectObject(glass).length).toBeGreaterThan(0)
})

it('changes only First Light, retaining transforms and registering each new resource once', () => {
  const { root, source, material, roofs } = fixture()
  const gold = new MeshStandardMaterial()
  const geometries = new Set<BufferGeometry>()
  const materials = new Set<Material>()
  const donorDisposals = [source, material, gold].map((value) =>
    vi.spyOn(value, 'dispose'),
  )
  root.updateMatrixWorld(true)
  const transform = roofs[0].matrix.clone()
  const worldTransform = roofs[0].matrixWorld.clone()
  expect(transform.elements[12]).toBe(0.1)
  expect(createFirstLightDomeGeometry(root, gold, geometries, materials)).toBe(
    true,
  )
  root.updateMatrixWorld(true)
  expect(geometries.size).toBe(3)
  expect(materials.size).toBe(2)
  expect(roofs[0].matrix).toEqual(transform)
  expect(roofs[0].matrixWorld).toEqual(worldTransform)
  expect(roofs[0].geometry).not.toBe(source)
  expect(roofs[0].material).not.toBe(material)
  for (const roof of roofs.slice(1)) {
    expect(roof.geometry).toBe(source)
    expect(roof.material).toBe(material)
    expect(roof.children).toHaveLength(0)
  }
  const glass = roofs[0].getObjectByName(
    'first-light-separated-glazing',
  ) as Mesh
  const frame = roofs[0].getObjectByName(
    'first-light-separated-gold-ribs',
  ) as Mesh
  expect(glass.castShadow).toBe(false)
  expect(frame.material).toBe(gold)
  expect(frame.castShadow).toBe(true)
  expect(createFirstLightDomeGeometry(root, gold, geometries, materials)).toBe(
    false,
  )
  expect(geometries.size).toBe(3)
  expect(materials.size).toBe(2)
  geometries.forEach((geometry) => geometry.dispose())
  materials.forEach((owned) => owned.dispose())
  for (const spy of donorDisposals) expect(spy).not.toHaveBeenCalled()
})

it('does not allocate roof derivatives when the authored First Light donor is absent', () => {
  const geometries = new Set<BufferGeometry>()
  const materials = new Set<Material>()
  expect(
    createFirstLightDomeGeometry(
      new Group(),
      new MeshStandardMaterial(),
      geometries,
      materials,
    ),
  ).toBe(false)
  expect(geometries.size + materials.size).toBe(0)
})
