// ============================================================
// Merc's stills for the Legend room: where he cannot be drawn live, and
// until he has drawn (MercPresence)
// ============================================================
//
// The coach's own stills live in public/ for the web, which the native
// bundle does not carry, and the Ear Lab with Merc's copies may not be
// imported from outside its folder (ear-lab/merc/fold.test.ts). So the
// room carries the same three pictures, imported, so they ship with its
// chunk and only with it; a build without the premium rooms resolves them
// to nothing (vite.config.ts, PREMIUM_IMAGES; premium-images-build.test.ts).

import type { MercState } from '@/lib/merc/constants'
import celebrate from './stills/merc-celebrate.webp'
import listen from './stills/merc-listen.webp'
import point from './stills/merc-point.webp'

/** The still that stands in for him in `pose`: listening, cheering, or
 *  pointing the way, which serves every other pose. */
export function legendStill(pose: MercState): string {
  if (pose === 'listen') return listen
  if (pose === 'celebrate') return celebrate
  return point
}
