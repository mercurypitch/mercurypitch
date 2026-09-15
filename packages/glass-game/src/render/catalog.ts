// ============================================================
// Render catalog — new exhibits and platform skins are data, not loader branches.
// ============================================================

export interface BreakableRenderRecipe {
  bundle?: string
  intactNode?: string
  shardPrefix?: string
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
  goblet: { ...CLEAR_GLASS, displayHeight: 0.66, fallbackShape: 'goblet' },
  vase: {
    ...CLEAR_GLASS,
    bundle: 'vessels',
    intactNode: 'vase_rounded_intact',
    shardPrefix: 'vase_rounded_shard_',
    persistentPrefix: 'vase_rounded_base',
    displayHeight: 0.62,
    fallbackShape: 'rounded',
  },
  fluted: {
    ...CLEAR_GLASS,
    bundle: 'vessels',
    intactNode: 'vase_fluted_intact',
    shardPrefix: 'vase_fluted_shard_',
    persistentPrefix: 'vase_fluted_base',
    displayHeight: 0.76,
    fallbackShape: 'fluted',
  },
  amphora: {
    ...CLEAR_GLASS,
    bundle: 'vessels',
    intactNode: 'vase_amphora_intact',
    shardPrefix: 'vase_amphora_shard_',
    persistentPrefix: 'vase_amphora_base',
    displayHeight: 0.75,
    fallbackShape: 'rounded',
  },
  portrait: {
    ...CLEAR_GLASS,
    bundle: 'legend-slab',
    intactNode: 'legend_cash_intact',
    shardPrefix: 'legend_cash_shard_',
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
  texture?: string
  transmission?: number
  thickness?: number
  iridescence?: number
  flatShading?: boolean
}

export const MUSEUM_MATERIAL_CATALOG: Readonly<
  Record<string, MuseumMaterialRecipe>
> = {
  marble: {
    color: 0xe8e0cc,
    roughness: 0.28,
    metalness: 0.08,
    texture: 'floor-marble',
  },
  teal: { color: 0x155c68, roughness: 0.23, metalness: 0.42 },
  gold: { color: 0xdcb671, roughness: 0.24, metalness: 0.85 },
  rock: { color: 0x788f91, roughness: 0.85, metalness: 0, flatShading: true },
  glass: {
    color: 0xabe8e2,
    roughness: 0.09,
    metalness: 0.08,
    transmission: 0.88,
    thickness: 0.11,
    iridescence: 0.65,
  },
}

export const GLTF_MATERIAL_ALIASES: Readonly<Record<string, string>> = {
  museum_ivory: 'marble',
  museum_brass: 'gold',
  museum_petrol: 'teal',
  museum_obsidian: 'teal',
  museum_cyan: 'teal',
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
