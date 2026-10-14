// ============================================================
// The arches' glass: unlit pictures, and a canvas for each arch lighting
// ============================================================
//
// Every arch shows its unlit glass as a plain image. The arch the voice
// is on gets a canvas over it (and one over its reflection): it starts as
// a copy of the unlit glass, and each lit strip is copied in from the lit
// glass, one drawImage a strip (ART-FIDELITY.md 4). At most two arches
// hold canvases: the one being sung and the one before it, still on
// screen; an older one has scrolled off by then and goes back to its
// picture. Light never drains: a strip once copied is never redrawn.
//
// The glass is light added over the river (the canvases are opaque, black
// where there is no glass, and their layer is blended additively by the
// scene), so a canvas needs no transparency.

import { ARCH, PLATES } from './bridge-geometry'
import type { LitStrip } from './bridge-reveal'

/** The arch sprites' frame, about the apex column (W). */
const FRAME = PLATES['glass-unlit'].frame

/** The four pictures a lit arch is copied from, decoded. */
export interface GlassImages {
  readonly glassUnlit: HTMLImageElement
  readonly glassLit: HTMLImageElement
  readonly reflectionUnlit: HTMLImageElement
  readonly reflectionLit: HTMLImageElement
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

export interface ArchGlass {
  /** Copy these strips in, each onto its arch. */
  paint: (strips: readonly LitStrip[]) => void
  /** A new run: every canvas goes, every arch shows its unlit picture. */
  reset: () => void
}

interface Lit {
  readonly arch: number
  readonly glass: HTMLCanvasElement
  readonly reflection: HTMLCanvasElement
}

/** Pixel columns of a u range on a picture `width` px wide. */
export function columnsOf(
  from: number,
  to: number,
  width: number,
): [number, number] {
  const at = (u: number): number =>
    ((u * ARCH.a - FRAME.left) / FRAME.width) * width
  // A foot's edge reaches the picture's edge: the glass's glow beyond it
  // lights with it.
  const x0 = from <= -1 + 1e-6 ? 0 : Math.max(0, Math.floor(at(from)))
  const x1 = to >= 1 - 1e-6 ? width : Math.min(width, Math.ceil(at(to)))
  return [x0, x1]
}

function copyColumns(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  from: number,
  to: number,
): void {
  const ctx = canvas.getContext('2d')
  if (ctx === null) return
  const [x0, x1] = columnsOf(from, to, canvas.width)
  if (x1 <= x0) return
  ctx.drawImage(
    image,
    x0,
    0,
    x1 - x0,
    canvas.height,
    x0,
    0,
    x1 - x0,
    canvas.height,
  )
}

function canvasOver(
  holder: HTMLElement,
  image: HTMLImageElement,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth || image.width
  canvas.height = image.naturalHeight || image.height
  canvas.setAttribute('aria-hidden', 'true')
  canvas.dataset.lit = 'true'
  canvas.style.cssText =
    'position:absolute;inset:0;width:100%;height:100%;display:block'
  canvas.getContext('2d')?.drawImage(image, 0, 0)
  holder.appendChild(canvas)
  return canvas
}

export function createArchGlass(deps: ArchGlassDeps): ArchGlass {
  const maxLive = deps.maxLive ?? 2
  let live: Lit[] = []
  let images: GlassImages | null = null
  let asked = false
  /** Strips heard before the pictures decoded, painted once they have. */
  let queued: LitStrip[] = []

  const litFor = (arch: number, art: GlassImages): Lit | null => {
    const known = live.find((lit) => lit.arch === arch)
    if (known !== undefined) return known
    const holders = deps.holders(arch)
    if (holders === null) return null
    const lit: Lit = {
      arch,
      glass: canvasOver(holders.glass, art.glassUnlit),
      reflection: canvasOver(holders.reflection, art.reflectionUnlit),
    }
    live.push(lit)
    // The oldest goes back to its picture: it has scrolled off.
    while (live.length > maxLive) {
      const old = live.shift()
      old?.glass.remove()
      old?.reflection.remove()
    }
    return lit
  }

  const draw = (strips: readonly LitStrip[], art: GlassImages): void => {
    for (const strip of strips) {
      const lit = litFor(strip.arch, art)
      if (lit === null) continue
      copyColumns(lit.glass, art.glassLit, strip.from, strip.to)
      copyColumns(lit.reflection, art.reflectionLit, strip.from, strip.to)
    }
  }

  const ask = (): void => {
    if (asked) return
    asked = true
    void deps.images().then(
      (art) => {
        images = art
        const waiting = queued
        queued = []
        draw(waiting, art)
      },
      () => {
        // No pictures: the run goes on with the bridge unlit.
        asked = false
        queued = []
      },
    )
  }

  return {
    paint: (strips) => {
      if (strips.length === 0) return
      if (images === null) {
        queued.push(...strips)
        ask()
        return
      }
      draw(strips, images)
    },
    reset: () => {
      for (const lit of live) {
        lit.glass.remove()
        lit.reflection.remove()
      }
      live = []
      queued = []
    },
  }
}
