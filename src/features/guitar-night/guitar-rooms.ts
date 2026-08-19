// ============================================================
// Guitar Night rooms — the naming side of the catalog join
// ============================================================
//
// The rooms themselves live in `src/lib/backgrounds/background-catalog.ts`
// with every other surface's. What is left here is the one thing the room
// itself needs and the catalog does not owe anyone: a name for the top rail
// that is a string no matter what the controller resolved to.

import type { BackgroundId } from '@/lib/backgrounds/background-catalog'
import { getBackgroundDefinition } from '@/lib/backgrounds/background-catalog'

/**
 * What the rail calls the room you are in.
 *
 * The controller only ever resolves to a catalog id, so the fallback is for
 * a shape the types already rule out — but the rail is a live string in a
 * header, and "undefined" written across the top of Guitar Night is a worse
 * failure than a generic word.
 */
export function guitarRoomLabel(id: BackgroundId | string): string {
  return getBackgroundDefinition(id)?.label ?? 'Guitar Night room'
}
