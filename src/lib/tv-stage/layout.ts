// ============================================================
// TV stage layout — where everything goes on a screen of a given size
// ============================================================
//
// Laid out for a 16:9 screen and kept inside a 5% margin on every side,
// because a TV may crop its edges (Google's TV app quality guidelines ask
// for the same overscan margin, REQ-TV-020): the title and the score along
// the top, the pitch lane across the middle, the lyrics below it. Type and
// strokes are sized from the screen's height, in units of 1080 lines, so a
// line reads the same from the sofa at any resolution.
//
// Tests: src/lib/tv-stage/renderer.test.ts.

export interface TvStageBox {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

export interface TvStageLayout {
  readonly width: number
  readonly height: number
  /** Everything drawn stays inside this box: 5% in from every edge. */
  readonly safe: TvStageBox
  readonly header: TvStageBox
  readonly lane: TvStageBox
  readonly lyrics: TvStageBox
  /** One unit of type: the screen's height over 1080, so 1 at 1080p. */
  readonly unit: number
}

export interface TvStageSize {
  readonly width: number
  readonly height: number
}

/** Where everything goes on a screen of this size. */
export function tvStageLayout(width: number, height: number): TvStageLayout {
  const safe = {
    x: width * 0.05,
    y: height * 0.05,
    w: width * 0.9,
    h: height * 0.9,
  }
  const header = { x: safe.x, y: safe.y, w: safe.w, h: safe.h * 0.12 }
  const laneTop = header.y + header.h + safe.h * 0.03
  const lane = { x: safe.x, y: laneTop, w: safe.w, h: safe.h * 0.5 }
  const lyricsTop = lane.y + lane.h + safe.h * 0.05
  const lyrics = {
    x: safe.x,
    y: lyricsTop,
    w: safe.w,
    h: safe.y + safe.h - lyricsTop,
  }
  return { width, height, safe, header, lane, lyrics, unit: height / 1080 }
}

const FONT = '-apple-system, "SF Pro Display", system-ui, sans-serif'

/** A canvas font of the stage's face, at `px` pixels. */
export const stageFont = (weight: number, px: number): string =>
  `${String(weight)} ${String(Math.round(px))}px ${FONT}`

/** `text`, cut short with an ellipsis to fit `maxWidth` in the current font. */
export function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  let cut = text
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) {
    cut = cut.slice(0, -1)
  }
  return `${cut.trimEnd()}…`
}
