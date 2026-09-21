// Cloudway platform rendering tests — authoritative snapshots select one batched visual state per platform.

import type { Group as GroupType, InstancedMesh as InstancedMeshType, } from 'three'
import { BoxGeometry, Group, InstancedMesh, Matrix4, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, Vector3, } from 'three'
import { describe, expect, it } from 'vitest'
import { CLOUDWAY_GLASS_RIBBON } from '../content/cloudway-trial'
import type { GameSnapshot, PlatformRuntimeSnapshot } from '../contracts'
import { createMuseumAssetLoadPlan } from './asset-load-plan'
import { CLOUDWAY_PLATFORM_BUNDLE_ID, CLOUDWAY_PLATFORM_NODES, } from './cloudway-catalog'
import { createCloudwayPlatformRenderer } from './cloudway-platforms'
import { disposeMaterials, disposeObject } from './dispose'
import { createMaterialLibrary } from './material-library'
import type { MuseumMaterials } from './materials'

function materials(): MuseumMaterials {
  return Object.fromEntries(
    ['marble', 'teal', 'limestone', 'gold', 'rock', 'glass', 'mirror'].map(
      (id) => [id, new MeshPhysicalMaterial()],
    ),
  ) as MuseumMaterials
}

function donorScene(omit?: string): Group {
  const scene = new Group()
  for (const node of Object.values(CLOUDWAY_PLATFORM_NODES)) {
    if (node === omit) continue
    const root = new Group()
    root.name = node
    root.userData.collider_json = JSON.stringify({
      width: 2,
      depth: 1.5,
      height: 0.32,
    })
    const material = new MeshStandardMaterial()
    material.name = node.includes('Marble') ? 'museum_ivory' : 'museum_petrol'
    const mesh = new Mesh(new BoxGeometry(2, 0.32, 1.5), material)
    mesh.name = `${node}__Top`
    mesh.position.y = -0.16
    root.add(mesh)
    scene.add(root)
  }
  return scene
}

function platformStates(
  overrides: Readonly<Record<string, Partial<PlatformRuntimeSnapshot>>> = {},
): PlatformRuntimeSnapshot[] {
  return CLOUDWAY_GLASS_RIBBON.platforms.map((platform) => ({
    id: platform.id,
    offset: { x: 0, y: 0, z: 0 },
    phase:
      platform.behavior?.kind === 'crackle'
        ? 'intact'
        : platform.behavior?.kind === 'glide'
          ? 'moving'
          : 'stable',
    phaseProgress: 0,
    collisionEnabled: true,
    ...overrides[platform.id],
  }))
}

function snapshot(
  states: readonly PlatformRuntimeSnapshot[],
  enabledPlatformIds = CLOUDWAY_GLASS_RIBBON.platforms.map(
    (platform) => platform.id,
  ),
  activeSolidIds = enabledPlatformIds,
): GameSnapshot {
  return {
    player: {
      position: { ...CLOUDWAY_GLASS_RIBBON.spawn.position },
      velocity: { x: 0, y: 0, z: 0 },
      grounded: true,
      facingYaw: CLOUDWAY_GLASS_RIBBON.spawn.facingYaw,
    },
    platformStates: states,
    breakables: CLOUDWAY_GLASS_RIBBON.breakables.map((target) => ({
      id: target.id,
      charge: 0,
      phase: 'idle',
      brokenAt: null,
    })),
    activeSolidIds,
    enabledPlatformIds,
    completedBreakableIds: [],
    activeEncounter: null,
    phase: 'idle',
    paused: false,
    checkpointId: 'cloudway-checkpoint-arrival',
    nearbyBreakableId: null,
    elapsedSeconds: 0,
    complete: false,
  }
}

function floors(): Map<string, Group> {
  return new Map(
    CLOUDWAY_GLASS_RIBBON.platforms.map((platform) => {
      const floor = new Group()
      floor.name = `floor-${platform.id}`
      floor.add(
        new Mesh(new BoxGeometry(1, 0.2, 1), new MeshStandardMaterial()),
      )
      return [platform.id, floor]
    }),
  )
}

