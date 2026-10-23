// Required asset readiness — bounded downloads, cancellation and failures never reveal fallback museum proxies.

import { Group, MeshPhysicalMaterial, Texture, TextureLoader } from 'three'
import { afterEach, expect, it, vi } from 'vitest'
import { GLASSWORKS } from '../content/glassworks'
import type { LevelDefinition } from '../contracts'
import { loadMuseumAssets, RequiredMuseumAssetError } from './asset-kit'
import { createMuseumAssetLoadPlan } from './asset-load-plan'
import * as assetSceneLoader from './asset-scene-loader'
import { MUSEUM_MATERIAL_CATALOG } from './catalog'
import type { MuseumMaterials } from './materials'
import type { createMuseum } from './museum'
import { configureTexture } from './texture-recipe'

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

function levelWithRequiredDecoration(): LevelDefinition {
  const fixture = levelWithRequiredVisual()
  return {
    ...fixture,
    id: 'required-decoration-fixture',
    presentation: {
      ...fixture.presentation!,
      visuals: [],
      decorations: [
        {
          id: 'required-painting',
          roomId: 'required-room',
          recipeId: 'garden-painting-v5',
          position: { x: 0, y: 1.8, z: 0 },
          yaw: 0,
          scale: 1,
        },
      ],
      assetRecipeIds: ['garden-painting-v5'],
    },
  }
}

function levelWithTwoRequiredVisuals(): LevelDefinition {
  const fixture = levelWithRequiredVisual()
  return {
    ...fixture,
    id: 'two-required-assets-fixture',
    presentation: {
      ...fixture.presentation!,
      visuals: [
        ...fixture.presentation!.visuals!,
        {
          id: 'required-screen',
          recipeId: 'museum-screen-v4',
          position: { x: 1, y: 0, z: 0 },
          yaw: 0,
        },
      ],
    },
  }
}

