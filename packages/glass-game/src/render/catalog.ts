// ============================================================
// Render catalog — new exhibits and platform skins are data, not loader branches.
// ============================================================

import type { SurfaceTextures } from './texture-recipe'

export interface BreakableRenderRecipe {
  bundle?: string
  intactNode?: string
  shardPrefix?: string
  shardCount: number
  /** A preferred bundle may contain a newer fracture than its legacy fallback. */
  bundleShardCounts?: Readonly<Record<string, number>>
  persistentPrefix?: string
  displayHeight: number
  tint: number
  roughness: number
  transmission: number
  thickness: number
  portraitTexture?: string
  portraitMaterial?: string
  faceAnchor?: boolean
  fallbackShape: 'goblet' | 'rounded' | 'fluted' | 'slab'
  fragmentBudget: number
}

const CLEAR_GLASS = {
  tint: 0xd9fff4,
  roughness: 0.025,
  transmission: 0.97,
  thickness: 0.025,
  fragmentBudget: 20,
}

export const BREAKABLE_RENDER_CATALOG: Readonly<
  Record<string, BreakableRenderRecipe>
> = {
  goblet: {
    ...CLEAR_GLASS,
    bundle: 'vessels',
    intactNode: 'goblet_laurel_intact',
    shardPrefix: 'goblet_laurel_shard_',
    shardCount: 23,
    displayHeight: 0.66,
    fallbackShape: 'goblet',
  },
  vase: {
    ...CLEAR_GLASS,
    bundle: 'vessels',
    intactNode: 'vase_rounded_intact',
    shardPrefix: 'vase_rounded_shard_',
    shardCount: 16,
    bundleShardCounts: { 'vessels-v2': 23 },
    persistentPrefix: 'vase_rounded_base',
    displayHeight: 0.62,
    fallbackShape: 'rounded',
  },
  fluted: {
    ...CLEAR_GLASS,
    bundle: 'glass-fluted-v3',
    intactNode: 'vase_fluted_intact',
    shardPrefix: 'vase_fluted_shard_',
    shardCount: 23,
    displayHeight: 0.76,
    fallbackShape: 'fluted',
  },
  amphora: {
    ...CLEAR_GLASS,
    bundle: 'glass-amphora-v3',
    intactNode: 'vase_amphora_intact',
    shardPrefix: 'vase_amphora_shard_',
    shardCount: 23,
    displayHeight: 0.75,
    fallbackShape: 'rounded',
  },
  coupe: {
    ...CLEAR_GLASS,
    bundle: 'glass-coupe-v3',
    intactNode: 'coupe_aurora_intact',
    shardPrefix: 'coupe_aurora_shard_',
    shardCount: 23,
    displayHeight: 0.52,
    fallbackShape: 'goblet',
  },
  decanter: {
    ...CLEAR_GLASS,
    bundle: 'glass-decanter-v3',
    intactNode: 'decanter_cut_intact',
    shardPrefix: 'decanter_cut_shard_',
    shardCount: 23,
    displayHeight: 0.62,
    fallbackShape: 'rounded',
  },
  portrait: {
    ...CLEAR_GLASS,
    bundle: 'legend-slab',
    intactNode: 'legend_cash_intact',
    shardPrefix: 'legend_cash_shard_',
    shardCount: 16,
    persistentPrefix: 'legend_cash_frame_',
    displayHeight: 0.84,
    fallbackShape: 'slab',
    portraitTexture: 'legend-johnny-cash',
    portraitMaterial: 'legend_portrait',
    faceAnchor: true,
    fragmentBudget: 18,
  },
}

export interface PlatformRenderRecipe {
  bundle?: string
  kitNode?: string
  body: string
  materialOverrides?: Readonly<Record<string, string>>
  outline: boolean
  suspendedHull: boolean
}

export interface MuseumMaterialRecipe {
  color: number
  roughness: number
  metalness: number
  textures?: SurfaceTextures
  transmission?: number
  thickness?: number
  iridescence?: number
  flatShading?: boolean
  normalStrength?: number
}

