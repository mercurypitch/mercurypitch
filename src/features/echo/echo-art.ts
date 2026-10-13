// ============================================================
// Echo's art: the painted plates and the star sprites, as the room loads them
// ============================================================
//
// The files are the Echo A0 art (agent-out, premium-exercises-art/echo-a0
// final/), copied by scripts/sync-echo-art.mjs. Every import is relative,
// so a build without the premium exercises folds each one to an empty
// string (apps/mercurypitch/vite.config.ts, PREMIUM_IMAGES) and the store
// build carries none of them (assert-bundle.mjs holds it to that).
//
// The plates come in two widths: a phone at DPR 2 or under takes the 860
// px plate, a DPR 3 phone the 1290 px one (plate-loader.ts). A tablet's
// own plate joins as a `<picture>` source in PR 5. The take's cloud layer
// (art round 3) has the plate's own frame and widths, so it is loaded and
// placed as a plate; the demo's (echo-clouds-demo-off-*) waits for the demo
// in PR 4.

import type { PlateSpec } from '@/components/room-kit/plate-loader'
import { preloadPlate } from '@/components/room-kit/plate-loader'
import cloudsTake860 from './art/echo-clouds-mid-take-860.webp'
import cloudsTake1290 from './art/echo-clouds-mid-take-1290.webp'
import haloFinished from './art/echo-halo-finished.webp'
import haloPhrase from './art/echo-halo-phrase.webp'
import haloResult from './art/echo-halo-result.webp'
import finishedBase from './art/echo-star-finished-base.webp'
import finishedBright from './art/echo-star-finished-bright.webp'
import finishedCyan from './art/echo-star-finished-cyan.webp'
import finishedViolet from './art/echo-star-finished-violet.webp'
import phraseBase from './art/echo-star-phrase-base.webp'
import phraseBright from './art/echo-star-phrase-bright.webp'
import phraseCyan from './art/echo-star-phrase-cyan.webp'
import phraseViolet from './art/echo-star-phrase-violet.webp'
import resultBase from './art/echo-star-result-base.webp'
import resultBright from './art/echo-star-result-bright.webp'
import resultCyan from './art/echo-star-result-cyan.webp'
import resultViolet from './art/echo-star-result-violet.webp'
import world860 from './art/echo-world-860.webp'
import world1290 from './art/echo-world-1290.webp'
import worldResult860 from './art/echo-world-result-860.webp'
import worldResult1290 from './art/echo-world-result-1290.webp'
import type { StarSize } from './echo-geometry'

/** A star's painted tint: the storyboard's stars run between these. */
export type StarTint = 'base' | 'violet' | 'cyan' | 'bright'

/** The night sky over the rooftops. */
export const WORLD_PLATE: PlateSpec = {
  key: 'echo-world',
  candidates: [
    { url: world860, width: 860 },
    { url: world1290, width: 1290 },
  ],
  sizes: '100vw',
}

/** The same world with the town lit, for the result. */
export const RESULT_PLATE: PlateSpec = {
  key: 'echo-world-result',
  candidates: [
    { url: worldResult860, width: 860 },
    { url: worldResult1290, width: 1290 },
  ],
  sizes: '100vw',
}

/**
 * The take's clouds: a transparent layer cut round the towers, so it
 * registers with the world plate only in the plate's own box.
 */
export const CLOUD_PLATE: PlateSpec = {
  key: 'echo-clouds-mid-take',
  candidates: [
    { url: cloudsTake860, width: 860 },
    { url: cloudsTake1290, width: 1290 },
  ],
  sizes: '100vw',
}

/** Each size's sprite per tint, and its halo. */
export const STAR_ART: Readonly<
  Record<
    StarSize,
    { readonly tints: Record<StarTint, string>; readonly halo: string }
  >
> = {
  phrase: {
    tints: {
      base: phraseBase,
      violet: phraseViolet,
      cyan: phraseCyan,
      bright: phraseBright,
    },
    halo: haloPhrase,
  },
  result: {
    tints: {
      base: resultBase,
      violet: resultViolet,
      cyan: resultCyan,
      bright: resultBright,
    },
    halo: haloResult,
  },
  finished: {
    tints: {
      base: finishedBase,
      violet: finishedViolet,
      cyan: finishedCyan,
      bright: finishedBright,
    },
    halo: haloFinished,
  },
}

/** The sprites are small: the browser keeps them once they have loaded. */
let spritesAsked = false

/**
 * Start the world plate's decode and the sprites' loads, on the tap that
 * opens the room. The result plate waits for the last phrase.
 */
export function preloadEchoArt(): void {
  preloadPlate(WORLD_PLATE)
  if (spritesAsked || typeof Image === 'undefined') return
  spritesAsked = true
  for (const size of Object.values(STAR_ART)) {
    for (const url of [...Object.values(size.tints), size.halo]) {
      if (url === '') continue
      const img = new Image()
      img.decoding = 'async'
      img.src = url
    }
  }
}

/** The result plate's decode, started as the last phrase begins. */
export function preloadEchoResult(): void {
  preloadPlate(RESULT_PLATE)
}