function instance(root: GroupType, name: string): InstancedMeshType {
  const mesh = root.getObjectByName(name)
  expect(mesh).toBeInstanceOf(InstancedMesh)
  return mesh as InstancedMeshType
}

describe('Cloudway platform renderer', () => {
  it('declares one required logical bundle for the entire reusable family', () => {
    const plan = createMuseumAssetLoadPlan(CLOUDWAY_GLASS_RIBBON)
    expect(
      plan.bundles.filter((id) => id === CLOUDWAY_PLATFORM_BUNDLE_ID),
    ).toEqual([CLOUDWAY_PLATFORM_BUNDLE_ID])
    expect(
      plan.taskIds.filter(
        (id) => id === `bundle:${CLOUDWAY_PLATFORM_BUNDLE_ID}`,
      ),
    ).toEqual([`bundle:${CLOUDWAY_PLATFORM_BUNDLE_ID}`])
    expect(plan.skyTexture).toBe('floating-museum-cloudscape-v3')
    expect(plan.taskIds).toContain('sky:floating-museum-cloudscape-v3')
  })

  it('batches repeated donors and applies the authoritative glide offset', () => {
    const palette = materials()
    const library = createMaterialLibrary()
    const sceneRoot = new Group()
    const fallbackFloors = floors()
    fallbackFloors.forEach((floor) => sceneRoot.add(floor))
    const renderer = createCloudwayPlatformRenderer(
      CLOUDWAY_GLASS_RIBBON,
      sceneRoot,
      fallbackFloors,
      palette,
      library,
    )
    const source = donorScene()
    renderer.install(source, CLOUDWAY_PLATFORM_BUNDLE_ID)
    const states = platformStates({
      'cloudway-glide-raft': { offset: { x: 0, y: 0, z: 1.25 } },
    })
    renderer.update(snapshot(states))

    const marble = instance(sceneRoot, 'cloudway-stable-Cloudway_Marble__Top')
    const frost = instance(sceneRoot, 'cloudway-stable-Cloudway_Frost__Top')
    const glide = instance(sceneRoot, 'cloudway-stable-Cloudway_Glide__Top')
    expect(marble.count).toBe(6)
    expect(frost.count).toBe(2)
    expect(glide.count).toBe(1)

    const matrix = new Matrix4()
    const position = new Vector3()
    glide.getMatrixAt(0, matrix)
    position.setFromMatrixPosition(matrix)
    expect(position.x).toBeCloseTo(0.7)
    expect(position.y).toBeCloseTo(-0.16)
    expect(position.z).toBeCloseTo(15.65)
    fallbackFloors.forEach((floor) => expect(floor.children).toHaveLength(0))

    disposeObject(sceneRoot, library.materials)
    disposeObject(source)
    library.dispose()
    disposeMaterials(Object.values(palette))
  })

  it('keeps enabled released art visible without collision and selects one phase', () => {
    const palette = materials()
    const library = createMaterialLibrary()
    const sceneRoot = new Group()
    const renderer = createCloudwayPlatformRenderer(
      CLOUDWAY_GLASS_RIBBON,
      sceneRoot,
      floors(),
      palette,
      library,
    )
    const source = donorScene()
    renderer.install(source, CLOUDWAY_PLATFORM_BUNDLE_ID)
    renderer.update(
      snapshot(
        platformStates({
          'cloudway-crackle-one': {
            phase: 'warning',
            phaseProgress: 0.4,
          },
          'cloudway-crackle-two': {
            phase: 'released',
            phaseProgress: 0.2,
            collisionEnabled: false,
          },
        }),
        CLOUDWAY_GLASS_RIBBON.platforms.map((platform) => platform.id),
        CLOUDWAY_GLASS_RIBBON.platforms
          .map((platform) => platform.id)
          .filter((id) => id !== 'cloudway-crackle-two'),
      ),
    )

    expect(
      instance(sceneRoot, 'cloudway-intact-Cloudway_Crackle_Intact__Top').count,
    ).toBe(0)
    expect(
      instance(sceneRoot, 'cloudway-warning-Cloudway_Crackle_Warning__Top')
        .count,
    ).toBe(1)
    expect(
      instance(sceneRoot, 'cloudway-release-Cloudway_Crackle_Release__Top')
        .count,
    ).toBe(1)

    disposeObject(sceneRoot, library.materials)
    disposeObject(source)
    library.dispose()
    disposeMaterials(Object.values(palette))
  })

  it('uses phase progress for warning pulse, falling shards and reformation', () => {
    const palette = materials()
    const library = createMaterialLibrary()
    const sceneRoot = new Group()
    const renderer = createCloudwayPlatformRenderer(
      CLOUDWAY_GLASS_RIBBON,
      sceneRoot,
      floors(),
      palette,
      library,
    )
    const source = donorScene()
    renderer.install(source, CLOUDWAY_PLATFORM_BUNDLE_ID)

    renderer.update(
      snapshot(
        platformStates({
          'cloudway-crackle-one': {
            phase: 'warning',
            phaseProgress: 0.125,
          },
          'cloudway-crackle-two': {
            phase: 'released',
            phaseProgress: 0.5,
            collisionEnabled: false,
          },
        }),
      ),
    )

    const warning = instance(
      sceneRoot,
      'cloudway-warning-Cloudway_Crackle_Warning__Top',
    )
    expect(warning.instanceColor).not.toBeNull()
    const released = instance(
      sceneRoot,
      'cloudway-release-Cloudway_Crackle_Release__Top',
    )
    const matrix = new Matrix4()
    const position = new Vector3()
    released.getMatrixAt(0, matrix)
    position.setFromMatrixPosition(matrix)
    expect(position.y).toBeLessThan(-0.4)

    renderer.update(
      snapshot(
        platformStates({
          'cloudway-crackle-one': {
            phase: 'resetting',
            phaseProgress: 0,
            collisionEnabled: false,
          },
          'cloudway-crackle-two': {
            phase: 'released',
            phaseProgress: 0.98,
            collisionEnabled: false,
          },
        }),
      ),
    )
    expect(released.count).toBe(0)

    disposeObject(sceneRoot, library.materials)
    disposeObject(source)
    library.dispose()
    disposeMaterials(Object.values(palette))
  })

  it('does not reveal a released platform hidden by progression', () => {
    const palette = materials()
    const library = createMaterialLibrary()
    const sceneRoot = new Group()
    const renderer = createCloudwayPlatformRenderer(
      CLOUDWAY_GLASS_RIBBON,
      sceneRoot,
      floors(),
      palette,
      library,
    )
    const source = donorScene()
    renderer.install(source, CLOUDWAY_PLATFORM_BUNDLE_ID)
    renderer.update(
      snapshot(
        platformStates({
          'cloudway-crackle-two': {
            phase: 'released',
            phaseProgress: 0.2,
            collisionEnabled: false,
          },
        }),
        CLOUDWAY_GLASS_RIBBON.platforms
          .map((platform) => platform.id)
          .filter((id) => id !== 'cloudway-crackle-two'),
      ),
    )

    expect(
      instance(sceneRoot, 'cloudway-release-Cloudway_Crackle_Release__Top')
        .count,
    ).toBe(0)

    disposeObject(sceneRoot, library.materials)
    disposeObject(source)
    library.dispose()
    disposeMaterials(Object.values(palette))
  })

  it('does not replace fallbacks when a required phase donor is missing', () => {
    const palette = materials()
    const library = createMaterialLibrary()
    const sceneRoot = new Group()
    const fallbackFloors = floors()
    const renderer = createCloudwayPlatformRenderer(
      CLOUDWAY_GLASS_RIBBON,
      sceneRoot,
      fallbackFloors,
      palette,
      library,
    )
    const source = donorScene(CLOUDWAY_PLATFORM_NODES.crackleWarning)

    expect(() => renderer.install(source, CLOUDWAY_PLATFORM_BUNDLE_ID)).toThrow(
      'Cloudway_Crackle_Warning',
    )
    expect(sceneRoot.getObjectByName('cloudway-platform-art')).toBeUndefined()
    fallbackFloors.forEach((floor) => expect(floor.children).toHaveLength(1))

    fallbackFloors.forEach((floor) => disposeObject(floor))
    disposeObject(source)
    library.dispose()
    disposeMaterials(Object.values(palette))
  })
})
