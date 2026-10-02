// Runner scenery tests — finished donor fidelity, fixed pools, water timing, warmup and ownership.

import type { InstancedMesh, Material, Object3D, ShaderMaterial } from 'three'
import { BoxGeometry, Float32BufferAttribute, Group, Matrix4, Mesh, MeshStandardMaterial, } from 'three'
import { describe, expect, it, vi } from 'vitest'
import type { RunnerSnapshot } from '../runner/contracts'
import { SINGING_CURRENT } from '../runner/first-course'
import { createSongRunnerGame } from '../runner/game'
import { createRunnerScenery } from './runner-scenery'
import { createRunnerSceneryLayout } from './runner-scenery-layout'

interface DonorFixture {
  readonly museum: Group
  readonly garden: Group
  readonly arcade: Group
  readonly canopy: Group
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
  // Parent transforms must be removed while child transforms remain baked.
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
  const arcade = new Group()
  const canopy = new Group()
  const museumBrass = new MeshStandardMaterial({ name: 'museum_brass' })
  const museumIvory = new MeshStandardMaterial({ name: 'museum_ivory' })
  const museumLimestone = new MeshStandardMaterial({
    name: 'museum_limestone',
  })
  const museumPetrol = new MeshStandardMaterial({ name: 'museum_petrol' })
  const gardenPalette = new MeshStandardMaterial({
    name: 'garden_palette',
    vertexColors: true,
  })
  // The garden kit intentionally has separate same-name material identities.
  const gardenIvory = new MeshStandardMaterial({
    name: 'museum_ivory',
    vertexColors: true,
  })
  const gardenLimestone = new MeshStandardMaterial({
    name: 'museum_limestone',
  })
  const arcadeAtlas = new MeshStandardMaterial({
    name: 'meshy_garden_arcade_atlas',
  })
  const canopyAtlas = new MeshStandardMaterial({
    name: 'meshy_observatory_canopy_atlas',
  })
  const geometries: BoxGeometry[] = []
  addPrefab(
    museum,
    'platform_terrace',
    [museumBrass, museumIvory, museumLimestone, museumPetrol],
    geometries,
    { childY: -0.5 },
  )
  addPrefab(
    museum,
    'museum_balustrade',
    [museumIvory, museumLimestone],
    geometries,
    { childY: 0.2 },
  )
  addPrefab(garden, 'island_root', [gardenLimestone], geometries, {
    childY: -0.7,
  })
  addPrefab(
    garden,
    'garden_perimeter',
    [gardenPalette, gardenIvory],
    geometries,
    { vertexColors: true },
  )
  addPrefab(
    garden,
    'garden_foliage',
    [gardenPalette, gardenIvory],
    geometries,
    { vertexColors: true },
  )
  addPrefab(garden, 'ivy_trail', [gardenPalette], geometries, {
    vertexColors: true,
    childY: -1,
  })
  addPrefab(arcade, 'meshy_garden_arcade', [arcadeAtlas], geometries)
  addPrefab(canopy, 'meshy_observatory_canopy', [canopyAtlas], geometries)
  return {
    museum,
    garden,
    arcade,
    canopy,
    materials: [
      museumBrass,
      museumIvory,
      museumLimestone,
      museumPetrol,
      gardenPalette,
      gardenIvory,
      gardenLimestone,
      arcadeAtlas,
      canopyAtlas,
    ],
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
  const scenery = createRunnerScenery({
    course: SINGING_CURRENT,
    museumScene: source.museum,
    gardenScene: source.garden,
    arcadeScene: source.arcade,
    canopyScene: source.canopy,
    reducedMotion,
  })
  return { scenery, source }
}

function waterMeshes(root: Object3D): InstancedMesh[] {
  return instanceMeshes(root).filter(
    (mesh) =>
      !Array.isArray(mesh.material) &&
      mesh.material.name === 'journey-water-source-material',
  )
}

describe('runner scenery', () => {
  it('bakes finished donor child transforms once and only changes fixed pool matrices', () => {
    const { scenery } = fixture()
    const meshes = instanceMeshes(scenery.root)
    const identities = meshes.map((mesh) => ({
      mesh,
      geometry: mesh.geometry,
      material: mesh.material,
      capacity: mesh.instanceMatrix.count,
    }))
    const terraceIvory = meshes.find((mesh) =>
      mesh.name.includes('terrace-museum-museum_ivory'),
    )!
    terraceIvory.geometry.computeBoundingBox()
    expect(terraceIvory.geometry.boundingBox!.min.x).toBeLessThan(-1.5)
    expect(terraceIvory.geometry.boundingBox!.max.z).toBeGreaterThan(1)
    expect(terraceIvory.geometry.boundingBox!.min.z).toBeLessThan(-1)

    const gardenPalette = meshes.find((mesh) =>
      mesh.name.includes('terrace-garden-garden_palette'),
    )!
    gardenPalette.geometry.computeBoundingBox()
    expect(gardenPalette.geometry.boundingBox!.min.x).toBeLessThan(-1.3)
    expect(gardenPalette.geometry.boundingBox!.max.y).toBeGreaterThan(0.1)

    const canopy = meshes.find((mesh) =>
      mesh.name.includes('runner-scenery-canopy-0-'),
    )!
    const arcade = meshes.find((mesh) =>
      mesh.name.includes('runner-scenery-arcade-0-'),
    )!
    expect(canopy.instanceMatrix.count).toBe(2)
    expect(arcade.instanceMatrix.count).toBe(2)
    expect(waterMeshes(scenery.root)).toHaveLength(2)
    expect(
      waterMeshes(scenery.root).map((mesh) => mesh.instanceMatrix.count),
    ).toEqual([2, 2])

    expect(scenery.metrics()).toMatchObject({
      residentChunks: 2,
      drawBatches: 11,
    })
    const layout = createRunnerSceneryLayout(SINGING_CURRENT)
    scenery.update(snapshot(layout.handoffs[1]!.atCourseDistanceMeters + 0.1))
    expect(scenery.metrics()).toMatchObject({
      residentChunks: 2,
      drawBatches: 10,
    })
    expect(scenery.root.position.z).toBeCloseTo(
      layout.handoffs[1]!.atCourseDistanceMeters + 0.1,
    )
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

  it('advances the shared pool and waterfall clock only while running and caps each delta', () => {
    const { scenery } = fixture()
    const water = waterMeshes(scenery.root)
    expect(water[0]!.material).toBe(water[1]!.material)
    expect(water[0]!.geometry).toBe(water[1]!.geometry)
    const uniforms = (water[0]!.material as ShaderMaterial).uniforms
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

  it('freezes pool and falling-water presentation for reduced motion', () => {
    const { scenery } = fixture(true)
    const uniforms = (waterMeshes(scenery.root)[0]!.material as ShaderMaterial)
      .uniforms
    scenery.update(snapshot(105), 0.1)
    expect(uniforms.uMotion!.value).toBe(0)
  })

  it('warms an empty architecture pool across an async callback and restores on success or failure', async () => {
    const { scenery } = fixture()
    const layout = createRunnerSceneryLayout(SINGING_CURRENT)
    scenery.update(snapshot(layout.handoffs[1]!.atCourseDistanceMeters + 0.1))
    const meshes = instanceMeshes(scenery.root)
    expect(meshes.some((mesh) => mesh.count === 0)).toBe(true)
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

  it('disposes every owned pool resource once and leaves finished donor resources borrowed', () => {
    const { scenery, source } = fixture()
    const borrowedGeometryDisposals = source.geometries.map((geometry) =>
      vi.spyOn(geometry, 'dispose'),
    )
    const borrowedMaterialDisposals = source.materials.map((material) =>
      vi.spyOn(material, 'dispose'),
    )
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
  })

  it('rejects same-source same-name donor materials with different identities', () => {
    const source = donors()
    const balustrade = source.museum.getObjectByName('museum_balustrade')!
    const impostor = new MeshStandardMaterial({ name: 'museum_ivory' })
    ;(balustrade.children[0] as Mesh).material = impostor
    expect(() =>
      createRunnerScenery({
        course: SINGING_CURRENT,
        museumScene: source.museum,
        gardenScene: source.garden,
        arcadeScene: source.arcade,
        canopyScene: source.canopy,
        reducedMotion: false,
      }),
    ).toThrow('no longer has one shared identity')
  })
})
