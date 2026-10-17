// ============================================================
// Lit arches: unlit pictures, and a canvas over each arch lighting
// ============================================================
//
// The glide rooms' light, one strip at a time (ART-FIDELITY.md 4). Every
// arch shows its unlit art as plain images, one a layer (Lip roll's wave
// has one, its water; Ng slides' arch has two, its glass and the glass's
// reflection). The arch the voice is on gets a canvas over each layer: it
// starts as a copy of the unlit picture, and each lit strip is copied in
// from the lit picture, one drawImage a strip a canvas. At most two
// arches hold canvases: the one being sung and the one before it, still on
// screen; an older one has scrolled off by then and goes back to its
// pictures. Light never drains: a strip once copied is never redrawn.
//
// The first arch's canvases are made ahead, as soon as the pictures have
// decoded after a reset (the view attaching, a run starting), so the first
// lit strip is one strip's copy a canvas and nothing else. Made on that
// frame, they cost a full-picture copy a layer and, from <img> sources,
// every picture's decode on the main thread: 167 ms in Lip roll and a 25 to
// 28 ms task in Ng slides at 4x CPU, measured 2026-10-15. The pictures now
// come decoded off the main thread (room-kit/canvas-picture.ts). The ready
// canvases stay hidden until their first strip: over its <img> a canvas is
// drawn a little differently (up to 11 of 255 on screen 1), so the unlit
// arch looks as it always did until it lights.
//
// A room brings its own art: where each arch's layers are placed, its
// pictures, how a u range maps to a picture's columns, and whether a strip
// is cleared before the lit picture is drawn into it (art drawn with
// transparency, so the lit glow's edge must not sit on the unlit's).
// bay-waves.ts and bridge-glass.ts are the two rooms' setups.

import type { CanvasPicture } from '@/components/room-kit/canvas-picture'
import { pictureSize } from '@/components/room-kit/canvas-picture'
import type { LitStrip } from '@/components/room-kit/glide-reveal'

/** The two pictures one layer of an arch is copied from, decoded. */
export interface LitLayer {
  readonly unlit: CanvasPicture
  readonly lit: CanvasPicture
}

/** A sprite's frame about its arch's middle column, in the picture's W. */
export interface ArchFrame {
  readonly left: number
  readonly width: number
}

/** Pixel columns of a u range on a picture, from its first column to past its last. */
export type ArchColumns = (
  from: number,
  to: number,
  width: number,
) => [number, number]

export interface LitArchesSetup<I> {
  /** Where arch k's layers are placed, one holder a layer; null if absent. */
  holders: (arch: number) => readonly HTMLElement[] | null
  /** The room's pictures, decoded. */
  images: () => Promise<I>
  /** Each layer's pictures, in the holders' order. */
  layers: (art: I) => readonly LitLayer[]
  /** Where a strip falls on a picture (archColumns). */
  columns: ArchColumns
  /** Clear a strip before the lit picture is drawn into it. */
  clearStrip: boolean
  /** Arches holding canvases at once. */
  maxLive?: number
}

export interface LitArches {
  /** Copy these strips in, each onto its arch. */
  paint: (strips: readonly LitStrip[]) => void
  /**
   * A new run: every lit canvas goes, every arch shows its unlit pictures,
   * and the first arch's canvases are made ready for its first strip.
   */
  reset: () => void
  /** The room is leaving: every canvas goes and nothing more is made. */
  dispose: () => void
}

interface Lit {
  readonly arch: number
  /** One a layer, in the holders' order. */
  readonly canvases: readonly HTMLCanvasElement[]
}

/**
 * The columns of a u range (-1 to 1 over an arch of half-width `a`, W) on
 * a picture `width` px wide whose sprite frame is `frame`.
 */
export function archColumns(a: number, frame: ArchFrame): ArchColumns {
  return (from, to, width) => {
    const at = (u: number): number =>
      ((u * a - frame.left) / frame.width) * width
    // A foot's edge reaches the picture's edge: the art beyond it lights
    // with it.
    const x0 = from <= -1 + 1e-6 ? 0 : Math.max(0, Math.floor(at(from)))
    const x1 = to >= 1 - 1e-6 ? width : Math.min(width, Math.ceil(at(to)))
    return [x0, x1]
  }
}

