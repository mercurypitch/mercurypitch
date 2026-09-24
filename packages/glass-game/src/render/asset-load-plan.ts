// ============================================================
// Museum asset load plan — declare stable logical install units before loading starts.
// ============================================================

import type { LevelDefinition } from '../contracts'
import { getBreakableRenderRecipe, getPlatformRenderRecipe, MUSEUM_MATERIAL_CATALOG, } from './catalog'
import { getRoomDecorationRecipe, roomDecorationTextureAssets, } from './room-decoration-catalog'
import type { MuseumSceneRecipe } from './scene-catalog'
import { getMuseumSceneRecipe, getMuseumVisualRecipe } from './scene-catalog'
import type { SurfaceTextureSlot, TextureRecipe } from './texture-recipe'

export interface MuseumMaterialTextureInstall {
  readonly materialId: string
  readonly slot: SurfaceTextureSlot
  readonly recipe: TextureRecipe
  readonly taskId: string
}

export interface MuseumAssetLoadPlan {
  readonly sceneRecipe: MuseumSceneRecipe
  readonly materialTextures: readonly MuseumMaterialTextureInstall[]
  readonly decorationTextures: readonly string[]
  readonly bundles: readonly string[]
  readonly skyTexture?: string
  readonly portraitTextures: readonly string[]
  readonly taskIds: readonly string[]
}

function unique(values: Iterable<string>): string[] {
  return [...new Set(values)]
}

export function createMuseumAssetLoadPlan(
  level: LevelDefinition,
): MuseumAssetLoadPlan {
  const sceneRecipe = getMuseumSceneRecipe(level)
  const materialTextures = Object.entries(MUSEUM_MATERIAL_CATALOG).flatMap(
    ([materialId, materialRecipe]) =>
      Object.entries(materialRecipe.textures ?? {}).map(([slot, recipe]) => ({
        materialId,
        slot: slot as SurfaceTextureSlot,
        recipe,
        taskId: `material:${recipe.asset}`,
      })),
  )
  const bundles = new Set<string>([
    ...sceneRecipe.kitDecorations.map((item) => item.bundle),
    ...(sceneRecipe.platformDecorations ?? []).map((item) => item.bundle),
    ...(level.presentation?.visuals ?? []).map(
      (visual) => getMuseumVisualRecipe(visual.recipeId).bundle,
    ),
    ...(level.presentation?.decorations ?? []).map(
      (decoration) => getRoomDecorationRecipe(decoration.recipeId).bundle,
    ),
  ])
  const decorationTextures = new Set(
    (level.presentation?.decorations ?? []).flatMap((decoration) =>
      roomDecorationTextureAssets(getRoomDecorationRecipe(decoration.recipeId)),
    ),
  )
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

  const bundleIds = [...bundles]
  const decorationTextureIds = [...decorationTextures]
  const portraitTextureIds = [...portraitTextures]
  const taskIds = unique([
    ...materialTextures.map((texture) => texture.taskId),
    ...decorationTextureIds.map((id) => `decoration-texture:${id}`),
    ...bundleIds.map((id) => `bundle:${id}`),
    ...(sceneRecipe.skyTexture === undefined
      ? []
      : [`sky:${sceneRecipe.skyTexture}`]),
    ...portraitTextureIds.map((id) => `portrait:${id}`),
  ])

  return {
    sceneRecipe,
    materialTextures,
    decorationTextures: decorationTextureIds,
    bundles: bundleIds,
    skyTexture: sceneRecipe.skyTexture,
    portraitTextures: portraitTextureIds,
    taskIds,
  }
}
