// ============================================================
// Merc's stills for the Ear Lab with Merc: where he cannot be drawn
// live, and until he has drawn (MercPresence). The coach's own stills
// live in public/ for the web, which the native bundle does not carry;
// these are the same three pictures at the size the room shows them,
// imported, so they ship with this chunk and only with it.
// ============================================================

import type { MercState } from '@/lib/merc/constants'
import celebrate from './stills/merc-celebrate.webp'
import listen from './stills/merc-listen.webp'
import point from './stills/merc-point.webp'

/** The still that stands in for him in `pose`: listening, cheering,
 *  or pointing the way, which serves every other pose. */
export function mercStill(pose: MercState): string {
  if (pose === 'listen') return listen
  if (pose === 'celebrate') return celebrate
  return point
}
