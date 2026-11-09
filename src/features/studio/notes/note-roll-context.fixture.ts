// ============================================================
// A canvas the note roll's tests can read back
// ============================================================
//
// jsdom has no canvas. This one records what the roll asks of it: each
// filled or stroked path with its shapes, colour, line width and opacity at
// that moment; each rectangle filled or stroked directly; each run of text
// with where it went, its font and its colour; and each gradient with its
// stops. It measures text as a font would, every character half the size
// wide, so a name cut to fit a column can be checked honestly. Saved state
// (save and restore) is kept as a canvas keeps it.

export interface RecordedShape {
  readonly kind: 'rect' | 'round' | 'arc' | 'line'
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface RecordedPaint {
  readonly op: 'fill' | 'stroke' | 'fillRect' | 'strokeRect'
  readonly shapes: readonly RecordedShape[]
  readonly style: unknown
  readonly alpha: number
  readonly lineWidth: number
  readonly blur: number
}

export interface RecordedText {
  readonly text: string
  readonly x: number
  readonly y: number
  readonly font: string
  readonly color: unknown
  readonly align: string
}

export interface RecordedGradient {
  readonly stops: [number, string][]
}

interface PenState {
  fillStyle: unknown
  strokeStyle: unknown
  globalAlpha: number
  lineWidth: number
  shadowBlur: number
  shadowColor: string
  shadowOffsetY: number
  font: string
  textAlign: string
  textBaseline: string
}

const fontPx = (font: string): number =>
  Number(/(\d+(?:\.\d+)?)px/u.exec(font)?.[1] ?? 10)

/** A 2D context that records the roll's calls, typed as the real one for the draw functions. */
export function recordingRollContext() {
  const paints: RecordedPaint[] = []
  const texts: RecordedText[] = []
  const gradients: RecordedGradient[] = []
  let clears = 0
  let path: RecordedShape[] = []
  const saved: PenState[] = []
  const pen: PenState = {
    fillStyle: '#000',
    strokeStyle: '#000',
    globalAlpha: 1,
    lineWidth: 1,
    shadowBlur: 0,
    shadowColor: 'transparent',
    shadowOffsetY: 0,
    font: '10px sans-serif',
    textAlign: 'start',
    textBaseline: 'alphabetic',
  }
  const paint = (
    op: RecordedPaint['op'],
    shapes: readonly RecordedShape[],
  ): void => {
    paints.push({
      op,
      shapes,
      style:
        op === 'fill' || op === 'fillRect' ? pen.fillStyle : pen.strokeStyle,
      alpha: pen.globalAlpha,
      lineWidth: pen.lineWidth,
      blur: pen.shadowBlur,
    })
  }
  const context = {
    setTransform: (): void => undefined,
    clearRect: (): void => {
      clears += 1
    },
    save: (): void => {
      saved.push({ ...pen })
    },
    restore: (): void => {
      const last = saved.pop()
      if (last) Object.assign(pen, last)
    },
    beginPath: (): void => {
      path = []
    },
    closePath: (): void => undefined,
    clip: (): void => undefined,
    rect(x: number, y: number, width: number, height: number) {
      path.push({ kind: 'rect', x, y, width, height })
    },
    roundRect(x: number, y: number, width: number, height: number) {
      path.push({ kind: 'round', x, y, width, height })
    },
    arc(x: number, y: number, radius: number) {
      path.push({
        kind: 'arc',
        x: x - radius,
        y: y - radius,
        width: radius * 2,
        height: radius * 2,
      })
    },
    moveTo(x: number, y: number) {
      path.push({ kind: 'line', x, y, width: 0, height: 0 })
    },
    lineTo(x: number, y: number) {
      path.push({ kind: 'line', x, y, width: 0, height: 0 })
    },
    fill: () => paint('fill', path),
    stroke: () => paint('stroke', path),
    fillRect(x: number, y: number, width: number, height: number) {
      paint('fillRect', [{ kind: 'rect', x, y, width, height }])
    },
    strokeRect(x: number, y: number, width: number, height: number) {
      paint('strokeRect', [{ kind: 'rect', x, y, width, height }])
    },
    fillText(text: string, x: number, y: number) {
      texts.push({
        text,
        x,
        y,
        font: pen.font,
        color: pen.fillStyle,
        align: pen.textAlign,
      })
    },
    measureText(text: string) {
      return { width: Array.from(text).length * fontPx(pen.font) * 0.5 }
    },
    createLinearGradient() {
      const gradient: RecordedGradient = { stops: [] }
      gradients.push(gradient)
      return {
        stops: gradient.stops,
        addColorStop(offset: number, color: string) {
          gradient.stops.push([offset, color])
        },
      }
    },
  }
  for (const key of Object.keys(pen) as (keyof PenState)[])
    Object.defineProperty(context, key, {
      get: () => pen[key],
      set: (value: never) => {
        pen[key] = value
      },
      enumerable: true,
    })
  return {
    context: context as unknown as CanvasRenderingContext2D,
    paints,
    texts,
    gradients,
    clears: () => clears,
  }
}
