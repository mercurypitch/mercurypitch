// ============================================================
// First Light — which picture sits behind which beat
// ============================================================
//
// Merc's scenes sit behind the beats that are mostly words and one
// button: the welcome, the first note and the Fork right after it, and
// the Map (owner decision V5, 10 Oct 2026). The beats that bring their own
// pictures (the voiceprint's demos, the twin's portrait, the prints, the
// account card) keep the plain sky, so two pictures never compete. So do the
// four questions and the plan: the Map's plate has Merc painted into it, and
// the questions bring Merc themselves, live or his still, above the screens.
//
// The art was generated with Codex imagegen on 11 Oct 2026 and ships as
// webp at full resolution: 1672x941 for wide screens, 941x1672 for tall
// ones. The Map's pair (v2) puts Merc where its cards never reach: the
// top left corner of a wide window, the top centre of a tall one, with
// the Map's words starting under him. First light's pair (v2) is the
// same scene with its star taken out: the star ships as its own small
// layer, which the flow lights when the first note lands (owner decision
// V11), and the tall cut is mirrored so the star sits top left, clear of
// "Not now". The stylesheet picks the file by aspect ratio; this module
// only names it, so the flow can fetch the next beat's picture before the
// visitor gets there.

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
  // Merc is the questions' own (MercPresence), so no plate may paint a
  // second one. The sky steps back behind their words, as it does behind
  // Keep and the Map (FirstLight's textHeavy).
  questions: 'plain',
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
    wide: '/onboarding/merc-first-light-v2-wide.webp',
    tall: '/onboarding/merc-first-light-v2-tall.webp',
  },
  map: {
    wide: '/onboarding/merc-map-v2-wide.webp',
    tall: '/onboarding/merc-map-v2-tall.webp',
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
 * The pictures the visitor can see next, likeliest first. Fetched while
 * they read the current beat, so the next plate fades in on a picture
 * rather than on an empty frame that fills in a moment later.
 *
 * First light's "Not now" and a refused microphone, and the Fork's "Not now",
 * lead past the walk: to the four questions while the person's plan is due,
 * and to the Map once it is answered or turned down. The questions are on the
 * plain sky, so both pictures are fetched behind each, the plain one first as
 * the likelier. The Fork's one button leads to the voiceprint (or, for a
 * returning singer, the prints), also on the plain sky. The questions lead to
 * the Map only by "See every room", the one way out of the plan that stays
 * in the flow.
 */
const PLATES_AHEAD: Partial<Record<Beat, readonly Plate[]>> = {
  sky: ['first-light'],
  'first-light': ['plain', 'map'],
  fork: ['plain', 'map'],
  questions: ['map'],
}

export function platesAhead(beat: Beat): readonly Plate[] {
  return PLATES_AHEAD[beat] ?? []
}
