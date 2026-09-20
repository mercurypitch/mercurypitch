// ============================================================
// Museum asset adapter — host URLs become renderer-owned geometry and textures.
// ============================================================

import type { Object3D, Texture } from 'three'
import { LoadingManager, TextureLoader } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import type { LevelDefinition } from '../contracts'
import { getBreakableRenderRecipe, getPlatformRenderRecipe, MUSEUM_MATERIAL_CATALOG, } from './catalog'
import { disposeObject } from './dispose'
import { prepareExhibitAsset } from './exhibit-asset'
import { createKitInstance } from './kit-instance'
import type { MuseumMaterials } from './materials'
import type { createMuseum } from './museum'
import { getMuseumSceneRecipe, getMuseumVisualRecipe } from './scene-catalog'
import type { SurfaceTextureSlot, TextureRecipe } from './texture-recipe'
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

export async function loadMuseumAssets(
  level: LevelDefinition,
  assetUrl: (id: string) => string,
  vessels: Map<string, ReturnType<typeof createVessel>>,
  museum: ReturnType<typeof createMuseum>,
  materials: MuseumMaterials,
  setSky: (texture: Texture) => void,
  disposed: () => boolean,
  onError?: (id: string, error: unknown) => void,
): Promise<void> {
  const sceneRecipe = getMuseumSceneRecipe(level)
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
    const scene = (await new GLTFLoader(manager).loadAsync(assetUrl(id))).scene
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
  ) => {
    let scene: Object3D | undefined
    let resolvedBundle = sceneRecipe.preferredBundles?.[id] ?? id
    try {
      const preferred = sceneRecipe.preferredBundles?.[id]
      try {
        scene = await loadScene(preferred ?? id)
      } catch (error) {
        if (preferred === undefined) throw error
        if (disposed()) return
        onError?.(preferred, error)
        // Catalogued legacy bundles are complete authored fallbacks. They may
        // replace a failed preferred revision; neither path reveals proxies.
        resolvedBundle = id
        scene = await loadScene(id)
      }
    } catch (error) {
      if (disposed()) return
      throw failure(id, error)
    }
    if (scene === undefined) return
    try {
      await beforeInstall
      if (!disposed()) use(scene, resolvedBundle)
    } catch (error) {
      if (disposed()) return
      throw failure(resolvedBundle, error)
    } finally {
      disposeObject(scene)
    }
  }
  const loadTexture = async (
    recipe: TextureRecipe,
    use: (texture: Awaited<ReturnType<TextureLoader['loadAsync']>>) => void,
    beforeInstall: Promise<unknown> = Promise.resolve(),
  ) => {
    let texture: Awaited<ReturnType<TextureLoader['loadAsync']>> | undefined
    try {
      texture = await new TextureLoader().loadAsync(assetUrl(recipe.asset))
      configureTexture(texture, recipe)
      await beforeInstall
      if (disposed()) {
        texture.dispose()
        return
      }
      use(texture)
      texture = undefined
    } catch (error) {
      texture?.dispose()
      if (disposed()) return
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
  const bundles = new Set<string>([
    ...sceneRecipe.kitDecorations.map((item) => item.bundle),
    ...(sceneRecipe.platformDecorations ?? []).map((item) => item.bundle),
    ...(level.presentation?.visuals ?? []).map(
      (visual) => getMuseumVisualRecipe(visual.recipeId).bundle,
    ),
  ])
  const portraitTextures = new Set<string>()
  for (const target of level.breakables) {
    const recipe = getBreakableRenderRecipe(target.variant)
    if (recipe.bundle !== undefined) bundles.add(recipe.bundle)
    if (recipe.portraitTexture !== undefined)
      portraitTextures.add(recipe.portraitTexture)
  }
  for (const platform of level.platforms) {
    const recipe = getPlatformRenderRecipe(platform.renderId ?? platform.kind)
    if (recipe.bundle !== undefined) bundles.add(recipe.bundle)
  }
  const materialsReady = Promise.all(
    Object.entries(MUSEUM_MATERIAL_CATALOG).flatMap(([id, recipe]) =>
      Object.entries(recipe.textures ?? {}).map(([slot, textureRecipe]) =>
        loadTexture(textureRecipe, (texture) => {
          const key = slot as SurfaceTextureSlot
          materials[id][key]?.dispose()
          materials[id][key] = texture
          materials[id].needsUpdate = true
        }),
      ),
    ),
  )
  const bundleLoads = [...bundles].map((bundle) =>
    loadBundle(bundle, materialsReady, (scene, resolvedBundle) => {
      museum.setKit(scene, bundle)
      installTargets(scene, bundle, resolvedBundle)
    }),
  )
  const bundlesReady = Promise.all(bundleLoads)
  const skyReady =
    sceneRecipe.skyTexture === undefined
      ? Promise.resolve()
      : loadTexture(
          {
            asset: sceneRecipe.skyTexture,
            interpretation: 'color',
            flipY: true,
          },
          setSky,
        )
  const portraitLoads = [...portraitTextures].map((id) =>
    loadTexture(
      { asset: id, interpretation: 'color' },
      (texture) => {
        for (const target of level.breakables)
          if (getBreakableRenderRecipe(target.variant).portraitTexture === id)
            vessels.get(target.id)?.setPortrait(texture.clone())
        texture.dispose()
      },
      bundlesReady,
    ),
  )
  await Promise.all([materialsReady, bundlesReady, skyReady, ...portraitLoads])
}
