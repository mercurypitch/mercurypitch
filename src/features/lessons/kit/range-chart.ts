// ============================================================
// Range chart — a voice's notes as height, its column and its lines
// ============================================================
//
// Lesson 7's one object (its WEB-SPEC, Toys 1), and later Lesson 11's and
// Lesson 14's. Pitch is height: a window of notes, one faint row a
// semitone, the C and A rows named in a gutter at the left. The column, the
// two octaves a voice type is often given, stands at the plot's left with
// its middle half lit and its ends dimmed, and time runs beside it for
// every line; in a compact figure the column fills the plot and a tune's
// beads lie across it. On top of that a figure's controller writes the
// scene: sung lines (Merc's amber, the singer's violet) with their glowing
// heads, a tune's beads, the gold bracket, the voice types as columns of
// their own, a voice's range bar, a reading's lit stretch with the rest
// dimmed, a note on the column, and shaded seams (Lesson 11).
//
// The chart paints only when its scene has changed (`changed`) or while a
// controller moves something (`animate`), so a still chart costs the page's
// frame loop nothing. The canvas is a picture: a controller gives it a
// spoken summary (`describe`), or hides it and speaks for it elsewhere.

import { q } from './dom'
import { addDrawer, surface, wake, watch } from './frame-loop'
import type { DrawFrame, NoteSpan, RangeBand, RangeBar, RangeBead, RangeBracket, RangeColumn, RangeLine, RangeSeam, RangeWash, } from './range-chart-draw'
import { drawBands, drawBar, drawBeads, drawBracket, drawColumn, drawLine, drawNote, drawPlayhead, drawRows, drawSeam, drawWash, RANGE_COLOR, } from './range-chart-draw'
import type { ColumnForm, RangeFrame, RangeWindow } from './range-chart-layout'
import { midiAt, rangeFrame, xOfT, yOf } from './range-chart-layout'

export type {
  LinePoint,
  NoteSpan,
  RangeBand,
  RangeBar,
  RangeBead,
  RangeBracket,
  RangeColumn,
  RangeLine,
  RangeSeam,
  RangeWash,
} from './range-chart-draw'
export type { ColumnForm, RangeFrame, RangeWindow } from './range-chart-layout'
export { RANGE_COLOR }

export interface RangeChartOptions {
  /** The notes on the chart, MIDI. */
  readonly window: RangeWindow
  /** How the column stands (default a bar at the plot's left). */
  readonly form?: ColumnForm
  /** Seconds across the time area (default 6). */
  readonly seconds?: number
  /** The C and A names in a gutter (default on). */
  readonly names?: boolean
  /** When it draws: a deck's `toyActive(n)`; default while the canvas is on screen. */
  readonly active?: () => boolean
}

/** What the chart shows; a figure's controller writes it, then calls `changed`. */
export interface RangeScene {
  column: RangeColumn | null
  seams: RangeSeam[]
  wash: RangeWash | null
  bands: RangeBand[]
  bar: RangeBar | null
  lines: RangeLine[]
  beads: RangeBead[]
  /** The beads' colour (default Merc's amber). */
  beadColor: string
  bracket: RangeBracket | null
  /** A note on the column, drawn as a bead. */
  note: number | null
  playhead: number | null
}

export interface RangeChart {
  readonly canvas: HTMLCanvasElement
  readonly scene: RangeScene
  readonly window: RangeWindow
  setWindow(w: RangeWindow): void
  readonly form: ColumnForm
  setForm(form: ColumnForm): void
  readonly seconds: number
  setSeconds(seconds: number): void
  /** Back to the column alone: the scene's every other part cleared. */
  clear(): void
  /** The scene has changed: paint it on the next frame. */
  changed(): void
  /**
   * A step run before every frame while it returns true, for something that
   * moves (a line drawing as it sounds); null stops the one running.
   */
  animate(step: ((now: number) => boolean) | null): void
  describe(text: string): void
  /** The frame as the canvas stands now, CSS px. */
  frame(): RangeFrame
  /** Where a note sits on the canvas (CSS px from its top left): for a handle laid over it. */
  pointOf(midi: number, t?: number): { x: number; y: number }
  /** The note a pointer's height stands for, unrounded. */
  midiAt(clientY: number): number
}

