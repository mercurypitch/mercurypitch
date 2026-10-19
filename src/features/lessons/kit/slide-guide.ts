// ============================================================
// Lesson slide guide — Merc's sung path over pitch rows, then the viewer's turn
// ============================================================
//
// Pitch is height: each row is a note, labelled at its left, and Merc's path
// runs across the rows in time. While Merc sings it (`model`), the path
// lights in the app's target amber in step with the voice: the model a
// singer follows. On the viewer's turn (`sweep`) nothing of the app's
// drawing stays: the rows are plain chrome, the path dashed chrome, and a
// vertical line sweeps along it with nothing riding the path itself. Nothing
// listens and nothing is scored; the page pairs the guide with the kit's
// breathing ring (sing.ts) and plays the sound itself.
//
// Any number of rows and a path of any length: Lesson 2's four lanes and its
// 4.2 s slide, Lesson 4's thirteen rows and its seventeen-note scale. A path
// can fall silent (Lesson 4's rests): a point marked `gap` starts a new
// phrase, and nothing is drawn from the point before it. Between runs the
// path rests in chrome (Lesson 2) or in amber (Lesson 4). Under reduced
// motion the model lights the whole path at once, and the sweep lights the
// path's segments one after another instead of a travelling line.
//
// Mounted on a root holding a `canvas` and a `[data-guide-rows]` box, into
// which the row labels are written as markup (so a ♯ is spoken), each at its
// row's height.

import { clamp, q } from './dom'
import { addDrawer, surface, watch } from './frame-loop'
import { reducedMotion } from './motion-switch'
import { COLOR, rgba } from './notes'

export interface GuideRow {
  /** The row's pitch, as a MIDI number: its height on the guide. */
  readonly midi: number
  /** Its label as markup, every sign spoken (notes.ts `nameHtml`). */
  readonly label: string
  /** A row the path does not use, drawn faint. */
  readonly faint?: boolean
}

/** A point of Merc's path: its pitch (MIDI, between two rows while it glides) `t` seconds in. */
export interface GuidePoint {
  readonly t: number
  readonly midi: number
  /** Merc is silent from the point before this one: no line between them, and this point starts a phrase. */
  readonly gap?: boolean
}

export interface GuideOptions {
  readonly rows: readonly GuideRow[]
  readonly path: readonly GuidePoint[]
  /** The path between runs: dashed chrome (default) or the amber target. */
  readonly rest?: 'chrome' | 'amber'
  /** When the guide draws; default while its root is on screen. */
  readonly active?: () => boolean
}

export interface Guide {
  /** True while Merc's model or the viewer's sweep runs. */
  readonly busy: boolean
  /** New rows and a new path (the slide an octave up, a new do), drawn from the next frame. */
  set(rows: readonly GuideRow[], path: readonly GuidePoint[]): void
  /** Merc's model: the path lights in amber as it is sung; resolves at its last point. */
  model(): Promise<void>
  /** The viewer's turn: `countIn` seconds waiting at the start, then the line sweeps the path; resolves when it has gone. */
  sweep(countIn: number): Promise<void>
}

type Mode = 'rest' | 'model' | 'count' | 'sweep'

/** Where the rows and the path sit on a W by H canvas. */
interface Frame {
  readonly x0: number
  readonly x1: number
  /** The path's length, seconds. */
  readonly T: number
  yOf(midi: number): number
  xOf(t: number): number
}

/** The labels' column, and the space above the top row and below the bottom one. */
const LABEL_W = 64
const PAD_Y = 18

/** The path's length in seconds: its last point's time. */
export const pathLength = (path: readonly GuidePoint[]): number =>
  path.length === 0 ? 0 : path[path.length - 1].t

/** How far down the guide a pitch sits, 0 at the highest row and 1 at the lowest. */
export function rowDepth(rows: readonly GuideRow[], midi: number): number {
  const pitches = rows.map((r) => r.midi)
  const hi = Math.max(...pitches)
  const lo = Math.min(...pitches)
  return (hi - midi) / Math.max(1, hi - lo)
}

/** Lays the rows out top to bottom, highest first, a semitone a step. */
export function guideFrame(
  W: number,
  H: number,
  rows: readonly GuideRow[],
  path: readonly GuidePoint[],
): Frame {
  const x0 = LABEL_W
  const x1 = W - 14
  const T = Math.max(0.001, pathLength(path))
  return {
    x0,
    x1,
    T,
    yOf: (midi) => PAD_Y + rowDepth(rows, midi) * (H - 2 * PAD_Y),
    xOf: (t) => x0 + (clamp(t, 0, T) / T) * (x1 - x0),
  }
}

