// ============================================================
// Render catalog — new exhibits and platform skins are data, not loader branches.
// ============================================================

import { CLOUDWAY_PLATFORM_BUNDLE_ID, CLOUDWAY_PLATFORM_NODES, CLOUDWAY_PLATFORM_RENDER_IDS, } from './cloudway-catalog'
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
  /** Separate art plane that remains after only the protective glazing breaks. */
  persistentPortrait?: {
    width: number
    height: number
    centerY: number
    z: number
  }
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

function collectedPortrait(portraitTexture: string): BreakableRenderRecipe {
  return {
    ...CLEAR_GLASS,
    bundle: 'legend-slab',
    intactNode: 'legend_cash_intact',
    shardPrefix: 'legend_cash_shard_',
    shardCount: 16,
    persistentPrefix: 'legend_cash_frame_',
    displayHeight: 0.84,
    fallbackShape: 'slab',
    portraitTexture,
    portraitMaterial: 'legend_portrait',
    persistentPortrait: { width: 0.58, height: 0.78, centerY: 0.42, z: 0.032 },
    faceAnchor: true,
    fragmentBudget: 18,
  }
}

export const BREAKABLE_RENDER_CATALOG: Readonly<
  Record<string, BreakableRenderRecipe>
> = {
  'portrait-awakened-muse': collectedPortrait('painting-portrait-v5'),
  'portrait-interval': collectedPortrait('painting-interval-v6'),
  'portrait-wave-keeper': collectedPortrait('painting-wave-keeper-v7'),
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
  'amber-v6': {
    ...CLEAR_GLASS,
    bundle: 'amber-v6',
    intactNode: 'breakable_l2_low_amber_urn_intact',
    shardPrefix: 'breakable_l2_low_amber_urn_shard_',
    shardCount: 16,
    displayHeight: 0.72,
    fallbackShape: 'rounded',
    fragmentBudget: 16,
  },
  'opaline-v6': {
    ...CLEAR_GLASS,
    bundle: 'opaline-v6',
    intactNode: 'breakable_l2_opaline_echo_amphora_intact',
    shardPrefix: 'breakable_l2_opaline_echo_amphora_shard_',
    shardCount: 18,
    displayHeight: 0.92,
    fallbackShape: 'rounded',
    fragmentBudget: 18,
  },
  'celadon-lark-decanter-fracture-v4': {
    ...CLEAR_GLASS,
    bundle: 'celadon-lark-decanter-fracture-v4',
    intactNode: 'breakable_l2_high_celadon_decanter_intact',
    shardPrefix: 'breakable_l2_high_celadon_decanter_shard_',
    shardCount: 18,
    displayHeight: 1.15,
    fallbackShape: 'rounded',
    fragmentBudget: 18,
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
  'archive-glazing-v5': {
    ...CLEAR_GLASS,
    bundle: 'legend-slab',
    intactNode: 'legend_cash_intact',
    shardPrefix: 'legend_cash_shard_',
    shardCount: 16,
    persistentPrefix: 'legend_cash_frame_',
    displayHeight: 0.84,
    fallbackShape: 'slab',
    portraitTexture: 'painting-archive-v5',
    portraitMaterial: 'legend_portrait',
    persistentPortrait: {
      width: 0.58,
      height: 0.78,
      centerY: 0.42,
      z: 0.032,
    },
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
  mirror: {
    color: 0xcbe4e3,
    roughness: 0.07,
    metalness: 1,
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
  [CLOUDWAY_PLATFORM_RENDER_IDS.marble]: {
    bundle: CLOUDWAY_PLATFORM_BUNDLE_ID,
    kitNode: CLOUDWAY_PLATFORM_NODES.marble,
    body: 'marble',
    outline: false,
    suspendedHull: false,
  },
  [CLOUDWAY_PLATFORM_RENDER_IDS.frost]: {
    bundle: CLOUDWAY_PLATFORM_BUNDLE_ID,
    kitNode: CLOUDWAY_PLATFORM_NODES.frost,
    body: 'teal',
    outline: false,
    suspendedHull: false,
  },
  [CLOUDWAY_PLATFORM_RENDER_IDS.glide]: {
    bundle: CLOUDWAY_PLATFORM_BUNDLE_ID,
    kitNode: CLOUDWAY_PLATFORM_NODES.glide,
    body: 'teal',
    outline: false,
    suspendedHull: false,
  },
  [CLOUDWAY_PLATFORM_RENDER_IDS.crackle]: {
    bundle: CLOUDWAY_PLATFORM_BUNDLE_ID,
    kitNode: CLOUDWAY_PLATFORM_NODES.crackleIntact,
    body: 'teal',
    outline: false,
    suspendedHull: false,
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
