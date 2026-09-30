// Glassware trio render recipes — each accepted form keeps its own glass optics and singing response.

import type { GlasswareTrioVariant } from '../content/glassware-trio-profile'
import { GLASSWARE_TRIO_PROFILES, GLASSWARE_TRIO_SOURCE_HEIGHT, } from '../content/glassware-trio-profile'
import type { BreakableRenderRecipe } from './catalog'
import type { ResonancePalette } from './resonance-release-config'

const accents: Readonly<
  Record<GlasswareTrioVariant, Partial<ResonancePalette>>
> = {
  'g01-sunlit-diadem': {
    crack: 0xffdda5,
    crackGlow: 0xffefd0,
    heart: 0xc5a159,
    heartGlow: 0xffe0a6,
    spray: 0xe5c386,
    droplets: [0xffdf98, 0xd9eee5, 0xf7e6c7],
    dust: 0xc7a46b,
  },
  'g14-tidal-wave-carafe': {
    crack: 0xb7eee3,
    crackGlow: 0xe2fff5,
    heart: 0x4eaaa4,
    heartGlow: 0xc9ffed,
    spray: 0x85d1cf,
    droplets: [0xabebe5, 0xf0d794, 0xb4dbe9],
    dust: 0x8bb4b3,
  },
  'g22-aurora-lotus-bowl': {
    crack: 0xe8c1f2,
    crackGlow: 0xffe5f5,
    heart: 0xa27ba9,
    heartGlow: 0xe9caef,
    spray: 0xd0a5e0,
    droplets: [0xe4bce6, 0xb4e2df, 0xf4d29c],
    dust: 0xb19dc7,
  },
}

function recipe(variant: GlasswareTrioVariant): BreakableRenderRecipe {
  const profile = GLASSWARE_TRIO_PROFILES[variant]
  return {
    bundle: profile.bundle,
    intactNode: profile.intactNode,
    shardPrefix: profile.shardPrefix,
    shardCount: profile.shardCount,
    sourceHeight: GLASSWARE_TRIO_SOURCE_HEIGHT,
    displayHeight: profile.displayHeight,
    sharedGeometry: true,
    scaleImportedMaterialUnits: [
      profile.materials.glass,
      profile.materials.interior,
    ],
    resonanceGlassMaterials: [profile.materials.glass],
    resonancePresentation: {
      seed: 20_260_930 + Number(profile.code.slice(1)),
      quality: 'balanced',
      intensity: 1,
      cohesion: 0.8824,
      palette: accents[variant],
    },
    shatterProfile: variant === 'g14-tidal-wave-carafe' ? 'radial' : 'crown',
    fallbackShape: variant === 'g01-sunlit-diadem' ? 'goblet' : 'rounded',
    tint: variant === 'g22-aurora-lotus-bowl' ? 0xe6d3f0 : 0xd5f3ee,
    roughness: 0.045,
    transmission: 0.98,
    thickness: 0.02,
    fragmentBudget: profile.shardCount,
  }
}

export const GLASSWARE_TRIO_RENDER_CATALOG: Readonly<
  Record<GlasswareTrioVariant, BreakableRenderRecipe>
> = {
  'g01-sunlit-diadem': recipe('g01-sunlit-diadem'),
  'g14-tidal-wave-carafe': recipe('g14-tidal-wave-carafe'),
  'g22-aurora-lotus-bowl': recipe('g22-aurora-lotus-bowl'),
}
