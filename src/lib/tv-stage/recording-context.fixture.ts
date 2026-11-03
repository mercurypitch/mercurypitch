// ============================================================
// A canvas the TV stage's tests can read back
// ============================================================
//
// jsdom has no canvas. This one records what the renderer asks of it: each
// run of text with where it went, its size and its colour; each image
// stamped with where it went and how much of it showed; each clip's
// rectangle; each curve piece; each blur asked for; and how often text was
// measured. It measures text as a font would, every character half the size
// wide, so a line drawn smaller is narrower and a wrap can be checked
// honestly. A fake whose widths ignore the size cannot tell a line that
// wraps from one that shrinks.
//
// `recordingSprites` hands the stage sprite canvases of the same kind, each
// image labelled with its sprite's key, so a test can tell which sprite was
// stamped where.

import type { SpriteCanvasFactory } from './sprites'

export interface Box {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

/** A run of text the renderer wrote: where, how big, in what colour. */
export interface Written {
  readonly text: string
  readonly x: number
  readonly y: number
  readonly px: number
  readonly color: string
}

/** An image stamped: its sprite's key, where it went, and at what opacity. */
export interface Stamped {
  readonly key: string
  readonly box: Box
  readonly alpha: number
}

/** A sprite's stand-in image: its key and size. */
export interface FakeImage {
  readonly key: string
  readonly width: number
  readonly height: number
}

/** The size in a canvas font, '700 72px …' to 72. */
const fontPx = (font: string): number =>
  Number(/(\d+(?:\.\d+)?)px/u.exec(font)?.[1] ?? 0)

interface Pen {
  font: string
  fillStyle: string
  globalAlpha: number
}

const gradient = () => ({ addColorStop: (): void => undefined })

/** Where a drawImage call put its image: the last four numbers, or the image's size. */
function stampedBox(image: FakeImage, args: readonly number[]): Box {
  if (args.length >= 8) {
    return { x: args[4], y: args[5], w: args[6], h: args[7] }
  }
  return {
    x: args[0],
    y: args[1],
    w: args[2] ?? image.width,
    h: args[3] ?? image.height,
  }
}

/** The calls the renderer makes, recorded, with text measured as a font would. */
export function recordingContext() {
  const texts: Written[] = []
  const notes: Box[] = []
  const clips: Box[] = []
  const images: Stamped[] = []
  const blurs: number[] = []
  let curves = 0
  let lines = 0
  // The rectangles of the path being built, and the box round its other
  // shapes: a clip is what `clip()` takes from it, not everything drawn.
  let path: Box[] = []
  let shape: { x0: number; y0: number; x1: number; y1: number } | null = null
  const grow = (x: number, y: number): void => {
    shape = {
      x0: Math.min(shape?.x0 ?? x, x),
      y0: Math.min(shape?.y0 ?? y, y),
      x1: Math.max(shape?.x1 ?? x, x),
      y1: Math.max(shape?.y1 ?? y, y),
    }
  }
  let measured = 0
  const noop = (): void => undefined
  const context = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    font: '',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    shadowColor: 'rgba(0, 0, 0, 0)',
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    get shadowBlur(): number {
      return blurs.at(-1) ?? 0
    },
    set shadowBlur(value: number) {
      blurs.push(value)
    },
    fillRect: noop,
    fillText(this: Pen, text: string, x: number, y: number) {
      texts.push({ text, x, y, px: fontPx(this.font), color: this.fillStyle })
    },
    measureText(this: Pen, text: string) {
      measured += 1
      return { width: Array.from(text).length * fontPx(this.font) * 0.5 }
    },
    drawImage(this: Pen, image: FakeImage, ...args: number[]) {
      images.push({
        key: image.key,
        box: stampedBox(image, args),
        alpha: this.globalAlpha,
      })
    },
    beginPath: () => {
      path = []
      shape = null
    },
    closePath: noop,
    moveTo: grow,
    lineTo: (x: number, y: number) => {
      lines += 1
      grow(x, y)
    },
    bezierCurveTo: (...points: number[]) => {
      curves += 1
      grow(points[4], points[5])
    },
    arc: (x: number, y: number, r: number) => {
      grow(x - r, y - r)
      grow(x + r, y + r)
    },
    rect: (x: number, y: number, w: number, h: number) => {
      path.push({ x, y, w, h })
    },
    roundRect: (x: number, y: number, w: number, h: number) => {
      notes.push({ x, y, w, h })
    },
    fill: noop,
    stroke: noop,
    save: noop,
    restore: noop,
    translate: noop,
    scale: noop,
    setTransform: noop,
    clip: () => {
      clips.push(...path)
      const box = shape
      if (box !== null) {
        clips.push({
          x: box.x0,
          y: box.y0,
          w: box.x1 - box.x0,
          h: box.y1 - box.y0,
        })
      }
    },
    createLinearGradient: gradient,
    createRadialGradient: gradient,
  }
  return {
    ctx: context as unknown as CanvasRenderingContext2D,
    texts,
    notes,
    clips,
    images,
    blurs,
    curves: () => curves,
    lines: () => lines,
    measured: () => measured,
  }
}

/** Sprite canvases that record, each image labelled with its sprite's key. */
export function recordingSprites(): {
  readonly factory: SpriteCanvasFactory
  readonly painted: string[]
} {
  const painted: string[] = []
  const factory: SpriteCanvasFactory = (width, height, key) => {
    painted.push(key)
    const image: FakeImage = { key, width, height }
    return {
      ctx: recordingContext().ctx,
      done: () => image as unknown as CanvasImageSource,
    }
  }
  return { factory, painted }
}

/** How wide the fake measures `written`. */
export const widthOf = (written: Written): number =>
  Array.from(written.text).length * written.px * 0.5
