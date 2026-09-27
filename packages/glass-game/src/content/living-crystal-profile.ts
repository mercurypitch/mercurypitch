// Living-crystal platform profile — reviewed donor identity, support and animation palettes shared by content and rendering.

export type LivingCrystalVariant = 'pearl-roots' | 'living-amber'

export const LIVING_CRYSTAL_PLATFORM_RENDER_ID = 'living-crystal-platform-v2'
export const LIVING_CRYSTAL_STAGING_RENDER_ID =
  'living-crystal-art-study-staging'
export const LIVING_CRYSTAL_PLATFORM_BUNDLE_ID = 'living-crystal-platform-v2'

export const LIVING_CRYSTAL_PLATFORM_NODES = {
  root: 'LivingCrystalPlatformV2',
  shell: 'LivingCrystalPlatformV2_Shell',
  hardware: 'LivingCrystalPlatformV2_Hardware',
  interior: 'LivingCrystalPlatformV2_PearlRoots',
  supportAnchor: 'LivingCrystalPlatformV2_SupportAnchor',
} as const

export const LIVING_CRYSTAL_PLATFORM_SUPPORT = {
  width: 3,
  depth: 1.7,
  height: 0.55,
  topY: 0,
  centre: [0, -0.275, 0] as const,
  minimumInteriorClearance: 0.04,
} as const

export const LIVING_CRYSTAL_PLATFORM_RUNTIME = {
  triangles: 32_336,
  meshDrawsPerPass: 3,
  textures: 0,
  bytes: 847_764,
  sha256: 'aa4febb3ccf8a1e9ab842263a14af9f923e279e0c8e317ac662f5d73a775643b',
  pathManifestSha256:
    '5e307abf2bcaa9566e8bf668dadd1c7a231e0acdcae169be0915a5800f81552a',
  pathCount: 51,
  pearlCount: 18,
  depthLayers: 3,
} as const

export interface LivingCrystalPalette {
  readonly primary: number
  readonly secondary: number
  readonly accent: number
}

export interface LivingCrystalVariantTuning {
  readonly palette: LivingCrystalPalette
  readonly intensity: number
  readonly speed: number
  readonly shellTint: number
  readonly attenuationTint: number
}

export const LIVING_CRYSTAL_VARIANTS: Readonly<
  Record<LivingCrystalVariant, LivingCrystalVariantTuning>
> = {
  'pearl-roots': {
    palette: {
      primary: 0xffe4b5,
      secondary: 0xc37a1e,
      accent: 0xfff3d1,
    },
    intensity: 1.55,
    speed: 0.34,
    shellTint: 0xf2a8c0,
    attenuationTint: 0xffc4d5,
  },
  'living-amber': {
    palette: {
      primary: 0xffbf4d,
      secondary: 0x9d3e0b,
      accent: 0xfff0a8,
    },
    intensity: 1.72,
    speed: 0.46,
    shellTint: 0xf09a78,
    attenuationTint: 0xffae72,
  },
}
