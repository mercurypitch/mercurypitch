// Runner scenery tests — donor fidelity, fixed pools, water timing, warmup and ownership.

import type { InstancedMesh, Material, Object3D, ShaderMaterial } from 'three'
import { BoxGeometry, Float32BufferAttribute, Group, Matrix4, Mesh, MeshStandardMaterial, Texture, } from 'three'
import { describe, expect, it, vi } from 'vitest'
import type { RunnerSnapshot } from '../runner/contracts'
import { SINGING_CURRENT } from '../runner/first-course'
import { createSongRunnerGame } from '../runner/game'
import { createRunnerScenery } from './runner-scenery'

interface DonorFixture {
  readonly museum: Group
  readonly garden: Group
  readonly materials: readonly Material[]
  readonly geometries: readonly BoxGeometry[]
}

function coloredGeometry(): BoxGeometry {
  const geometry = new BoxGeometry(0.2, 0.2, 0.2)
  geometry.setAttribute(
    'color',
    new Float32BufferAttribute(
      new Float32Array(geometry.getAttribute('position').count * 3).fill(1),
      3,
    ),
  )
  return geometry
}

function addPrefab(
  scene: Group,
  name: string,
  materials: readonly Material[],
  geometries: BoxGeometry[],
  options: { readonly vertexColors?: boolean; readonly childY?: number } = {},
): void {
  const prefab = new Group()
  prefab.name = name
  prefab.position.set(7, 1.5, -3)
  materials.forEach((material, index) => {
    const geometry =
      options.vertexColors === true
        ? coloredGeometry()
        : new BoxGeometry(0.2, 0.2, 0.2)
    geometries.push(geometry)
    const child = new Mesh(geometry, material)
    child.position.set(index * 0.08, (options.childY ?? 0) + index * 0.04, 0)
    prefab.add(child)
  })
  scene.add(prefab)
}

function donors(): DonorFixture {
  const museum = new Group()
  const garden = new Group()
  const brass = new MeshStandardMaterial({ name: 'museum_brass' })
  const ivory = new MeshStandardMaterial({ name: 'museum_ivory' })
  const limestone = new MeshStandardMaterial({ name: 'museum_limestone' })
  const palette = new MeshStandardMaterial({
    name: 'garden_palette',
    vertexColors: true,
  })
  const geometries: BoxGeometry[] = []
  const museumMaterials = [brass, ivory, limestone]
  addPrefab(museum, 'museum_arch', museumMaterials, geometries, {
    childY: 0.4,
  })
  addPrefab(museum, 'museum_column', museumMaterials, geometries, {
    childY: 2.1625,
  })
  addPrefab(museum, 'museum_rotunda', museumMaterials, geometries, {
    childY: 1.835,
  })
  addPrefab(garden, 'garden_perimeter', [palette, ivory], geometries, {
    vertexColors: true,
  })
  addPrefab(garden, 'ivy_trail', [palette], geometries, {
    vertexColors: true,
    childY: -0.9985,
  })
  return {
    museum,
    garden,
    materials: [brass, ivory, limestone, palette],
    geometries,
  }
}

function snapshot(
  courseDistanceMeters: number,
  status: RunnerSnapshot['status'] = 'running',
): RunnerSnapshot {
  const base = createSongRunnerGame(SINGING_CURRENT, {
    comfortableMidi: 60,
  }).snapshot()
  return { ...base, status, courseDistanceMeters }
}

function instanceMeshes(root: Object3D): InstancedMesh[] {
  return root.children.filter(
    (child): child is InstancedMesh => (child as InstancedMesh).isInstancedMesh,
  )
}

function fixture(reducedMotion = false) {
  const source = donors()
  const paintingMap = new Texture()
  const scenery = createRunnerScenery({
    course: SINGING_CURRENT,
    museumScene: source.museum,
    gardenScene: source.garden,
    paintingMap,
    reducedMotion,
  })
  return { scenery, source, paintingMap }
}

