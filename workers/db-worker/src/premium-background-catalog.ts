// ============================================================
// Premium background catalog — server-owned R2 object allowlist
// ============================================================
//
// The client names a stable background id and a small variant enum. It never
// supplies an R2 key: resolving the complete key here prevents traversal and
// keeps bucket layout independent from UI URLs.

import type { BackgroundPerkId, BackgroundSurface, } from '../../../src/lib/backgrounds/background-catalog'
import { BACKGROUND_PERK_IDS } from '../../../src/lib/backgrounds/background-catalog'

export const PREMIUM_BACKGROUND_IDS = BACKGROUND_PERK_IDS

export type PremiumBackgroundId = BackgroundPerkId

export const PREMIUM_BACKGROUND_VARIANTS = [
  'landscape-2k',
  'landscape-4k',
  'portrait-2k',
] as const

export type PremiumBackgroundVariant =
  (typeof PREMIUM_BACKGROUND_VARIANTS)[number]

const SURFACE_BY_ID: Record<PremiumBackgroundId, BackgroundSurface> = {
  'golden-stage': 'jam',
  'golden-singer': 'jam',
  'aurora-loft': 'jam',
  'golden-hour-stage': 'karaoke',
  'aurora-stage': 'karaoke',
  'neon-velvet-stage': 'karaoke',
  'midnight-rain-stage': 'karaoke',
  'neon-velvet-room': 'jam',
  'midnight-rain-room': 'jam',
  'mercury-archive': 'jam',
  'piano-velvet-recital': 'piano',
  'piano-aurora-loft': 'piano',
  'piano-midnight-rain': 'piano',
  'piano-mercury-archive': 'piano',
  'piano-rain-glasshouse': 'piano',
  'piano-alpine-observatory': 'piano',
  'piano-cedar-listening-room': 'piano',
  'piano-desert-modern-salon': 'piano',
  'piano-moonlit-gallery': 'piano',
  'piano-coastal-fog-pavilion': 'piano',
}

function includes<const T extends readonly string[]>(
  values: T,
  candidate: string,
): candidate is T[number] {
  return (values as readonly string[]).includes(candidate)
}

export function isPremiumBackgroundId(
  candidate: string,
): candidate is PremiumBackgroundId {
  return includes(PREMIUM_BACKGROUND_IDS, candidate)
}

export function isPremiumBackgroundVariant(
  candidate: string,
): candidate is PremiumBackgroundVariant {
  return includes(PREMIUM_BACKGROUND_VARIANTS, candidate)
}

/** Only Jam Room art may be delegated to room guests by a host. */
export function isJamPremiumBackgroundId(id: PremiumBackgroundId): boolean {
  return SURFACE_BY_ID[id] === 'jam'
}