function levelWithPreferredBundle(): LevelDefinition {
  const fixture = levelWithRequiredVisual()
  return {
    ...fixture,
    id: 'preferred-bundle-fixture',
    presentation: {
      ...fixture.presentation!,
      visuals: [
        {
          id: 'required-arch',
          recipeId: 'museum-arch',
          position: { x: 0, y: 0, z: 0 },
          yaw: 0,
        },
      ],
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

type LoadedTexture = Awaited<ReturnType<TextureLoader['loadAsync']>>

function texture(): LoadedTexture {
  return new Texture() as LoadedTexture
}

function museum(setKit = vi.fn(), setDecorationTexture = vi.fn()) {
  return { setKit, setDecorationTexture } as unknown as ReturnType<
    typeof createMuseum
  >
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it.each(['mobile', 'full'] as const)(
  'profiles catalog material images before ownership transfer for %s assets without changing sky sampling',
  async (assetProfile) => {
    const level = levelWithRequiredVisual()
    const plan = createMuseumAssetLoadPlan(level)
    const loaded = new Map<string, LoadedTexture>()
    const originals = new Map<string, TexImageSource & { close: () => void }>()
    const registered = vi.fn()
    vi.spyOn(TextureLoader.prototype, 'loadAsync').mockImplementation(
      async (url) => {
        const image = { width: 1024, height: 1024, close: vi.fn() }
        const result = new Texture(image) as unknown as LoadedTexture
        loaded.set(String(url), result)
        originals.set(
          String(url),
          image as unknown as TexImageSource & { close: () => void },
        )
        return result
      },
    )
    const resize = vi.fn(async (image: TexImageSource) => {
      const install = plan.materialTextures.find(
        ({ recipe }) => originals.get(recipe.asset) === image,
      )!
      const source = loaded.get(install.recipe.asset)!
      const expected = configureTexture(new Texture(), install.recipe)
      expect(source.flipY).toBe(expected.flipY)
      expect(source.colorSpace).toBe(expected.colorSpace)
      expect(source.repeat.toArray()).toEqual(expected.repeat.toArray())
      return { width: 512, height: 512, close: vi.fn() }
    })
    vi.stubGlobal('createImageBitmap', resize)
    vi.spyOn(assetSceneLoader, 'loadProfiledAssetScene').mockResolvedValue(
      new Group(),
    )
    const library = materials()
    const setSky = vi.fn()

    await loadMuseumAssets(
      level,
      (id) => id,
      new Map(),
      museum(),
      library,
      setSky,
      () => false,
      undefined,
      undefined,
      { assetProfile, onDecodedImage: registered },
    )

    expect(resize).toHaveBeenCalledTimes(assetProfile === 'mobile' ? 4 : 0)
    for (const install of plan.materialTextures) {
      const installed = library[install.materialId]![install.slot]!
      const original = originals.get(install.recipe.asset)!
      const expected = configureTexture(new Texture(), install.recipe)
      const capped =
        assetProfile === 'mobile' && install.slot === 'roughnessMap'
      expect(installed.image).toMatchObject({
        width: capped ? 512 : 1024,
        height: capped ? 512 : 1024,
      })
      expect(installed.image === original).toBe(!capped)
      expect(original.close).toHaveBeenCalledTimes(capped ? 1 : 0)
      expect(registered).toHaveBeenCalledWith(installed.image)
      if (capped) {
        expect(registered).not.toHaveBeenCalledWith(original)
        expect(
          (installed.image as { close: () => void }).close,
        ).not.toHaveBeenCalled()
      }
      expect(installed.flipY).toBe(expected.flipY)
      expect(installed.colorSpace).toBe(expected.colorSpace)
      expect(installed.wrapS).toBe(expected.wrapS)
      expect(installed.wrapT).toBe(expected.wrapT)
      expect(installed.repeat.toArray()).toEqual(expected.repeat.toArray())
      expect(installed.anisotropy).toBe(expected.anisotropy)
      expect(installed.channel).toBe(expected.channel)
    }
    const sky = loaded.get(plan.skyTexture!)!
    expect(setSky).toHaveBeenCalledWith(sky)
    expect(sky.image).toBe(originals.get(plan.skyTexture!))
    expect(sky.flipY).toBe(true)
  },
)

it.each(['abort', 'disposed'] as const)(
  'releases both images exactly once when %s teardown interrupts a catalog resize',
  async (teardown) => {
    const source = { width: 1024, height: 1024, close: vi.fn() }
    const replacement = { width: 512, height: 512, close: vi.fn() }
    const pendingTexture = new Texture(source) as unknown as LoadedTexture
    const disposed = vi.fn()
    pendingTexture.addEventListener('dispose', disposed)
    let finishResize: ((image: typeof replacement) => void) | undefined
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(
        () =>
          new Promise<typeof replacement>((resolve) => {
            finishResize = resolve
          }),
      ),
    )
    vi.spyOn(TextureLoader.prototype, 'loadAsync').mockImplementation(
      async (url) =>
        url === 'warm-carrara-roughness' ? pendingTexture : texture(),
    )
    vi.spyOn(assetSceneLoader, 'loadProfiledAssetScene').mockResolvedValue(
      new Group(),
    )
    const attempt = new AbortController()
    let unavailable = false
    const registered = vi.fn()
    const library = materials()
    const pending = loadMuseumAssets(
      levelWithRequiredVisual(),
      (id) => id,
      new Map(),
      museum(),
      library,
      vi.fn(),
      () => unavailable,
      undefined,
      undefined,
      {
        assetProfile: 'mobile',
        signal: attempt.signal,
        onDecodedImage: registered,
      },
    )

    await vi.waitFor(() => expect(finishResize).toBeTypeOf('function'))
    if (teardown === 'abort') attempt.abort()
    else unavailable = true
    finishResize?.(replacement)
    await expect(pending).resolves.toBeUndefined()

    expect(library.marble!.roughnessMap).toBeNull()
    expect(registered).not.toHaveBeenCalledWith(source)
    expect(registered).not.toHaveBeenCalledWith(replacement)
    expect(source.close).toHaveBeenCalledOnce()
    expect(replacement.close).toHaveBeenCalledOnce()
    expect(disposed).toHaveBeenCalledOnce()
  },
)

it('releases an unpublished portrait once when its bundle prerequisite rejects after catalog resizing', async () => {
  const portraitImage = { width: 1024, height: 1024, close: vi.fn() }
  const portrait = new Texture(portraitImage) as unknown as LoadedTexture
  const disposed = vi.fn()
  portrait.addEventListener('dispose', disposed)
  vi.spyOn(TextureLoader.prototype, 'loadAsync').mockImplementation(
    async (url) =>
      url === 'legend-johnny-cash'
        ? portrait
        : (new Texture({ width: 1024, height: 1024 }) as LoadedTexture),
  )
  const resize = vi.fn(async () => ({
    width: 512,
    height: 512,
    close: vi.fn(),
  }))
  vi.stubGlobal('createImageBitmap', resize)
  let rejectBundle: ((error: Error) => void) | undefined
  vi.spyOn(assetSceneLoader, 'loadProfiledAssetScene').mockImplementation(
    () =>
      new Promise<Group>((_resolve, reject) => {
        rejectBundle = reject
      }),
  )
  const fixture = levelWithRequiredVisual()
  const level = {
    ...fixture,
    presentation: { ...fixture.presentation!, visuals: [] },
    breakables: [{ ...GLASSWORKS.breakables[0]!, variant: 'portrait' }],
  }
  const setPortrait = vi.fn()
  const pending = loadMuseumAssets(
    level,
    (id) => id,
    new Map([
      [level.breakables[0]!.id, { setPortrait }],
    ]) as unknown as Parameters<typeof loadMuseumAssets>[2],
    museum(),
    materials(),
    vi.fn(),
    () => false,
    undefined,
    undefined,
    { assetProfile: 'mobile' },
  )
  const rejected = expect(pending).rejects.toMatchObject({
    name: 'RequiredMuseumAssetError',
    assetId: 'legend-slab',
  })
  await vi.waitFor(() => expect(resize).toHaveBeenCalledTimes(4))
  rejectBundle?.(new Error('portrait bundle unavailable'))
  await rejected
  await vi.waitFor(() => expect(portraitImage.close).toHaveBeenCalledOnce())

  expect(setPortrait).not.toHaveBeenCalled()
  expect(disposed).toHaveBeenCalledOnce()
})

it('releases the current resized image exactly once when material installation rejects', async () => {
  const source = { width: 1024, height: 1024, close: vi.fn() }
  const replacement = { width: 512, height: 512, close: vi.fn() }
  const rejectedTexture = new Texture(source) as unknown as LoadedTexture
  const disposed = vi.fn()
  rejectedTexture.addEventListener('dispose', disposed)
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async () => replacement),
  )
  vi.spyOn(TextureLoader.prototype, 'loadAsync').mockImplementation(
    async (url) =>
      url === 'warm-carrara-roughness' ? rejectedTexture : texture(),
  )
  vi.spyOn(assetSceneLoader, 'loadProfiledAssetScene').mockResolvedValue(
    new Group(),
  )
  const plan = createMuseumAssetLoadPlan(levelWithRequiredVisual())
  const target = plan.materialTextures.find(
    ({ recipe }) => recipe.asset === 'warm-carrara-roughness',
  )!
  const library = materials()
  Object.defineProperty(library[target.materialId], target.slot, {
    get: () => null,
    set: () => {
      throw new Error('material installation rejected')
    },
  })

  await expect(
    loadMuseumAssets(
      levelWithRequiredVisual(),
      (id) => id,
      new Map(),
      museum(),
      library,
      vi.fn(),
      () => false,
      undefined,
      undefined,
      { assetProfile: 'mobile' },
    ),
  ).rejects.toMatchObject({
    name: 'RequiredMuseumAssetError',
    assetId: target.recipe.asset,
  })

  expect(source.close).toHaveBeenCalledOnce()
  expect(rejectedTexture.image).toBe(replacement)
  expect(replacement.close).toHaveBeenCalledOnce()
  expect(disposed).toHaveBeenCalledOnce()
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
    .spyOn(assetSceneLoader, 'loadProfiledAssetScene')
    .mockResolvedValue(new Group())
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
  expect(bundleLoad).toHaveBeenCalledWith(
    'museum-window-v4',
    expect.objectContaining({ signal: expect.any(AbortSignal) }),
  )
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
  const bundleLoad = vi.spyOn(assetSceneLoader, 'loadProfiledAssetScene')
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

  bundleLoad.mockResolvedValueOnce(new Group())
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

it('loads a required painting before installing its decoration bundle', async () => {
  const order: string[] = []
  vi.spyOn(TextureLoader.prototype, 'loadAsync').mockImplementation(async () =>
    texture(),
  )
  vi.spyOn(assetSceneLoader, 'loadProfiledAssetScene').mockResolvedValue(
    new Group(),
  )
  const setKit = vi.fn((_: Group, bundle: string) => {
    if (bundle === 'museum-decor-v5') order.push('bundle')
  })
  const setDecorationTexture = vi.fn((id: string) => {
    if (id === 'painting-garden-v5') order.push('texture')
  })

  await loadMuseumAssets(
    levelWithRequiredDecoration(),
    (id) => id,
    new Map(),
    museum(setKit, setDecorationTexture),
    materials(),
    vi.fn(),
    () => false,
  )

  expect(setDecorationTexture).toHaveBeenCalledWith(
    'painting-garden-v5',
    expect.any(Texture),
  )
  expect(setKit).toHaveBeenCalledWith(expect.any(Group), 'museum-decor-v5')
  expect(order).toEqual(['texture', 'bundle'])
})

it('rejects a missing required painting without installing its bundle', async () => {
  vi.spyOn(TextureLoader.prototype, 'loadAsync').mockImplementation(
    async (url) => {
      if (url === 'painting-garden-v5') throw new Error('painting unavailable')
      return texture()
    },
  )
  vi.spyOn(assetSceneLoader, 'loadProfiledAssetScene').mockResolvedValue(
    new Group(),
  )
  const setKit = vi.fn()
  const setDecorationTexture = vi.fn()

  await expect(
    loadMuseumAssets(
      levelWithRequiredDecoration(),
      (id) => id,
      new Map(),
      museum(setKit, setDecorationTexture),
      materials(),
      vi.fn(),
      () => false,
    ),
  ).rejects.toMatchObject({
    name: 'RequiredMuseumAssetError',
    assetId: 'painting-garden-v5',
  })
  expect(setDecorationTexture).not.toHaveBeenCalled()
  expect(setKit).not.toHaveBeenCalledWith(expect.any(Group), 'museum-decor-v5')
})

it('propagates a profiled bundle dependency failure before installation', async () => {
  vi.spyOn(TextureLoader.prototype, 'loadAsync').mockImplementation(async () =>
    texture(),
  )
  vi.spyOn(assetSceneLoader, 'loadProfiledAssetScene').mockRejectedValueOnce(
    new Error(
      'Asset has unavailable dependencies: museum-window-basecolor.jpg',
    ),
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
  vi.spyOn(assetSceneLoader, 'loadProfiledAssetScene').mockResolvedValue(
    new Group(),
  )
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

it('declares one logical preferred/fallback bundle unit and completes it after installation', async () => {
  const level = levelWithPreferredBundle()
  const plan = createMuseumAssetLoadPlan(level)
  expect(new Set(plan.taskIds).size).toBe(plan.taskIds.length)
  expect(plan.taskIds).toContain('bundle:museum-kit')
  expect(plan.taskIds).not.toContain('bundle:museum-kit-v2')

  vi.spyOn(TextureLoader.prototype, 'loadAsync').mockImplementation(async () =>
    texture(),
  )
  const bundleLoad = vi
    .spyOn(assetSceneLoader, 'loadProfiledAssetScene')
    .mockImplementation(async (url) => {
      if (url === 'museum-kit-v2') throw new Error('preferred unavailable')
      return new Group()
    })
  const order: string[] = []
  const installed: string[] = []
  const setKit = vi.fn((_: Group, bundle: string) => {
    if (bundle === 'museum-kit') order.push('installed')
  })

  await loadMuseumAssets(
    level,
    (id) => id,
    new Map(),
    museum(setKit),
    materials(),
    vi.fn(),
    () => false,
    vi.fn(),
    (taskId) => {
      installed.push(taskId)
      if (taskId === 'bundle:museum-kit') order.push('completed')
    },
  )

  expect(bundleLoad).toHaveBeenCalledWith(
    'museum-kit-v2',
    expect.objectContaining({ signal: expect.any(AbortSignal) }),
  )
  expect(bundleLoad).toHaveBeenCalledWith(
    'museum-kit',
    expect.objectContaining({ signal: expect.any(AbortSignal) }),
  )
  expect(installed.filter((id) => id === 'bundle:museum-kit')).toHaveLength(1)
  expect(order).toEqual(['installed', 'completed'])
})

it('bounds required GLB work so one renderer attempt cannot decode every bundle together', async () => {
  vi.spyOn(TextureLoader.prototype, 'loadAsync').mockImplementation(async () =>
    texture(),
  )
  const releases: Array<() => void> = []
  let active = 0
  let maximumActive = 0
  const bundleLoad = vi
    .spyOn(assetSceneLoader, 'loadProfiledAssetScene')
    .mockImplementation(
      () =>
        new Promise<Group>((resolve) => {
          active++
          maximumActive = Math.max(maximumActive, active)
          releases.push(() => {
            active--
            resolve(new Group())
          })
        }),
    )

  const pending = loadMuseumAssets(
    levelWithTwoRequiredVisuals(),
    (id) => id,
    new Map(),
    museum(),
    materials(),
    vi.fn(),
    () => false,
    undefined,
    undefined,
    { maximumConcurrentBundleLoads: 1 },
  )

  await vi.waitFor(() => expect(bundleLoad).toHaveBeenCalledTimes(1))
  releases.shift()?.()
  await vi.waitFor(() => expect(bundleLoad).toHaveBeenCalledTimes(2))
  releases.shift()?.()
  await pending

  expect(maximumActive).toBe(1)
})

it('aborts the active GLB and never starts queued work after renderer teardown', async () => {
  vi.spyOn(TextureLoader.prototype, 'loadAsync').mockImplementation(async () =>
    texture(),
  )
  const bundleLoad = vi
    .spyOn(assetSceneLoader, 'loadProfiledAssetScene')
    .mockImplementation((_url, options) => {
      return new Promise<Group>((_resolve, reject) => {
        options.signal.addEventListener(
          'abort',
          () => reject(new DOMException('Aborted', 'AbortError')),
          { once: true },
        )
      })
    })
  const setKit = vi.fn()
  const attempt = new AbortController()
  const pending = loadMuseumAssets(
    levelWithTwoRequiredVisuals(),
    (id) => id,
    new Map(),
    museum(setKit),
    materials(),
    vi.fn(),
    () => false,
    undefined,
    undefined,
    { maximumConcurrentBundleLoads: 1, signal: attempt.signal },
  )

  await vi.waitFor(() => expect(bundleLoad).toHaveBeenCalledTimes(1))
  attempt.abort()
  await expect(pending).resolves.toBeUndefined()

  expect(bundleLoad).toHaveBeenCalledTimes(1)
  expect(setKit).not.toHaveBeenCalled()
})

it('invalidates a standalone texture request and releases its late decoded image', async () => {
  let resolveSky: ((texture: LoadedTexture) => void) | undefined
  const image = { close: vi.fn(), height: 64, width: 64 }
  const lateSky = new Texture(image) as unknown as LoadedTexture
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
  vi.spyOn(assetSceneLoader, 'loadProfiledAssetScene').mockResolvedValue(
    new Group(),
  )
  const attempt = new AbortController()
  const setSky = vi.fn()
  const pending = loadMuseumAssets(
    levelWithRequiredVisual(),
    (id) => id,
    new Map(),
    museum(),
    materials(),
    setSky,
    () => false,
    undefined,
    undefined,
    { signal: attempt.signal },
  )

  await vi.waitFor(() => expect(resolveSky).toBeTypeOf('function'))
  attempt.abort()
  resolveSky?.(lateSky)
  await expect(pending).resolves.toBeUndefined()

  expect(setSky).not.toHaveBeenCalled()
  expect(disposed).toHaveBeenCalledOnce()
  expect(image.close).toHaveBeenCalledOnce()
})
