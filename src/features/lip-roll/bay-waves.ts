// ============================================================
// The waves: unlit pictures, and a canvas for each wave lighting
// ============================================================
//
// Lip roll's light, through the glide rooms' lit arches (room-kit
// glide/lit-arches.ts): every wave shows its unlit water as a plain image,
// and the wave the voice is on gets a canvas over it that lights strip by
// strip from the lit picture (ART-FIDELITY.md 4). A wave has one layer,
// its water.
//
// Unlike Ng's glass, the water is drawn normally (opaque where there is
// water, transparent around it), so a strip is cleared before the lit
// picture is drawn into it: the lit glow's edge must not sit on the
// unlit's.

import type { CanvasPicture } from '@/components/room-kit/canvas-picture'
import type { LitArches } from '@/components/room-kit/glide/lit-arches'
import { archColumns, createLitArches, } from '@/components/room-kit/glide/lit-arches'
import { PLATES, WAVE } from './bay-geometry'

/** The two pictures a lit wave is copied from, decoded. */
export interface WaveImages {
  readonly unlit: CanvasPicture
  readonly lit: CanvasPicture
}

export interface BayWavesDeps {
  holder: (wave: number) => HTMLElement | null
  images: () => Promise<WaveImages>
  /** Canvases kept at once. */
  maxLive?: number
}

export type BayWaves = LitArches

/** The wave sprites' columns: their frame is about the crest (W). */
const columns = archColumns(WAVE.a, PLATES['wave-unlit'].frame)

export function createBayWaves(deps: BayWavesDeps): BayWaves {
  return createLitArches({
    holders: (wave) => {
      const holder = deps.holder(wave)
      return holder === null ? null : [holder]
    },
    images: () => deps.images(),
    layers: (art) => [art],
    columns,
    clearStrip: true,
    maxLive: deps.maxLive,
  })
}