describe('runner scenery', () => {
  it('bakes child-relative donor transforms once and only changes fixed pool matrices', () => {
    const { scenery } = fixture()
    const meshes = instanceMeshes(scenery.root)
    const identities = meshes.map((mesh) => ({
      mesh,
      geometry: mesh.geometry,
      material: mesh.material,
      capacity: mesh.instanceMatrix.count,
    }))
    const columnLimestone = meshes.find((mesh) =>
      mesh.name.startsWith('runner-scenery-pavilion-museum_limestone'),
    )!
    columnLimestone.geometry.computeBoundingBox()
    expect(columnLimestone.geometry.boundingBox!.max.y).toBeGreaterThan(2.2)
    expect(columnLimestone.geometry.boundingBox!.min.y).toBeCloseTo(-0.2)
    expect(columnLimestone.geometry.boundingBox!.min.x).toBeCloseTo(-1.65)
    expect(columnLimestone.geometry.boundingBox!.max.x).toBeCloseTo(1.65)
    expect(columnLimestone.geometry.boundingBox!.min.z).toBeCloseTo(-0.7)
    expect(columnLimestone.geometry.boundingBox!.max.z).toBeCloseTo(0.7)
    const gardenIvory = meshes.find((mesh) =>
      mesh.name.startsWith('runner-scenery-garden-museum_ivory'),
    )!
    gardenIvory.geometry.computeBoundingBox()
    expect(gardenIvory.geometry.boundingBox!.min.x).toBeCloseTo(-6.3)
    expect(gardenIvory.geometry.boundingBox!.max.x).toBeCloseTo(6.3)
    expect(gardenIvory.geometry.boundingBox!.min.y).toBeCloseTo(-0.18)
    expect(gardenIvory.geometry.boundingBox!.min.z).toBeCloseTo(-3.1)
    expect(gardenIvory.geometry.boundingBox!.max.z).toBeCloseTo(3.2)
    const water = meshes.find(
      (mesh) =>
        !Array.isArray(mesh.material) &&
        mesh.material.name === 'journey-water-source-material',
    )!
    expect(water.instanceMatrix.count).toBe(4)

    expect(scenery.metrics()).toMatchObject({
      residentChunks: 2,
      drawBatches: 3,
    })
    scenery.update(snapshot(38.5))
    expect(scenery.metrics()).toMatchObject({
      residentChunks: 2,
      drawBatches: 2,
    })
    scenery.update(snapshot(105))
    expect(scenery.metrics()).toMatchObject({
      residentChunks: 2,
      drawBatches: 3,
    })
    expect(scenery.root.position.z).toBe(105)
    expect(instanceMeshes(scenery.root)).toHaveLength(identities.length)
    identities.forEach((identity, index) => {
      const current = instanceMeshes(scenery.root)[index]!
      expect(current).toBe(identity.mesh)
      expect(current.geometry).toBe(identity.geometry)
      expect(current.material).toBe(identity.material)
      expect(current.instanceMatrix.count).toBe(identity.capacity)
    })
    expect(scenery.metrics().buffersBytes).toBeGreaterThan(0)
  })

  it('advances the shared water clock only while running and caps each delta', () => {
    const { scenery } = fixture()
    const water = instanceMeshes(scenery.root).find(
      (mesh) =>
        !Array.isArray(mesh.material) &&
        mesh.material.name === 'journey-water-source-material',
    )!
    const uniforms = (water.material as ShaderMaterial).uniforms
    expect(uniforms.uTime!.value).toBe(0)
    expect(uniforms.uMotion!.value).toBe(1)

    scenery.update(snapshot(105), 0.7)
    expect(uniforms.uTime!.value).toBeCloseTo(0.1)
    scenery.update(snapshot(105, 'paused'), 0.1)
    scenery.update(snapshot(105), Number.NaN)
    expect(uniforms.uTime!.value).toBeCloseTo(0.1)
    scenery.update(snapshot(105), 0.05)
    expect(uniforms.uTime!.value).toBeCloseTo(0.15)
  })

  it('freezes water presentation for reduced motion', () => {
    const { scenery } = fixture(true)
    const water = instanceMeshes(scenery.root).find(
      (mesh) =>
        !Array.isArray(mesh.material) &&
        mesh.material.name === 'journey-water-source-material',
    )!
    const uniforms = (water.material as ShaderMaterial).uniforms
    scenery.update(snapshot(105), 0.1)
    expect(uniforms.uMotion!.value).toBe(0)
  })

  it('warms every empty pool across an async callback and restores on success or failure', async () => {
    const { scenery } = fixture()
    const meshes = instanceMeshes(scenery.root)
    const matrix = new Matrix4()
    const before = meshes.map((mesh) => {
      mesh.getMatrixAt(0, matrix)
      return {
        count: mesh.count,
        visible: mesh.visible,
        frustumCulled: mesh.frustumCulled,
        matrix: matrix.clone(),
      }
    })
    let release!: () => void
    const pending = scenery.withWarmupState(
      () =>
        new Promise<void>((resolve) => {
          release = resolve
        }),
    )
    await vi.waitFor(() =>
      expect(meshes.every((mesh) => mesh.count > 0)).toBe(true),
    )
    expect(meshes.every((mesh) => mesh.visible && !mesh.frustumCulled)).toBe(
      true,
    )
    release()
    await pending

    const expectRestored = () =>
      meshes.forEach((mesh, index) => {
        const actual = new Matrix4()
        mesh.getMatrixAt(0, actual)
        expect(mesh.count).toBe(before[index]!.count)
        expect(mesh.visible).toBe(before[index]!.visible)
        expect(mesh.frustumCulled).toBe(before[index]!.frustumCulled)
        expect(actual.elements).toEqual(before[index]!.matrix.elements)
      })
    expectRestored()
    await expect(
      scenery.withWarmupState(() => {
        throw new Error('warm render failed')
      }),
    ).rejects.toThrow('warm render failed')
    expectRestored()
  })

  it('does not restore disposed pools when disposal happens during warmup', async () => {
    const { scenery } = fixture()
    await scenery.withWarmupState(async () => {
      scenery.dispose()
    })
    expect(scenery.root.children).toHaveLength(0)
    expect(scenery.metrics()).toEqual({
      residentChunks: 0,
      drawBatches: 0,
      triangles: 0,
      buffersBytes: 0,
    })
    expect(() => scenery.update(snapshot(105), 0.1)).not.toThrow()
  })

  it('disposes each owned pool resource once and leaves all borrowed resources alone', () => {
    const { scenery, source, paintingMap } = fixture()
    const borrowedGeometryDisposals = source.geometries.map((geometry) =>
      vi.spyOn(geometry, 'dispose'),
    )
    const borrowedMaterialDisposals = source.materials.map((material) =>
      vi.spyOn(material, 'dispose'),
    )
    const paintingDisposal = vi.spyOn(paintingMap, 'dispose')
    const meshes = instanceMeshes(scenery.root)
    const meshDisposals = meshes.map((mesh) => vi.spyOn(mesh, 'dispose'))
    const ownedGeometryDisposals = [
      ...new Set(meshes.map((mesh) => mesh.geometry)),
    ].map((geometry) => vi.spyOn(geometry, 'dispose'))
    const borrowedMaterials = new Set(source.materials)
    const ownedMaterialDisposals = [
      ...new Set(
        meshes.flatMap((mesh) =>
          Array.isArray(mesh.material) ? mesh.material : [mesh.material],
        ),
      ),
    ]
      .filter((material) => !borrowedMaterials.has(material))
      .map((material) => vi.spyOn(material, 'dispose'))

    scenery.dispose()
    scenery.dispose()
    meshDisposals.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1))
    ownedGeometryDisposals.forEach((spy) =>
      expect(spy).toHaveBeenCalledTimes(1),
    )
    ownedMaterialDisposals.forEach((spy) =>
      expect(spy).toHaveBeenCalledTimes(1),
    )
    borrowedGeometryDisposals.forEach((spy) =>
      expect(spy).not.toHaveBeenCalled(),
    )
    borrowedMaterialDisposals.forEach((spy) =>
      expect(spy).not.toHaveBeenCalled(),
    )
    expect(paintingDisposal).not.toHaveBeenCalled()
  })

  it('rejects same-name donor materials with different identities', () => {
    const source = donors()
    const column = source.museum.getObjectByName('museum_column')!
    const impostor = new MeshStandardMaterial({ name: 'museum_brass' })
    ;(column.children[0] as Mesh).material = impostor
    expect(() =>
      createRunnerScenery({
        course: SINGING_CURRENT,
        museumScene: source.museum,
        gardenScene: source.garden,
        paintingMap: new Texture(),
        reducedMotion: false,
      }),
    ).toThrow('no longer has one shared identity')
  })
})
