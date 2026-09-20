// Required asset readiness — downloads start together and failures never reveal fallback museum proxies.

import { Group, MeshPhysicalMaterial, Texture, TextureLoader } from 'three'
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { afterEach, expect, it, vi } from 'vitest'
import { GLASSWORKS } from '../content/glassworks'
import type { LevelDefinition } from '../contracts'
import { loadMuseumAssets, RequiredMuseumAssetError } from './asset-kit'
import { MUSEUM_MATERIAL_CATALOG } from './catalog'
import type { MuseumMaterials } from './materials'
import type { createMuseum } from './museum'

function levelWithRequiredVisual(): LevelDefinition {
  return {
    ...GLASSWORKS,
    id: 'required-asset-fixture',
    platforms: [],
    breakables: [],
    presentation: {
      worldBounds: {
        minX: -2,
        maxX: 2,
        minY: -1,
        maxY: 4,
        minZ: -2,
        maxZ: 2,
      },
      lightBounds: {
        minX: -2,
        maxX: 2,
        minY: -1,
        maxY: 4,
        minZ: -2,
        maxZ: 2,
      },
      rooms: [],
      audioRegions: [],
      visuals: [
        {
          id: 'required-window',
          recipeId: 'museum-window-v4',
          position: { x: 0, y: 0, z: 0 },
          yaw: 0,
        },
      ],
      assetRecipeIds: [],
    },
  }
}

function materials(): MuseumMaterials {
  return Object.fromEntries(
    Object.keys(MUSEUM_MATERIAL_CATALOG).map((id) => [
      id,
      new MeshPhysicalMaterial(),
    ]),
  ) as MuseumMaterials
}

function gltf(scene = new Group()): GLTF {
  return { scene, animations: [] } as unknown as GLTF
}

type LoadedTexture = Awaited<ReturnType<TextureLoader['loadAsync']>>

function texture(): LoadedTexture {
  return new Texture() as LoadedTexture
}

function museum(setKit = vi.fn()) {
  return { setKit } as unknown as ReturnType<typeof createMuseum>
}

afterEach(() => {
  vi.restoreAllMocks()
})

it('starts bundle and texture downloads together but rejects before installation when a material texture fails', async () => {
  const textureLoad = vi
    .spyOn(TextureLoader.prototype, 'loadAsync')
    .mockImplementation(async (url) => {
      if (String(url).includes('warm-carrara-normal'))
        throw new Error('normal map unavailable')
      return texture()
    })
  const bundleLoad = vi
    .spyOn(GLTFLoader.prototype, 'loadAsync')
    .mockResolvedValue(gltf())
  const setKit = vi.fn()
  const onError = vi.fn()

  const pending = loadMuseumAssets(
    levelWithRequiredVisual(),
    (id) => id,
    new Map(),
    museum(setKit),
    materials(),
    vi.fn(),
    () => false,
    onError,
  )

  expect(textureLoad).toHaveBeenCalled()
  expect(bundleLoad).toHaveBeenCalledWith('museum-window-v4')
  await expect(pending).rejects.toMatchObject({
    name: 'RequiredMuseumAssetError',
    assetId: 'warm-carrara-normal',
  })
  expect(setKit).not.toHaveBeenCalled()
  expect(onError).toHaveBeenCalledWith(
    'warm-carrara-normal',
    expect.any(RequiredMuseumAssetError),
  )
})

it('rejects a required bundle and an installation failure instead of resolving with proxies', async () => {
  vi.spyOn(TextureLoader.prototype, 'loadAsync').mockImplementation(async () =>
    texture(),
  )
  const bundleLoad = vi.spyOn(GLTFLoader.prototype, 'loadAsync')
  bundleLoad.mockRejectedValueOnce(new Error('window bundle unavailable'))

  await expect(
    loadMuseumAssets(
      levelWithRequiredVisual(),
      (id) => id,
      new Map(),
      museum(),
      materials(),
      vi.fn(),
      () => false,
    ),
  ).rejects.toMatchObject({
    name: 'RequiredMuseumAssetError',
    assetId: 'museum-window-v4',
  })

  bundleLoad.mockResolvedValueOnce(gltf())
  await expect(
    loadMuseumAssets(
      levelWithRequiredVisual(),
      (id) => id,
      new Map(),
      museum(
        vi.fn(() => {
          throw new Error('authored window node missing')
        }),
      ),
      materials(),
      vi.fn(),
      () => false,
    ),
  ).rejects.toMatchObject({
    name: 'RequiredMuseumAssetError',
    assetId: 'museum-window-v4',
  })
})

it('rejects a GLB that resolves after its loading manager reports a missing dependency', async () => {
  vi.spyOn(TextureLoader.prototype, 'loadAsync').mockImplementation(async () =>
    texture(),
  )
  vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockImplementationOnce(
    async function (this: GLTFLoader) {
      this.manager.itemError('museum-window-basecolor.jpg')
      return gltf()
    },
  )

  await expect(
    loadMuseumAssets(
      levelWithRequiredVisual(),
      (id) => id,
      new Map(),
      museum(),
      materials(),
      vi.fn(),
      () => false,
    ),
  ).rejects.toMatchObject({
    name: 'RequiredMuseumAssetError',
    assetId: 'museum-window-v4',
  })
})

it('disposes a late required texture without installing it after teardown', async () => {
  let resolveSky: ((texture: LoadedTexture) => void) | undefined
  const lateSky = texture()
  const disposed = vi.fn()
  lateSky.addEventListener('dispose', disposed)
  vi.spyOn(TextureLoader.prototype, 'loadAsync').mockImplementation(
    async (url) => {
      if (url === 'museum-sky')
        return new Promise<LoadedTexture>((resolve) => {
          resolveSky = resolve
        })
      return texture()
    },
  )
  vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockResolvedValue(gltf())
  let unavailable = false
  const setSky = vi.fn()
  const pending = loadMuseumAssets(
    levelWithRequiredVisual(),
    (id) => id,
    new Map(),
    museum(),
    materials(),
    setSky,
    () => unavailable,
  )

  unavailable = true
  resolveSky?.(lateSky)
  await expect(pending).resolves.toBeUndefined()
  expect(setSky).not.toHaveBeenCalled()
  expect(disposed).toHaveBeenCalledTimes(1)
})