/** Copy one strip of `image` into `canvas`, over the same columns. */
function copyColumns(
  canvas: HTMLCanvasElement,
  image: CanvasPicture,
  strip: LitStrip,
  columns: ArchColumns,
  clear: boolean,
): void {
  const ctx = canvas.getContext('2d')
  if (ctx === null) return
  const [x0, x1] = columns(strip.from, strip.to, canvas.width)
  if (x1 <= x0) return
  if (clear) ctx.clearRect(x0, 0, x1 - x0, canvas.height)
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
  image: CanvasPicture,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  const size = pictureSize(image)
  canvas.width = size.width
  canvas.height = size.height
  canvas.setAttribute('aria-hidden', 'true')
  canvas.dataset.lit = 'true'
  canvas.style.cssText =
    'position:absolute;inset:0;width:100%;height:100%;display:block'
  canvas.getContext('2d')?.drawImage(image, 0, 0)
  holder.appendChild(canvas)
  return canvas
}

const removeAll = (lit: Lit): void => {
  for (const canvas of lit.canvases) canvas.remove()
}

const setVisibility = (lit: Lit, visibility: '' | 'hidden'): void => {
  for (const canvas of lit.canvases) canvas.style.visibility = visibility
}

export function createLitArches<I>(setup: LitArchesSetup<I>): LitArches {
  const maxLive = setup.maxLive ?? 2
  let live: Lit[] = []
  /** The first arch's canvases, made ahead and not lit yet. */
  let ready: Lit | null = null
  let layers: readonly LitLayer[] | null = null
  let asked = false
  let disposed = false
  /** Strips heard before the pictures decoded, painted once they have. */
  let queued: LitStrip[] = []

  const canvasesFor = (arch: number, art: readonly LitLayer[]): Lit | null => {
    const holders = setup.holders(arch)
    if (holders === null) return null
    return {
      arch,
      canvases: holders.map((holder, i) => canvasOver(holder, art[i].unlit)),
    }
  }

  /** The first arch's canvases, before its first strip needs them. */
  const makeReady = (art: readonly LitLayer[]): void => {
    if (disposed || ready !== null || live.length > 0) return
    ready = canvasesFor(0, art)
    // Hidden until lit: the pictures under them show, as before they existed.
    if (ready !== null) setVisibility(ready, 'hidden')
  }

  const litFor = (arch: number, art: readonly LitLayer[]): Lit | null => {
    const known = live.find((lit) => lit.arch === arch)
    if (known !== undefined) return known
    let lit: Lit | null
    if (ready !== null && ready.arch === arch) {
      lit = ready
      ready = null
      setVisibility(lit, '')
    } else {
      lit = canvasesFor(arch, art)
    }
    if (lit === null) return null
    live.push(lit)
    // The oldest goes back to its pictures: it has scrolled off.
    while (live.length > maxLive) {
      const old = live.shift()
      if (old !== undefined) removeAll(old)
    }
    return lit
  }

  const draw = (
    strips: readonly LitStrip[],
    art: readonly LitLayer[],
  ): void => {
    for (const strip of strips) {
      const lit = litFor(strip.arch, art)
      if (lit === null) continue
      lit.canvases.forEach((canvas, i) => {
        copyColumns(canvas, art[i].lit, strip, setup.columns, setup.clearStrip)
      })
    }
  }

  const ask = (): void => {
    if (asked) return
    asked = true
    void setup.images().then(
      (art) => {
        if (disposed) return
        layers = setup.layers(art)
        const waiting = queued
        queued = []
        if (waiting.length === 0) makeReady(layers)
        else draw(waiting, layers)
      },
      () => {
        // No pictures: the run goes on with the arches unlit.
        asked = false
        queued = []
      },
    )
  }

  return {
    paint: (strips) => {
      if (strips.length === 0 || disposed) return
      if (layers === null) {
        queued.push(...strips)
        ask()
        return
      }
      draw(strips, layers)
    },
    reset: () => {
      for (const lit of live) removeAll(lit)
      live = []
      queued = []
      if (disposed) return
      // Ready canvases never lit are still the unlit pictures: they stay.
      if (layers === null) ask()
      else makeReady(layers)
    },
    dispose: () => {
      disposed = true
      for (const lit of live) removeAll(lit)
      if (ready !== null) removeAll(ready)
      live = []
      ready = null
      queued = []
    },
  }
}
