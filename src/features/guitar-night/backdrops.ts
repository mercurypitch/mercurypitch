// The rooms Guitar Night can be played in — one image each, nothing generated.
// ============================================================
//
// A backdrop is not decoration alone: it names the room, and the room name is
// what the topbar has always shown. Only images that actually ship in
// `public/guitar-night/` are listed, so a choice can never resolve to a 404.

export interface GuitarNightBackdrop {
  id: string
  /** The room this is, as the topbar says it. */
  name: string
  /** What the light in it feels like — the only reason to pick one. */
  detail: string
  url: string
}

export const GUITAR_NIGHT_BACKDROPS: readonly GuitarNightBackdrop[] = [
  {
    id: 'velvet-rehearsal',
    name: 'Velvet Rehearsal',
    detail: 'Amber lamps, curtains drawn',
    url: '/guitar-night/velvet-rehearsal.webp',
  },
  {
    id: 'valve-corner',
    name: 'Valve Corner',
    detail: 'Warm glass, stacked cabinets',
    url: '/guitar-night/valve-corner.webp',
  },
  {
    id: 'blue-hour-roof',
    name: 'Blue-hour Roof',
    detail: 'City dusk, open air',
    url: '/guitar-night/blue-hour-roof.webp',
  },
  {
    id: 'daylight-loft',
    name: 'Daylight Loft',
    detail: 'Bright windows, bare floor',
    url: '/guitar-night/daylight-loft.webp',
  },
]

export const DEFAULT_BACKDROP_ID = 'velvet-rehearsal'

/** The room key, so a chosen room returns on the next visit. */
export const BACKDROP_STORAGE_KEY = 'pitchperfect_guitar_night_backdrop'

/** A saved id that no longer ships falls back to the default room, visibly. */
export function resolveBackdrop(id: string | null): GuitarNightBackdrop {
  const found = GUITAR_NIGHT_BACKDROPS.find((backdrop) => backdrop.id === id)
  if (found !== undefined) return found
  // The list is never empty, but the fallback is spelled out rather than
  // asserted so a future edit cannot make this return undefined.
  return GUITAR_NIGHT_BACKDROPS[0] as GuitarNightBackdrop
}

export function isBackdropId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    GUITAR_NIGHT_BACKDROPS.some((backdrop) => backdrop.id === value)
  )
}
