// ============================================================
// Background catalog — one typed registry for Karaoke and Jam environments
// ============================================================
//
// Supporter sources are opaque protected keys, never public asset URLs. A
// future loader resolves those keys through the authenticated background
// endpoint and exposes only a short-lived object URL to the renderer.

export type BackgroundSurface = 'karaoke' | 'jam'

export const CURRENT_FREE_BACKGROUND_IDS = [
  'karaoke-theatre',
  'room-stage',
  'room-singer',
  'room-guitar',
  'room-keys',
] as const

/** Existing 5K masters awaiting protected app delivery. */
export const EXISTING_PREMIUM_BACKGROUND_IDS = [
  'golden-stage',
  'golden-singer',
  'aurora-loft',
] as const

/** Stable ids reserved for the next Mercury Editions image-generation pass. */
export const NEW_EDITION_BACKGROUND_IDS = [
  'golden-hour-stage',
  'aurora-stage',
  'neon-velvet-stage',
  'midnight-rain-stage',
  'neon-velvet-room',
  'midnight-rain-room',
  'mercury-archive',
] as const

/** Every supporter background may also be granted permanently by this id. */
export const BACKGROUND_PERK_IDS = [
  ...EXISTING_PREMIUM_BACKGROUND_IDS,
  ...NEW_EDITION_BACKGROUND_IDS,
] as const

export type FreeBackgroundId = (typeof CURRENT_FREE_BACKGROUND_IDS)[number]
export type BackgroundPerkId = (typeof BACKGROUND_PERK_IDS)[number]
export type BackgroundId = FreeBackgroundId | BackgroundPerkId

export type BackgroundDelivery = 'shipped' | 'master-ready' | 'planned'

export type BackgroundEdition =
  | 'core'
  | 'golden-hour'
  | 'aurora'
  | 'neon-velvet'
  | 'midnight-rain'
  | 'mercury-archive'

export interface PublicBackgroundSource {
  kind: 'public'
  landscape: string
  landscape2x?: string
  portrait?: string
  portrait2x?: string
}

export interface ProtectedBackgroundSource {
  kind: 'protected'
  /**
   * Logical source only. It is not an R2 object path or a fetchable URL.
   * The server owns the mapping from this key to immutable objects.
   */
  key: `backgrounds/${BackgroundSurface}/${string}`
}

export type BackgroundAssetSource =
  | PublicBackgroundSource
  | ProtectedBackgroundSource

export type BackgroundAccessRule =
  | { kind: 'free' }
  | {
      kind: 'supporter'
      pack: 'standard'
      /** A permanent/manual grant may unlock this one background. */
      explicitPerkId: BackgroundPerkId
    }

export interface BackgroundDefinition {
  id: BackgroundId
  surface: BackgroundSurface
  label: string
  edition: BackgroundEdition
  delivery: BackgroundDelivery
  access: BackgroundAccessRule
  assetSource: BackgroundAssetSource
  /** Normalized focal point used by future cover/crop renderers. */
  focalPoint: { x: number; y: number }
}

const publicSource = (
  landscape: string,
  landscape2x?: string,
): PublicBackgroundSource => ({
  kind: 'public',
  landscape,
  ...(landscape2x === undefined ? {} : { landscape2x }),
})

const protectedSource = (
  surface: BackgroundSurface,
  id: BackgroundPerkId,
): ProtectedBackgroundSource => ({
  kind: 'protected',
  key: `backgrounds/${surface}/${id}`,
})

const supporterAccess = (id: BackgroundPerkId): BackgroundAccessRule => ({
  kind: 'supporter',
  pack: 'standard',
  explicitPerkId: id,
})

