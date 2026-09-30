// ============================================================
// Render catalog — new exhibits and platform skins are data, not loader branches.
// ============================================================

import { FROST_GOLD_ARCH_BUNDLE_IDS, FROST_GOLD_ARCH_NODES, FROST_GOLD_ARCH_PANE, } from '../content/frost-gold-arch-profile'
import { FROST_WALL_BUNDLE, FROST_WALL_PANE, } from '../content/frost-wall-profile'
import { LIVING_CRYSTAL_PLATFORM_BUNDLE_ID, LIVING_CRYSTAL_PLATFORM_RENDER_ID, LIVING_CRYSTAL_STAGING_RENDER_ID, } from '../content/living-crystal-profile'
import { PEARL_QUARTER_TURN_BUNDLE_IDS, PEARL_QUARTER_TURN_DOCK_RENDER_ID, PEARL_QUARTER_TURN_RENDER_ID, } from '../content/pearl-quarter-turn-profile'
import { RESONANCE_ROSEBUD_BUNDLE_ID, RESONANCE_ROSEBUD_DISPLAY_HEIGHT, RESONANCE_ROSEBUD_MATERIAL_OPTICS, RESONANCE_ROSEBUD_MATERIALS, RESONANCE_ROSEBUD_NODES, RESONANCE_ROSEBUD_SHARD_COUNT, RESONANCE_ROSEBUD_SOURCE_HEIGHT, RESONANCE_ROSEBUD_VARIANT_ID, } from '../content/resonance-rosebud-profile'
import { PORTRAIT_EXHIBIT_ENVELOPE } from '../content/solid-props'
import { CLOUDWAY_PLATFORM_BUNDLE_ID, CLOUDWAY_PLATFORM_NODES, CLOUDWAY_PLATFORM_RENDER_IDS, } from './cloudway-catalog'
import { CLOUDWAY_LAB_BUNDLE_IDS, CLOUDWAY_LAB_PLATFORM_RENDER_IDS, } from './cloudway-laboratory-catalog'
import type { ResonancePresentationConfig } from './resonance-release-config'
import type { SurfaceTextures } from './texture-recipe'

export interface BreakableRenderRecipe {
  shatterProfile?: 'crown' | 'radial' | 'sheet' | 'ice-wall'
  /** Local pane bounds: centred in X/Z, resting at Y=0. */
  barrierEnvelope?: { width: number; height: number; depth: number }
  bundle?: string
  intactNode?: string
  shardPrefix?: string
  shardCount: number
  /** A preferred bundle may contain a newer fracture than its legacy fallback. */
  bundleShardCounts?: Readonly<Record<string, number>>
  persistentPrefix?: string
  /** Optional reviewed source height; rejects an unexpected donor export. */
  sourceHeight?: number
  /** Identical prepared donor geometry may be leased across vessel instances. */
  sharedGeometry?: boolean
  displayHeight: number
  /** Physical glTF materials whose metre-valued optics scale with geometry. */
  scaleImportedMaterialUnits?: readonly string[]
  /** Opt-in charge and release treatment layered around standard rigid shards. */
  resonancePresentation?: ResonancePresentationConfig
  /** Imported surfaces eligible for authored crack raycasts. */
  resonanceGlassMaterials?: readonly string[]
  tint: number
  roughness: number
  transmission: number
  thickness: number
  portraitTexture?: string
  portraitMaterial?: string
  /** Whether the image remains protected or travels on the authored shards. */
  portraitFracture?: 'protective-glazing' | 'picture-bearing'
  /** Separate art plane used before fracture and for the collected reward. */
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
  shatterProfile: 'radial' as const,
  tint: 0xd9fff4,
  roughness: 0.025,
  transmission: 0.97,
  thickness: 0.025,
  fragmentBudget: 20,
}

