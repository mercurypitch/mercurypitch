// Floor inlay tests — stable seeds vary authored rooms without leaking resources or collision state.

import { readFile } from 'node:fs/promises'
import type { Group, Mesh as MeshType } from 'three'
import { Box3, MeshPhysicalMaterial } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { describe, expect, it, vi } from 'vitest'
import type { FloorArtPaletteId, FloorArtRecipeId, LevelDefinition, PlatformDefinition, } from '../contracts'
import { disposeObject } from './dispose'
import { createPlatformFloorArt, removeEmbeddedFloorInlay, sampleSoundWaveOffset, selectFloorArtVariant, } from './floor-art'
import { createKitInstance, kitFloorDimensions } from './kit-instance'
import { createMaterialLibrary } from './material-library'
import type { MuseumMaterials } from './materials'

const RECIPES: readonly FloorArtRecipeId[] = [
  'quiet-marble',
  'orbital-rings',
  'angular-parquet',
  'sound-wave',
  'hero-petal',
]

const PALETTES: readonly FloorArtPaletteId[] = [
  'neutral',
  'portrait',
  'archive',
  'garden',
  'neutral',
]

function createMaterials(): MuseumMaterials {
  return Object.fromEntries(
    ['marble', 'teal', 'limestone', 'gold', 'rock', 'glass'].map((id) => [
      id,
      new MeshPhysicalMaterial({ name: id }),
    ]),
  ) as MuseumMaterials
}

function platform(id: string): PlatformDefinition {
  return {
    id,
    kind: 'deck',
    minX: -2.2,
    maxX: 2.2,
    minZ: -1.8,
    maxZ: 1.8,
    top: 0,
    thickness: 0.3,
    material: 'stone',
  }
}

function level(id = 'floor-art-proof'): LevelDefinition {
  const platforms = RECIPES.map((_, index) => platform(`floor-${index}`))
  return {
    id,
    title: 'Floor art proof',
    spawn: { position: { x: 0, y: 0, z: 0 }, facingYaw: 0 },
    platforms,
    checkpoints: [],
    breakables: [],
    exit: {
      minX: 0,
      maxX: 1,
      minZ: 0,
      maxZ: 1,
      top: 0,
      requiresCompleted: [],
    },
    fallBelow: -3,
    presentation: {
      worldBounds: {
        minX: -3,
        maxX: 3,
        minY: -3,
        maxY: 3,
        minZ: -3,
        maxZ: 3,
      },
      lightBounds: {
        minX: -3,
        maxX: 3,
        minY: -1,
        maxY: 3,
        minZ: -3,
        maxZ: 3,
      },
      rooms: [],
      audioRegions: [],
      visuals: [],
      floorArt: RECIPES.map((recipeId, index) => ({
        platformId: platforms[index]!.id,
        recipeId,
        palette: PALETTES[index],
      })),
      assetRecipeIds: [],
    },
  }
}

function artFingerprint(root: Group) {
  return root.children.map((child) => {
    const position = (child as MeshType).geometry.getAttribute('position')
    return {
      material: child.name,
      positions: Array.from(position.array).map((value) =>
        Number(value.toFixed(5)),
      ),
    }
  })
}

