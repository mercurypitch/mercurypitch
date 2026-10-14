// ============================================================
// The waves: unlit pictures, and a canvas for each wave lighting
// ============================================================
//
// Every wave shows its unlit water as a plain image. The wave the voice
// is on gets a canvas over it: it starts as a copy of the unlit picture,
// and each lit strip is copied in from the lit picture, one clear and one
// drawImage a strip (ART-FIDELITY.md 4). At most two waves hold canvases:
// the one being sung and the one before it, still on screen; an older one
// has scrolled off by then and goes back to its picture. Light never
// drains: a strip once copied is never redrawn.
//
// Unlike Ng's glass, the water is drawn normally (opaque where there is
// water, transparent around it), so a strip is cleared before the lit
// picture is drawn into it: the lit glow's edge must not sit on the
// unlit's.

import type { LitStrip } from '@/components/room-kit/glide-reveal'
import { PLATES, WAVE } from './bay-geometry'

/** The wave sprites' frame, about the crest (W). */
const FRAME = PLATES['wave-unlit'].frame

/** The two pictures a lit wave is copied from, decoded. */
export interface WaveImages {
  readonly unlit: HTMLImageElement
  readonly lit: HTMLImageElement
}

export interface BayWavesDeps {
  holder: (wave: number) => HTMLElement | null
  images: () => Promise<WaveImages>
  /** Canvases kept at once. */
  maxLive?: number
}

export interface BayWaves {
  /** Copy these strips in, each onto its wave. */
  paint: (strips: readonly LitStrip[]) => void
  /** A new run: every canvas goes, every wave shows its unlit picture. */
  reset: () => void
}

interface Lit {
  readonly wave: number
  readonly canvas: HTMLCanvasElement
}

/** Pixel columns of a u range on a picture `width` px wide. */
export function columnsOf(
  from: number,
  to: number,
  width: number,
): [number, number] {
  const at = (u: number): number =>
    ((u * WAVE.a - FRAME.left) / FRAME.width) * width
  // A foot's edge reaches the picture's edge: the water beyond it lights
  // with it.
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
  ctx.clearRect(x0, 0, x1 - x0, canvas.height)
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

export function createBayWaves(deps: BayWavesDeps): BayWaves {
  const maxLive = deps.maxLive ?? 2
  let live: Lit[] = []
  let images: WaveImages | null = null
  let asked = false
  /** Strips heard before the pictures decoded, painted once they have. */
  let queued: LitStrip[] = []

  const litFor = (wave: number, art: WaveImages): Lit | null => {
    const known = live.find((lit) => lit.wave === wave)
    if (known !== undefined) return known
    const holder = deps.holder(wave)
    if (holder === null) return null
    const lit: Lit = { wave, canvas: canvasOver(holder, art.unlit) }
    live.push(lit)
    // The oldest goes back to its picture: it has scrolled off.
    while (live.length > maxLive) live.shift()?.canvas.remove()
    return lit
  }

  const draw = (strips: readonly LitStrip[], art: WaveImages): void => {
    for (const strip of strips) {
      const lit = litFor(strip.arch, art)
      if (lit !== null) copyColumns(lit.canvas, art.lit, strip.from, strip.to)
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
        // No pictures: the run goes on with the bay unlit.
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
      for (const lit of live) lit.canvas.remove()
      live = []
      queued = []
    },
  }
}
