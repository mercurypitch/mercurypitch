// ============================================================
// Background catalog — one typed registry for every performance environment
// ============================================================
//
// Supporter sources are opaque protected keys, never public asset URLs. The
// shared runtime resolves those keys through the authenticated background
// endpoint and exposes only a short-lived object URL to the renderer.

export type BackgroundSurface = 'karaoke' | 'jam' | 'piano'

export function isBackgroundSurface(
  value: unknown,
): value is BackgroundSurface {
  return value === 'karaoke' || value === 'jam' || value === 'piano'
}

export const CURRENT_FREE_BACKGROUND_IDS = [
  'karaoke-theatre',
  'room-stage',
  'room-singer',
  'room-guitar',
  'room-keys',
  'piano-afterglow',
  'piano-morning-conservatory',
  'piano-nocturne-studio',
  'piano-brick-practice-loft',
  'piano-quiet-music-library',
] as const

/** Existing 5K masters awaiting protected app delivery. */
export const EXISTING_PREMIUM_BACKGROUND_IDS = [
  'golden-stage',
  'golden-singer',
  'aurora-loft',
] as const

const SHARED_NEW_EDITION_BACKGROUND_IDS = [
  'golden-hour-stage',
  'aurora-stage',
  'neon-velvet-stage',
  'midnight-rain-stage',
  'neon-velvet-room',
  'midnight-rain-room',
  'mercury-archive',
] as const

/** Mastered Piano art identities; server publication remains runtime truth. */
export const PIANO_PREMIUM_BACKGROUND_IDS = [
  'piano-velvet-recital',
  'piano-aurora-loft',
  'piano-midnight-rain',
  'piano-mercury-archive',
  'piano-rain-glasshouse',
  'piano-alpine-observatory',
  'piano-cedar-listening-room',
  'piano-desert-modern-salon',
  'piano-moonlit-gallery',
  'piano-coastal-fog-pavilion',
] as const

/** Stable Mercury Editions ids beyond the original three premium masters. */
export const NEW_EDITION_BACKGROUND_IDS = [
  ...SHARED_NEW_EDITION_BACKGROUND_IDS,
  ...PIANO_PREMIUM_BACKGROUND_IDS,
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
export type BackgroundTreatment = 'dark' | 'light'

export type BackgroundEdition =
  | 'core'
  | 'golden-hour'
  | 'aurora'
  | 'neon-velvet'
  | 'midnight-rain'
  | 'mercury-archive'
  | 'rain-glasshouse'
  | 'alpine-observatory'
  | 'cedar-listening-room'
  | 'desert-modern-salon'
  | 'moonlit-gallery'
  | 'coastal-fog-pavilion'

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
  description?: string
  edition: BackgroundEdition
  delivery: BackgroundDelivery
  access: BackgroundAccessRule
  assetSource: BackgroundAssetSource
  /** Normalized focal point used by future cover/crop renderers. */
  focalPoint: { x: number; y: number }
  /** Defaults to dark; authored light rooms opt into warmer foreground grades. */
  treatment?: BackgroundTreatment
}

