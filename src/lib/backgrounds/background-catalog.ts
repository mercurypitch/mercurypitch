// ============================================================
// Background catalog — one typed registry for every performance environment
// ============================================================
//
// Supporter sources are opaque protected keys, never public asset URLs. The
// shared runtime resolves those keys through the authenticated background
// endpoint and exposes only a short-lived object URL to the renderer.

export type BackgroundSurface = 'karaoke' | 'jam' | 'piano' | 'guitar' | 'drum'

export function isBackgroundSurface(
  value: unknown,
): value is BackgroundSurface {
  return (
    value === 'karaoke' ||
    value === 'jam' ||
    value === 'piano' ||
    value === 'guitar' ||
    value === 'drum'
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
  // Drum Night keeps its authored Pocket Console as the free default, then
  // adds three independently composed rooms for the first public room pack.
  'drum-pocket-console',
  'drum-tape-room',
  'drum-daylight-riser',
  'drum-after-hours-booth',
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

/** Mastered Drum room identities; publication remains server-authoritative. */
export const DRUM_PREMIUM_BACKGROUND_IDS = [
  'drum-blue-hour-live-room',
  'drum-bronze-soundstage',
  'drum-rain-glass-studio',
  'drum-walnut-live-room',
  'drum-sunrise-pavilion',
] as const

/** Stable Mercury Editions ids beyond the original three premium masters. */
export const NEW_EDITION_BACKGROUND_IDS = [
  ...SHARED_NEW_EDITION_BACKGROUND_IDS,
  ...PIANO_PREMIUM_BACKGROUND_IDS,
  ...DRUM_PREMIUM_BACKGROUND_IDS,
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

/** Every supporter background may also be granted permanently by this id. */
export const BACKGROUND_PERK_IDS = [
  ...EXISTING_PREMIUM_BACKGROUND_IDS,
  ...NEW_EDITION_BACKGROUND_IDS,
  ...MERCURY_ROOMS_BACKGROUND_IDS,
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
  | 'blue-hour-live-room'
  | 'bronze-soundstage'
  | 'rain-glass-studio'
  | 'walnut-live-room'
  | 'sunrise-pavilion'

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
    id: 'drum-pocket-console',
    surface: 'drum',
    label: 'Pocket Console',
    description: 'Warm brass cues around a focused tracking room',
    edition: 'core',
    delivery: 'shipped',
    access: { kind: 'free' },
    assetSource: publicSource(
      '/drum-night/pocket-console-landscape.webp',
      undefined,
      '/drum-night/pocket-console-portrait.webp',
    ),
    focalPoint: { x: 0.5, y: 0.54 },
  },
  {
    id: 'drum-tape-room',
    surface: 'drum',
    label: 'Tape Room',
    description:
      'Analogue warmth and soft amber light around the tracking floor',
    edition: 'core',
    delivery: 'shipped',
    access: { kind: 'free' },
    assetSource: publicSource(
      '/drum-night/tape-room-landscape.webp',
      undefined,
      '/drum-night/tape-room-portrait.webp',
    ),
    focalPoint: { x: 0.5, y: 0.5 },
  },
  {
    id: 'drum-daylight-riser',
    surface: 'drum',
    label: 'Daylight Riser',
    description: 'Clear morning light across an open drum riser',
    edition: 'core',
    delivery: 'shipped',
    access: { kind: 'free' },
    assetSource: publicSource(
      '/drum-night/daylight-riser-landscape.webp',
      undefined,
      '/drum-night/daylight-riser-portrait.webp',
    ),
    focalPoint: { x: 0.5, y: 0.48 },
    treatment: 'light',
  },
  {
    id: 'drum-after-hours-booth',
    surface: 'drum',
    label: 'After-Hours Booth',
    description: 'A close late-night booth with low amber practicals',
    edition: 'core',
    delivery: 'shipped',
    access: { kind: 'free' },
    assetSource: publicSource(
      '/drum-night/after-hours-booth-landscape.webp',
      undefined,
      '/drum-night/after-hours-booth-portrait.webp',
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
    id: 'drum-blue-hour-live-room',
    surface: 'drum',
    label: 'Blue Hour Live Room',
    description:
      'Deep blue windows and warm practicals around a spacious tracking floor.',
    edition: 'blue-hour-live-room',
    delivery: 'master-ready',
    access: supporterAccess('drum-blue-hour-live-room'),
    assetSource: protectedSource('drum', 'drum-blue-hour-live-room'),
    focalPoint: { x: 0.5, y: 0.48 },
  },
  {
    id: 'drum-bronze-soundstage',
    surface: 'drum',
    label: 'Bronze Soundstage',
    description:
      'Smoked bronze walls and focused light in a cinematic drum room.',
    edition: 'bronze-soundstage',
    delivery: 'master-ready',
    access: supporterAccess('drum-bronze-soundstage'),
    assetSource: protectedSource('drum', 'drum-bronze-soundstage'),
    focalPoint: { x: 0.5, y: 0.5 },
  },
  {
    id: 'drum-rain-glass-studio',
    surface: 'drum',
    label: 'Rain Glass Studio',
    description:
      'Rain-patterned glass and amber light around a focused studio floor.',
    edition: 'rain-glass-studio',
    delivery: 'master-ready',
    access: supporterAccess('drum-rain-glass-studio'),
    assetSource: protectedSource('drum', 'drum-rain-glass-studio'),
    focalPoint: { x: 0.5, y: 0.48 },
  },
  {
    id: 'drum-walnut-live-room',
    surface: 'drum',
    label: 'Walnut Live Room',
    description: 'Walnut diffusion panels and classic recording-studio warmth.',
    edition: 'walnut-live-room',
    delivery: 'master-ready',
    access: supporterAccess('drum-walnut-live-room'),
    assetSource: protectedSource('drum', 'drum-walnut-live-room'),
    focalPoint: { x: 0.5, y: 0.5 },
  },
  {
    id: 'drum-sunrise-pavilion',
    surface: 'drum',
    label: 'Sunrise Pavilion',
    description: 'Soft morning light across an open modern recording pavilion.',
    edition: 'sunrise-pavilion',
    delivery: 'master-ready',
    access: supporterAccess('drum-sunrise-pavilion'),
    assetSource: protectedSource('drum', 'drum-sunrise-pavilion'),
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
    label: 'Nordic Amphitheatre',
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
] as const satisfies readonly BackgroundDefinition[]

export const DEFAULT_BACKGROUND_IDS = {
  karaoke: 'karaoke-theatre',
  jam: 'room-stage',
  piano: 'piano-afterglow',
  guitar: 'velvet-rehearsal',
  drum: 'drum-pocket-console',
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
