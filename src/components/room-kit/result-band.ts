// ============================================================
// A result band: the take's lit columns, copied from a decoded picture
// ============================================================
//
// At the result, Lip roll's bay and Ng slides' bridge copy columns of a lit
// picture (the ranges the take lit) into a canvas over the unlit view.
// Copied from an <img>, the picture was decoded on the main thread in the
// commit of the result's own frame: Lip roll's 1290 x 1560 band cost 38 ms
// there at 4x CPU, in an 84 ms task; Ng's 1290 x 582 band 10 ms, in a
// 46 ms one (measured 2026-10-15).
//
// So the band's picture is a canvas picture (canvas-picture.ts), decoded
// off the main thread, and the room asks for it ahead of the result
// (`prepare`, as the last wave or slide begins), which also sizes the
// canvas. The result's frame then only copies columns of a decoded bitmap.
// The room owns the picture and lets it go when it leaves (`release`).

import type { CanvasPicture } from './canvas-picture'
import { createPictureSet, pictureSize } from './canvas-picture'

/** Columns of the picture, [x0, x1) in its px; empty ones are skipped. */
export type BandColumns = readonly (readonly [number, number])[]

export interface ResultBand {
  /** Decode the picture and size the canvas to it, ahead of the result. */
  prepare: () => void
  /**
   * The band: the canvas cleared, then `columns(width)` copied from the
   * picture (`width` is the picture's, which the canvas takes).
   */
  paint: (columns: (width: number) => BandColumns) => Promise<void>
  /** The room is leaving: the picture goes. */
  release: () => void
}

/**
 * The band drawn into `canvas` from the picture at `url`; `fallback` (the
 * room's <img> loader) where a bitmap cannot be made.
 */
export function createResultBand(
  canvas: () => HTMLCanvasElement | undefined,
  url: () => string,
  fallback: (url: string) => Promise<HTMLImageElement>,
): ResultBand {
  const pictures = createPictureSet(() => [url()], fallback)
  const picture = async (): Promise<CanvasPicture | null> => {
    const [decoded] = await pictures.get().catch(() => [])
    return decoded ?? null
  }

  /** The canvas at the picture's size; resized only when it differs, as a resize clears it. */
  const sizedTo = (decoded: CanvasPicture): CanvasRenderingContext2D | null => {
    const target = canvas()
    if (target === undefined) return null
    const { width, height } = pictureSize(decoded)
    if (target.width !== width) target.width = width
    if (target.height !== height) target.height = height
    return target.getContext('2d')
  }

  return {
    prepare: () => {
      void picture().then((decoded) => {
        if (decoded !== null) sizedTo(decoded)
      })
    },
    paint: async (columns) => {
      const decoded = await picture()
      if (decoded === null) return
      const ctx = sizedTo(decoded)
      if (ctx === null) return
      const { width, height } = ctx.canvas
      ctx.clearRect(0, 0, width, height)
      for (const [x0, x1] of columns(width)) {
        if (x1 > x0) {
          ctx.drawImage(decoded, x0, 0, x1 - x0, height, x0, 0, x1 - x0, height)
        }
      }
    },
    release: () => pictures.release(),
  }
}
