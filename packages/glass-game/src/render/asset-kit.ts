// ============================================================
// Museum asset adapter — host URLs become renderer-owned geometry and textures.
// ============================================================

import type { Object3D, Texture } from 'three'
import { TextureLoader } from 'three'
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
  const loadBundle = async (
    id: string,
    use: (scene: Object3D, resolvedBundle: string) => void,
  ) => {
    let scene: Object3D | undefined
    let resolvedBundle = sceneRecipe.preferredBundles?.[id] ?? id
    try {
      const preferred = sceneRecipe.preferredBundles?.[id]
      try {
        scene = (await new GLTFLoader().loadAsync(assetUrl(preferred ?? id)))
          .scene
      } catch (error) {
        if (preferred === undefined) throw error
        if (!disposed()) onError?.(preferred, error)
        resolvedBundle = id
        scene = (await new GLTFLoader().loadAsync(assetUrl(id))).scene
      }
      if (!disposed()) use(scene, resolvedBundle)
    } catch (error) {
      if (!disposed()) onError?.(id, error)
    } finally {
      if (scene) disposeObject(scene)
    }
  }
  const loadTexture = async (
    recipe: TextureRecipe,
    use: (texture: Awaited<ReturnType<TextureLoader['loadAsync']>>) => void,
  ) => {
    try {
      const texture = await new TextureLoader().loadAsync(
        assetUrl(recipe.asset),
      )
      configureTexture(texture, recipe)
      if (disposed()) texture.dispose()
      else use(texture)
    } catch (error) {
      if (!disposed()) onError?.(recipe.asset, error)
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
      let prepared: ReturnType<typeof prepareExhibitAsset>
      try {
        prepared = prepareExhibitAsset(
          scene,
          recipe,
          resolvedBundle,
          vessel.materialLibrary,
        )
      } catch (error) {
        if (!disposed()) onError?.(resolvedBundle, error)
        continue
      }
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
  await Promise.all(
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
  if (disposed()) return
  await Promise.all([
    ...(sceneRecipe.skyTexture !== undefined
      ? [
          loadTexture(
            {
              asset: sceneRecipe.skyTexture,
              interpretation: 'color',
              flipY: true,
            },
            setSky,
          ),
        ]
      : []),
    ...[...bundles].map((bundle) =>
      loadBundle(bundle, (scene, resolvedBundle) => {
        museum.setKit(scene, bundle)
        installTargets(scene, bundle, resolvedBundle)
      }),
    ),
    ...[...portraitTextures].map((id) =>
      loadTexture({ asset: id, interpretation: 'color' }, (texture) => {
        for (const target of level.breakables)
          if (getBreakableRenderRecipe(target.variant).portraitTexture === id)
            vessels.get(target.id)?.setPortrait(texture.clone())
        texture.dispose()
      }),
    ),
  ])
}
