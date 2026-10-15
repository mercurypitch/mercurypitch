// ============================================================
// Lip roll's art: the bay's plates, as the room loads them
// ============================================================
//
// The files are written by scripts/sync-lip-art.mjs: the L0 paintings
// when they exist, else stand-ins (every plate today; bay-geometry.ts
// marks each `standIn`, STAND-INS.md says what each stands for). Every
// import is relative, so a build without the premium exercises folds each
// one to an empty string (apps/mercurypitch/vite.config.ts,
// PREMIUM_IMAGES) and the store build carries none of them
// (assert-bundle.mjs holds it to that).
//
// The wave, the sea-front and the result come in two widths: a phone at
// DPR 2 or under takes the 860 px-per-W files, a DPR 3 phone the 1290
// ones. The waves and the result's lit band are copied into canvases
// (bay-waves.ts, room-kit/result-band.ts) from pictures the scene decodes
// off the main thread (room-kit/canvas-picture.ts). The waves are still
// loaded here as images and kept decoded: each wave is also an <img> in
// the scene (BayScene.tsx), and with only the files downloaded ahead a
// 33 ms frame came back into wave 1 in 3 of 15 measured runs, against
// none in 9 with this hold (2026-10-15). The bay-back is a plate
// (plate-loader.ts), decoded while the screen pushes in.

import type { PlateSpec } from '@/components/room-kit/plate-loader'
import { preloadPlate } from '@/components/room-kit/plate-loader'
import bayBack from './art/bay-back.webp'
import bubble from './art/bay-bubble.webp'
import result860 from './art/bay-result-860.webp'
import result1290 from './art/bay-result-1290.webp'
import resultLit860 from './art/bay-result-lit-860.webp'
import resultLit1290 from './art/bay-result-lit-1290.webp'
import seaFront860 from './art/bay-sea-front-860.webp'
import seaFront1290 from './art/bay-sea-front-1290.webp'
import waveLit860 from './art/bay-wave-lit-860.webp'
import waveLit1290 from './art/bay-wave-lit-1290.webp'
import waveUnlit860 from './art/bay-wave-unlit-860.webp'
import waveUnlit1290 from './art/bay-wave-unlit-1290.webp'
import { PLATES } from './bay-geometry'

/** One width's files for everything drawn in the bay itself. */
export interface BayArt {
  /** Px per W of these files. */
  readonly px: number
  readonly waveUnlit: string
  readonly waveLit: string
  readonly seaFront: string
  readonly resultLit: string
}

const SMALL: BayArt = {
  px: 860,
  waveUnlit: waveUnlit860,
  waveLit: waveLit860,
  seaFront: seaFront860,
  resultLit: resultLit860,
}

const LARGE: BayArt = {
  px: 1290,
  waveUnlit: waveUnlit1290,
  waveLit: waveLit1290,
  seaFront: seaFront1290,
  resultLit: resultLit1290,
}

/** The files for a screen of this pixel ratio: 860 at DPR 2 and under. */
export function bayArt(dpr: number): BayArt {
  return dpr > 2 ? LARGE : SMALL
}

/** One glass bubble, drawn along the voice. */
export const BUBBLE_URL = bubble

/** The sky, the moon, the cliffs and the far sea: one plate, a quarter of the waves' speed. */
export const BAY_PLATE: PlateSpec = {
  key: 'lip-bay-back',
  candidates: [
    {
      url: bayBack,
      width: Math.round(PLATES.back.frame.width * PLATES.back.widths[0]),
    },
  ],
  sizes: `${Math.round(PLATES.back.frame.width * 100)}vw`,
}

/** The pulled-back view of the whole bay, unlit. */
export const RESULT_PLATE: PlateSpec = {
  key: 'lip-result',
  candidates: [
    { url: result860, width: 860 },
    { url: result1290, width: 1290 },
  ],
  sizes: '100vw',
}

const images = new Map<string, Promise<HTMLImageElement>>()

/**
 * One image, loaded and decoded once and kept; rejects when it will not
 * load. The bubble is drawn from this and the waves are held in it; the
 * waves' canvases and the result's band only fall back to it where a
 * bitmap cannot be made.
 */
export function bayImage(url: string): Promise<HTMLImageElement> {
  const known = images.get(url)
  if (known !== undefined) return known
  const img = new Image()
  img.decoding = 'async'
  const loaded = new Promise<HTMLImageElement>((resolve, reject) => {
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`bay art: ${url}`))
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
 * On the tap that opens the room: the bay-back's decode, the waves' and
 * the bubble's loads. The result's pictures wait for the last wave.
 */
export function preloadLipArt(): void {
  preloadPlate(BAY_PLATE)
  if (typeof Image === 'undefined') return
  const art = bayArt(dpr())
  for (const url of [art.waveUnlit, art.waveLit, BUBBLE_URL]) {
    if (url !== '') void bayImage(url).catch(() => undefined)
  }
}

/**
 * The result's plate, started as the last wave begins; the scene decodes
 * its lit band at the same moment (BayView.prepareResult).
 */
export function preloadLipResult(): void {
  preloadPlate(RESULT_PLATE)
}