function collectedPortrait(portraitTexture: string): BreakableRenderRecipe {
  return {
    ...CLEAR_GLASS,
    shatterProfile: 'sheet',
    bundle: 'legend-slab',
    intactNode: 'legend_cash_intact',
    shardPrefix: 'legend_cash_shard_',
    shardCount: 16,
    persistentPrefix: 'legend_cash_frame_',
    displayHeight: PORTRAIT_EXHIBIT_ENVELOPE.height,
    fallbackShape: 'slab',
    portraitTexture,
    portraitMaterial: 'legend_portrait',
    portraitFracture: 'picture-bearing',
    persistentPortrait: { width: 0.58, height: 0.78, centerY: 0.42, z: 0.032 },
    faceAnchor: true,
    fragmentBudget: 18,
  }
}

export const BREAKABLE_RENDER_CATALOG: Readonly<
  Record<string, BreakableRenderRecipe>
> = {
  'frosted-scroll-wall': {
    ...CLEAR_GLASS,
    shatterProfile: 'ice-wall',
    barrierEnvelope: FROST_WALL_PANE,
    bundle: FROST_WALL_BUNDLE,
    intactNode: 'frost_wall_intact',
    shardPrefix: 'frost_wall_shard_',
    shardCount: 32,
    persistentPrefix: 'frost_wall_frame',
    displayHeight: FROST_WALL_PANE.height,
    fallbackShape: 'slab',
    fragmentBudget: 24,
    tint: 0xbdeeff,
    roughness: 0.16,
    thickness: FROST_WALL_PANE.depth,
  },
  'frost-gold-arch-breakwall-a': {
    ...CLEAR_GLASS,
    shatterProfile: 'ice-wall',
    barrierEnvelope: {
      width: FROST_GOLD_ARCH_PANE.width,
      height: FROST_GOLD_ARCH_PANE.height,
      depth: FROST_GOLD_ARCH_PANE.depth,
    },
    bundle: FROST_GOLD_ARCH_BUNDLE_IDS.logical,
    intactNode: FROST_GOLD_ARCH_NODES.intact,
    shardPrefix: FROST_GOLD_ARCH_NODES.shardPrefix,
    shardCount: 32,
    persistentPrefix: FROST_GOLD_ARCH_NODES.frame,
    displayHeight: FROST_GOLD_ARCH_PANE.height,
    fallbackShape: 'slab',
    fragmentBudget: 24,
    tint: 0xcaf5ff,
    roughness: 0.13,
    thickness: FROST_GOLD_ARCH_PANE.depth,
  },
  'portrait-awakened-muse': collectedPortrait('painting-portrait-v5'),
  'portrait-interval': collectedPortrait('painting-interval-v6'),
  'portrait-wave-keeper': collectedPortrait('painting-wave-keeper-v7'),
  goblet: {
    ...CLEAR_GLASS,
    shatterProfile: 'crown',
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
    shatterProfile: 'crown',
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
  [RESONANCE_ROSEBUD_VARIANT_ID]: {
    ...CLEAR_GLASS,
    shatterProfile: 'radial',
    bundle: RESONANCE_ROSEBUD_BUNDLE_ID,
    intactNode: RESONANCE_ROSEBUD_NODES.intact,
    shardPrefix: RESONANCE_ROSEBUD_NODES.shardPrefix,
    shardCount: RESONANCE_ROSEBUD_SHARD_COUNT,
    sourceHeight: RESONANCE_ROSEBUD_SOURCE_HEIGHT,
    sharedGeometry: true,
    displayHeight: RESONANCE_ROSEBUD_DISPLAY_HEIGHT,
    scaleImportedMaterialUnits: [
      RESONANCE_ROSEBUD_MATERIALS.glass,
      RESONANCE_ROSEBUD_MATERIALS.fractureInterior,
    ],
    resonancePresentation: {
      seed: 20_260_929,
      quality: 'balanced',
      intensity: 1,
      cohesion: 0.8824,
    },
    resonanceGlassMaterials: [RESONANCE_ROSEBUD_MATERIALS.glass],
    tint: 0xf3c9dc,
    roughness: 0.08,
    transmission: 0.96,
    thickness:
      RESONANCE_ROSEBUD_MATERIAL_OPTICS[RESONANCE_ROSEBUD_MATERIALS.glass]
        .displayThickness,
    fallbackShape: 'rounded',
    fragmentBudget: RESONANCE_ROSEBUD_SHARD_COUNT,
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
    shatterProfile: 'sheet',
    bundle: 'legend-slab',
    intactNode: 'legend_cash_intact',
    shardPrefix: 'legend_cash_shard_',
    shardCount: 16,
    persistentPrefix: 'legend_cash_frame_',
    displayHeight: PORTRAIT_EXHIBIT_ENVELOPE.height,
    fallbackShape: 'slab',
    portraitTexture: 'legend-johnny-cash',
    portraitMaterial: 'legend_portrait',
    faceAnchor: true,
    fragmentBudget: 18,
  },
  'archive-glazing-v5': {
    ...CLEAR_GLASS,
    shatterProfile: 'sheet',
    bundle: 'legend-slab',
    intactNode: 'legend_cash_intact',
    shardPrefix: 'legend_cash_shard_',
    shardCount: 16,
    persistentPrefix: 'legend_cash_frame_',
    displayHeight: PORTRAIT_EXHIBIT_ENVELOPE.height,
    fallbackShape: 'slab',
    portraitTexture: 'painting-archive-v5',
    portraitMaterial: 'legend_portrait',
    portraitFracture: 'protective-glazing',
    persistentPortrait: {
      width: 0.58,
      height: 0.78,
      centerY: 0.42,
      z: 0.032,
    },
    faceAnchor: true,
    fragmentBudget: 18,
  },
  'cloudway-lab-voice': {
    ...CLEAR_GLASS,
    shardCount: 0,
    displayHeight: 0.62,
    fallbackShape: 'rounded',
    fragmentBudget: 14,
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
  [CLOUDWAY_LAB_PLATFORM_RENDER_IDS.pearlRest]: {
    bundle: CLOUDWAY_LAB_BUNDLE_IDS.pearlRest,
    body: 'marble',
    outline: false,
    suspendedHull: false,
  },
  [CLOUDWAY_LAB_PLATFORM_RENDER_IDS.scroll]: {
    bundle: CLOUDWAY_LAB_BUNDLE_IDS.scroll,
    body: 'glass',
    outline: false,
    suspendedHull: false,
  },
  [CLOUDWAY_LAB_PLATFORM_RENDER_IDS.roseCrackle]: {
    bundle: CLOUDWAY_LAB_BUNDLE_IDS.roseCrackle,
    body: 'glass',
    outline: false,
    suspendedHull: false,
  },
  [CLOUDWAY_LAB_PLATFORM_RENDER_IDS.roseHexCrumble]: {
    bundle: CLOUDWAY_LAB_BUNDLE_IDS.roseHexCrumble,
    body: 'glass',
    outline: false,
    suspendedHull: false,
  },
  [CLOUDWAY_LAB_PLATFORM_RENDER_IDS.amethystCrackle]: {
    bundle: CLOUDWAY_LAB_BUNDLE_IDS.amethystCrackle,
    body: 'glass',
    outline: false,
    suspendedHull: false,
  },
  [CLOUDWAY_LAB_PLATFORM_RENDER_IDS.frostLily]: {
    bundle: CLOUDWAY_LAB_BUNDLE_IDS.frostLily,
    body: 'glass',
    outline: false,
    suspendedHull: false,
  },
  [CLOUDWAY_LAB_PLATFORM_RENDER_IDS.auroraGlide]: {
    bundle: CLOUDWAY_LAB_BUNDLE_IDS.auroraGlide,
    body: 'glass',
    outline: false,
    suspendedHull: false,
  },
  [PEARL_QUARTER_TURN_RENDER_ID]: {
    bundle: PEARL_QUARTER_TURN_BUNDLE_IDS.logical,
    body: 'marble',
    outline: false,
    suspendedHull: false,
  },
  [PEARL_QUARTER_TURN_DOCK_RENDER_ID]: {
    body: 'marble',
    outline: true,
    suspendedHull: false,
  },
  [LIVING_CRYSTAL_PLATFORM_RENDER_ID]: {
    bundle: LIVING_CRYSTAL_PLATFORM_BUNDLE_ID,
    body: 'glass',
    outline: false,
    suspendedHull: false,
  },
  [LIVING_CRYSTAL_STAGING_RENDER_ID]: {
    body: 'marble',
    outline: true,
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
