// ============================================================
// Band chart — the singer's line against Merc's target band
// ============================================================
//
// The voice lessons' signature figure (Lesson 3 WEB-SPEC, Toys 6): a strip
// in the app's pitch-canvas style, pitch as height in cents from Merc's
// note, a fixed window of time across it. Merc's band reaches 35 cents
// either side (Voice Mirror's hit band, kit/band-words.ts), with Merc's line
// steady at its centre: his "ooh" carries a vibrato, which the chart leaves
// out, so the wobble is never read as part of the band or as something to
// copy. The singer's line is violet; a note beyond the chart is pinned to
// its edge with an arrow pointing off it.
//
// One component, many figures: Lesson 3's cold open, its octave toy, its
// chase and drag, and Sing it's live line, and later Lessons 5, 7 and 9.
// Lesson 5 adds what a held note needs: a level strip under the plot (its
// push and its hook), and a hold's fixed frame with its seconds named,
// 10 or 15 across (`setWindow`), both in band-chart-hold.ts. Lesson 9 adds
// rungs, Merc's notes as bands over time slots or across the plot, each
// with its own glow and lit edge (band-chart-rungs.ts), and his leaps as
// arcs between them (band-chart-arcs.ts): the page passes their painter in
// (`paintRungs`), so no lesson without rungs downloads it. Its notes axis
// can name the rungs' rows in words in place of the grid's letters, the
// gutter widened to fit (`names`, band-chart-names.ts). Lesson 14 adds a
// song: Merc's notes as bands over their own times, lit along their length
// by their level, with the words under them, the chords, breath marks and
// a level strip where a figure asks (band-chart-song.ts). Lesson 22 draws
// Merc's line itself, wave and all, at its true pitch from the schedule
// his voice plays, with no line at the band's centre (`centre`), its
// middle dashed and a ruler from the middle to a swing's top, through a
// painter the page passes in (`paintOver`, band-chart-wave.ts). Lesson 24
// draws a drone under the chart: the drone as a narrow amber band or a
// chrome line, Lesson 5's band on the note to tune, the top notes from
// their schedules, Lesson 10's beads and the piano's and the pure ticks,
// with the beats as brightness, in place of Merc's band (`paintRungs`,
// band-chart-drone.ts), on a window that need not sit even about the note
// (`span`) and changes with each of the figure's states (`setAxis`).
// Each figure is a controller that writes the chart's `scene` (the line, the
// marks, the glow, the lit edge) and the chart paints it while it is on
// screen, in each frame where what it shows differs from what it last drew:
// the scene, Merc's note, the window, the canvas's size and pixel ratio
// (frame-loop.ts, `wants`). It compares rather than waits for a wake,
// because a controller writes the scene in place, from anywhere, and on any
// input the page's loop asks again; one that changes it from a timer or a
// sound, with no input on the page, calls the loop's `wake`. With nothing
// changing, the chart asks for no frame. The time window is fixed and the
// line draws across it, so the chart never scrolls; under reduced motion a
// controller lands its figure in the end state instead of animating it. The
// canvas is an image with a spoken summary (`describe`) unless a controller
// makes it a slider.

import type { Arc } from './band-chart-arcs'
import type { BandSpec, CentsTick, ChartFrame, ChartMark, SpectrumScene, TracePoint, } from './band-chart-draw'
import { BAND_COLOR, centsAt, drawBand, drawCentsGrid, drawHandle, drawHead, drawLineLabel, drawLitEdge, drawMark, drawNotesGrid, drawOctaveBracket, drawPlayhead, drawTrace, xOf, yOf, } from './band-chart-draw'
import type { DroneScene } from './band-chart-drone-scene'
import type { LevelPoint } from './band-chart-hold'
import { drawLevelStrip, drawTimeTicks, STRIP_GAP, stripHeight, TICKS_ROOM, } from './band-chart-hold'
import type { RungNames } from './band-chart-names'
import type { Beads, Rung } from './band-chart-rungs'
import type { SongScene } from './band-chart-song-scene'
import type { MiddleLine, WaveLine, WaveRuler } from './band-chart-wave-scene'
import { HIT_TOLERANCE_CENTS } from './band-words'
import { q } from './dom'
import { addDrawer, surface, wake, watch, watchPixelRatio } from './frame-loop'

export type { CentsTick, ChartMark, TracePoint } from './band-chart-draw'
export type { LevelPoint } from './band-chart-hold'
export { BAND_COLOR }

