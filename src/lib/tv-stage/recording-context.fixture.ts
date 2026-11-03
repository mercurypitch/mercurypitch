// ============================================================
// A canvas the TV stage's tests can read back
// ============================================================
//
// jsdom has no canvas. This one records what the renderer asks of it: each
// run of text with where it went, its size and its colour; each note's
// rounded box; each clip's rectangle; and how often text was measured. It
// measures text as a font would, every character half the size wide, so a
// line drawn smaller is narrower and a wrap can be checked honestly. A fake
// whose widths ignore the size cannot tell a line that wraps from one that
// shrinks.

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

/** The size in a canvas font, '700 72px …' to 72. */
const fontPx = (font: string): number =>
  Number(/(\d+(?:\.\d+)?)px/u.exec(font)?.[1] ?? 0)

interface Pen {
  font: string
  fillStyle: string
}

/** The calls the renderer makes, recorded, with text measured as a font would. */
export function recordingContext() {
  const texts: Written[] = []
  const notes: Box[] = []
  const clips: Box[] = []
  // The rectangles of the path being built: a clip is what `clip()` takes
  // from it, not every rectangle drawn.
  let path: Box[] = []
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
    fillRect: noop,
    fillText(this: Pen, text: string, x: number, y: number) {
      texts.push({ text, x, y, px: fontPx(this.font), color: this.fillStyle })
    },
    measureText(this: Pen, text: string) {
      measured += 1
      return { width: Array.from(text).length * fontPx(this.font) * 0.5 }
    },
    beginPath: () => {
      path = []
    },
    moveTo: noop,
    lineTo: noop,
    arc: noop,
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
    clip: () => {
      clips.push(...path)
    },
  }
  return {
    ctx: context as unknown as CanvasRenderingContext2D,
    texts,
    notes,
    clips,
    measured: () => measured,
  }
}

/** How wide the fake measures `written`. */
export const widthOf = (written: Written): number =>
  Array.from(written.text).length * written.px * 0.5
