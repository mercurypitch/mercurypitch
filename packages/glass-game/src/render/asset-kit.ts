// ============================================================
// Museum asset adapter — host URLs become renderer-owned geometry and textures.
// ============================================================

import type { Object3D, Texture } from 'three'
import { LoadingManager, TextureLoader } from 'three'
import type { MeshoptDecoder as MeshoptDecoderValue } from 'three/addons/libs/meshopt_decoder.module.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import type { LevelDefinition } from '../contracts'
import { createMuseumAssetLoadPlan } from './asset-load-plan'
import { getBreakableRenderRecipe } from './catalog'
import { disposeObject } from './dispose'
import { prepareExhibitAsset } from './exhibit-asset'
import { createKitInstance } from './kit-instance'
import type { MuseumMaterials } from './materials'
import type { createMuseum } from './museum'
import type { TextureRecipe } from './texture-recipe'
import { configureTexture } from './texture-recipe'
import type { createVessel } from './vessels'

type MeshoptDecoder = typeof MeshoptDecoderValue
type LoaderMeshoptDecoder = Pick<
  MeshoptDecoder,
  'decodeGltfBufferAsync' | 'supported'
>
type MeshoptDecodeArguments = Parameters<
  MeshoptDecoder['decodeGltfBufferAsync']
>

let decoderReady: Promise<MeshoptDecoder> | undefined

function loadMeshoptDecoder(): Promise<MeshoptDecoder> {
  decoderReady ??= import('three/addons/libs/meshopt_decoder.module.js')
    .then((module) => module.MeshoptDecoder)
    .catch((error: unknown) => {
      decoderReady = undefined
      throw error
    })
  return decoderReady
}

const lazyMeshoptDecoder = {
  supported: typeof WebAssembly !== 'undefined',
  decodeGltfBufferAsync: (...args: MeshoptDecodeArguments) => {
    return loadMeshoptDecoder().then((decoder) => {
      if (!decoder.supported)
        throw new Error('Meshopt decoding is unsupported in this runtime.')
      return decoder.decodeGltfBufferAsync(...args)
    })
  },
} satisfies LoaderMeshoptDecoder

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
): Promise<void> {
  const plan = createMuseumAssetLoadPlan(level)
  const sceneRecipe = plan.sceneRecipe
  const completeUnit = (taskId: string) => {
    if (!disposed()) onInstalled?.(taskId)
  }
  const failure = (id: string, error: unknown) => {
    if (error instanceof RequiredMuseumAssetError) return error
    const required = new RequiredMuseumAssetError(id, error)
    if (!disposed()) onError?.(id, required)
    return required
  }
  const loadScene = async (id: string) => {
    const failedDependencies: string[] = []
    const manager = new LoadingManager()
    manager.onError = (url) => failedDependencies.push(url)
    const scene = (
      await new GLTFLoader(manager)
        .setMeshoptDecoder(lazyMeshoptDecoder as MeshoptDecoder)
        .loadAsync(assetUrl(id))
    ).scene
    if (failedDependencies.length === 0) return scene
    disposeObject(scene)
    throw new Error(
      `GLB "${id}" has unavailable dependencies: ${failedDependencies.join(', ')}`,
    )
  }
  const loadBundle = async (
    id: string,
    beforeInstall: Promise<unknown>,
    use: (scene: Object3D, resolvedBundle: string) => void,
  ): Promise<boolean> => {
    let scene: Object3D | undefined
    let resolvedBundle = sceneRecipe.preferredBundles?.[id] ?? id
    try {
      const preferred = sceneRecipe.preferredBundles?.[id]
      try {
        scene = await loadScene(preferred ?? id)
      } catch (error) {
        if (preferred === undefined) throw error
        if (disposed()) return false
        onError?.(preferred, error)
        // Catalogued legacy bundles are complete authored fallbacks. They may
        // replace a failed preferred revision; neither path reveals proxies.
        resolvedBundle = id
        scene = await loadScene(id)
      }
    } catch (error) {
      if (disposed()) return false
      throw failure(id, error)
    }
    if (scene === undefined) return false
    try {
      await beforeInstall
      if (disposed()) return false
      use(scene, resolvedBundle)
      return true
    } catch (error) {
      if (disposed()) return false
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
    try {
      texture = await new TextureLoader().loadAsync(assetUrl(recipe.asset))
      configureTexture(texture, recipe)
      await beforeInstall
      if (disposed()) {
        texture.dispose()
        return false
      }
      use(texture)
      texture = undefined
      return true
    } catch (error) {
      texture?.dispose()
      if (disposed()) return false
      throw failure(recipe.asset, error)
    }
  }
  const installTargets = (
    scene: Object3D,
    bundle: string,
    resolvedBundle: string,
  ) => {
    for (const target of level.breakables) {
      const recipe = getBreakableRenderRecipe(target.variant)
      if (recipe.bundle !== bundle || recipe.intactNode === undefined) continue
      const vessel = vessels.get(target.id)
      if (!vessel) continue
      // No vessel mutation until the full declared intact/fracture set is ready.
      const prepared = prepareExhibitAsset(
        scene,
        recipe,
        resolvedBundle,
        vessel.materialLibrary,
      )
      vessel.setGeometry(prepared.geometry, prepared.pieces, prepared.materials)
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
  const bundleLoads = plan.bundles.map(async (bundle) => {
    const installed = await loadBundle(
      bundle,
      decorationSurfacesReady,
      (scene, resolvedBundle) => {
        museum.setKit(scene, bundle)
        installTargets(scene, bundle, resolvedBundle)
      },
    )
    if (installed) completeUnit(`bundle:${bundle}`)
  })
  const bundlesReady = Promise.all(bundleLoads)
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
  await Promise.all([
    materialsReady,
    decorationTexturesReady,
    bundlesReady,
    skyReady,
    ...portraitLoads,
  ])
}
