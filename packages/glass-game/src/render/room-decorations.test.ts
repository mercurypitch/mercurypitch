// Room decoration renderer tests — required art installs into stable roots with clean ownership.

import { BoxGeometry, Group, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, Texture, } from 'three'
import { expect, it, vi } from 'vitest'
import type { LevelDefinition } from '../contracts'
import { disposeMaterials, disposeObject } from './dispose'
import { createMaterialLibrary } from './material-library'
import type { MuseumMaterials } from './materials'
import { createRoomDecorations } from './room-decorations'

function level(): LevelDefinition {
  return {
    id: 'decorations/test',
    title: 'Decoration test',
    spawn: { position: { x: 0, y: 0, z: 0 }, facingYaw: 0 },
    platforms: [],
    solids: [
      {
        id: 'planter-bowl',
        kind: 'prop',
        shape: 'cylinder',
        x: 1,
        z: 2,
        radiusTop: 0.4,
        radiusBottom: 0.5,
        top: 0.4,
        thickness: 0.4,
        presentation: { role: 'plinth', material: 'stone' },
      },
    ],
    checkpoints: [],
    breakables: [],
    exit: {
      minX: -0.5,
      maxX: 0.5,
      minZ: -0.5,
      maxZ: 0.5,
      top: 0,
      requiresCompleted: [],
    },
    fallBelow: -2,
    presentation: {
      worldBounds: {
        minX: -4,
        maxX: 4,
        minY: -2,
        maxY: 4,
        minZ: -4,
        maxZ: 4,
      },
      lightBounds: {
        minX: -4,
        maxX: 4,
        minY: -2,
        maxY: 4,
        minZ: -4,
        maxZ: 4,
      },
      rooms: [
        {
          id: 'decorations/test/gallery/room/gallery',
          bounds: {
            minX: -4,
            maxX: 4,
            minY: 0,
            maxY: 4,
            minZ: -4,
            maxZ: 4,
          },
        },
      ],
      audioRegions: [],
      visuals: [],
      decorations: [
        {
          id: 'decorations/test/gallery/decoration/planter',
          roomId: 'decorations/test/gallery/room/gallery',
          recipeId: 'crystal-planter-v5',
          position: { x: 1, y: 0, z: 2 },
          yaw: 0.25,
          scale: 1.1,
          coveredSolidIds: ['planter-bowl'],
        },
        {
          id: 'decorations/test/gallery/decoration/painting',
          roomId: 'decorations/test/gallery/room/gallery',
          recipeId: 'garden-painting-v5',
          position: { x: -3, y: 2, z: 0 },
          yaw: Math.PI / 2,
          scale: 1,
        },
        {
          id: 'decorations/test/gallery/decoration/mirror',
          roomId: 'decorations/test/gallery/room/gallery',
          recipeId: 'gallery-mirror-v5',
          position: { x: 3, y: 2, z: 0 },
          yaw: -Math.PI / 2,
          scale: 1,
        },
      ],
      assetRecipeIds: [
        'crystal-planter-v5',
        'gallery-mirror-v5',
        'garden-painting-v5',
      ],
    },
  }
}

function materials(): MuseumMaterials {
  return {
    marble: new MeshPhysicalMaterial(),
    teal: new MeshPhysicalMaterial(),
    limestone: new MeshPhysicalMaterial(),
    gold: new MeshPhysicalMaterial(),
    rock: new MeshPhysicalMaterial(),
    glass: new MeshPhysicalMaterial(),
    mirror: new MeshPhysicalMaterial({ metalness: 1, roughness: 0.07 }),
  }
}

function bundle(surfaceMaterialName = 'decor_surface'): Group {
  const scene = new Group()
  const planter = new Group()
  planter.name = 'decor_crystal_planter'
  const planterMaterial = new MeshStandardMaterial()
  planterMaterial.name = 'museum_brass'
  planter.add(new Mesh(new BoxGeometry(1, 1.4, 1), planterMaterial))
  const frame = new Group()
  frame.name = 'decor_gallery_frame'
  const frameMaterial = new MeshStandardMaterial()
  frameMaterial.name = 'museum_brass'
  const surfaceMaterial = new MeshStandardMaterial()
  surfaceMaterial.name = surfaceMaterialName
  surfaceMaterial.normalMap = new Texture()
  frame.add(
    new Mesh(new BoxGeometry(1.2, 1.8, 0.1), frameMaterial),
    new Mesh(new BoxGeometry(0.9, 1.48, 0.01), surfaceMaterial),
  )
  scene.add(planter, frame)
  return scene
}