describe('seeded floor art', () => {
  it('starts a sound line from the same continuous phase as later segments', () => {
    const variant = {
      detail: 1 as const,
      mirror: 1 as const,
      phase: Math.PI / 2,
    }
    const points = Array.from({ length: 15 }, (_, index) =>
      sampleSoundWaveOffset(1.5, 0.2, variant, 1, 3, index / 14),
    )
    const steps = points
      .slice(1)
      .map((point, index) => Math.abs(point - points[index]!))

    expect(steps[0]).toBeLessThanOrEqual(Math.max(...steps.slice(1)))
    expect(Math.max(...points.map(Math.abs))).toBeLessThanOrEqual(0.2)
  })

  it('renders each garden sound wave as continuous warm brass', () => {
    const materials = createMaterials()
    const soundWave = createPlatformFloorArt(level(), materials).get('floor-3')

    expect(soundWave?.children.map((child) => child.name)).toEqual([
      'floor-art-gold',
    ])

    if (soundWave !== undefined)
      disposeObject(soundWave, new Set(Object.values(materials)))
    Object.values(materials).forEach((material) => material.dispose())
  })

  it('builds every recipe deterministically inside its physical platform', () => {
    const materials = createMaterials()
    const first = createPlatformFloorArt(level(), materials)
    const second = createPlatformFloorArt(level(), materials)

    expect(first.size).toBe(RECIPES.length)
    for (let index = 0; index < RECIPES.length; index++) {
      const id = `floor-${index}`
      const root = first.get(id)!
      const repeated = second.get(id)!
      expect(root.name).toBe(`floor-art-${id}`)
      expect(root.children.length).toBeGreaterThan(0)
      expect(root.userData.floorArt).toEqual(repeated.userData.floorArt)
      expect(artFingerprint(root)).toEqual(artFingerprint(repeated))

      const bounds = new Box3().setFromObject(root)
      expect(bounds.min.x).toBeGreaterThanOrEqual(-2.2)
      expect(bounds.max.x).toBeLessThanOrEqual(2.2)
      expect(bounds.min.z).toBeGreaterThanOrEqual(-1.8)
      expect(bounds.max.z).toBeLessThanOrEqual(1.8)
      expect(bounds.min.y).toBeGreaterThanOrEqual(0)
      // Encounter pads begin at y=.02, so their cyan fill and brass ring win.
      expect(bounds.max.y).toBeLessThan(0.019)
    }

    const changed = level('another-floor-art-proof')
    expect(
      selectFloorArtVariant(level().id, level().presentation!.floorArt![3]!),
    ).not.toEqual(
      selectFloorArtVariant(changed.id, changed.presentation!.floorArt![3]!),
    )

    first.forEach((root) =>
      disposeObject(root, new Set(Object.values(materials))),
    )
    second.forEach((root) =>
      disposeObject(root, new Set(Object.values(materials))),
    )
    Object.values(materials).forEach((material) => material.dispose())
  })

  it('owns only geometry and leaves the shared museum palette alive', () => {
    const materials = createMaterials()
    const roots = createPlatformFloorArt(level(), materials)
    const borrowed = new Set(Object.values(materials))
    const materialDisposals = Object.values(materials).map((material) =>
      vi.spyOn(material, 'dispose'),
    )
    const geometry = (roots.get('floor-0')!.children[0] as MeshType).geometry
    const geometryDispose = vi.spyOn(geometry, 'dispose')

    roots.forEach((root) => disposeObject(root, borrowed))

    expect(geometryDispose).toHaveBeenCalledTimes(1)
    materialDisposals.forEach((dispose) =>
      expect(dispose).not.toHaveBeenCalled(),
    )
    Object.values(materials).forEach((material) => material.dispose())
  })

  it('removes the merged V2 centre inlay while retaining its outer trim', async () => {
    const donor = await readFile(
      new URL(
        '../../../../apps/beside-cue/public/games/adventure-v2/platform-kit.glb',
        import.meta.url,
      ),
    )
    const buffer = donor.buffer.slice(
      donor.byteOffset,
      donor.byteOffset + donor.byteLength,
    ) as ArrayBuffer
    const gltf = await new GLTFLoader().parseAsync(buffer, '')
    const source = gltf.scene.getObjectByName('platform_terrace')
    if (source === undefined)
      throw new Error('The V2 donor has no platform_terrace node.')
    const materials = createMaterials()
    const library = createMaterialLibrary()
    const instance = createKitInstance(source, materials, {}, library)
    const sourcePetrol = source.getObjectByName(
      'platform_terrace_museum_petrol',
    ) as MeshType
    const petrol = instance.getObjectByName(
      'platform_terrace_museum_petrol',
    ) as MeshType
    const brass = instance.getObjectByName(
      'platform_terrace_museum_brass',
    ) as MeshType

    expect(petrol.geometry.name).toBe('')
    expect(sourcePetrol.geometry.index?.count).toBe(184 * 3)
    expect(removeEmbeddedFloorInlay(instance, kitFloorDimensions(source))).toBe(
      1_872,
    )
    expect(petrol.geometry.index?.count).toBe(8 * 3)
    expect(brass.geometry.index?.count).toBe(4_412 * 3)
    expect(sourcePetrol.geometry.index?.count).toBe(184 * 3)

    const position = petrol.geometry.getAttribute('position')
    const referencedRadii = Array.from(petrol.geometry.index!.array).map(
      (index) => Math.hypot(position.getX(index), position.getZ(index)),
    )
    expect(Math.min(...referencedRadii)).toBeGreaterThan(1.4)

    disposeObject(instance, library.materials)
    library.dispose()
    disposeObject(gltf.scene)
    Object.values(materials).forEach((material) => material.dispose())
  })

  it('rejects unknown or duplicate platform references', () => {
    const materials = createMaterials()
    const base = level()
    const presentation = base.presentation!
    const unknown = {
      ...base,
      presentation: {
        ...presentation,
        floorArt: [
          {
            platformId: 'missing',
            recipeId: 'quiet-marble' as const,
          },
        ],
      },
    }
    const duplicate = {
      ...base,
      presentation: {
        ...presentation,
        floorArt: [presentation.floorArt![0]!, presentation.floorArt![0]!],
      },
    }

    expect(() => createPlatformFloorArt(unknown, materials)).toThrow(
      'unknown platform "missing"',
    )
    expect(() => createPlatformFloorArt(duplicate, materials)).toThrow(
      'Duplicate floor art',
    )
    Object.values(materials).forEach((material) => material.dispose())
  })
})
