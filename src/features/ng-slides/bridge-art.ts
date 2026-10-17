// ============================================================
// Ng slides' art: the bridge's plates, as the room loads them
// ============================================================
//
// The files are written by scripts/sync-ng-art.mjs: the N0 paintings when
// they exist, else stand-ins drawn from the measured geometry (every plate
// today; bridge-geometry.ts marks each `standIn`, STAND-INS.md says what
// each stands for). Every import is relative, so a build without the
// premium exercises folds each one to an empty string
// (apps/mercurypitch/vite.config.ts, PREMIUM_IMAGES) and the store build
// carries none of them (assert-bundle.mjs holds it to that).
//
// The arch's sprites come in two widths: a phone at DPR 2 or under takes
// the 860 px-per-W files, a DPR 3 phone the 1290 ones, as Echo's plates
// do. The glass and its reflection are drawn into canvases strip by strip
// (room-kit glide-reveal.ts), so they are loaded as images and decoded
// before the first strip; the river-back is a plate (plate-loader.ts),
// decoded while the screen pushes in.

import type { PlateSpec } from '@/components/room-kit/plate-loader'
import { preloadPlate } from '@/components/room-kit/plate-loader'
import glassLit860 from './art/bridge-glass-lit-860.webp'
import glassLit1290 from './art/bridge-glass-lit-1290.webp'
import glassUnlit860 from './art/bridge-glass-unlit-860.webp'
import glassUnlit1290 from './art/bridge-glass-unlit-1290.webp'
import landing860 from './art/bridge-landing-860.webp'
import landing1290 from './art/bridge-landing-1290.webp'
import nearLeft860 from './art/bridge-near-left-860.webp'
import nearLeft1290 from './art/bridge-near-left-1290.webp'
import nearRight860 from './art/bridge-near-right-860.webp'
import nearRight1290 from './art/bridge-near-right-1290.webp'
import pier860 from './art/bridge-pier-860.webp'
import pier1290 from './art/bridge-pier-1290.webp'
import reflectionLit from './art/bridge-reflection-lit.webp'
import reflectionUnlit from './art/bridge-reflection-unlit.webp'
import result860 from './art/bridge-result-860.webp'
import result1290 from './art/bridge-result-1290.webp'
import resultLit860 from './art/bridge-result-lit-860.webp'
import resultLit1290 from './art/bridge-result-lit-1290.webp'
import riverBack from './art/bridge-riverback.webp'
import shimmer from './art/bridge-shimmer.webp'
import { PLATES } from './bridge-geometry'

/** One width's files for everything drawn on the bridge itself. */
export interface BridgeArt {
  /** Px per W of these files. */
  readonly px: number
  readonly glassUnlit: string
  readonly glassLit: string
  readonly landing: string
  readonly pier: string
  readonly nearLeft: string
  readonly nearRight: string
  readonly resultLit: string
}

const SMALL: BridgeArt = {
  px: 860,
  glassUnlit: glassUnlit860,
  glassLit: glassLit860,
  landing: landing860,
  pier: pier860,
  nearLeft: nearLeft860,
  nearRight: nearRight860,
  resultLit: resultLit860,
}

const LARGE: BridgeArt = {
  px: 1290,
  glassUnlit: glassUnlit1290,
  glassLit: glassLit1290,
  landing: landing1290,
  pier: pier1290,
  nearLeft: nearLeft1290,
  nearRight: nearRight1290,
  resultLit: resultLit1290,
}

/** The files for a screen of this pixel ratio: 860 at DPR 2 and under. */
export function bridgeArt(dpr: number): BridgeArt {
  return dpr > 2 ? LARGE : SMALL
}

/** The reflections: one width, half the small glass's (they are blurred). */
export const REFLECTION_ART = {
  unlit: reflectionUnlit,
  lit: reflectionLit,
} as const

/** The water's shimmer tile. */
export const SHIMMER_URL = shimmer

/** The river, sky and far bank: one plate, a third of the bridge's speed. */
export const RIVER_PLATE: PlateSpec = {
  key: 'ng-riverback',
  candidates: [
    {
      url: riverBack,
      width: Math.round(
        PLATES.riverback.frame.width * PLATES.riverback.widths[0],
      ),
    },
  ],
  sizes: `${Math.round(PLATES.riverback.frame.width * 100)}vw`,
}

/** The pulled-back view of the whole bridge, unlit. */
export const RESULT_PLATE: PlateSpec = {
  key: 'ng-result',
  candidates: [
    { url: result860, width: 860 },
    { url: result1290, width: 1290 },
  ],
  sizes: '100vw',
}

const images = new Map<string, Promise<HTMLImageElement>>()

/**
 * One image, loaded and decoded once per room visit; rejects when it will
 * not load. Canvases draw from these.
 */
export function bridgeImage(url: string): Promise<HTMLImageElement> {
  const known = images.get(url)
  if (known !== undefined) return known
  const img = new Image()
  img.decoding = 'async'
  const loaded = new Promise<HTMLImageElement>((resolve, reject) => {
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`bridge art: ${url}`))
  }).then(async (ready) => {
    if (typeof ready.decode === 'function') {
      await ready.decode().catch(() => undefined)
    }
    return ready
  })
  img.src = url
  images.set(url, loaded)
  loaded.catch(() => images.delete(url))
  return loaded
}

const dpr = (): number =>
  typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1

/**
 * On the tap that opens the room: the river's decode and the glass's
 * loads. The result's picture waits for the last slide.
 */
export function preloadNgArt(): void {
  preloadPlate(RIVER_PLATE)
  if (typeof Image === 'undefined') return
  const art = bridgeArt(dpr())
  for (const url of [art.glassUnlit, art.glassLit, REFLECTION_ART.unlit]) {
    if (url !== '') void bridgeImage(url).catch(() => undefined)
  }
}

/**
 * The result's plate, started as the last slide begins; the scene decodes
 * its lit band at the same moment (BridgeView.prepareResult).
 */
export function preloadNgResult(): void {
  preloadPlate(RESULT_PLATE)
}
