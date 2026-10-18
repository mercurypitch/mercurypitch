// ============================================================
// The Warm-up path's art: the night's plate and the orbs' sprites
// ============================================================
//
// Written by scripts/sync-warm-art.mjs from the owner's picks of the Codex
// plates (18 Oct 2026): the sky's version 1 and the stops' version 2 after
// its post-fix. Every import is relative, so a build without the premium
// exercises folds each one to an empty string (apps/mercurypitch/
// vite.config.ts, PREMIUM_IMAGES) and the store build carries none of them
// (assert-bundle.mjs holds it to that).
//
// The sky is a plate (room-kit plate-loader.ts): the tap that opens the
// Warm-up starts its decode, and the path adopts it. The orbs are four small
// sprites, decoded on the same tap and kept, so the path's first frame has
// them.

import type { PlateSpec } from '@/components/room-kit/plate-loader'
import { preloadPlate } from '@/components/room-kit/plate-loader'
import sky from './art/warm-sky.webp'
import stopDone from './art/warm-stop-done.webp'
import stopLit from './art/warm-stop-lit.webp'
import stopNext from './art/warm-stop-next.webp'
import stopWaiting from './art/warm-stop-waiting.webp'
import type { OrbState } from './path-view'

/** The sky plate's size, px, as painted. */
export const SKY_PX = { width: 830, height: 1896 } as const

/** The floor's line of light, from the plate's top, as a share of its height. */
export const SKY_FLOOR = 0.7421

/**
 * The plate's own colours at its top and bottom rows (the sync's measure):
 * the sky continues in them above and below the plate, and they are the
 * fallback while it decodes.
 */
export const SKY_TOP = '#030c18'
export const SKY_BOTTOM = '#010711'

/** The plate's band colours, top to bottom: its fallback (PlateImage). */
export const SKY_FALLBACK = `linear-gradient(180deg, ${SKY_TOP} 0%, #051327 50%, #041530 74%, #03132d 80%, ${SKY_BOTTOM} 100%)`

export const SKY_PLATE: PlateSpec = {
  key: 'warm-sky',
  candidates: [{ url: sky, width: SKY_PX.width }],
  // The plate is drawn at the path's column, up to 430 px wide.
  sizes: 'min(100vw, 430px)',
}

/** Each orb state's sprite: a glass orb in its light, on transparency. */
export const ORB_SPRITES: Readonly<Record<OrbState, string>> = {
  waiting: stopWaiting,
  next: stopNext,
  done: stopDone,
  lit: stopLit,
}

/** The sprites, decoded on the tap and kept for the path's life. */
const kept: HTMLImageElement[] = []

/** Start the path's art loading: the sky's decode and the four orbs. */
export function preloadWarmUpArt(): void {
  preloadPlate(SKY_PLATE)
  if (kept.length > 0 || typeof Image === 'undefined') return
  for (const url of Object.values(ORB_SPRITES)) {
    if (url === '') continue
    const img = new Image()
    img.decoding = 'async'
    img.src = url
    kept.push(img)
    void img.decode().catch(() => undefined)
  }
}
