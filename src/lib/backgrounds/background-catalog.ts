// ============================================================
// Background catalog — one typed registry for every performance environment
// ============================================================
//
// Supporter sources are opaque protected keys, never public asset URLs. The
// shared runtime resolves those keys through the authenticated background
// endpoint and exposes only a short-lived object URL to the renderer.

export type BackgroundSurface = 'karaoke' | 'jam' | 'piano' | 'guitar' | 'ear'

export function isBackgroundSurface(
  value: unknown,
): value is BackgroundSurface {
  return (
    value === 'karaoke' ||
    value === 'jam' ||
    value === 'piano' ||
    value === 'guitar' ||
    value === 'ear'
  )
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
  // Guitar Night's four shipped rooms. They predate this catalog and lived in
  // their own module with their own storage key and their own <select>, which
  // is why Guitar Night could not offer a supporter room at all.
  'velvet-rehearsal',
  'valve-corner',
  'blue-hour-roof',
  'daylight-loft',
  // Mercury Rooms, the first pack authored for all four surfaces at once.
  // One free room each, so every surface has something new to look at
  // without a supporter account.
  'karaoke-tokyo-cyber',
  'jam-velvet-lounge',
  'piano-ambient-led-studio',
  'guitar-midnight-canyon',
  // The Ear Lab's one free room until its pack lands (ear-lab-polish-plan
  // Phase 6). A ~1K stand-in pair, not a master.
  'ear-regulator-room',
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

/**
 * Mercury Rooms — two supporter rooms per surface, one dark and one bright.
 *
 * The first pack with art for Guitar Night, which had no supporter room at
 * all until its rooms joined this catalog. The bright half is deliberate: a
 * daylit room is the case where the foreground treatment has to earn its
 * keep, and there was nothing in the library to test it against.
 */
export const MERCURY_ROOMS_BACKGROUND_IDS = [
  'karaoke-floating-orb',
  'karaoke-nordic-amphitheatre',
  'jam-skyline-penthouse',
  'jam-nordic-wood',
  'piano-manor-library',
  'piano-parisian-salon',
  'guitar-british-rock',
  'guitar-venice-beach',
] as const

/**
 * The Room Library — every remaining mastered supporter room, in one pack.
 *
 * Mercury Rooms gave each surface a pair; this is the rest of the shelf,
 * seven to eight rooms per surface, so the picker stops being a short list
 * with one obvious choice. Identities only: nothing is visible until Studio
 * publishes a complete revision for it.
 */
export const ROOM_LIBRARY_BACKGROUND_IDS = [
  'guitar-alpine-lodge',
  'guitar-blues-barn',
  'guitar-high-tech-vault',
  'guitar-industrial-loft',
  'guitar-metal-sanctuary',
  'guitar-pedal-lab',
  'guitar-spanish-courtyard',
  'jam-boho-attic',
  'jam-cyber-bunker',
  'jam-indie-loft',
  'jam-industrial-soundstage',
  'jam-japanese-zen',
  'jam-retro-analog',
  'jam-space-observatory',
  'karaoke-broadway-theater',
  'karaoke-jazz-club',
  'karaoke-nordic-amphitheater',
  'karaoke-rooftop-skyline',
  'karaoke-rustic-coffeehouse',
  'karaoke-speakeasy-vault',
  'karaoke-starlight-solarium',
  'karaoke-synthwave-80s',
  'piano-1950s-jazz-lounge',
  'piano-acoustic-chamber',
  'piano-alpine-villa',
  'piano-coastal-sunset',
  'piano-grand-hall',
  'piano-moonlit-conservatory',
] as const

/** Every supporter background may also be granted permanently by this id. */
export const BACKGROUND_PERK_IDS = [
  ...EXISTING_PREMIUM_BACKGROUND_IDS,
  ...NEW_EDITION_BACKGROUND_IDS,
  ...MERCURY_ROOMS_BACKGROUND_IDS,
  ...ROOM_LIBRARY_BACKGROUND_IDS,
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
  | 'floating-orb'
  | 'nordic-amphitheatre'
  | 'skyline-penthouse'
  | 'nordic-wood'
  | 'manor-library'
  | 'parisian-salon'
  | 'british-rock'
  | 'venice-beach'
  | 'alpine-lodge'
  | 'blues-barn'
  | 'high-tech-vault'
  | 'industrial-loft'
  | 'metal-sanctuary'
  | 'pedal-lab'
  | 'spanish-courtyard'
  | 'boho-attic'
  | 'cyber-bunker'
  | 'indie-loft'
  | 'industrial-soundstage'
  | 'japanese-zen'
  | 'retro-analog'
  | 'space-observatory'
  | 'broadway-theater'
  | 'jazz-club'
  | 'nordic-amphitheater'
  | 'rooftop-skyline'
  | 'rustic-coffeehouse'
  | 'speakeasy-vault'
  | 'starlight-solarium'
  | 'synthwave-80s'
  | '1950s-jazz-lounge'
  | 'acoustic-chamber'
  | 'alpine-villa'
  | 'coastal-sunset'
  | 'grand-hall'
  | 'moonlit-conservatory'

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
    id: 'velvet-rehearsal',
    surface: 'guitar',
    label: 'Velvet Rehearsal',
    description: 'Amber lamps, curtains drawn.',
    edition: 'core',
    delivery: 'shipped',
    access: { kind: 'free' },
    assetSource: publicSource('/guitar-night/velvet-rehearsal.webp'),
    focalPoint: { x: 0.5, y: 0.5 },
  },
  {
    id: 'valve-corner',
    surface: 'guitar',
    label: 'Valve Corner',
    description: 'Warm glass, stacked cabinets.',
    edition: 'core',
    delivery: 'shipped',
    access: { kind: 'free' },
    assetSource: publicSource('/guitar-night/valve-corner.webp'),
    focalPoint: { x: 0.5, y: 0.5 },
  },
  {
    id: 'blue-hour-roof',
    surface: 'guitar',
    label: 'Blue-hour Roof',
    description: 'City dusk, open air.',
    edition: 'core',
    delivery: 'shipped',
    access: { kind: 'free' },
    assetSource: publicSource('/guitar-night/blue-hour-roof.webp'),
    focalPoint: { x: 0.5, y: 0.5 },
  },
  {
    id: 'daylight-loft',
    surface: 'guitar',
    label: 'Daylight Loft',
    description: 'Bright windows, bare floor.',
    edition: 'core',
    delivery: 'shipped',
    access: { kind: 'free' },
    assetSource: publicSource('/guitar-night/daylight-loft.webp'),
    focalPoint: { x: 0.5, y: 0.5 },
    treatment: 'light',
  },
  {
    id: 'karaoke-tokyo-cyber',
    surface: 'karaoke',
    label: 'Tokyo Cyber',
    description: 'Rain-slick neon, three floors up',
    edition: 'core',
    delivery: 'shipped',
    access: { kind: 'free' },
    assetSource: publicSource(
      '/karaoke-night/tokyo-cyber-landscape.webp',
      undefined,
      '/karaoke-night/tokyo-cyber-portrait.webp',
    ),
    focalPoint: { x: 0.5, y: 0.5 },
  },
  {
    id: 'jam-velvet-lounge',
    surface: 'jam',
    label: 'Velvet Lounge',
    description: 'Low light, deep red, room for the band',
    edition: 'core',
    delivery: 'shipped',
    access: { kind: 'free' },
    assetSource: publicSource(
      '/jam/velvet-lounge-landscape.webp',
      undefined,
      '/jam/velvet-lounge-portrait.webp',
    ),
    focalPoint: { x: 0.5, y: 0.5 },
  },
  {
    id: 'piano-ambient-led-studio',
    surface: 'piano',
    label: 'Ambient LED Studio',
    description: 'A dark studio washed in slow colour',
    edition: 'core',
    delivery: 'shipped',
    access: { kind: 'free' },
    assetSource: publicSource(
      '/piano-night/ambient-led-studio-landscape.webp',
      undefined,
      '/piano-night/ambient-led-studio-portrait.webp',
    ),
    focalPoint: { x: 0.5, y: 0.5 },
  },
  {
    id: 'guitar-midnight-canyon',
    surface: 'guitar',
    label: 'Midnight Canyon',
    description: 'Desert rock, one amp, and the night sky',
    edition: 'core',
    delivery: 'shipped',
    access: { kind: 'free' },
    assetSource: publicSource(
      '/guitar-night/midnight-canyon-landscape.webp',
      undefined,
      '/guitar-night/midnight-canyon-portrait.webp',
    ),
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
  {
    id: 'karaoke-floating-orb',
    surface: 'karaoke',
    label: 'Floating Orb',
    description: 'A slow-turning orb of light over a dark room',
    edition: 'floating-orb',
    delivery: 'master-ready',
    access: supporterAccess('karaoke-floating-orb'),
    assetSource: protectedSource('karaoke', 'karaoke-floating-orb'),
    focalPoint: { x: 0.5, y: 0.5 },
  },
  {
    id: 'karaoke-nordic-amphitheatre',
    surface: 'karaoke',
    label: 'Nordic Amphitheatre v1',
    description: 'Pale stone tiers under an open northern sky',
    edition: 'nordic-amphitheatre',
    delivery: 'master-ready',
    access: supporterAccess('karaoke-nordic-amphitheatre'),
    assetSource: protectedSource('karaoke', 'karaoke-nordic-amphitheatre'),
    focalPoint: { x: 0.5, y: 0.5 },
    treatment: 'light',
  },
  {
    id: 'jam-skyline-penthouse',
    surface: 'jam',
    label: 'Skyline Penthouse',
    description: 'Glass, city lights, and room to spread out',
    edition: 'skyline-penthouse',
    delivery: 'master-ready',
    access: supporterAccess('jam-skyline-penthouse'),
    assetSource: protectedSource('jam', 'jam-skyline-penthouse'),
    focalPoint: { x: 0.5, y: 0.5 },
  },
  {
    id: 'jam-nordic-wood',
    surface: 'jam',
    label: 'Nordic Wood',
    description: 'Bright timber and daylight, built for a full band',
    edition: 'nordic-wood',
    delivery: 'master-ready',
    access: supporterAccess('jam-nordic-wood'),
    assetSource: protectedSource('jam', 'jam-nordic-wood'),
    focalPoint: { x: 0.5, y: 0.5 },
    treatment: 'light',
  },
  {
    id: 'piano-manor-library',
    surface: 'piano',
    label: 'Manor Library',
    description: 'Shelves to the ceiling and one lamp lit',
    edition: 'manor-library',
    delivery: 'master-ready',
    access: supporterAccess('piano-manor-library'),
    assetSource: protectedSource('piano', 'piano-manor-library'),
    focalPoint: { x: 0.5, y: 0.5 },
  },
  {
    id: 'piano-parisian-salon',
    surface: 'piano',
    label: 'Parisian Salon',
    description: 'Tall windows, gilt mouldings, afternoon light',
    edition: 'parisian-salon',
    delivery: 'master-ready',
    access: supporterAccess('piano-parisian-salon'),
    assetSource: protectedSource('piano', 'piano-parisian-salon'),
    focalPoint: { x: 0.5, y: 0.5 },
    treatment: 'light',
  },
  {
    id: 'guitar-british-rock',
    surface: 'guitar',
    label: 'British Rock',
    description: 'Stacked cabs in a low, dark rehearsal room',
    edition: 'british-rock',
    delivery: 'master-ready',
    access: supporterAccess('guitar-british-rock'),
    assetSource: protectedSource('guitar', 'guitar-british-rock'),
    focalPoint: { x: 0.5, y: 0.5 },
  },
  {
    id: 'guitar-venice-beach',
    surface: 'guitar',
    label: 'Venice Beach',
    description: 'Sun, salt air and an open garage door',
    edition: 'venice-beach',
    delivery: 'master-ready',
    access: supporterAccess('guitar-venice-beach'),
    assetSource: protectedSource('guitar', 'guitar-venice-beach'),
    focalPoint: { x: 0.5, y: 0.5 },
    treatment: 'light',
  },
  {
    id: 'guitar-alpine-lodge',
    surface: 'guitar',
    label: 'Alpine Lodge',
    description: 'Timber beams, and mountain light through tall glass',
    edition: 'alpine-lodge',
    delivery: 'master-ready',
    access: supporterAccess('guitar-alpine-lodge'),
    assetSource: protectedSource('guitar', 'guitar-alpine-lodge'),
    focalPoint: { x: 0.5, y: 0.5 },
  },
  {
    id: 'guitar-blues-barn',
    surface: 'guitar',
    label: 'Blues Barn',
    description: 'Weathered boards and a tube amp left glowing',
    edition: 'blues-barn',
    delivery: 'master-ready',
    access: supporterAccess('guitar-blues-barn'),
    assetSource: protectedSource('guitar', 'guitar-blues-barn'),
    focalPoint: { x: 0.5, y: 0.5 },
  },
  {
    id: 'guitar-high-tech-vault',
    surface: 'guitar',
    label: 'High-Tech Vault',
    description: 'Glass and steel, lit from below',
    edition: 'high-tech-vault',
    delivery: 'master-ready',
    access: supporterAccess('guitar-high-tech-vault'),
    assetSource: protectedSource('guitar', 'guitar-high-tech-vault'),
    focalPoint: { x: 0.5, y: 0.5 },
  },
  {
    id: 'guitar-industrial-loft',
    surface: 'guitar',
    label: 'Industrial Loft',
    description: 'Bare brick, black pipework, and a lot of ceiling',
    edition: 'industrial-loft',
    delivery: 'master-ready',
    access: supporterAccess('guitar-industrial-loft'),
    assetSource: protectedSource('guitar', 'guitar-industrial-loft'),
    focalPoint: { x: 0.5, y: 0.5 },
  },
  {
    id: 'guitar-metal-sanctuary',
    surface: 'guitar',
    label: 'Metal Sanctuary',
    description: 'A wall of stacked cabinets under crimson light',
    edition: 'metal-sanctuary',
    delivery: 'master-ready',
    access: supporterAccess('guitar-metal-sanctuary'),
    assetSource: protectedSource('guitar', 'guitar-metal-sanctuary'),
    focalPoint: { x: 0.5, y: 0.5 },
  },
  {
    id: 'guitar-pedal-lab',
    surface: 'guitar',
    label: 'Pedal Lab',
    description: 'A bench of pedals and patch cable everywhere',
    edition: 'pedal-lab',
    delivery: 'master-ready',
    access: supporterAccess('guitar-pedal-lab'),
    assetSource: protectedSource('guitar', 'guitar-pedal-lab'),
    focalPoint: { x: 0.5, y: 0.5 },
  },
  {
    id: 'guitar-spanish-courtyard',
    surface: 'guitar',
    label: 'Spanish Courtyard',
    description: 'Whitewashed walls and tiled floor, late afternoon',
    edition: 'spanish-courtyard',
    delivery: 'master-ready',
    access: supporterAccess('guitar-spanish-courtyard'),
    assetSource: protectedSource('guitar', 'guitar-spanish-courtyard'),
    focalPoint: { x: 0.5, y: 0.5 },
  },
  {
    id: 'jam-boho-attic',
    surface: 'jam',
    label: 'Boho Attic',
    description: 'Rugs, lamps, and a sloped ceiling under the roof',
    edition: 'boho-attic',
    delivery: 'master-ready',
    access: supporterAccess('jam-boho-attic'),
    assetSource: protectedSource('jam', 'jam-boho-attic'),
    focalPoint: { x: 0.5, y: 0.5 },
  },
  {
    id: 'jam-cyber-bunker',
    surface: 'jam',
    label: 'Cyber Bunker',
    description: 'Concrete, cable runs, and cold panel light',
    edition: 'cyber-bunker',
    delivery: 'master-ready',
    access: supporterAccess('jam-cyber-bunker'),
    assetSource: protectedSource('jam', 'jam-cyber-bunker'),
    focalPoint: { x: 0.5, y: 0.5 },
  },
  {
    id: 'jam-indie-loft',
    surface: 'jam',
    label: 'Indie Loft',
    description: 'Red brick and tube amps, with room for four',
    edition: 'indie-loft',
    delivery: 'master-ready',
    access: supporterAccess('jam-indie-loft'),
    assetSource: protectedSource('jam', 'jam-indie-loft'),
    focalPoint: { x: 0.5, y: 0.5 },
  },
  {
    id: 'jam-industrial-soundstage',
    surface: 'jam',
    label: 'Industrial Soundstage',
    description: 'A working stage with the rigging left visible',
    edition: 'industrial-soundstage',
    delivery: 'master-ready',
    access: supporterAccess('jam-industrial-soundstage'),
    assetSource: protectedSource('jam', 'jam-industrial-soundstage'),
    focalPoint: { x: 0.5, y: 0.5 },
  },
  {
    id: 'jam-japanese-zen',
    surface: 'jam',
    label: 'Japanese Zen',
    description: 'Cedar screens, tatami, and a low sunken floor',
    edition: 'japanese-zen',
    delivery: 'master-ready',
    access: supporterAccess('jam-japanese-zen'),
    assetSource: protectedSource('jam', 'jam-japanese-zen'),
    focalPoint: { x: 0.5, y: 0.5 },
  },
  {
    id: 'jam-retro-analog',
    surface: 'jam',
    label: 'Retro Analog',
    description: 'Tape machines and a desk with real faders',
    edition: 'retro-analog',
    delivery: 'master-ready',
    access: supporterAccess('jam-retro-analog'),
    assetSource: protectedSource('jam', 'jam-retro-analog'),
    focalPoint: { x: 0.5, y: 0.5 },
  },
  {
    id: 'jam-space-observatory',
    surface: 'jam',
    label: 'Space Observatory',
    description: 'A glass dome, and the Milky Way above it',
    edition: 'space-observatory',
    delivery: 'master-ready',
    access: supporterAccess('jam-space-observatory'),
    assetSource: protectedSource('jam', 'jam-space-observatory'),
    focalPoint: { x: 0.5, y: 0.5 },
  },
  {
    id: 'karaoke-broadway-theater',
    surface: 'karaoke',
    label: 'Broadway Theater',
    description: 'A gilded proscenium arch and an empty house',
    edition: 'broadway-theater',
    delivery: 'master-ready',
    access: supporterAccess('karaoke-broadway-theater'),
    assetSource: protectedSource('karaoke', 'karaoke-broadway-theater'),
    focalPoint: { x: 0.5, y: 0.5 },
  },
  {
    id: 'karaoke-jazz-club',
    surface: 'karaoke',
    label: 'Jazz Club',
    description: 'One brass microphone under an amber spotlight',
    edition: 'jazz-club',
    delivery: 'master-ready',
    access: supporterAccess('karaoke-jazz-club'),
    assetSource: protectedSource('karaoke', 'karaoke-jazz-club'),
    focalPoint: { x: 0.5, y: 0.5 },
  },
  {
    id: 'karaoke-nordic-amphitheater',
    surface: 'karaoke',
    label: 'Nordic Amphitheatre v2',
    description: 'Open stone tiers, and a wide northern sky',
    edition: 'nordic-amphitheater',
    delivery: 'master-ready',
    access: supporterAccess('karaoke-nordic-amphitheater'),
    assetSource: protectedSource('karaoke', 'karaoke-nordic-amphitheater'),
    focalPoint: { x: 0.5, y: 0.5 },
    treatment: 'light',
  },
  {
    id: 'karaoke-rooftop-skyline',
    surface: 'karaoke',
    label: 'Rooftop Skyline',
    description: 'An open-air stage above a midnight city',
    edition: 'rooftop-skyline',
    delivery: 'master-ready',
    access: supporterAccess('karaoke-rooftop-skyline'),
    assetSource: protectedSource('karaoke', 'karaoke-rooftop-skyline'),
    focalPoint: { x: 0.5, y: 0.5 },
  },
  {
    id: 'karaoke-rustic-coffeehouse',
    surface: 'karaoke',
    label: 'Rustic Coffeehouse',
    description: 'A corner stage, warm lamps, and low tables',
    edition: 'rustic-coffeehouse',
    delivery: 'master-ready',
    access: supporterAccess('karaoke-rustic-coffeehouse'),
    assetSource: protectedSource('karaoke', 'karaoke-rustic-coffeehouse'),
    focalPoint: { x: 0.5, y: 0.5 },
  },
  {
    id: 'karaoke-speakeasy-vault',
    surface: 'karaoke',
    label: 'Speakeasy Vault',
    description: 'Brick arches below street level',
    edition: 'speakeasy-vault',
    delivery: 'master-ready',
    access: supporterAccess('karaoke-speakeasy-vault'),
    assetSource: protectedSource('karaoke', 'karaoke-speakeasy-vault'),
    focalPoint: { x: 0.5, y: 0.5 },
  },
  {
    id: 'karaoke-starlight-solarium',
    surface: 'karaoke',
    label: 'Starlight Solarium',
    description: 'A glasshouse open to the stars',
    edition: 'starlight-solarium',
    delivery: 'master-ready',
    access: supporterAccess('karaoke-starlight-solarium'),
    assetSource: protectedSource('karaoke', 'karaoke-starlight-solarium'),
    focalPoint: { x: 0.5, y: 0.5 },
  },
  {
    id: 'karaoke-synthwave-80s',
    surface: 'karaoke',
    label: 'Synthwave 80s',
    description: 'Grid horizon, chrome, and magenta haze',
    edition: 'synthwave-80s',
    delivery: 'master-ready',
    access: supporterAccess('karaoke-synthwave-80s'),
    assetSource: protectedSource('karaoke', 'karaoke-synthwave-80s'),
    focalPoint: { x: 0.5, y: 0.5 },
  },
  {
    id: 'piano-1950s-jazz-lounge',
    surface: 'piano',
    label: '1950s Jazz Lounge',
    description: 'Low light, a small stage, and stained wood',
    edition: '1950s-jazz-lounge',
    delivery: 'master-ready',
    access: supporterAccess('piano-1950s-jazz-lounge'),
    assetSource: protectedSource('piano', 'piano-1950s-jazz-lounge'),
    focalPoint: { x: 0.5, y: 0.5 },
  },
  {
    id: 'piano-acoustic-chamber',
    surface: 'piano',
    label: 'Acoustic Chamber',
    description: 'Curved walnut diffusers on every wall',
    edition: 'acoustic-chamber',
    delivery: 'master-ready',
    access: supporterAccess('piano-acoustic-chamber'),
    assetSource: protectedSource('piano', 'piano-acoustic-chamber'),
    focalPoint: { x: 0.5, y: 0.5 },
  },
  {
    id: 'piano-alpine-villa',
    surface: 'piano',
    label: 'Alpine Villa',
    description: 'Concrete, glass, and misted peaks at dawn',
    edition: 'alpine-villa',
    delivery: 'master-ready',
    access: supporterAccess('piano-alpine-villa'),
    assetSource: protectedSource('piano', 'piano-alpine-villa'),
    focalPoint: { x: 0.5, y: 0.5 },
    treatment: 'light',
  },
  {
    id: 'piano-coastal-sunset',
    surface: 'piano',
    label: 'Coastal Sunset',
    description: 'Open doors onto the sea, late in the day',
    edition: 'coastal-sunset',
    delivery: 'master-ready',
    access: supporterAccess('piano-coastal-sunset'),
    assetSource: protectedSource('piano', 'piano-coastal-sunset'),
    focalPoint: { x: 0.5, y: 0.5 },
    treatment: 'light',
  },
  {
    id: 'piano-grand-hall',
    surface: 'piano',
    label: 'Grand Hall',
    description: 'Chandeliers, and a concert grand beneath them',
    edition: 'grand-hall',
    delivery: 'master-ready',
    access: supporterAccess('piano-grand-hall'),
    assetSource: protectedSource('piano', 'piano-grand-hall'),
    focalPoint: { x: 0.5, y: 0.5 },
  },
  {
    id: 'piano-moonlit-conservatory',
    surface: 'piano',
    label: 'Moonlit Conservatory',
    description: 'A glass conservatory in a single silver beam',
    edition: 'moonlit-conservatory',
    delivery: 'master-ready',
    access: supporterAccess('piano-moonlit-conservatory'),
    assetSource: protectedSource('piano', 'piano-moonlit-conservatory'),
    focalPoint: { x: 0.5, y: 0.5 },
  },
  {
    id: 'ear-regulator-room',
    surface: 'ear',
    label: 'Regulator Room',
    description: 'A chronometer workshop after hours, one lamp on the bench',
    edition: 'core',
    delivery: 'shipped',
    access: { kind: 'free' },
    assetSource: publicSource(
      '/ear-lab/regulator-room-landscape.webp',
      undefined,
      '/ear-lab/regulator-room-portrait.webp',
    ),
    focalPoint: { x: 0.5, y: 0.42 },
  },
] as const satisfies readonly BackgroundDefinition[]

export const DEFAULT_BACKGROUND_IDS = {
  karaoke: 'karaoke-theatre',
  jam: 'room-stage',
  piano: 'piano-afterglow',
  guitar: 'velvet-rehearsal',
  ear: 'ear-regulator-room',
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
