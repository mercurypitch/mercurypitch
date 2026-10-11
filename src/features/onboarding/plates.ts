// ============================================================
// First Light — which picture sits behind which beat
// ============================================================
//
// Merc's scenes sit behind the beats that are mostly words and one
// button: the welcome, the first note and the Fork right after it, and
// the Map (owner decision V5, 10 Oct 2026). The beats that bring their own
// pictures (the voiceprint's demos, the twin's portrait, the prints, the
// account card) keep the plain sky, so two pictures never compete.
//
// The art was generated with Codex imagegen on 11 Oct 2026 and ships as
// webp at full resolution: 1672x941 for wide screens, 941x1672 for tall
// ones (the Map has no tall cut: on a phone its cards cover the middle,
// and the wide one is anchored on Merc instead). The stylesheet picks
// the file by aspect ratio; this module only names it, so the flow can
// fetch the next beat's picture before the visitor gets there.

import type { Beat } from './flow'

export type Plate = 'sky' | 'first-light' | 'map' | 'plain'

const PLATE_FOR_BEAT: Record<Beat, Plate> = {
  sky: 'sky',
  'first-light': 'first-light',
  // The Fork follows the first note on the same picture: the star that
  // note lit is still in the sky when the twin is offered.
  fork: 'first-light',
  prints: 'plain',
  voiceprint: 'plain',
  twin: 'plain',
  keep: 'plain',
  map: 'map',
}

export function plateFor(beat: Beat): Plate {
  return PLATE_FOR_BEAT[beat]
}

/** Wide and tall files per plate, matching the stylesheet's media query. */
const PLATE_FILES: Record<Plate, { wide: string; tall: string }> = {
  sky: {
    wide: '/onboarding/merc-sky-wide.webp',
    tall: '/onboarding/merc-sky-tall.webp',
  },
  'first-light': {
    wide: '/onboarding/merc-first-light-wide.webp',
    tall: '/onboarding/merc-first-light-tall.webp',
  },
  map: {
    wide: '/onboarding/merc-map-wide.webp',
    tall: '/onboarding/merc-map-wide.webp',
  },
  plain: {
    wide: '/onboarding/sky-wide.webp',
    tall: '/onboarding/sky-tall.webp',
  },
}

/** The same test as the stylesheet's `(max-aspect-ratio: 1/1)`. */
export const TALL_QUERY = '(max-aspect-ratio: 1/1)'

/** The file a plate shows at this window shape. */
export function plateSrc(plate: Plate, tall: boolean): string {
  const files = PLATE_FILES[plate]
  return tall ? files.tall : files.wide
}

/**
 * The picture the visitor is most likely to see next. Fetched while they
 * read the current beat, so the next plate fades in on a picture rather
 * than on an empty frame that fills in a moment later.
 */
const PLATE_AHEAD: Partial<Record<Beat, Plate>> = {
  sky: 'first-light',
  'first-light': 'map',
  fork: 'map',
}

export function plateAhead(beat: Beat): Plate | null {
  return PLATE_AHEAD[beat] ?? null
}