it('installs framed art and a planter into stable room roots with exact proxy coverage', () => {
  const palette = materials()
  const mirrorSource = new Texture()
  const mirrorSourceDisposed = vi.fn()
  mirrorSource.addEventListener('dispose', mirrorSourceDisposed)
  palette.mirror.normalMap = mirrorSource
  const library = createMaterialLibrary()
  const manager = createRoomDecorations(level(), palette, library)
  const roots = new Group()
  roots.add(...manager.instances.map((instance) => instance.root))
  const paintingSource = new Texture()
  const paintingSourceDisposed = vi.fn()
  paintingSource.addEventListener('dispose', paintingSourceDisposed)

  manager.installTexture('painting-garden-v5', paintingSource)
  const sourceBundle = bundle()
  expect(manager.installBundle(sourceBundle, 'museum-decor-v5')).toEqual([
    'planter-bowl',
  ])
  expect(manager.instances).toHaveLength(3)
  expect(manager.instances[0]).toMatchObject({
    roomId: 'decorations/test/gallery/room/gallery',
  })
  expect(manager.instances[0].root.position.toArray()).toEqual([1, 0, 2])
  expect(manager.instances[0].root.scale.toArray()).toEqual([1.1, 1.1, 1.1])

  let paintingMaterial: MeshStandardMaterial | undefined
  manager.instances[1].root.traverse((object) => {
    const mesh = object as Mesh
    if (!mesh.isMesh) return
    const material = mesh.material as MeshStandardMaterial
    if (material.name === 'decor_surface') paintingMaterial = material
  })
  if (paintingMaterial === undefined)
    throw new Error('Painting surface was not installed.')
  expect(paintingMaterial.map).not.toBe(paintingSource)
  expect(paintingMaterial.map?.isTexture).toBe(true)
  const mirrorMeshes: Mesh[] = []
  manager.instances[2].root.traverse((object) => {
    const mesh = object as Mesh
    if (mesh.isMesh) mirrorMeshes.push(mesh)
  })
  expect(
    mirrorMeshes.some(
      (mesh) =>
        (mesh.material as MeshStandardMaterial).name === 'decor_surface' &&
        (mesh.material as MeshStandardMaterial).metalness === 1,
    ),
  ).toBe(true)
  const mirrorMaterial = mirrorMeshes
    .map((mesh) => mesh.material as MeshStandardMaterial)
    .find((material) => material.name === 'decor_surface')
  if (mirrorMaterial === undefined)
    throw new Error('Mirror surface was not installed.')
  expect(mirrorMaterial.normalMap).not.toBe(mirrorSource)

  manager.update(new Set())
  expect(manager.instances[0].root.visible).toBe(false)
  manager.update(new Set(['planter-bowl']))
  expect(manager.instances[0].root.visible).toBe(true)

  const paintingMapDisposed = vi.fn()
  const paintingNormalDisposed = vi.fn()
  const mirrorNormalDisposed = vi.fn()
  const librarySurface = [...library.materials].find(
    (material) => material.name === 'decor_surface',
  ) as MeshStandardMaterial
  const libraryNormalDisposed = vi.fn()
  paintingMaterial.map?.addEventListener('dispose', paintingMapDisposed)
  paintingMaterial.normalMap?.addEventListener(
    'dispose',
    paintingNormalDisposed,
  )
  mirrorMaterial.normalMap?.addEventListener('dispose', mirrorNormalDisposed)
  librarySurface.normalMap?.addEventListener('dispose', libraryNormalDisposed)
  disposeObject(
    roots,
    new Set([...library.materials, ...Object.values(palette)]),
  )
  manager.dispose()
  library.dispose()
  disposeMaterials(Object.values(palette))
  expect(paintingMapDisposed).toHaveBeenCalledTimes(1)
  expect(paintingNormalDisposed).toHaveBeenCalledTimes(1)
  expect(mirrorNormalDisposed).toHaveBeenCalledTimes(1)
  expect(mirrorSourceDisposed).toHaveBeenCalledTimes(1)
  expect(libraryNormalDisposed).toHaveBeenCalledTimes(1)
  expect(paintingSourceDisposed).toHaveBeenCalledTimes(1)
})

it('rejects a frame whose authored inset material is absent', () => {
  const palette = materials()
  const library = createMaterialLibrary()
  const manager = createRoomDecorations(level(), palette, library)
  const roots = new Group()
  roots.add(...manager.instances.map((instance) => instance.root))
  manager.installTexture('painting-garden-v5', new Texture())

  expect(() =>
    manager.installBundle(bundle('wrong_surface'), 'museum-decor-v5'),
  ).toThrow('could not find material "decor_surface"')

  disposeObject(
    roots,
    new Set([...library.materials, ...Object.values(palette)]),
  )
  manager.dispose()
  library.dispose()
  disposeMaterials(Object.values(palette))
})
