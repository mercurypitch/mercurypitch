// ============================================================
// Long note's art: the lantern's plates, as the room loads them
// ============================================================
//
// The lantern is five painted plates (Lantern.tsx says what each one is).
// They go through the room kit's plate loader (plate-loader.ts), as Echo's,
// Lip roll's and Ng slides' plates do: the tap that opens the room builds
// each plate's picture and starts its decode while the screen pushes in
// (`preloadLongNoteArt`, premium-exercise-wiring.ts), and the lantern
// adopts those pictures instead of loading a second copy. The room lets
// them go when it leaves.
//
// One file per plate, at one width: the `w` descriptor and `sizes` pick
// nothing, and the plate's box comes from its style (Lantern.tsx). Every
// import is relative, so a build without the premium exercises folds each
// one to an empty string (apps/mercurypitch/vite.config.ts,
// PREMIUM_IMAGES) and the store build carries none of them.

import type { PlateSpec } from '@/components/room-kit/plate-loader'
import { preloadPlate } from '@/components/room-kit/plate-loader'
import frameUrl from './lantern-frame.webp'
import frameLitUrl from './lantern-frame-lit.webp'
import glassUrl from './lantern-glass.webp'
import liquidUrl from './lantern-liquid.webp'
import starsUrl from './lantern-stars.webp'

/** A plate and its box in view-box units, as measured when it was cut. */
export interface LanternPlate {
  readonly spec: PlateSpec
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

/** A plate of one file, `width` px wide. */
const plate = (key: string, url: string, width: number): PlateSpec => ({
  key: `long-note-${key}`,
  candidates: [{ url, width }],
  sizes: '100vw',
})

/** The empty painting outside the glass's inside: handle, cap, frame, base. */
export const FRAME: LanternPlate = {
  spec: plate('frame', frameUrl, 640),
  x: 19.945,
  y: 2.624,
  w: 160.109,
  h: 368.502,
}
/** The same from the full painting, lit by the liquid. */
export const FRAME_LIT: LanternPlate = {
  spec: plate('frame-lit', frameLitUrl, 642),
  x: 19.695,
  y: 2.874,
  w: 160.61,
  h: 368.252,
}
/** The empty painting inside the glass: its streaks, the bowl's rings. */
export const GLASS: LanternPlate = {
  spec: plate('glass', glassUrl, 472),
  x: 40.96,
  y: 115.201,
  w: 118.081,
  h: 197.385,
}
/** The full painting inside the glass: the light itself. */
export const LIQUID: LanternPlate = {
  spec: plate('liquid', liquidUrl, 472),
  x: 40.96,
  y: 115.201,
  w: 118.081,
  h: 197.385,
}
/** The liquid's stars alone, over the deep blue of a half-full glass. */
export const STARS: LanternPlate = {
  spec: plate('stars', starsUrl, 404),
  x: 49.465,
  y: 115.451,
  w: 101.069,
  h: 182.625,
}

/** Every plate the lantern shows. */
export const LANTERN_PLATES: readonly LanternPlate[] = [
  FRAME,
  FRAME_LIT,
  GLASS,
  LIQUID,
  STARS,
]

/** On the tap that opens the room: every plate's decode. */
export function preloadLongNoteArt(): void {
  for (const each of LANTERN_PLATES) preloadPlate(each.spec)
}