/** The chart's vertical axis: cents either side of Merc's note, cents from it to either end, or a span of notes. */
export type BandAxis =
  | { readonly range: number }
  /** Cents from Merc's note at the bottom and the top: a window that need not sit even about it (Lesson 24's drone chart). */
  | { readonly span: readonly [lo: number, hi: number] }
  | {
      /** The lowest and highest notes on the axis, MIDI. */
      readonly notes: readonly [lo: number, hi: number]
      /** Notes named in full beside their tick (A3, A4); the others show their letter. */
      readonly named?: readonly number[]
      /**
       * Rows named in words in place of every letter and `named`, and no
       * other row named: a ladder's rungs ("so · A3", band-chart-names.ts's
       * `rungNames`). The gutter widens to the longest.
       */
      readonly names?: RungNames
    }

export interface BandChartOptions {
  /** Merc's note, MIDI: the band's centre. */
  readonly target: number
  /** Default ±150 cents. */
  readonly axis?: BandAxis
  /** A second band this many cents above Merc's, dashed: the same note an octave up (1200). */
  readonly echo?: number
  /** Seconds across the chart (default 4). */
  readonly window?: number
  /** The cents ticks and their labels (default the kit's ±15, ±35, ±50 and ±100); a small chart names fewer. */
  readonly ticks?: readonly CentsTick[]
  /** When it draws: a deck's `toyActive(n)`; default while the canvas is on screen. */
  readonly active?: () => boolean
  /** A level strip under the plot, for the scene's `level` (band-chart-hold.ts). */
  readonly strip?: boolean
  /** The seconds named under the plot: a hold's fixed frame. */
  readonly timeTicks?: boolean
  /**
   * Paints the scene's `rungs` in place of Merc's band: band-chart-rungs.ts's
   * `paintRungs`, passed in by the page that has rungs; or a song
   * (band-chart-song.ts's `paintSong`), or a drone chart
   * (band-chart-drone.ts's `paintDrone`). False for a scene with none,
   * which keeps the band.
   */
  readonly paintRungs?: (f: ChartFrame, scene: BandScene) => boolean
  /**
   * A painter that takes the room under the plot and lays the plot out
   * for it: Lesson 13's spectrum strip (spectrum-strip.ts's `spectrumUnder`),
   * passed in by the page that draws one.
   */
  readonly under?: Under
  /**
   * Merc's steady line at the band's centre; false for a figure that
   * draws his line itself, wave and all (Lesson 22): no amber line marks
   * the centre then, so nothing says where the middle is before the page
   * does.
   */
  readonly centre?: boolean
  /**
   * A painter over the plot, after the singer's line: band-chart-wave.ts's
   * `paintWave`, passed in by the page that draws Merc's wave, its middle
   * and a ruler.
   */
  readonly paintOver?: (f: ChartFrame, scene: BandScene) => void
}

/** A painter under the plot: where the plot's top and bottom sit in a figure `h` high, and what it paints. */
export interface Under {
  top(h: number): number
  bottom(h: number): number
  paint(f: ChartFrame, scene: BandScene): void
}