const blankScene = (column: RangeColumn | null): RangeScene => ({
  column,
  seams: [],
  wash: null,
  bands: [],
  bar: null,
  lines: [],
  beads: [],
  beadColor: RANGE_COLOR.target,
  bracket: null,
  note: null,
  playhead: null,
})

export function mountRangeChart(
  root: HTMLElement,
  opts: RangeChartOptions,
): RangeChart {
  const canvas = q<HTMLCanvasElement>('canvas', root)
  const cv = surface(canvas)
  let win = opts.window
  let form: ColumnForm = opts.form ?? 'bar'
  let seconds = opts.seconds ?? 6
  let scene = blankScene(null)
  let dirty = true
  let step: ((now: number) => boolean) | null = null

  const frameOf = (w: number, h: number): RangeFrame =>
    rangeFrame(w, h, {
      lo: win.lo,
      hi: win.hi,
      column: scene.column === null ? 'none' : form,
      seconds,
      names: opts.names,
    })

  function paint(f: DrawFrame): void {
    drawRows(f, opts.names !== false)
    if (scene.column !== null) drawColumn(f, scene.column, form === 'wide')
    for (const s of scene.seams) drawSeam(f, s)
    if (scene.bands.length > 0) drawBands(f, scene.bands)
    if (scene.bar !== null) drawBar(f, scene.bar)
    if (scene.wash !== null) drawWash(f, scene.wash)
    if (scene.playhead !== null) drawPlayhead(f, scene.playhead)
    for (const line of scene.lines) drawLine(f, line)
    drawBeads(f, scene.beads, scene.beadColor)
    if (scene.bracket !== null) drawBracket(f, scene.bracket)
    if (scene.note !== null) drawNote(f, scene.note)
  }

  const changed = (): void => {
    dirty = true
    wake()
  }

  addDrawer({
    active: opts.active ?? watch(canvas),
    wants: () => dirty || step !== null,
    draw(now) {
      if (step !== null && !step(now)) step = null
      dirty = false
      const { ctx, w, h } = cv.fit()
      paint({ ...frameOf(w, h), ctx })
    },
  })
  // a canvas that changes size is drawn again at its new size
  if (typeof ResizeObserver !== 'undefined')
    new ResizeObserver(changed).observe(canvas)

  return {
    canvas,
    get scene() {
      return scene
    },
    get window() {
      return win
    },
    setWindow(w) {
      win = w
      changed()
    },
    get form() {
      return form
    },
    setForm(next) {
      form = next
      changed()
    },
    get seconds() {
      return seconds
    },
    setSeconds(s) {
      seconds = s
      changed()
    },
    clear() {
      scene = blankScene(scene.column)
      changed()
    },
    changed,
    animate(next) {
      step = next
      changed()
    },
    describe(text) {
      if (canvas.getAttribute('aria-label') !== text)
        canvas.setAttribute('aria-label', text)
    },
    frame() {
      return frameOf(canvas.clientWidth, canvas.clientHeight)
    },
    pointOf(midi, t) {
      const f = frameOf(canvas.clientWidth, canvas.clientHeight)
      const x = t === undefined ? (f.colX0 + f.colX1) / 2 : xOfT(f, t)
      return { x, y: yOf(f, midi) }
    },
    midiAt(clientY) {
      const rect = canvas.getBoundingClientRect()
      return midiAt(frameOf(rect.width, rect.height), clientY - rect.top)
    },
  }
}

/** A span of notes as the chart's scene takes it. */
export const span = (lo: number, hi: number): NoteSpan => ({ lo, hi })
