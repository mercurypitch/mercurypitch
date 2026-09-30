// Living-crystal runtime delivery — decode the reviewed donor and share three geometries across placements.

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type { Mesh } from 'three'
import { BoxGeometry, Group, Mesh as ThreeMesh, MeshStandardMaterial, PerspectiveCamera, } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { GLASS_GAME_ASSET_FILES } from '../browser/assets'
import { LIVING_CRYSTAL_PLATFORM_BUNDLE_ID, LIVING_CRYSTAL_PLATFORM_NODES, LIVING_CRYSTAL_PLATFORM_RENDER_ID, LIVING_CRYSTAL_PLATFORM_RUNTIME, LIVING_CRYSTAL_PLATFORM_SUPPORT, } from '../content/living-crystal-profile'
import { LIVING_CRYSTAL_PEARL_ROOTS_STUDY } from '../content/living-crystal-study'
import { LIVING_GLASS_ROSEBUD_ID, LIVING_GLASS_TRIAL, } from '../content/living-glass-trial'
import type { GameSnapshot, LevelDefinition, PlatformDefinition, } from '../contracts'
import { disposeObject } from './dispose'
import { createLivingCrystalPlatformRenderer } from './living-crystal-platform'
import { validateLivingCrystalPlatformDonor } from './living-crystal-platform-contract'

function bytes(): Buffer {
  return readFileSync(
    new URL(
      `../../../../apps/beside-cue/public/games/${GLASS_GAME_ASSET_FILES[LIVING_CRYSTAL_PLATFORM_BUNDLE_ID]}`,
      import.meta.url,
    ),
  )
}

async function load() {
  const source = bytes()
  const payload = new Uint8Array(source.byteLength)
  payload.set(source)
  return (await new GLTFLoader().parseAsync(payload.buffer, '')).scene
}

function snapshot(
  enabledPlatformIds: readonly string[],
  elapsedSeconds = 0,
): GameSnapshot {
  return {
    player: {
      position: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      grounded: true,
      facingYaw: 0,
    },
    breakables: [],
    enabledPlatformIds,
    completedBreakableIds: [],
    activeEncounter: null,
    phase: 'idle',
    paused: false,
    checkpointId: 'living-crystal-start',
    nearbyBreakableId: null,
    elapsedSeconds,
    complete: false,
  }
}

function repeatedLevel(): LevelDefinition {
  const repeated: PlatformDefinition = {
    id: 'living-crystal/repeated',
    minX: 4 - LIVING_CRYSTAL_PLATFORM_SUPPORT.depth / 2,
    maxX: 4 + LIVING_CRYSTAL_PLATFORM_SUPPORT.depth / 2,
    minZ: -LIVING_CRYSTAL_PLATFORM_SUPPORT.width / 2,
    maxZ: LIVING_CRYSTAL_PLATFORM_SUPPORT.width / 2,
    top: 0,
    thickness: LIVING_CRYSTAL_PLATFORM_SUPPORT.height,
    kind: 'deck',
    material: 'stone',
    renderId: LIVING_CRYSTAL_PLATFORM_RENDER_ID,
    renderQuarterTurns: 1,
  }
  return {
    ...LIVING_CRYSTAL_PEARL_ROOTS_STUDY,
    platforms: [...LIVING_CRYSTAL_PEARL_ROOTS_STUDY.platforms, repeated],
    presentation: {
      ...LIVING_CRYSTAL_PEARL_ROOTS_STUDY.presentation!,
      livingCrystalInteriors: [
        ...LIVING_CRYSTAL_PEARL_ROOTS_STUDY.presentation!
          .livingCrystalInteriors!,
        {
          platformId: repeated.id,
          variant: 'living-amber',
          seed: 9049,
        },
      ],
    },
  }
}

function geometryTriangles(mesh: Mesh): number {
  return (
    (mesh.geometry.getIndex()?.count ??
      mesh.geometry.getAttribute('position').count) / 3
  )
}

function geometryBytes(meshes: readonly Mesh[]): number {
  return meshes.reduce((total, mesh) => {
    const attributes = Object.values(mesh.geometry.attributes).reduce(
      (sum, attribute) => sum + attribute.array.byteLength,
      0,
    )
    return (
      total + attributes + (mesh.geometry.getIndex()?.array.byteLength ?? 0)
    )
  }, 0)
}

function cameraLookingAt(
  position: { readonly x: number; readonly y: number; readonly z: number },
  target: { readonly x: number; readonly y: number; readonly z: number },
): PerspectiveCamera {
  const camera = new PerspectiveCamera(48, 4 / 3, 0.05, 180)
  camera.position.set(position.x, position.y, position.z)
  camera.lookAt(target.x, target.y, target.z)
  camera.updateMatrixWorld(true)
  return camera
}

