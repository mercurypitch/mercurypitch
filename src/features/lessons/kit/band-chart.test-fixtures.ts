// ============================================================
// Band chart by hand — charts on canvases that keep every call they hear
// ============================================================
//
// A band chart's tests ask what it paints. `paintCharts` mounts each figure
// as a page mounts it, on a canvas of its own whose 2D context draws nothing
// and keeps every call it hears, sets the figure's scene, and runs one frame
// of the page's loop by hand (frame-loop.test-fixtures.ts): what each canvas
// heard in that frame. `paintFrames` runs more than one, for what one frame
// leaves the next on the canvas, with a late font loading before each frame
// after the first, since a chart draws again only when something it shows has
// changed; `mountCharts` mounts the figures and hands back the loop, for a
// test that runs its frames itself. `marksOf` reads the calls back as the
// marks they drew, a line a mark: a stroke with its colour, width, alpha,
// dash and path; a fill and its path; a rect, its corner and size; words with
// their alignment and anchor. The styles every later mark shares (the font, a
// line's joins and caps) are written once, where they change, and `capsOf`
// says which frame drew each mark, and with what cap. A mark also keeps its
// colour's channels, how opaque it is drawn, a stroke's width and the points
// it reaches, for a test that asks where and how strongly something is drawn.
// Words are measured in the double's own font, `CHAR_PX` a character, so a
// mark knows where its words end. Every canvas measures 300 by 190 px. The
// test file imports './browser-doubles.test-fixtures' first, and calls
// `vi.useRealTimers()` and `vi.restoreAllMocks()` after each test.

import { vi } from 'vitest'
import type { BandChart, BandChartOptions, BandScene } from './band-chart'
import { q } from './dom'
import type { HandLoop } from './frame-loop.test-fixtures'
import { handLoop } from './frame-loop.test-fixtures'

/** A call a canvas heard: a method and its arguments, or a property set (`font=`) and its value. */
export type Call = readonly [name: string, ...args: unknown[]]

/** A character's width in the double's 12 px monospaced font, px. */
const CHAR_PX = 7.2

/** Every canvas's size on the page, CSS px, as the hand loop measures it. */
const CANVAS = { w: 300, h: 190 } as const

/** A 2D context that keeps every call and every property set, and draws nothing. */
function recordingContext(calls: Call[]): CanvasRenderingContext2D {
  const props: Record<PropertyKey, unknown> = {}
  return new Proxy(props, {
    get: (target, key) =>
      key in target
        ? target[key]
        : (...args: unknown[]): unknown => {
            calls.push([String(key), ...args])
            return key === 'measureText'
              ? { width: String(args[0]).length * CHAR_PX }
              : undefined
          },
    set: (target, key, value: unknown) => {
      calls.push([`${String(key)}=`, value])
      target[key] = value
      return true
    },
  }) as unknown as CanvasRenderingContext2D
}

/** A mark the calls drew: the line the picture writes for it, its colour, and the points it reaches. */
export interface Mark {
  readonly line: string
  /** Its colour's red, green and blue ('245,158,11'); empty for a clear or a shared style. */
  readonly rgb: string
  /** How opaque it is drawn: its colour's alpha times the context's. */
  readonly opacity: number
  /** A stroke's width, px; 0 for any other mark. */
  readonly width: number
  /** A path's points (a circle's edges), a rect's sides, or where words run from and to. */
  readonly xs: readonly number[]
  readonly ys: readonly number[]
}

/** A number as a mark writes it, to two decimals. */
const num = (v: number): string => String(Math.round(v * 100) / 100)

/** Styles that every later mark shares, written once where they change. */
const SHARED = ['font', 'lineJoin', 'lineCap']

/** A colour's red, green and blue and its alpha, from '#f59e0b' or 'rgba(245,158,11,0.6)'. */
export function channels(color: string): { rgb: string; alpha: number } {
  const rgba = /^rgba\((\d+),(\d+),(\d+),([\d.]+)\)$/.exec(color)
  if (rgba !== null)
    return { rgb: rgba.slice(1, 4).join(','), alpha: Number(rgba[4]) }
  const hex = /^#([0-9a-f]{6})$/i.exec(color)
  if (hex === null) return { rgb: '', alpha: 0 }
  const v = parseInt(hex[1], 16)
  return { rgb: [v >> 16, (v >> 8) & 255, v & 255].join(','), alpha: 1 }
}

/** Where words run from and to, by their alignment, in the double's font. */
function wordsSpan(words: string, x: number, align: unknown): number[] {
  const w = words.length * CHAR_PX
  if (align === 'right') return [x - w, x]
  if (align === 'center') return [x - w / 2, x + w / 2]
  return [x, x + w]
}

