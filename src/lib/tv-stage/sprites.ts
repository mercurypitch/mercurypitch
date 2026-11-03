// ============================================================
// TV stage sprites — the glass, painted once per screen size
// ============================================================
//
// The phone draws the stage for the TV every frame, beside the room it is
// also running, so the stage paints its expensive pieces (the lane's glass
// panel, the notes' yellow glass, the singer's glowing dot, the now marker,
// the paused screen's bar) once, on canvases of their own, and stamps them
// with drawImage from then on. A blur is a shadow drawn while a sprite is
// painted, never in a frame: the canvas's shadowBlur is the costliest thing
// it can be asked for, and a frame would ask it of every note.
//
// A sprite is asked for by a key that carries its size, and painted the
// first time it is asked for. A new screen size forgets them all, so a TV
// that comes back at another resolution gets sprites at its own pixels. The
// canvases come from a factory, so a test can paint on a recording context.
//
// Tests: src/lib/tv-stage/sprites.test.ts.

/** A painted sprite: what drawImage takes, and its size in pixels. */
export interface Sprite {
  readonly image: CanvasImageSource
  readonly width: number
  readonly height: number
}

/**
 * A canvas to paint a sprite on, and its picture once painted: what
 * drawImage stamps from then on.
 */
export interface SpriteCanvas {
  readonly ctx: CanvasRenderingContext2D
  readonly done: () => CanvasImageSource
}

/**
 * A canvas `width` by `height` for the sprite `key` names, with no alpha
 * channel where it is `opaque`, or null where none can be made. The key is
 * for a test, to tell its sprites apart.
 */
export type SpriteCanvasFactory = (
  width: number,
  height: number,
  key: string,
  opaque: boolean,
) => SpriteCanvas | null

/** The sprites of one screen, painted once each. */
export interface SpriteCache {
  /**
   * The sprite `key` names, `width` by `height` pixels, painted by `paint`
   * the first time it is asked for on this screen. Null where no canvas can
   * be made: the stage then draws without it.
   */
  get: (
    key: string,
    size: {
      readonly width: number
      readonly height: number
      /** Every pixel painted solid: it is stamped as a copy. */
      readonly opaque?: boolean
    },
    paint: (ctx: CanvasRenderingContext2D) => void,
  ) => Sprite | null
  /** The screen the sprites are for: a new size forgets every sprite. */
  screen: (width: number, height: number) => void
}

/**
 * A sprite's canvas as the stage page makes it: a canvas of the page's own
 * document, without an alpha channel for an opaque sprite, which the
 * browser can then stamp as a plain copy rather than blend.
 */
function spriteCanvas(
  width: number,
  height: number,
  _key: string,
  opaque: boolean,
): SpriteCanvas | null {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { alpha: !opaque })
  return ctx === null ? null : { ctx, done: () => canvas }
}

export function createSpriteCache(
  factory: SpriteCanvasFactory = spriteCanvas,
): SpriteCache {
  let painted = new Map<string, Sprite | null>()
  let screen = ''
  return {
    get: (key, size, paint) => {
      const kept = painted.get(key)
      if (kept !== undefined) return kept
      const width = Math.max(1, Math.ceil(size.width))
      const height = Math.max(1, Math.ceil(size.height))
      const made = factory(width, height, key, size.opaque === true)
      if (made === null) {
        painted.set(key, null)
        return null
      }
      paint(made.ctx)
      const sprite = { image: made.done(), width, height }
      painted.set(key, sprite)
      return sprite
    },
    screen: (width, height) => {
      const now = `${String(width)}x${String(height)}`
      if (now === screen) return
      screen = now
      painted = new Map()
    },
  }
}

/** A rounded rectangle's path, with arcs: no roundRect on older WebKit. */
export function roundedPath(
  ctx: CanvasRenderingContext2D,
  box: {
    readonly x: number
    readonly y: number
    readonly w: number
    readonly h: number
  },
  radius: number,
): void {
  const r = Math.max(0, Math.min(radius, box.w / 2, box.h / 2))
  const { x, y, w, h } = box
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arc(x + w - r, y + r, r, -Math.PI / 2, 0)
  ctx.lineTo(x + w, y + h - r)
  ctx.arc(x + w - r, y + h - r, r, 0, Math.PI / 2)
  ctx.lineTo(x + r, y + h)
  ctx.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI)
  ctx.lineTo(x, y + r)
  ctx.arc(x + r, y + r, r, Math.PI, Math.PI * 1.5)
  ctx.closePath()
}

/** A vertical gradient across `y0`..`y1` through these stops. */
export function verticalGradient(
  ctx: CanvasRenderingContext2D,
  y0: number,
  y1: number,
  stops: readonly (readonly [number, string])[],
): CanvasGradient {
  const gradient = ctx.createLinearGradient(0, y0, 0, y1)
  for (const [at, color] of stops) gradient.addColorStop(at, color)
  return gradient
}

/** A horizontal gradient across `x0`..`x1` through these stops. */
export function horizontalGradient(
  ctx: CanvasRenderingContext2D,
  x0: number,
  x1: number,
  stops: readonly (readonly [number, string])[],
): CanvasGradient {
  const gradient = ctx.createLinearGradient(x0, 0, x1, 0)
  for (const [at, color] of stops) gradient.addColorStop(at, color)
  return gradient
}