function fallbacks(level: LevelDefinition): Map<string, Group> {
  return new Map(
    level.platforms.map((platform) => {
      const root = new Group()
      root.add(
        new ThreeMesh(
          new BoxGeometry(1, platform.thickness, 1),
          new MeshStandardMaterial(),
        ),
      )
      return [platform.id, root]
    }),
  )
}

beforeAll(() => {
  vi.stubGlobal('self', globalThis)
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async () => ({ width: 1, height: 1, close: () => undefined })),
  )
})

afterAll(() => vi.unstubAllGlobals())

describe('shipped living-crystal platform', () => {
  it('matches the hashed three-role delivery and dimensional path contract', async () => {
    const delivery = bytes()
    expect(delivery.byteLength).toBe(LIVING_CRYSTAL_PLATFORM_RUNTIME.bytes)
    expect(createHash('sha256').update(delivery).digest('hex')).toBe(
      LIVING_CRYSTAL_PLATFORM_RUNTIME.sha256,
    )
    const scene = await load()
    const root = scene.getObjectByName(LIVING_CRYSTAL_PLATFORM_NODES.root)!
    const contract = validateLivingCrystalPlatformDonor(root)
    expect(contract).toMatchObject({
      triangles: LIVING_CRYSTAL_PLATFORM_RUNTIME.triangles,
      draws: LIVING_CRYSTAL_PLATFORM_RUNTIME.meshDrawsPerPass,
    })
    expect(
      Array.isArray(contract.interior.material)
        ? undefined
        : contract.interior.material.transparent,
    ).toBe(false)
    disposeObject(scene)
  })

  it('shares donor geometry and gold material while each palette owns its animation', async () => {
    const source = await load()
    const level = repeatedLevel()
    const scene = new Group()
    const fallbackById = fallbacks(level)
    let reducedMotion = false
    const renderer = createLivingCrystalPlatformRenderer(
      level,
      scene,
      fallbackById,
      { reducedMotion: () => reducedMotion },
    )
    const covered = renderer.install(source, LIVING_CRYSTAL_PLATFORM_BUNDLE_ID)
    expect(covered).toEqual(
      new Set(['living-crystal/main', 'living-crystal/repeated']),
    )
    const owner = scene.getObjectByName('living-crystal-platform-art')!
    expect(owner.children).toHaveLength(2)
    expect(owner.children.every((child) => child.visible)).toBe(true)
    const first = owner.children[0]!
    const second = owner.children[1]!
    const firstShell = first.getObjectByName(
      LIVING_CRYSTAL_PLATFORM_NODES.shell,
    ) as Mesh
    const secondShell = second.getObjectByName(
      LIVING_CRYSTAL_PLATFORM_NODES.shell,
    ) as Mesh
    const firstHardware = first.getObjectByName(
      LIVING_CRYSTAL_PLATFORM_NODES.hardware,
    ) as Mesh
    const secondHardware = second.getObjectByName(
      LIVING_CRYSTAL_PLATFORM_NODES.hardware,
    ) as Mesh
    expect(firstShell.geometry).toBe(secondShell.geometry)
    expect(firstHardware.geometry).toBe(secondHardware.geometry)
    expect(firstHardware.material).toBe(secondHardware.material)
    expect(firstShell.material).not.toBe(secondShell.material)

    renderer.update(snapshot([], 0.3))
    expect(renderer.snapshot().visible).toBe(0)
    expect(owner.children.every((child) => !child.visible)).toBe(true)
    renderer.update(snapshot([...covered], 0.4))
    expect(renderer.snapshot()).toMatchObject({
      installed: 2,
      visible: 2,
      visibleMeshPrimitives: 6,
      visibleGeometryTriangles: LIVING_CRYSTAL_PLATFORM_RUNTIME.triangles * 2,
      textures: 0,
    })
    reducedMotion = true
    renderer.update(snapshot([...covered], 0.5))
    expect(renderer.snapshot().interiors).toEqual([
      expect.objectContaining({
        settings: expect.objectContaining({ reducedMotion: true }),
      }),
      expect.objectContaining({
        settings: expect.objectContaining({ reducedMotion: true }),
      }),
    ])
    renderer.update(snapshot(['living-crystal/main'], 0.6))
    expect(renderer.snapshot().visible).toBe(1)
    renderer.dispose()
    renderer.dispose()
    expect(scene.getObjectByName('living-crystal-platform-art')).toBeUndefined()
    expect(renderer.install(source, LIVING_CRYSTAL_PLATFORM_BUNDLE_ID)).toEqual(
      new Set(),
    )
    renderer.update(snapshot([...covered], 1))
    expect(scene.getObjectByName('living-crystal-platform-art')).toBeUndefined()
    disposeObject(source)
  })

  it('replaces only the inner sculpture and follows the authored exhibit lifecycle', async () => {
    const source = await load()
    const scene = new Group()
    let reducedMotion = false
    const renderer = createLivingCrystalPlatformRenderer(
      LIVING_GLASS_TRIAL,
      scene,
      fallbacks(LIVING_GLASS_TRIAL),
      { reducedMotion: () => reducedMotion },
    )
    renderer.install(source, LIVING_CRYSTAL_PLATFORM_BUNDLE_ID)
    const art = scene.getObjectByName('living-crystal-living-crystal/main')!
    const shell = art.getObjectByName(
      LIVING_CRYSTAL_PLATFORM_NODES.shell,
    ) as Mesh
    const hardware = art.getObjectByName(
      LIVING_CRYSTAL_PLATFORM_NODES.hardware,
    ) as Mesh
    const state = (
      charge: number,
      phase: GameSnapshot['breakables'][number]['phase'],
      brokenAt: number | null,
      elapsedSeconds: number,
    ): GameSnapshot => ({
      ...snapshot(['living-crystal/main'], elapsedSeconds),
      breakables: [{ id: LIVING_GLASS_ROSEBUD_ID, charge, phase, brokenAt }],
      phase,
    })

    renderer.update(state(0.7, 'charging', null, 1))
    const charged = renderer.snapshot()
    expect(charged.interiors).toEqual([
      expect.objectContaining({
        response: 'charge',
        progress: 0.7,
      }),
    ])
    const pearl = charged.interiors[0] as {
      renderedTriangles: number
      estimatedGeometryMiB: number
    }
    expect(charged.visibleMeshPrimitives).toBe(15)
    expect(charged.visibleGeometryTriangles).toBe(
      geometryTriangles(shell) +
        geometryTriangles(hardware) +
        pearl.renderedTriangles,
    )
    expect(charged.sharedGeometryBytes).toBe(geometryBytes([shell, hardware]))
    expect(pearl.estimatedGeometryMiB).toBeGreaterThan(0)

    renderer.update({
      ...state(0.2, 'charging', null, 1.1),
      enabledPlatformIds: [],
    })
    expect(art.visible).toBe(false)
    expect(renderer.snapshot().interiors).toEqual([
      expect.objectContaining({ response: 'charge', progress: 0.7 }),
    ])
    renderer.update(state(0.2, 'charging', null, 1.2))
    expect(art.visible).toBe(true)
    expect(renderer.snapshot().interiors).toEqual([
      expect.objectContaining({ response: 'charge', progress: 0.2 }),
    ])

    expect(
      renderer.cullForView(
        cameraLookingAt({ x: 0, y: 2, z: -10 }, { x: 0, y: 1, z: -30 }),
      ),
    ).toBe(true)
    expect(art.visible).toBe(false)
    renderer.update(state(0.9, 'charging', null, 1.3))
    expect(renderer.snapshot().interiors).toEqual([
      expect.objectContaining({ response: 'charge', progress: 0.2 }),
    ])
    expect(
      renderer.cullForView(
        cameraLookingAt({ x: 0, y: 2, z: -10 }, { x: 0, y: 0, z: 0 }),
      ),
    ).toBe(true)
    expect(art.visible).toBe(true)
    expect(renderer.snapshot().interiors).toEqual([
      expect.objectContaining({ response: 'charge', progress: 0.9 }),
    ])

    renderer.update(state(1, 'shattering', 1, 2.2))
    expect(renderer.snapshot().interiors).toEqual([
      expect.objectContaining({
        response: 'release',
        progress: 0.5,
      }),
    ])
    reducedMotion = true
    renderer.update(state(1, 'complete', null, 2.3))
    expect(renderer.snapshot().interiors).toEqual([
      expect.objectContaining({
        response: 'rest',
        progress: 0,
        settings: expect.objectContaining({ reducedMotion: true }),
      }),
    ])
    renderer.update(state(0, 'idle', null, 0.2))
    expect(renderer.snapshot().interiors).toEqual([
      expect.objectContaining({ response: 'rest', progress: 0 }),
    ])

    renderer.dispose()
    disposeObject(source)
  })
})