export const BACKGROUND_CATALOG = [
  {
    id: 'karaoke-theatre',
    surface: 'karaoke',
    label: 'Mercury Theatre',
    edition: 'core',
    delivery: 'shipped',
    access: { kind: 'free' },
    assetSource: publicSource('/karaoke-night-stage.webp'),
    focalPoint: { x: 0.5, y: 0.5 },
  },
  {
    id: 'room-stage',
    surface: 'jam',
    label: 'Rehearsal Stage',
    edition: 'core',
    delivery: 'shipped',
    access: { kind: 'free' },
    assetSource: publicSource(
      '/jam/room-stage.webp',
      '/jam/room-stage-4k.webp',
    ),
    focalPoint: { x: 0.5, y: 0.5 },
  },
  {
    id: 'room-singer',
    surface: 'jam',
    label: 'Vocal Booth',
    edition: 'core',
    delivery: 'shipped',
    access: { kind: 'free' },
    assetSource: publicSource(
      '/jam/room-singer.webp',
      '/jam/room-singer-4k.webp',
    ),
    focalPoint: { x: 0.5, y: 0.48 },
  },
  {
    id: 'room-guitar',
    surface: 'jam',
    label: 'Guitar Room',
    edition: 'core',
    delivery: 'shipped',
    access: { kind: 'free' },
    assetSource: publicSource(
      '/jam/room-guitar.webp',
      '/jam/room-guitar-4k.webp',
    ),
    focalPoint: { x: 0.5, y: 0.5 },
  },
  {
    id: 'room-keys',
    surface: 'jam',
    label: 'Keys Room',
    edition: 'core',
    delivery: 'shipped',
    access: { kind: 'free' },
    assetSource: publicSource('/jam/room-keys.webp', '/jam/room-keys-4k.webp'),
    focalPoint: { x: 0.5, y: 0.5 },
  },
  {
    id: 'golden-stage',
    surface: 'jam',
    label: 'Golden Stage',
    edition: 'golden-hour',
    delivery: 'master-ready',
    access: supporterAccess('golden-stage'),
    assetSource: protectedSource('jam', 'golden-stage'),
    focalPoint: { x: 0.5, y: 0.5 },
  },
  {
    id: 'golden-singer',
    surface: 'jam',
    label: 'Golden Vocal Booth',
    edition: 'golden-hour',
    delivery: 'master-ready',
    access: supporterAccess('golden-singer'),
    assetSource: protectedSource('jam', 'golden-singer'),
    focalPoint: { x: 0.5, y: 0.48 },
  },
  {
    id: 'aurora-loft',
    surface: 'jam',
    label: 'Aurora Loft',
    edition: 'aurora',
    delivery: 'master-ready',
    access: supporterAccess('aurora-loft'),
    assetSource: protectedSource('jam', 'aurora-loft'),
    focalPoint: { x: 0.5, y: 0.5 },
  },
  {
    id: 'golden-hour-stage',
    surface: 'karaoke',
    label: 'Golden Hour Stage',
    edition: 'golden-hour',
    delivery: 'planned',
    access: supporterAccess('golden-hour-stage'),
    assetSource: protectedSource('karaoke', 'golden-hour-stage'),
    focalPoint: { x: 0.5, y: 0.5 },
  },
  {
    id: 'aurora-stage',
    surface: 'karaoke',
    label: 'Aurora Stage',
    edition: 'aurora',
    delivery: 'planned',
    access: supporterAccess('aurora-stage'),
    assetSource: protectedSource('karaoke', 'aurora-stage'),
    focalPoint: { x: 0.5, y: 0.5 },
  },
  {
    id: 'neon-velvet-stage',
    surface: 'karaoke',
    label: 'Neon Velvet Stage',
    edition: 'neon-velvet',
    delivery: 'planned',
    access: supporterAccess('neon-velvet-stage'),
    assetSource: protectedSource('karaoke', 'neon-velvet-stage'),
    focalPoint: { x: 0.5, y: 0.5 },
  },
  {
    id: 'midnight-rain-stage',
    surface: 'karaoke',
    label: 'Midnight Rain Stage',
    edition: 'midnight-rain',
    delivery: 'planned',
    access: supporterAccess('midnight-rain-stage'),
    assetSource: protectedSource('karaoke', 'midnight-rain-stage'),
    focalPoint: { x: 0.5, y: 0.5 },
  },
  {
    id: 'neon-velvet-room',
    surface: 'jam',
    label: 'Neon Velvet Room',
    edition: 'neon-velvet',
    delivery: 'planned',
    access: supporterAccess('neon-velvet-room'),
    assetSource: protectedSource('jam', 'neon-velvet-room'),
    focalPoint: { x: 0.5, y: 0.5 },
  },
  {
    id: 'midnight-rain-room',
    surface: 'jam',
    label: 'Midnight Rain Room',
    edition: 'midnight-rain',
    delivery: 'planned',
    access: supporterAccess('midnight-rain-room'),
    assetSource: protectedSource('jam', 'midnight-rain-room'),
    focalPoint: { x: 0.5, y: 0.5 },
  },
  {
    id: 'mercury-archive',
    surface: 'jam',
    label: 'Mercury Archive',
    edition: 'mercury-archive',
    delivery: 'planned',
    access: supporterAccess('mercury-archive'),
    assetSource: protectedSource('jam', 'mercury-archive'),
    focalPoint: { x: 0.5, y: 0.5 },
  },
] as const satisfies readonly BackgroundDefinition[]

export const DEFAULT_BACKGROUND_IDS = {
  karaoke: 'karaoke-theatre',
  jam: 'room-stage',
} as const satisfies Record<BackgroundSurface, FreeBackgroundId>

const BACKGROUND_BY_ID = new Map<BackgroundId, BackgroundDefinition>(
  BACKGROUND_CATALOG.map((background) => [background.id, background]),
)

export function isBackgroundId(value: unknown): value is BackgroundId {
  return (
    typeof value === 'string' && BACKGROUND_BY_ID.has(value as BackgroundId)
  )
}

export function isBackgroundPerkId(value: unknown): value is BackgroundPerkId {
  return (
    typeof value === 'string' &&
    (BACKGROUND_PERK_IDS as readonly string[]).includes(value)
  )
}

export function getBackgroundDefinition(
  id: unknown,
): BackgroundDefinition | null {
  return isBackgroundId(id) ? (BACKGROUND_BY_ID.get(id) ?? null) : null
}

export function listBackgrounds(
  surface: BackgroundSurface,
  options: { includeUnshipped?: boolean } = {},
): readonly BackgroundDefinition[] {
  return BACKGROUND_CATALOG.filter(
    (background) =>
      background.surface === surface &&
      (options.includeUnshipped === true || background.delivery === 'shipped'),
  )
}

export function defaultBackground(
  surface: BackgroundSurface,
): BackgroundDefinition {
  return BACKGROUND_BY_ID.get(DEFAULT_BACKGROUND_IDS[surface])!
}
