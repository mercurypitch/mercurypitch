// Procedural art bounds — decode shipped donors and exercise their actual render adapters.

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { Box3, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, Texture, } from 'three'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { describe, expect, it } from 'vitest'
import { CLOUDWAY_LAB_ROOT_NAMES, CLOUDWAY_LAB_SCROLL_MATERIAL_BINDINGS, } from '../../render/cloudway-laboratory-catalog.ts'
import { fitCloudwayLaboratoryRigidPresentation } from '../../render/cloudway-laboratory-platforms.ts'
import { createCloudwayScrollAdapter } from '../../render/cloudway-scroll-adapter.ts'
import { disposeObject } from '../../render/dispose.ts'
import { compileAssembledPlatform, PROCEDURAL_VISUAL_ENVELOPES, } from './chunk-envelopes.ts'
import { createScrollBridgeChunk } from './chunk-library.ts'

const assets = [
  [
    'pearl-rest',
    'pearlRest',
    'pearl-marble-long/pearl-marble-long-runtime-v1.glb',
    'dda126cc3c9ea41a326fd06299f1bdf89e1a7e2789b1c2eceb83380c0f9ca861',
    1401472,
  ],
  [
    'frost-lily',
    'frostLily',
    'frost-lily-step/frost-lily-step-runtime-v2.glb',
    '3a3b8682f14bb463bcb13dc695191279144e1a799e7d5764348d98a3600ea9cf',
    3359924,
  ],
  [
    'aurora-glide',
    'auroraGlide',
    'aurora-glide-raft/aurora-glide-raft-runtime-v2.glb',
    'a1533a0837faacc4d55df5b9aa1fc8cae303ccd8c9af2f91af2480863dcc570e',
    3035924,
  ],
  [
    'rose-crackle',
    'roseCrackle',
    'rose-quartz-crackle-fast/rose-quartz-crackle-fast-runtime-v1.glb',
    'faabbbb1c4a4f7019502c79e51299a1fb7317de7315fe3410f8b167caaed5285',
    9491080,
  ],
  [
    'amethyst-crackle',
    'amethystCrackle',
    'amethyst-crackle-slow/amethyst-crackle-slow-runtime-v1.glb',
    '2a9615df89bbac42be86c14f0ca251c34d8937aa3b6ed7990baf50fb07991b4c',
    19673144,
  ],
  [
    'rose-hex-crumble',
    'roseHexCrumble',
    'optional-platforms/rose-crystal-hex-crumble/rose-crystal-hex-crumble-mobile-v4.glb',
    '448952af288e5c3676201b9fe85695da22cc481087685216a0f4662f4bb6ad3e',
    1775788,
  ],
  [
    'rose-hex-crumble',
    'roseHexCrumble',
    'optional-platforms/rose-crystal-hex-crumble/rose-crystal-hex-crumble-desktop-v4.glb',
    '10f7e17289dbbb7a17808c6a976512e8b764590500f0de9a966b50d170908c74',
    5597072,
  ],
  [
    'gilt-scroll',
    'scroll',
    'gilt-scroll-bridge/gilt-scroll-bridge-runtime-v1.glb',
    'eb141261cc6dc65a2fd889c0984c0cdb2be8bcbb869e44b45d654845c252edba',
    4951124,
  ],
] as const

describe('procedural measured visual envelopes', () => {
  it.each(assets)(
    'contains the actual %s donor (%s)',
    async (profileId, key, path, expectedHash, expectedBytes) => {
      const bytes = readFileSync(
        new URL(
          `../../../../../apps/beside-cue/public/games/cloudway-laboratory-v1/${path}`,
          import.meta.url,
        ),
      )
      const hash = createHash('sha256').update(bytes).digest('hex')
      expect(
        hash,
        'Measured donor changed: remeasure its runtime envelope before updating this pin.',
      ).toBe(expectedHash)
      expect(bytes.length).toBe(expectedBytes)
      const scene = (
        await new GLTFLoader()
          .setMeshoptDecoder(MeshoptDecoder)
          .register(() => ({
            name: 'EXT_texture_webp',
            loadTexture: async () => new Texture(),
          }))
          .parseAsync(
            bytes.buffer.slice(
              bytes.byteOffset,
              bytes.byteOffset + bytes.byteLength,
            ),
            '',
          )
      ).scene
      const root = scene.getObjectByName(CLOUDWAY_LAB_ROOT_NAMES[key])!
      expect(root, hash).toBeDefined()
      const hidden: Mesh[] = []
      root.traverse((object) => {
        if (
          object instanceof Mesh &&
          (object.name.includes('__shard_') ||
            object.name.endsWith('__contact') ||
            object.name.includes('Shard'))
        )
          hidden.push(object)
      })
      for (const object of hidden) object.removeFromParent()
      let measured: Box3
      let cleanup = () => {}
      if (key === 'pearlRest') {
        fitCloudwayLaboratoryRigidPresentation(root, key, {
          width: 3.2,
          depth: 0.72,
        })
        root.updateMatrixWorld(true)
        measured = new Box3().setFromObject(root)
        expect(measured.max.z - measured.min.z - 0.72, hash).toBeCloseTo(
          0.16837033,
          6,
        )
        expect(root.scale.y).toBe(1)
      } else if (key === 'scroll') {
        const p = createScrollBridgeChunk('asset').platforms[0]
        const platform = compileAssembledPlatform({
          id: 'asset',
          profileId: p.profileId,
          center: { x: 0, y: 0, z: 0 },
          quarterTurns: 0,
          behavior: p.behavior,
        }).definition
        const glass = new MeshPhysicalMaterial({
          transmission: 0.92,
          metalness: 0,
          roughness: 0.08,
        })
        const opaque = new MeshStandardMaterial()
        const adapter = createCloudwayScrollAdapter({
          source: root,
          platform,
          materials: CLOUDWAY_LAB_SCROLL_MATERIAL_BINDINGS.map((binding) => ({
            ...binding,
            material: binding.kind === 'glass' ? glass : opaque,
          })),
        })
        adapter.update({
          id: platform.id,
          offset: { x: 0, y: 0, z: 0 },
          phase: 'extended',
          phaseProgress: 0,
          collisionEnabled: true,
          lengthRatio: 1,
        })
        measured = adapter.getLiveBounds()
        cleanup = () => {
          adapter.dispose()
          glass.dispose()
          opaque.dispose()
        }
      } else {
        root.updateMatrixWorld(true)
        measured = new Box3().setFromObject(root)
      }
      const envelope = PROCEDURAL_VISUAL_ENVELOPES[profileId]
      for (const axis of ['x', 'y', 'z'] as const) {
        const suffix = axis.toUpperCase() as 'X' | 'Y' | 'Z'
        expect(
          measured.min[axis],
          `${path} ${hash} min${suffix}`,
        ).toBeGreaterThanOrEqual(envelope[`min${suffix}`] - 0.000001)
        expect(
          measured.max[axis],
          `${path} ${hash} max${suffix}`,
        ).toBeLessThanOrEqual(envelope[`max${suffix}`] + 0.000001)
      }
      cleanup()
      disposeObject(scene)
      for (const mesh of hidden) disposeObject(mesh)
    },
  )
})
