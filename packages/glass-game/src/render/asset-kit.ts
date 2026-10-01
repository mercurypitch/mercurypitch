// ============================================================
// Museum asset adapter — host URLs become renderer-owned geometry and textures.
// ============================================================

import type { Object3D, Texture } from 'three'
import { TextureLoader } from 'three'
import type { LevelDefinition } from '../contracts'
import { createMuseumAssetLoadPlan } from './asset-load-plan'
import { resolveAssetProfileBundle } from './asset-profile-bundles'
import { loadProfiledAssetScene } from './asset-scene-loader'
import { releaseAssetImage } from './asset-texture-profile'
import { getBreakableRenderRecipe } from './catalog'
import { disposeObject } from './dispose'
import { prepareExhibitAsset } from './exhibit-asset'
import { createExhibitGeometryPool } from './exhibit-geometry-pool'
import { createKitInstance } from './kit-instance'
import type { MuseumMaterials } from './materials'
import type { createMuseum } from './museum'
import type { GlassAssetQualityProfile } from './render-quality'
import type { TextureRecipe } from './texture-recipe'
import { configureTexture } from './texture-recipe'
import type { createVessel } from './vessels'

export class RequiredMuseumAssetError extends Error {
  readonly assetId: string

  constructor(assetId: string, cause: unknown) {
    super(`Required museum asset "${assetId}" could not be prepared.`, {
      cause,
    })
    this.name = 'RequiredMuseumAssetError'
    this.assetId = assetId
  }
}

export interface MuseumAssetLoadOptions {
  /** Cancels abort-capable work and invalidates late results from one attempt. */
  readonly signal?: AbortSignal
  /** Bounds simultaneous compressed downloads and Meshopt decode work. */
  readonly maximumConcurrentBundleLoads?: number
  /** Resizes decoded images before installation and their first GPU upload. */
  readonly assetProfile?: GlassAssetQualityProfile
  /** Transfers decoded-image lifetime to the renderer before publication. */
  readonly onDecodedImage?: (image: TexImageSource) => void
}

const DEFAULT_MAXIMUM_CONCURRENT_BUNDLE_LOADS = 2

async function forEachConcurrent<T>(
  values: readonly T[],
  maximumConcurrent: number,
  signal: AbortSignal,
  work: (value: T) => Promise<void>,
): Promise<void> {
  let next = 0
  const worker = async () => {
    while (!signal.aborted) {
      const index = next++
      if (index >= values.length) return
      await work(values[index]!)
    }
  }
  const count = Math.min(values.length, maximumConcurrent)
  await Promise.all(Array.from({ length: count }, worker))
}