/** What the chart shows this frame; a figure's controller writes it. */
export interface BandScene {
  /** The singer's line, in seconds across the window and cents from Merc's note. */
  line: TracePoint[]
  /** The line's head, its newest point: a bead, or an arrow off the chart. */
  head: { t: number; c: number } | null
  /** Where the line is now, a faint upright rule, while something plays. */
  playhead: number | null
  /** Merc's line, lit while his note sounds (0 to 1); and the echo band's. */
  glow: number
  echoGlow: number
  /** The band's edge lit mint, with "in the band" beside it. */
  lit: boolean
  /** Moments of the loop: "try", "compare". */
  marks: ChartMark[]
  /** A reading beside the line: "0 cents". */
  label: { t: number; c: number; text: string } | null
  /** The gold bracket from Merc's band to the echo, with its words. */
  bracket: string | null
  /** A drag handle on the head. */
  handle: boolean
  /** The level along the window, drawn in the strip under the plot (a chart with `strip`). */
  level: LevelPoint[]
  /**
   * Merc's notes as rungs, each with its own glow and lit edge: on a chart
   * given `paintRungs`, they take the place of his band, its echo, `glow`
   * and `lit`. `clear` and `setTarget` take them away with the rest.
   */
  rungs?: Rung[]
  /** Merc's leaps as arcs between his rungs, drawn while the scene has rungs (band-chart-arcs.ts). */
  arcs?: Arc[]
  /** His rungs as beads on a string, Lesson 20's run: none unless a page asks (band-chart-rungs.ts). */
  beads?: Beads | null
  /** The spectrum strip under the plot, on a chart given its `under` (spectrum-strip.ts). */
  spectrum?: SpectrumScene
  /**
   * A phrase or a whole song, its words and breath marks, on a chart given
   * band-chart-song.ts's `paintSong` and `songUnder`: it takes the place of
   * Merc's band, as rungs do.
   */
  song?: SongScene
  /** Merc's own line from a play's schedule, on a chart given band-chart-wave.ts's `paintWave`. */
  wave?: WaveLine | null
  /** The dashed middle of a line, labelled "middle", on the same chart. */
  middle?: MiddleLine | null
  /** The ruler from a wave's middle to the top of a swing, with its reading. */
  ruler?: WaveRuler | null
  /**
   * A drone under the chart, its band or line, the note's band, the top
   * notes, the beads and the ticks, with the beats as brightness, on a
   * chart given band-chart-drone.ts's `paintDrone`: it takes the place of
   * Merc's band, as rungs do.
   */
  drone?: DroneScene | null
  /**
   * What a page's own `paintOver` draws from, when it is none of the
   * above: kept in the scene, so a change to it alone draws again (Lesson
   * 26's lit bead and count-in strip). Anything JSON holds.
   */
  over?: unknown
}

export interface BandChart {
  readonly canvas: HTMLCanvasElement
  readonly scene: BandScene
  /** Merc's note, MIDI. */
  readonly target: number
  /** Moves the band to another note (a round on C4): the line is cleared. */
  setTarget(midi: number): void
  /** Gives the axis another reach, a figure's next state (Lesson 24's drone chart): the scene stays. */
  setAxis(axis: BandAxis): void
  /** Seconds across the chart: a hold's fixed frame, 10 or 15. */
  readonly window: number
  setWindow(seconds: number): void
  /** Back to Merc's band alone: no line, no marks, nothing lit. */
  clear(): void
  /** The canvas's spoken summary of what it shows now. */
  describe(text: string): void
  /** The cents a pointer's height stands for, over this chart's plot. */
  centsAt(clientY: number): number
  /** Where a point of the line sits on the canvas, CSS px from its top left: for a handle laid over it. */
  pointOf(t: number, cents: number): { x: number; y: number }
  /** The axis's reach, in cents from Merc's note. */
  readonly lo: number
  readonly hi: number
}

const blankScene = (): BandScene => ({
  line: [],
  head: null,
  playhead: null,
  glow: 0,
  echoGlow: 0,
  lit: false,
  marks: [],
  label: null,
  bracket: null,
  handle: false,
  level: [],
})

/** Room above and below the plot, px. */
const PAD = 14

/** The axis in cents from Merc's note. */
function reach(axis: BandAxis, target: number): [number, number] {
  if ('range' in axis) return [-axis.range, axis.range]
  if ('span' in axis) return [axis.span[0], axis.span[1]]
  return [(axis.notes[0] - target) * 100, (axis.notes[1] - target) * 100]
}

