// Living-crystal runtime delivery — decode the reviewed donor and share three geometries across placements.

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type { Mesh } from 'three'
import { BoxGeometry, Group, Mesh as ThreeMesh, MeshStandardMaterial, } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { GLASS_GAME_ASSET_FILES } from '../browser/assets'
import { LIVING_CRYSTAL_PLATFORM_BUNDLE_ID, LIVING_CRYSTAL_PLATFORM_NODES, LIVING_CRYSTAL_PLATFORM_RENDER_ID, LIVING_CRYSTAL_PLATFORM_RUNTIME, LIVING_CRYSTAL_PLATFORM_SUPPORT, } from '../content/living-crystal-profile'
import { LIVING_CRYSTAL_PEARL_ROOTS_STUDY } from '../content/living-crystal-study'
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

    renderer.update(snapshot([...covered], 0.4))
    expect(renderer.snapshot()).toMatchObject({
      installed: 2,
      visible: 2,
      drawCalls: 6,
      renderedTriangles: LIVING_CRYSTAL_PLATFORM_RUNTIME.triangles * 2,
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
})
