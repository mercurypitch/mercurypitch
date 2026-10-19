// ============================================================
// Lesson 5 three starts toy — Fig. 4, the folds from above and a trace
// ============================================================
//
// Lesson 3's vocal folds seen from above (kit/folds.ts) beside a trace
// strip 1.6 s wide (WEB-SPEC, Toys 4): the height of the wave is the level,
// a layer of fine dots is air with no note, a short mark is the catch, and
// gold marks the one fit, the "together" start's tick where air and sound
// begin at once. Three buttons each play their start on A3 (starts.ts):
// Air first draws the folds apart with an arrow of air and the dots, then
// the wave grows as they close into vibration; A catch draws them pressed
// shut with a heavier stroke, a short silence, the mark at the click, then
// the wave at full height at once; Together closes them to a slit as the
// wave starts and grows smoothly. Nothing listens, and the page never asks
// for a catch. Each button names what it plays; a polite line repeats it
// after it plays, and the trace has a text summary. Under reduced motion a
// start lands whole at once, and still sounds.
//
// Mounted twice: Step 4, and the Wrap's free play.

import { mulberry32, q, qa } from '@/features/lessons/kit/dom'
import type { FoldShape } from '@/features/lessons/kit/folds'
import { drawFoldLabels, drawFoldPair, drawFoldText, } from '@/features/lessons/kit/folds'
import { addDrawer, surface, watch } from '@/features/lessons/kit/frame-loop'
import { reducedMotion } from '@/features/lessons/kit/motion-switch'
import { COLOR, rgba } from '@/features/lessons/kit/notes'
import type { Voice } from '@/features/lessons/kit/sound'
import { Sound } from '@/features/lessons/kit/sound'
import type { FoldsPose, Start } from './starts'
import { airAt, foldsAt, markOf, playStart, START_SEC, START_WORDS, tickOf, TRACE_IDLE, waveAt, } from './starts'

/** Cycles the trace draws across its 1.6 s: a schematic wave, not 220 a second. */
const CYCLES = 15
const PRESSED = { width: 2.6, alpha: 0.95 } as const

/** Fine dots of air, placed once: seconds across and height, −1 to 1. */
const DOTS = ((): { t: number; y: number }[] => {
  const random = mulberry32(20261019)
  return Array.from({ length: 70 }, () => ({
    t: random() * 0.35,
    y: random() * 2 - 1,
  }))
})()

interface Layout {
  readonly ctx: CanvasRenderingContext2D
  /** The folds' centre and the plot's top and height. */
  readonly cx: number
  readonly top: number
  readonly height: number
  /** The trace strip. */
  readonly x0: number
  readonly x1: number
  readonly mid: number
  readonly amp: number
}

function layout(ctx: CanvasRenderingContext2D, w: number, h: number): Layout {
  const foldsW = Math.min(w * 0.38, 190)
  return {
    ctx,
    cx: foldsW / 2,
    top: 30,
    height: h - 64,
    x0: foldsW + 14,
    x1: w - 14,
    mid: h / 2,
    amp: Math.min(h * 0.3, 70),
  }
}

/** The folds in a pose; `buzz` shakes their middle while they vibrate. */
function drawFolds(l: Layout, pose: FoldsPose, buzz: number): void {
  const s: FoldShape = {
    cx: l.cx,
    y0: l.top,
    len: l.height,
    th: 18,
    gap: 1 + 15 * pose.open,
    bulge: pose.vibrating ? 2 + 2.4 * buzz : 0,
  }
  drawFoldPair(l.ctx, s, 1, pose.pressed ? PRESSED : undefined)
  drawFoldLabels(l.ctx, s)
  if (!pose.air) return
  // an arrow of air up through the gap, from the lungs below
  const { ctx } = l
  const y0 = l.top + l.height * 0.86
  const y1 = l.top + l.height * 0.3
  ctx.strokeStyle = rgba(COLOR.chrome, 0.85)
  ctx.fillStyle = rgba(COLOR.chrome, 0.85)
  ctx.lineWidth = 1.6
  ctx.beginPath()
  ctx.moveTo(l.cx, y0)
  ctx.lineTo(l.cx, y1 + 8)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(l.cx, y1)
  ctx.lineTo(l.cx - 5, y1 + 9)
  ctx.lineTo(l.cx + 5, y1 + 9)
  ctx.closePath()
  ctx.fill()
  drawFoldText(ctx, 'AIR', l.cx + 10, y1 + 18, 'left')
}

const xAt = (l: Layout, t: number): number =>
  l.x0 + (Math.min(Math.max(t, 0), START_SEC) / START_SEC) * (l.x1 - l.x0)

