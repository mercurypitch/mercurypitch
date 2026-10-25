// ============================================================
// Merc's stills — the picture that stands in for him, by pose
// ============================================================
//
// Where he cannot be drawn live (reduced motion, a CPU-only WebGL) and until
// he has drawn, a still stands in for him (MercPresence). Three are painted:
// listening, cheering, and pointing the way, which serves every other pose.
// The plan's two hosts and the coach's tours all draw him, so the map is
// written here once, in a file with nothing but a type to import: Karaoke
// Night loads the coach, and must not load the plan to find a picture.

import type { MercState } from './constants'

const STILLS: Partial<Record<MercState, string>> = {
  listen: '/onboarding/coach/merc-listen.webp',
  celebrate: '/onboarding/coach/merc-celebrate.webp',
}
const STILL_POINT = '/onboarding/coach/merc-point.webp'

/** The still that stands in for him in `pose`. */
export const stillFor = (pose: MercState): string => STILLS[pose] ?? STILL_POINT