const publicSource = (
  landscape: string,
  landscape2x?: string,
  portrait?: string,
  portrait2x?: string,
): PublicBackgroundSource => ({
  kind: 'public',
  landscape,
  ...(landscape2x === undefined ? {} : { landscape2x }),
  ...(portrait === undefined ? {} : { portrait }),
  ...(portrait2x === undefined ? {} : { portrait2x }),
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
    id: 'piano-afterglow',
    surface: 'piano',
    label: 'Afterglow Studio',
    description: 'Blue-hour focus around a concert grand',
    edition: 'core',
    delivery: 'shipped',
    access: { kind: 'free' },
    assetSource: publicSource(
      '/piano-night/afterglow-studio-landscape.webp',
      undefined,
      '/piano-night/afterglow-studio-portrait.webp',
    ),
    focalPoint: { x: 0.5, y: 0.5 },
  },
  {
    id: 'piano-morning-conservatory',
    surface: 'piano',
    label: 'Morning Conservatory',
    description: 'Warm daylight for an unhurried practice session',
    edition: 'core',
    delivery: 'shipped',
    access: { kind: 'free' },
    assetSource: publicSource(
      '/piano-night/morning-conservatory-landscape.webp',
      undefined,
      '/piano-night/morning-conservatory-portrait.webp',
    ),
    focalPoint: { x: 0.52, y: 0.46 },
    treatment: 'light',
  },
  {
    id: 'piano-nocturne-studio',
    surface: 'piano',
    label: 'Nocturne Studio',
    description: 'A blue-black studio shaped for quiet evening practice',
    edition: 'core',
    delivery: 'shipped',
    access: { kind: 'free' },
    assetSource: publicSource(
      '/piano-night/nocturne-studio-landscape.webp',
      undefined,
      '/piano-night/nocturne-studio-portrait.webp',
    ),
    focalPoint: { x: 0.5, y: 0.48 },
  },
  {
    id: 'piano-brick-practice-loft',
    surface: 'piano',
    label: 'Brick Practice Loft',
    description: 'An open rehearsal loft with warm brick and working-room calm',
    edition: 'core',
    delivery: 'shipped',
    access: { kind: 'free' },
    assetSource: publicSource(
      '/piano-night/brick-practice-loft-landscape.webp',
      undefined,
      '/piano-night/brick-practice-loft-portrait.webp',
    ),
    focalPoint: { x: 0.5, y: 0.48 },
    treatment: 'light',
  },
  {
    id: 'piano-quiet-music-library',
    surface: 'piano',
    label: 'Quiet Music Library',
    description: 'A book-lined practice room with a soft after-hours glow',
    edition: 'core',
    delivery: 'shipped',
    access: { kind: 'free' },
    assetSource: publicSource(
      '/piano-night/quiet-music-library-landscape.webp',
      undefined,
      '/piano-night/quiet-music-library-portrait.webp',
    ),
    focalPoint: { x: 0.5, y: 0.48 },
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
  {
    id: 'piano-velvet-recital',
    surface: 'piano',
    label: 'Velvet Recital',
    edition: 'neon-velvet',
    delivery: 'master-ready',
    access: supporterAccess('piano-velvet-recital'),
    assetSource: protectedSource('piano', 'piano-velvet-recital'),
    focalPoint: { x: 0.5, y: 0.48 },
  },
  {
    id: 'piano-aurora-loft',
    surface: 'piano',
    label: 'Aurora Piano Loft',
    edition: 'aurora',
    delivery: 'master-ready',
    access: supporterAccess('piano-aurora-loft'),
    assetSource: protectedSource('piano', 'piano-aurora-loft'),
    focalPoint: { x: 0.52, y: 0.48 },
  },
  {
    id: 'piano-midnight-rain',
    surface: 'piano',
    label: 'Midnight Rain Room',
    edition: 'midnight-rain',
    delivery: 'master-ready',
    access: supporterAccess('piano-midnight-rain'),
    assetSource: protectedSource('piano', 'piano-midnight-rain'),
    focalPoint: { x: 0.5, y: 0.5 },
  },
  {
    id: 'piano-mercury-archive',
    surface: 'piano',
    label: 'Mercury Piano Archive',
    edition: 'mercury-archive',
    delivery: 'master-ready',
    access: supporterAccess('piano-mercury-archive'),
    assetSource: protectedSource('piano', 'piano-mercury-archive'),
    focalPoint: { x: 0.5, y: 0.48 },
  },
  {
    id: 'piano-rain-glasshouse',
    surface: 'piano',
    label: 'Rain Glasshouse',
    description: 'A glass-walled piano room suspended inside the evening rain',
    edition: 'rain-glasshouse',
    delivery: 'master-ready',
    access: supporterAccess('piano-rain-glasshouse'),
    assetSource: protectedSource('piano', 'piano-rain-glasshouse'),
    focalPoint: { x: 0.5, y: 0.48 },
  },
  {
    id: 'piano-alpine-observatory',
    surface: 'piano',
    label: 'Alpine Observatory',
    description: 'A high-altitude observatory under the last blue light',
    edition: 'alpine-observatory',
    delivery: 'master-ready',
    access: supporterAccess('piano-alpine-observatory'),
    assetSource: protectedSource('piano', 'piano-alpine-observatory'),
    focalPoint: { x: 0.5, y: 0.46 },
  },
  {
    id: 'piano-cedar-listening-room',
    surface: 'piano',
    label: 'Cedar Listening Room',
    description:
      'Dark cedar, paper light, and a room tuned for close listening',
    edition: 'cedar-listening-room',
    delivery: 'master-ready',
    access: supporterAccess('piano-cedar-listening-room'),
    assetSource: protectedSource('piano', 'piano-cedar-listening-room'),
    focalPoint: { x: 0.52, y: 0.48 },
  },
  {
    id: 'piano-desert-modern-salon',
    surface: 'piano',
    label: 'Desert Modern Salon',
    description: 'Warm stone, desert dusk, and a spacious modern recital salon',
    edition: 'desert-modern-salon',
    delivery: 'master-ready',
    access: supporterAccess('piano-desert-modern-salon'),
    assetSource: protectedSource('piano', 'piano-desert-modern-salon'),
    focalPoint: { x: 0.5, y: 0.46 },
    treatment: 'light',
  },
  {
    id: 'piano-moonlit-gallery',
    surface: 'piano',
    label: 'Moonlit Gallery',
    description:
      'A silver-blue gallery prepared for a private midnight recital',
    edition: 'moonlit-gallery',
    delivery: 'master-ready',
    access: supporterAccess('piano-moonlit-gallery'),
    assetSource: protectedSource('piano', 'piano-moonlit-gallery'),
    focalPoint: { x: 0.5, y: 0.46 },
  },
  {
    id: 'piano-coastal-fog-pavilion',
    surface: 'piano',
    label: 'Coastal Fog Pavilion',
    description: 'A quiet coastal pavilion opening into soft morning fog',
    edition: 'coastal-fog-pavilion',
    delivery: 'master-ready',
    access: supporterAccess('piano-coastal-fog-pavilion'),
    assetSource: protectedSource('piano', 'piano-coastal-fog-pavilion'),
    focalPoint: { x: 0.5, y: 0.46 },
    treatment: 'light',
  },
] as const satisfies readonly BackgroundDefinition[]

export const DEFAULT_BACKGROUND_IDS = {
  karaoke: 'karaoke-theatre',
  jam: 'room-stage',
  piano: 'piano-afterglow',
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