/** The path's pitch at `t` seconds, along its straight stretches. */
export function pitchAt(path: readonly GuidePoint[], t: number): number {
  if (path.length === 0) return 0
  if (t <= path[0].t) return path[0].midi
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]
    const b = path[i]
    if (t <= b.t) {
      const u = b.t > a.t ? (t - a.t) / (b.t - a.t) : 1
      return a.midi + (b.midi - a.midi) * u
    }
  }
  return path[path.length - 1].midi
}

function drawRows(
  ctx: CanvasRenderingContext2D,
  f: Frame,
  rows: readonly GuideRow[],
): void {
  ctx.lineWidth = 1
  for (const row of rows) {
    const y = Math.round(f.yOf(row.midi)) + 0.5
    ctx.strokeStyle = rgba(COLOR.chrome, row.faint === true ? 0.12 : 0.3)
    ctx.beginPath()
    ctx.moveTo(f.x0 - 6, y)
    ctx.lineTo(f.x1, y)
    ctx.stroke()
  }
}

/** True while `t` falls in a silence: after the point before a `gap` point, before the gap point itself. */
export function inGap(path: readonly GuidePoint[], t: number): boolean {
  for (let i = 1; i < path.length; i++) {
    const b = path[i]
    if (t < b.t) return b.gap === true && t > path[i - 1].t
  }
  return false
}

/**
 * The path from `from` to `to` seconds as the lines to stroke: one piece
 * for a path with no silence in that stretch, a piece per phrase where it
 * falls silent. Each piece starts and ends where the stretch or its phrase
 * does, at the path's pitch there.
 */
export function pathPieces(
  path: readonly GuidePoint[],
  from: number,
  to: number,
): GuidePoint[][] {
  const pieces: GuidePoint[][] = []
  let piece: GuidePoint[] | null = inGap(path, from)
    ? null
    : [{ t: from, midi: pitchAt(path, from) }]
  for (const p of path) {
    if (p.t <= from || p.t >= to) continue
    if (p.gap === true || piece === null) {
      if (piece !== null && piece.length > 1) pieces.push(piece)
      piece = []
    }
    piece.push({ t: p.t, midi: p.midi })
  }
  if (piece !== null && !inGap(path, to))
    piece.push({ t: to, midi: pitchAt(path, to) })
  if (piece !== null && piece.length > 1) pieces.push(piece)
  return pieces
}

/** Strokes the path from `from` to `to` seconds, lifting the pen over its silences. */
function tracePath(
  ctx: CanvasRenderingContext2D,
  f: Frame,
  path: readonly GuidePoint[],
  from: number,
  to: number,
): void {
  ctx.beginPath()
  for (const piece of pathPieces(path, from, to)) {
    piece.forEach((p, i) => {
      if (i === 0) ctx.moveTo(f.xOf(p.t), f.yOf(p.midi))
      else ctx.lineTo(f.xOf(p.t), f.yOf(p.midi))
    })
  }
  ctx.stroke()
}

interface Stroke {
  readonly color: string
  readonly width: number
  readonly dash?: readonly number[]
  readonly glow?: boolean
}

function strokePath(
  ctx: CanvasRenderingContext2D,
  f: Frame,
  path: readonly GuidePoint[],
  span: readonly [number, number],
  s: Stroke,
): void {
  if (span[1] <= span[0]) return
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.setLineDash(s.dash === undefined ? [] : [...s.dash])
  if (s.glow === true) {
    ctx.strokeStyle = s.color
    ctx.globalAlpha = 0.18
    ctx.lineWidth = s.width * 4
    tracePath(ctx, f, path, span[0], span[1])
    ctx.globalAlpha = 1
  }
  ctx.strokeStyle = s.color
  ctx.lineWidth = s.width
  tracePath(ctx, f, path, span[0], span[1])
  ctx.setLineDash([])
}

const CHROME_DASH: Stroke = {
  color: rgba(COLOR.chrome, 0.78),
  width: 2.2,
  dash: [6, 6],
}
const AMBER_REST: Stroke = { color: rgba(COLOR.amber, 0.85), width: 2.6 }
const AMBER_LIT: Stroke = { color: COLOR.amber, width: 3.2, glow: true }
const AMBER_AHEAD: Stroke = {
  color: rgba(COLOR.amber, 0.35),
  width: 2,
  dash: [5, 6],
}
const CHROME_LIT: Stroke = { color: COLOR.chrome, width: 2.8, glow: true }