/** What the calls drew, mark by mark, in the order they drew it. */
export function marksOf(calls: readonly Call[]): Mark[] {
  const style: Record<string, unknown> = { globalAlpha: 1, lineWidth: 1 }
  const out: Mark[] = []
  let dash: readonly number[] = []
  let path: string[] = []
  let xs: number[] = []
  let ys: number[] = []
  const of = (key: string): string => String(style[key])
  const alpha = (): string =>
    style.globalAlpha === 1 ? '' : ` alpha ${num(Number(style.globalAlpha))}`
  const mark = (line: string, color = '', mx = xs, my = ys): void => {
    const { rgb, alpha: a } = channels(color)
    const stroke = line.startsWith('stroke ')
    out.push({
      line,
      rgb,
      opacity: a * Number(style.globalAlpha),
      width: stroke ? Number(style.lineWidth) : 0,
      xs: mx,
      ys: my,
    })
  }
  for (const [name, ...args] of calls) {
    const [x, y, p, r] = args.map(Number)
    if (name.endsWith('=')) {
      const key = name.slice(0, -1)
      if (SHARED.includes(key) && style[key] !== args[0])
        mark(`${key} ${String(args[0])}`, '', [], [])
      style[key] = args[0]
      continue
    }
    switch (name) {
      case 'beginPath':
        path = []
        xs = []
        ys = []
        break
      case 'moveTo':
      case 'lineTo':
        path.push(`${name === 'moveTo' ? 'M' : 'L'}${num(x)},${num(y)}`)
        xs.push(x)
        ys.push(y)
        break
      case 'arc':
        path.push(`O${num(x)},${num(y)} r${num(p)}`)
        xs.push(x - p, x + p)
        ys.push(y - p, y + p)
        break
      case 'closePath':
        path.push('Z')
        break
      case 'setLineDash':
        dash = args[0] as number[]
        break
      case 'stroke': {
        const dashed = dash.length > 0 ? ` dash ${dash.join(' ')}` : ''
        const width = num(Number(style.lineWidth))
        mark(
          `stroke ${of('strokeStyle')} w${width}${alpha()}${dashed} ${path.join(' ')}`,
          of('strokeStyle'),
        )
        break
      }
      case 'fill':
        mark(
          `fill ${of('fillStyle')}${alpha()} ${path.join(' ')}`,
          of('fillStyle'),
        )
        break
      case 'fillRect':
        mark(
          `rect ${of('fillStyle')}${alpha()} ${num(x)},${num(y)} ${num(p)}x${num(r)}`,
          of('fillStyle'),
          [x, x + p],
          [y, y + r],
        )
        break
      case 'fillText': {
        const words = String(args[0])
        const [tx, ty] = [Number(args[1]), Number(args[2])]
        mark(
          `text ${of('fillStyle')}${alpha()} ${of('textAlign')} ${of('textBaseline')} ${num(tx)},${num(ty)} ${words}`,
          of('fillStyle'),
          wordsSpan(words, tx, style.textAlign),
          [ty],
        )
        break
      }
      case 'clearRect':
        mark(`clear ${num(x)},${num(y)} ${num(p)}x${num(r)}`, '', [], [])
        break
      case 'setTransform':
        mark(
          `transform ${args.map((a) => num(Number(a))).join(' ')}`,
          '',
          [],
          [],
        )
        break
      default:
      // measureText draws nothing
    }
  }
  return out
}

/** The picture the calls drew: each mark's line. */
export const picture = (calls: readonly Call[]): string[] =>
  marksOf(calls).map((m) => m.line)

/** A mark, the frame that drew it (from 1), and the line cap it was drawn with. */
export interface Capped {
  readonly mark: Mark
  readonly frame: number
  readonly cap: string
}

/**
 * Each mark with the frame that drew it, counted by the transform each frame
 * starts with, and the line cap in force: the canvas's own, 'butt', until a
 * mark sets another, which one frame then leaves to the next.
 */
export function capsOf(marks: readonly Mark[]): Capped[] {
  let frame = 0
  let cap = 'butt'
  return marks.map((mark) => {
    if (mark.line.startsWith('transform ')) frame += 1
    if (mark.line.startsWith('lineCap ')) cap = mark.line.split(' ')[1]
    return { mark, frame, cap }
  })
}

/** A chart as a page mounts it, and the scene it shows. */
export interface Figure {
  readonly opts: BandChartOptions
  readonly scene?: (s: BandScene) => void
}

export interface Painted {
  readonly chart: BandChart
  /** Every call its canvas heard in the frames it was painted in. */
  readonly calls: readonly Call[]
}

/**
 * Each figure's chart mounted on a canvas of its own, on screen, its scene
 * set, and the loop to paint them, its frames not yet run. A canvas's
 * `clientWidth` and `clientHeight` can be redefined, for a new size.
 */
export async function mountCharts(
  figures: readonly Figure[],
): Promise<{ hand: HandLoop; painted: Painted[] }> {
  const heard = new Map<HTMLCanvasElement, Call[]>()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    function (this: HTMLCanvasElement) {
      const calls: Call[] = []
      heard.set(this, calls)
      return recordingContext(calls)
    } as unknown as HTMLCanvasElement['getContext'],
  )
  const hand = await handLoop()
  const { mountBandChart } = await import('./band-chart')
  const painted = figures.map((figure) => {
    const root = document.createElement('div')
    root.innerHTML = '<canvas></canvas>'
    document.body.appendChild(root)
    const canvas = q<HTMLCanvasElement>('canvas', root)
    hand.paints(canvas)
    // what `pointOf` measures, as the hand loop's `paints` has the box
    Object.defineProperties(canvas, {
      clientWidth: { value: CANVAS.w, configurable: true },
      clientHeight: { value: CANVAS.h, configurable: true },
    })
    const chart = mountBandChart(root, figure.opts)
    figure.scene?.(chart.scene)
    hand.see(canvas)
    return { chart, calls: heard.get(canvas) ?? [] }
  })
  return { hand, painted }
}

/**
 * Each figure's chart mounted on a canvas of its own, on screen, its scene
 * set; then one frame of the page's loop: what each canvas heard in it.
 */
export async function paintCharts(
  ...figures: readonly Figure[]
): Promise<Painted[]> {
  const { hand, painted } = await mountCharts(figures)
  hand.frame()
  return painted
}

/**
 * A figure's chart, mounted as `paintCharts` mounts it, then `count` frames
 * of the loop, a late font loading before each after the first so that each
 * paints the scene again: what its canvas heard in them all.
 */
export async function paintFrames(
  figure: Figure,
  count: number,
): Promise<Painted> {
  const { hand, painted } = await mountCharts([figure])
  for (let i = 0; i < count; i++) {
    if (i > 0) hand.fontsLoad()
    hand.frame()
  }
  return painted[0]
}