/** The trace strip's frame: its centre line and its seconds. */
function drawStrip(l: Layout): void {
  const { ctx } = l
  ctx.strokeStyle = rgba(COLOR.chrome, 0.16)
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(l.x0, l.mid)
  ctx.lineTo(l.x1, l.mid)
  ctx.stroke()
  drawFoldText(ctx, '0', l.x0, l.mid + l.amp + 16, 'left')
  drawFoldText(ctx, `${START_SEC} s`, l.x1, l.mid + l.amp + 16, 'right')
}

/** One start's trace up to `upto` seconds: the dots, the wave, the mark and the tick. */
function drawTrace(l: Layout, s: Start, upto: number): void {
  const { ctx } = l
  ctx.fillStyle = rgba(COLOR.chrome, 0.7)
  for (const d of DOTS) {
    if (d.t > upto || !airAt(s, d.t)) continue
    ctx.fillRect(xAt(l, d.t), l.mid + d.y * l.amp * 0.32, 1.6, 1.6)
  }
  ctx.strokeStyle = COLOR.chrome
  ctx.lineWidth = 1.6
  ctx.beginPath()
  const step = (START_SEC / (l.x1 - l.x0)) * 1.5
  for (let t = 0; t <= upto; t += step) {
    const y =
      l.mid -
      l.amp * waveAt(s, t) * Math.sin((2 * Math.PI * CYCLES * t) / START_SEC)
    if (t === 0) ctx.moveTo(xAt(l, t), y)
    else ctx.lineTo(xAt(l, t), y)
  }
  ctx.stroke()
  const mark = markOf(s)
  if (mark !== null && upto >= mark) {
    ctx.strokeStyle = COLOR.ink
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(xAt(l, mark), l.mid - l.amp * 0.4)
    ctx.lineTo(xAt(l, mark), l.mid + l.amp * 0.4)
    ctx.stroke()
    // its name above the wave, on a hairline up from the mark
    ctx.strokeStyle = rgba(COLOR.chrome, 0.4)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(xAt(l, mark), l.mid - l.amp * 0.4)
    ctx.lineTo(xAt(l, mark), l.mid - l.amp - 6)
    ctx.stroke()
    drawFoldText(ctx, 'CATCH', xAt(l, mark) + 6, l.mid - l.amp - 10, 'left')
  }
  const tick = tickOf(s)
  if (tick !== null && upto >= tick) {
    ctx.strokeStyle = COLOR.gold
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(xAt(l, tick), l.mid - l.amp - 6)
    ctx.lineTo(xAt(l, tick), l.mid + l.amp + 4)
    ctx.stroke()
  }
}

export interface StartsOptions {
  /** When it draws: a deck's `toyActive(n)`; default while its root is on screen. */
  readonly active?: () => boolean
}

export interface Starts {
  /** Stops the start now (the viewer left the step); its trace stays. */
  stop(): void
}

export function mountStarts(
  root: HTMLElement,
  opts: StartsOptions = {},
): Starts {
  const canvas = q<HTMLCanvasElement>('.starts-viz canvas', root)
  const cv = surface(canvas)
  const buttons = qa<HTMLButtonElement>('[data-start]', root)
  const live = q('[data-starts-live]', root)
  let shown: Start | null = null
  let t0 = 0
  let playing = false
  let voice: Voice | null = null

  function finish(): void {
    if (!playing) return
    playing = false
    voice?.stop()
    voice = null
    buttons.forEach((b) => b.classList.remove('is-on'))
    if (shown !== null) live.textContent = `${START_WORDS[shown].name}.`
  }

  function start(s: Start, b: HTMLButtonElement): void {
    if (playing) return
    shown = s
    playing = true
    t0 = performance.now()
    buttons.forEach((x) => x.classList.toggle('is-on', x === b))
    canvas.setAttribute('aria-label', START_WORDS[s].summary)
    voice = playStart(s, Sound.canPlay())
  }

  for (const b of buttons) {
    b.setAttribute('aria-label', START_WORDS[b.dataset.start as Start].name)
    b.addEventListener('click', () => {
      const s = b.dataset.start
      if (s === 'air' || s === 'catch' || s === 'together') start(s, b)
    })
  }

  addDrawer({
    active: opts.active ?? watch(root),
    draw(now) {
      const t = playing ? (now - t0) / 1000 : START_SEC
      if (playing && t >= START_SEC + 0.35) finish()
      const calm = reducedMotion()
      const at = calm ? START_SEC : Math.min(t, START_SEC)
      const { ctx, w, h } = cv.fit()
      const l = layout(ctx, w, h)
      // the folds vibrate in a blur at real speed, and hold a still frame when motion is reduced
      const buzz = calm ? 0.5 : 0.5 + 0.5 * Math.sin(now * 0.11)
      drawFolds(l, playing ? foldsAt(shown, at) : foldsAt(null, 0), buzz)
      drawStrip(l)
      if (shown !== null) drawTrace(l, shown, at)
    },
  })

  canvas.setAttribute('aria-label', TRACE_IDLE)

  return {
    stop() {
      finish()
    },
  }
}