/** The bright point where Merc's voice is now. */
function drawHead(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
): void {
  const halo = ctx.createRadialGradient(x, y, 0, x, y, 16)
  halo.addColorStop(0, rgba(color, 0.55))
  halo.addColorStop(1, rgba(color, 0))
  ctx.fillStyle = halo
  ctx.beginPath()
  ctx.arc(x, y, 16, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(x, y, 4.5, 0, Math.PI * 2)
  ctx.fill()
}

/** Merc's model, `t` seconds in: what has been sung lit in amber, the rest faint ahead. */
function drawModel(
  ctx: CanvasRenderingContext2D,
  f: Frame,
  path: readonly GuidePoint[],
  t: number,
): void {
  if (reducedMotion()) {
    strokePath(ctx, f, path, [0, f.T], AMBER_LIT)
    return
  }
  strokePath(ctx, f, path, [t, f.T], AMBER_AHEAD)
  strokePath(ctx, f, path, [0, t], AMBER_LIT)
  // through a silence nothing is sung, so no point marks where the voice is
  if (!inGap(path, t))
    drawHead(ctx, f.xOf(t), f.yOf(pitchAt(path, t)), COLOR.amber)
}

/** The viewer's turn, `t` seconds into the sweep: a vertical line, or under reduced motion the segments lit so far. */
function drawSweep(
  ctx: CanvasRenderingContext2D,
  f: Frame,
  path: readonly GuidePoint[],
  t: number,
  H: number,
): void {
  strokePath(ctx, f, path, [0, f.T], CHROME_DASH)
  if (reducedMotion()) {
    const reached = path.filter((p) => p.t <= t).pop()
    if (reached !== undefined && reached.t > 0)
      strokePath(ctx, f, path, [0, reached.t], CHROME_LIT)
    return
  }
  const x = Math.round(f.xOf(t)) + 0.5
  ctx.strokeStyle = rgba(COLOR.chrome, 0.9)
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(x, 6)
  ctx.lineTo(x, H - 6)
  ctx.stroke()
}

/**
 * Writes each row's label at its row's height in the labels box, as a share
 * of the box, so the labels sit right before the canvas has drawn a frame.
 */
function placeLabels(box: HTMLElement, rows: readonly GuideRow[]): void {
  box.textContent = ''
  for (const row of rows) {
    const el = document.createElement('span')
    el.className = row.faint === true ? 'guide-row faint' : 'guide-row'
    const depth = rowDepth(rows, row.midi).toFixed(4)
    el.style.top = `calc(${PAD_Y}px + ${depth} * (100% - ${2 * PAD_Y}px))`
    el.innerHTML = row.label
    box.appendChild(el)
  }
}

export function mountGuide(root: HTMLElement, opts: GuideOptions): Guide {
  const cv = surface(q<HTMLCanvasElement>('canvas', root))
  const box = q('[data-guide-rows]', root)
  let rows = opts.rows
  let path = opts.path
  let mode: Mode = 'rest'
  let t0 = 0
  let wait = 0
  placeLabels(box, rows)

  function rest(ctx: CanvasRenderingContext2D, f: Frame): void {
    strokePath(
      ctx,
      f,
      path,
      [0, f.T],
      opts.rest === 'amber' ? AMBER_REST : CHROME_DASH,
    )
  }

  function draw(now: number): void {
    const { ctx, w: W, h: H } = cv.fit()
    const f = guideFrame(W, H, rows, path)
    drawRows(ctx, f, rows)
    const s = (now - t0) / 1000
    if (mode === 'model') drawModel(ctx, f, path, s)
    // the count-in: the line waits at the start of the path
    else if (mode === 'count') drawSweep(ctx, f, path, 0, H)
    else if (mode === 'sweep') drawSweep(ctx, f, path, s - wait, H)
    else rest(ctx, f)
  }

  addDrawer({ active: opts.active ?? watch(root), draw })

  /** Runs `phases` in turn on timers (so a run ends on time even off screen), then rests. */
  function run(
    phases: readonly [Mode, number][],
    countIn: number,
  ): Promise<void> {
    wait = countIn
    t0 = performance.now()
    return new Promise((resolve) => {
      let at = 0
      for (const [phase, seconds] of phases) {
        setTimeout(() => {
          mode = phase
        }, at * 1000)
        at += seconds
      }
      setTimeout(() => {
        mode = 'rest'
        resolve()
      }, at * 1000)
    })
  }

  return {
    get busy() {
      return mode !== 'rest'
    },
    set(nextRows, nextPath) {
      rows = nextRows
      path = nextPath
      placeLabels(box, rows)
    },
    model() {
      mode = 'model'
      return run([['model', pathLength(path)]], 0)
    },
    sweep(countIn) {
      mode = 'count'
      return run(
        [
          ['count', countIn],
          ['sweep', pathLength(path)],
        ],
        countIn,
      )
    },
  }
}
