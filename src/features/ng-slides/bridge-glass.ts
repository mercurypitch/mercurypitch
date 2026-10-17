// ============================================================
// The arches' glass: unlit pictures, and a canvas for each arch lighting
// ============================================================
//
// Ng slides' light, through the glide rooms' lit arches (room-kit
// glide/lit-arches.ts): every arch shows its unlit glass as a plain image,
// and the arch the voice is on gets a canvas over it, and one over its
// reflection, that light strip by strip from the lit glass (ART-FIDELITY.md
// 4). An arch has two layers: its glass, then its reflection.
//
// The glass is light added over the river (the canvases are opaque, black
// where there is no glass, and their layer is blended additively by the
// scene), so a canvas needs no transparency and a strip is drawn straight
// over the unlit copy.

import type { CanvasPicture } from '@/components/room-kit/canvas-picture'
import type { LitArches } from '@/components/room-kit/glide/lit-arches'
import { archColumns, createLitArches, } from '@/components/room-kit/glide/lit-arches'
import { ARCH, PLATES } from './bridge-geometry'

/** The four pictures a lit arch is copied from, decoded. */
export interface GlassImages {
  readonly glassUnlit: CanvasPicture
  readonly glassLit: CanvasPicture
  readonly reflectionUnlit: CanvasPicture
  readonly reflectionLit: CanvasPicture
}

/** Where arch k's glass and its reflection are placed in the scene. */
export interface GlassHolders {
  readonly glass: HTMLElement
  readonly reflection: HTMLElement
}

export interface ArchGlassDeps {
  holders: (arch: number) => GlassHolders | null
  images: () => Promise<GlassImages>
  /** Canvases kept at once. */
  maxLive?: number
}

export type ArchGlass = LitArches

/**
 * The arch sprites' columns: their frame is about the apex column (W). The
 * reflection's picture is lit over the same columns of its own width.
 */
const columns = archColumns(ARCH.a, PLATES['glass-unlit'].frame)

export function createArchGlass(deps: ArchGlassDeps): ArchGlass {
  return createLitArches({
    holders: (arch) => {
      const holders = deps.holders(arch)
      return holders === null ? null : [holders.glass, holders.reflection]
    },
    images: () => deps.images(),
    layers: (art) => [
      { unlit: art.glassUnlit, lit: art.glassLit },
      { unlit: art.reflectionUnlit, lit: art.reflectionLit },
    ],
    columns,
    clearStrip: false,
    maxLive: deps.maxLive,
  })
}