const stoneTextures = (id: string, repeat = 1 / 1.2): SurfaceTextures => ({
  map: {
    asset: `${id}-basecolor`,
    interpretation: 'color',
    wrap: 'repeat',
    repeat: [repeat, repeat],
  },
  normalMap: {
    asset: `${id}-normal`,
    interpretation: 'data',
    wrap: 'repeat',
    repeat: [repeat, repeat],
  },
  roughnessMap: {
    asset: `${id}-roughness`,
    interpretation: 'data',
    wrap: 'repeat',
    repeat: [repeat, repeat],
  },
})

export const MUSEUM_MATERIAL_CATALOG: Readonly<
  Record<string, MuseumMaterialRecipe>
> = {
  marble: {
    color: 0xffffff,
    roughness: 1,
    metalness: 0,
    normalStrength: 0.18,
    textures: stoneTextures('warm-carrara'),
  },
  teal: {
    color: 0xffffff,
    roughness: 0.3,
    metalness: 0,
    normalStrength: 0.18,
    textures: stoneTextures('verde-marble'),
  },
  limestone: {
    color: 0xffffff,
    roughness: 0.78,
    metalness: 0,
    normalStrength: 0.35,
    textures: stoneTextures('cream-limestone'),
  },
  gold: {
    color: 0xffffff,
    roughness: 0.4,
    metalness: 1,
    normalStrength: 0.08,
    textures: stoneTextures('brushed-brass', 4),
  },
  rock: { color: 0x69818b, roughness: 0.85, metalness: 0, flatShading: true },
  glass: {
    color: 0xcdf7f0,
    roughness: 0.06,
    metalness: 0,
    transmission: 0.92,
    thickness: 0.055,
    iridescence: 0.35,
  },
}

export const GLTF_MATERIAL_ALIASES: Readonly<Record<string, string>> = {
  museum_ivory: 'marble',
  museum_brass: 'gold',
  museum_petrol: 'teal',
  museum_obsidian: 'rock',
  museum_cyan: 'glass',
  museum_limestone: 'limestone',
  museum_glass: 'glass',
}

export const PLATFORM_RENDER_CATALOG: Readonly<
  Record<string, PlatformRenderRecipe>
> = {
  deck: {
    bundle: 'museum-kit',
    kitNode: 'platform_terrace',
    body: 'marble',
    outline: true,
    suspendedHull: true,
  },
  bridge: {
    bundle: 'museum-kit',
    kitNode: 'platform_bridge',
    body: 'marble',
    outline: true,
    suspendedHull: false,
  },
  catch: { body: 'teal', outline: false, suspendedHull: false },
  island: {
    bundle: 'museum-kit',
    kitNode: 'platform_island',
    body: 'marble',
    outline: true,
    suspendedHull: true,
  },
  ledge: {
    bundle: 'museum-kit',
    kitNode: 'platform_ledge',
    body: 'marble',
    outline: true,
    suspendedHull: true,
  },
  plinth: {
    bundle: 'museum-kit',
    kitNode: 'platform_plinth',
    body: 'teal',
    outline: true,
    suspendedHull: true,
  },
}

export function getBreakableRenderRecipe(id: string): BreakableRenderRecipe {
  const recipe = BREAKABLE_RENDER_CATALOG[id]
  if (recipe === undefined)
    throw new Error(
      `Unknown glass exhibit render recipe "${id}". Register it in render/catalog.ts.`,
    )
  return recipe
}

export function getPlatformRenderRecipe(id: string): PlatformRenderRecipe {
  const recipe = PLATFORM_RENDER_CATALOG[id]
  if (recipe === undefined)
    throw new Error(
      `Unknown museum platform render recipe "${id}". Register it in render/catalog.ts.`,
    )
  for (const material of [
    recipe.body,
    ...Object.values(recipe.materialOverrides ?? {}),
  ]) {
    if (MUSEUM_MATERIAL_CATALOG[material] === undefined)
      throw new Error(
        `Platform recipe "${id}" refers to unknown material "${material}".`,
      )
  }
  return recipe
}