export async function loadMuseumAssets(
  level: LevelDefinition,
  assetUrl: (id: string) => string,
  vessels: Map<string, ReturnType<typeof createVessel>>,
  museum: ReturnType<typeof createMuseum>,
  materials: MuseumMaterials,
  setSky: (texture: Texture) => void,
  disposed: () => boolean,
  onError?: (id: string, error: unknown) => void,
  onInstalled?: (taskId: string) => void,
  options: MuseumAssetLoadOptions = {},
): Promise<void> {
  const plan = createMuseumAssetLoadPlan(level)
  const sceneRecipe = plan.sceneRecipe
  const attempt = new AbortController()
  const ownerSignal = options.signal
  const abortAttempt = () => attempt.abort(ownerSignal?.reason)
  ownerSignal?.addEventListener('abort', abortAttempt, { once: true })
  if (ownerSignal?.aborted === true) abortAttempt()
  const unavailable = () => disposed() || attempt.signal.aborted
  const maximumConcurrentBundleLoads = Math.max(
    1,
    Math.min(
      4,
      Math.floor(
        options.maximumConcurrentBundleLoads ??
          DEFAULT_MAXIMUM_CONCURRENT_BUNDLE_LOADS,
      ),
    ),
  )
  const completeUnit = (taskId: string) => {
    if (!unavailable()) onInstalled?.(taskId)
  }
  const failure = (id: string, error: unknown) => {
    if (error instanceof RequiredMuseumAssetError) return error
    const required = new RequiredMuseumAssetError(id, error)
    if (!unavailable()) onError?.(id, required)
    return required
  }
  const loadScene = (id: string) =>
    loadProfiledAssetScene(assetUrl(id), {
      signal: attempt.signal,
      assetProfile: options.assetProfile,
      onDecodedImage: options.onDecodedImage,
    })
  const loadBundle = async (
    id: string,
    beforeInstall: Promise<unknown>,
    use: (scene: Object3D, resolvedBundle: string) => void,
  ): Promise<boolean> => {
    let scene: Object3D | undefined
    const assetProfile = options.assetProfile ?? 'full'
    let resolvedBundle = resolveAssetProfileBundle(
      sceneRecipe.preferredBundles?.[id] ?? id,
      assetProfile,
    )
    try {
      const preferred = sceneRecipe.preferredBundles?.[id]
      try {
        const requested = resolveAssetProfileBundle(
          preferred ?? id,
          assetProfile,
        )
        scene = await loadScene(requested)
      } catch (error) {
        if (preferred === undefined) throw error
        if (unavailable()) return false
        onError?.(preferred, error)
        // Catalogued legacy bundles are complete authored fallbacks. They may
        // replace a failed preferred revision; neither path reveals proxies.
        resolvedBundle = resolveAssetProfileBundle(id, assetProfile)
        scene = await loadScene(resolvedBundle)
      }
    } catch (error) {
      if (unavailable()) return false
      throw failure(id, error)
    }
    if (scene === undefined) return false
    try {
      await beforeInstall
      if (unavailable()) return false
      use(scene, resolvedBundle)
      return true
    } catch (error) {
      if (unavailable()) return false
      throw failure(resolvedBundle, error)
    } finally {
      disposeObject(scene)
    }
  }
  const loadTexture = async (
    recipe: TextureRecipe,
    use: (texture: Awaited<ReturnType<TextureLoader['loadAsync']>>) => void,
    beforeInstall: Promise<unknown> = Promise.resolve(),
  ): Promise<boolean> => {
    let texture: Awaited<ReturnType<TextureLoader['loadAsync']>> | undefined
    let decodedImage: TexImageSource | undefined
    let imageRegistered = false
    try {
      texture = await new TextureLoader().loadAsync(assetUrl(recipe.asset))
      decodedImage = texture.source.data as TexImageSource | undefined
      if (unavailable()) {
        if (decodedImage !== undefined) releaseAssetImage(decodedImage)
        texture.dispose()
        return false
      }
      if (decodedImage !== undefined && options.onDecodedImage !== undefined) {
        options.onDecodedImage(decodedImage)
        imageRegistered = true
      }
      configureTexture(texture, recipe)
      await beforeInstall
      if (unavailable()) {
        texture.dispose()
        return false
      }
      use(texture)
      texture = undefined
      return true
    } catch (error) {
      texture?.dispose()
      if (decodedImage !== undefined && !imageRegistered)
        releaseAssetImage(decodedImage)
      if (unavailable()) return false
      throw failure(recipe.asset, error)
    }
  }
  const installTargets = (
    scene: Object3D,
    bundle: string,
    resolvedBundle: string,
  ) => {
    let pool: ReturnType<typeof createExhibitGeometryPool> | undefined
    try {
      for (const target of level.breakables) {
        const recipe = getBreakableRenderRecipe(target.variant)
        if (recipe.bundle !== bundle || recipe.intactNode === undefined)
          continue
        const vessel = vessels.get(target.id)
        if (!vessel) continue
        // No vessel mutation until the full declared intact/fracture set is ready.
        const prepared =
          recipe.sharedGeometry === true
            ? (pool ??= createExhibitGeometryPool(
                scene,
                resolvedBundle,
              )).acquire(recipe, vessel.materialLibrary)
            : prepareExhibitAsset(
                scene,
                recipe,
                resolvedBundle,
                vessel.materialLibrary,
              )
        if ('release' in prepared) vessel.setGeometryLease(prepared)
        else
          vessel.setGeometry(
            prepared.geometry,
            prepared.pieces,
            prepared.materials,
          )
        if (recipe.persistentPrefix !== undefined)
          scene.traverse((node) => {
            if (
              !node.name.startsWith(recipe.persistentPrefix!) ||
              node.parent?.name.startsWith(recipe.persistentPrefix!) === true
            )
              return
            const part = createKitInstance(
              node,
              materials,
              {},
              vessel.materialLibrary,
            )
            part.applyMatrix4(prepared.transform)
            vessels.get(target.id)?.addPersistent(part)
          })
      }
    } finally {
      pool?.close()
    }
  }
  const materialLoads = new Map<string, Promise<boolean>[]>()
  for (const textureInstall of plan.materialTextures) {
    const pending = loadTexture(textureInstall.recipe, (texture) => {
      const material = materials[textureInstall.materialId]
      material[textureInstall.slot]?.dispose()
      material[textureInstall.slot] = texture
      material.needsUpdate = true
    })
    const group = materialLoads.get(textureInstall.taskId) ?? []
    group.push(pending)
    materialLoads.set(textureInstall.taskId, group)
  }
  const materialsReady = Promise.all(
    [...materialLoads].map(async ([taskId, pending]) => {
      if ((await Promise.all(pending)).every(Boolean)) completeUnit(taskId)
    }),
  )
  const decorationTexturesReady = Promise.all(
    plan.decorationTextures.map(async (id) => {
      const installed = await loadTexture(
        { asset: id, interpretation: 'color' },
        (texture) => museum.setDecorationTexture(id, texture),
      )
      if (installed) completeUnit(`decoration-texture:${id}`)
    }),
  )
  const decorationSurfacesReady = Promise.all([
    materialsReady,
    decorationTexturesReady,
  ])
  // A surface may reject while bundles are still downloading. Their install
  // awaits attach later; keep this shared prerequisite owned in the meantime.
  // The original rejection still propagates through materialsReady below.
  void decorationSurfacesReady.catch(() => undefined)
  const bundlesReady = forEachConcurrent(
    plan.bundles,
    maximumConcurrentBundleLoads,
    attempt.signal,
    async (bundle) => {
      const installed = await loadBundle(
        bundle,
        decorationSurfacesReady,
        (scene, resolvedBundle) => {
          museum.setKit(scene, bundle)
          installTargets(scene, bundle, resolvedBundle)
        },
      )
      if (installed) completeUnit(`bundle:${bundle}`)
    },
  )
  const skyReady =
    plan.skyTexture === undefined
      ? Promise.resolve()
      : loadTexture(
          {
            asset: plan.skyTexture,
            interpretation: 'color',
            flipY: true,
          },
          setSky,
        ).then((installed) => {
          if (installed) completeUnit(`sky:${plan.skyTexture}`)
        })
  const portraitLoads = plan.portraitTextures.map(async (id) => {
    const installed = await loadTexture(
      { asset: id, interpretation: 'color' },
      (texture) => {
        for (const target of level.breakables)
          if (getBreakableRenderRecipe(target.variant).portraitTexture === id)
            vessels.get(target.id)?.setPortrait(texture.clone())
        texture.dispose()
      },
      bundlesReady,
    )
    if (installed) completeUnit(`portrait:${id}`)
  })
  try {
    await Promise.all([
      materialsReady,
      decorationTexturesReady,
      bundlesReady,
      skyReady,
      ...portraitLoads,
    ])
  } catch (error) {
    attempt.abort(error)
    if (ownerSignal?.aborted === true || disposed()) return
    throw error
  } finally {
    ownerSignal?.removeEventListener('abort', abortAttempt)
  }
}
