// Merc skinning regression — cached shadow frames must present the current authored pose.

import { readFile } from 'node:fs/promises'
import type { BufferGeometry, Object3D } from 'three'
import { Matrix4, SkinnedMesh } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { WebGLObjects } from 'three/src/renderers/webgl/WebGLObjects.js'
import { afterEach, expect, it, vi } from 'vitest'
import { GLASS_GAME_ASSET_FILES } from '../browser/assets'
import { GLASSWORKS } from '../content/glassworks'
import { FLOATING_MUSEUM_JOURNEY } from '../content/museum-journey'
import { createGlassGame } from '../core/game'
import { createJourneyMerc } from '../journey/merc'
import { disposeObject } from './dispose'
import { loadAdventureMerc } from './merc'
import { createShadowUpdateCadence } from './render-quality'

afterEach(() => vi.restoreAllMocks())

async function actualMerc() {
  const bytes = await readFile(
    new URL(
      `../../../../apps/beside-cue/public/games/${GLASS_GAME_ASSET_FILES.merc}`,
      import.meta.url,
    ),
  )
  return new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  )
}

/** Exercise Three's real object/skeleton cache without requiring GPU rasterization. */
function renderSkin(root: Object3D, interval: 1 | 2 | 4) {
  const meshes: SkinnedMesh[] = []
  root.traverse((object) => {
    if (object instanceof SkinnedMesh) meshes.push(object)
  })
  const info = { render: { frame: 0 } }
  type Dependencies = ConstructorParameters<typeof WebGLObjects>
  const objects = new WebGLObjects(
    {} as Dependencies[0],
    {
      get: (_object: Object3D, geometry: BufferGeometry) => geometry,
      update: () => undefined,
    } as unknown as Dependencies[1],
    {} as Dependencies[2],
    {} as Dependencies[3],
    info as Dependencies[4],
  )
  const cadence = createShadowUpdateCadence(interval)
  return () => {
    root.updateMatrixWorld(true)
    // WebGLRenderer projects objects before incrementing its frame ID, then
    // the optional shadow pass visits objects using that incremented ID.
    meshes.forEach((mesh) => objects.update(mesh))
    info.render.frame++
    if (cadence.next()) meshes.forEach((mesh) => objects.update(mesh))
    for (const skeleton of new Set(meshes.map((mesh) => mesh.skeleton))) {
      const actual = skeleton.boneMatrices
      if (actual === null)
        throw new Error('The live Merc skeleton has no bone palette')
      const expected = new Float32Array(actual.length)
      const matrix = new Matrix4()
      skeleton.bones.forEach((bone, index) => {
        matrix.multiplyMatrices(bone.matrixWorld, skeleton.boneInverses[index]!)
        matrix.toArray(expected, index * 16)
      })
      expect(Array.from(actual)).toEqual(Array.from(expected))
    }
  }
}

it.each([1, 2, 4] as const)(
  'presents the current walking Merc pose with shadows every %i frames',
  async (interval) => {
    vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockResolvedValueOnce(
      await actualMerc(),
    )
    const merc = await loadAdventureMerc('local-merc.glb')
    const snapshot = createGlassGame(GLASSWORKS).snapshot()
    snapshot.player.velocity.z = -1.15
    const render = renderSkin(merc.root, interval)
    try {
      for (let frame = 0; frame < 12; frame++) {
        snapshot.elapsedSeconds += 1 / 60
        snapshot.player.position.z -= 1.15 / 60
        merc.update(snapshot, 1 / 60, false)
        render()
      }
    } finally {
      merc.dispose()
    }
  },
)

it.each([1, 2, 4] as const)(
  'presents the current museum Merc pose with shadows every %i frames',
  async (interval) => {
    const gltf = await actualMerc()
    const merc = createJourneyMerc(
      { ...gltf, dispose: () => disposeObject(gltf.scene) },
      FLOATING_MUSEUM_JOURNEY.stages[0]!,
    )
    merc.setTarget(FLOATING_MUSEUM_JOURNEY.stages[1]!, false)
    const render = renderSkin(merc.root, interval)
    try {
      for (let frame = 0; frame < 12; frame++) {
        merc.update(1 / 60, false)
        render()
      }
    } finally {
      merc.dispose()
    }
  },
)