export function mountBandChart(
  root: HTMLElement,
  opts: BandChartOptions,
): BandChart {
  const canvas = q<HTMLCanvasElement>('canvas', root)
  const cv = surface(canvas)
  let axis: BandAxis = opts.axis ?? { range: 150 }
  let window = opts.window ?? 4
  let target = opts.target
  let [lo, hi] = reach(axis, target)
  let scene = blankScene()

  /** The room under the plot, px: the level strip and the seconds, where the figure asks for them. */
  const below = (h: number): number =>
    (opts.strip === true ? STRIP_GAP + stripHeight(h) : 0) +
    (opts.timeTicks === true ? TICKS_ROOM : 0)

  /** The plot inside a w by h canvas: room for the note letters, or the rung names, at the left on a notes axis. */
  const frameOf = (
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
  ): ChartFrame => ({
    ctx,
    w,
    h,
    x0: 'notes' in axis ? Math.max(40, axis.names?.gutter(ctx) ?? 0) : 12,
    x1: w - 12,
    top: opts.under?.top(h) ?? PAD,
    bottom: opts.under?.bottom(h) ?? h - PAD - below(h),
    lo,
    hi,
    window,
  })

  /** The strip and the seconds under the plot. */
  function paintBelow(f: ChartFrame): void {
    let y = f.bottom
    if (opts.strip === true) {
      const height = stripHeight(f.h)
      drawLevelStrip(f, y + STRIP_GAP, height, scene.level)
      y += STRIP_GAP + height
    }
    if (opts.timeTicks === true) drawTimeTicks(f, y + 4)
    opts.under?.paint(f, scene)
  }

  /** Merc's band, its echo and its lit edge; or the scene's rungs in their place. */
  function paintBands(f: ChartFrame): void {
    if (opts.paintRungs?.(f, scene) === true) return
    const main: BandSpec = {
      c: 0,
      half: HIT_TOLERANCE_CENTS,
      glow: scene.glow,
      line: opts.centre !== false,
    }
    drawBand(f, main)
    if (opts.echo !== undefined)
      drawBand(f, {
        c: opts.echo,
        half: HIT_TOLERANCE_CENTS,
        dashed: true,
        glow: scene.echoGlow,
      })
    if (scene.lit) drawLitEdge(f, main)
  }

  /** The grid: the notes axis's rows, lettered or named, or the cents ticks. */
  function paintGrid(f: ChartFrame): void {
    if (!('notes' in axis)) {
      drawCentsGrid(f, opts.ticks)
      return
    }
    const names = axis.names
    drawNotesGrid(f, target, axis.named ?? [], names === undefined)
    names?.paint(f, target)
  }

  function paint(f: ChartFrame): void {
    paintGrid(f)
    paintBands(f)
    for (const m of scene.marks) drawMark(f, m)
    if (scene.playhead !== null) drawPlayhead(f, scene.playhead)
    drawTrace(f, scene.line)
    opts.paintOver?.(f, scene)
    const head = scene.head
    if (head !== null) {
      drawHead(f, head.t, head.c)
      if (scene.handle) drawHandle(f, head.t, head.c)
    }
    if (scene.label !== null)
      drawLineLabel(f, scene.label.t, scene.label.c, scene.label.text)
    if (scene.bracket !== null && opts.echo !== undefined)
      drawOctaveBracket(f, 0, opts.echo, scene.bracket)
    paintBelow(f)
  }

  // what the chart shows now, and what its last frame drew, as one string
  // each: the scene, Merc's note, the axis's reach, the window, the canvas's
  // size and ratio
  let shown = ''
  let drawn = ''
  const showing = (): string =>
    JSON.stringify([
      scene,
      target,
      lo,
      hi,
      window,
      canvas.clientWidth,
      canvas.clientHeight,
      globalThis.devicePixelRatio,
    ])
  /** Draws again though nothing it compares has moved: a font that loaded after a frame drew its words in another. */
  const again = (): void => {
    drawn = ''
    wake()
  }

  addDrawer({
    active: opts.active ?? watch(canvas),
    // read just before `draw`, in the same frame, so `draw` keeps it as drawn
    wants: () => (shown = showing()) !== drawn,
    draw() {
      drawn = shown
      const { ctx, w, h } = cv.fit()
      paint(frameOf(ctx, w, h))
    },
  })
  // a new size or pixel ratio wakes a resting loop; a late font draws again
  new ResizeObserver(wake).observe(canvas)
  watchPixelRatio(wake)
  void document.fonts?.ready.then(again)
  document.fonts?.addEventListener('loadingdone', again)

  return {
    canvas,
    get scene() {
      return scene
    },
    get target() {
      return target
    },
    get lo() {
      return lo
    },
    get hi() {
      return hi
    },
    setTarget(midi) {
      target = midi
      ;[lo, hi] = reach(axis, target)
      scene = blankScene()
      wake()
    },
    setAxis(next) {
      axis = next
      ;[lo, hi] = reach(axis, target)
      wake()
    },
    get window() {
      return window
    },
    setWindow(seconds) {
      window = seconds
      wake()
    },
    clear() {
      scene = blankScene()
      wake()
    },
    describe(text) {
      canvas.setAttribute('aria-label', text)
    },
    centsAt(clientY) {
      const rect = canvas.getBoundingClientRect()
      if (rect.height <= 2 * PAD) return 0
      return centsAt(
        frameOf(cv.ctx, rect.width, rect.height),
        clientY - rect.top,
      )
    },
    pointOf(t, cents) {
      const f = frameOf(cv.ctx, canvas.clientWidth, canvas.clientHeight)
      return { x: xOf(f, t), y: yOf(f, Math.min(Math.max(cents, lo), hi)) }
    },
  }
}
