// ============================================================
// Break Glass — the materials ladder (level map).
//
// Each level is a breakable MATERIAL with its own personality and a difficulty
// set by where the glass rings relative to your calibrated ceiling
// (target.offsetSemitones): lower = an easy win, at/above your ceiling = brutal.
// Free materials ease you in; Pro materials sit at/above your ceiling.
//
// `image` is the concept render (public/game/materials/*.webp) used for the
// level thumbnail and the in-level hero object; `accent` tints the card, glow,
// and shatter.
// ============================================================

import type { GlassConfig } from '@/lib/glass/config'
import { GLASS_CONFIG } from '@/lib/glass/config'

export type LevelTier = 'free' | 'pro'
export type Material = 'glass' | 'ice' | 'crystal' | 'vase' | 'diamond'

export interface GlassLevel {
  id: string
  name: string
  material: Material
  /** One-line flavor shown on the level card. */
  blurb: string
  tier: LevelTier
  /** Accent color for the card, object glow, and shatter tint. */
  accent: string
  /** Concept render served from public/ (thumbnail + in-level hero object). */
  image: string
  /** Full gameplay config for this level (GLASS_CONFIG with overrides). */
  config: GlassConfig
}

/** Build a level config by overriding where the glass rings vs. your ceiling.
 *  GLASS_CONFIG is `as const` (literal types), so we widen back to GlassConfig
 *  after replacing the offset with an arbitrary number. */
function atOffset(offsetSemitones: number): GlassConfig {
  return {
    ...GLASS_CONFIG,
    target: { ...GLASS_CONFIG.target, offsetSemitones },
  } as GlassConfig
}

export const LEVELS: readonly GlassLevel[] = [
  {
    id: 'wine',
    name: 'Wine Glass',
    material: 'glass',
    tier: 'free',
    accent: '#58a6ff',
    image: '/game/materials/glass.webp',
    blurb: 'The classic. It rings, then bursts.',
    config: atOffset(-3),
  },
  {
    id: 'ice',
    name: 'Ice',
    material: 'ice',
    tier: 'free',
    accent: '#7ee7ff',
    image: '/game/materials/ice.webp',
    blurb: 'Sing warm. It cracks, then crumbles.',
    config: atOffset(-2),
  },
  {
    id: 'crystal',
    name: 'Crystal',
    material: 'crystal',
    tier: 'free',
    accent: '#bc8cff',
    image: '/game/materials/crystal.webp',
    blurb: 'Cut crystal — bright and unforgiving.',
    config: atOffset(-1),
  },
  {
    id: 'vase',
    name: 'Porcelain Vase',
    material: 'vase',
    tier: 'pro',
    accent: '#f0a8c0',
    image: '/game/materials/vase.webp',
    blurb: 'Porcelain, right at the top of your range.',
    config: atOffset(0),
  },
  {
    id: 'diamond',
    name: 'Diamond',
    material: 'diamond',
    tier: 'pro',
    accent: '#7ee787',
    image: '/game/materials/diamond.webp',
    blurb: 'The hardest thing you will ever sing.',
    config: atOffset(1),
  },
]

export const isLevelLocked = (level: GlassLevel, isPro: boolean): boolean =>
  level.tier === 'pro' && !isPro
