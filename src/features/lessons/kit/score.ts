// ============================================================
// Score — the song on two staffs as a figure: drawn at its size, lit as it plays
// ============================================================
//
// Mounts the score's drawing in a figure (kit/score-draw.ts), or its parts
// as bands on the pitch line (kit/score-bands.ts), and keeps it at the
// figure's size, drawn again when that changes. It holds how much is
// written and where the cursor stands, so a drawing made again keeps both,
// and the marks drawn before, so only a new one fades in. A tap on a staff
// names the staff, so Step 4 plays that part alone (Lesson 28 WEB-SPEC,
// Toys 2). The page plays; the score shows.

import { svg } from './dom'
import { addDrawer, wake } from './frame-loop'
import { Motion } from './motion-switch'
import type { Run } from './run'
import { drawBands } from './score-bands'
import type { ScoreDrawing } from './score-draw'
import { drawScore, lightScore, writeScore } from './score-draw'
import type { ScoreScene } from './score-layout'

export interface ScoreOptions {
  /** A tap on a staff: its index, top to bottom. */
  readonly onStaff?: (staff: number) => void
}

/** A play's clock on the score: the cursor and the lights, silent; the page's run is the sound. */
export interface ScorePlay {
  /** Seconds it runs. */
  readonly seconds: number
  /** Seconds a beat. */
  readonly beatSec: number
  /** The beat of the scene it starts on: 0 by default. */
  readonly from?: number
  /** The staffs whose notes light: every one by default. */
  readonly staffs?: readonly number[]
  /** Writes each note as it sounds: the hero's pairs of staffs, Step 3's B. */
  readonly write?: boolean
  /** Hears each frame's beat, from the scene's start. */
  readonly onBeat?: (beat: number) => void
}

/** How the scene is drawn: on its staffs, or its parts as bands on the pitch line. */
export type ScoreView = 'staffs' | 'bands'

export interface Score {
  /** Draws a scene, its notes written up to `written` beats: every one by default. */
  show(scene: ScoreScene, written?: number): void
  /** Writes the notes that start by `beat`, as a figure written as it sounds. */
  write(beat: number): void
  /** The cursor at `beat` and the notes sounding there lit, only `staffs`' where given; or neither (null). */
  at(beat: number | null, staffs?: readonly number[]): void
  /** Draws the same scene on its staffs or as bands. */
  setView(view: ScoreView): void
  /**
   * Runs a play's cursor and lights on the frame loop for `seconds`, then
   * clears them; done is true when it ran to its end, false when stopped or
   * replaced. Under reduced motion, or with animations paused, the cursor
   * jumps beat to beat.
   */
  play(p: ScorePlay): Run
  readonly view: ScoreView
  readonly scene: ScoreScene | null
  readonly drawing: ScoreDrawing | null
}

/** The figure's box inside its border, or a phone's figure where nothing lays it out (jsdom). */
function boxOf(el: Element): { w: number; h: number } {
  const b = el.getBoundingClientRect()
  const cs = window.getComputedStyle(el)
  const px = (v: string): number => Number.parseFloat(v) || 0
  const w = b.width - px(cs.borderLeftWidth) - px(cs.borderRightWidth)
  const h = b.height - px(cs.borderTopWidth) - px(cs.borderBottomWidth)
  return w > 0 && h > 0 ? { w, h } : { w: 358, h: 300 }
}

/** Mounts a score in `figure`, empty until a scene is shown; the figure takes the sheet's `sc` class, which sets the drawing in it. */
export function mountScore(figure: HTMLElement, o: ScoreOptions = {}): Score {
  figure.classList.add('sc')
  const host = svg(
    'svg',
    { class: 'sc-svg', 'aria-hidden': 'true', focusable: 'false' },
    figure,
  )
  const seen = new Set<string>()
  let scene: ScoreScene | null = null
  let drawing: ScoreDrawing | null = null
  let view: ScoreView = 'staffs'
  let written = Number.POSITIVE_INFINITY
  let beat: number | null = null
  let staffs: readonly number[] | undefined
  let size = { w: 0, h: 0 }

  function draw(): void {
    if (scene === null) return
    size = boxOf(figure)
    figure.dataset.view = view
    drawing =
      view === 'bands'
        ? drawBands(host, scene, size)
        : drawScore(host, scene, size, {
            seen,
            taps: o.onStaff !== undefined,
          })
    writeScore(drawing, written)
    lightScore(drawing, beat, staffs)
  }

  if (o.onStaff !== undefined) {
    const onStaff = o.onStaff
    host.addEventListener('click', (e) => {
      const hit = (e.target as Element | null)?.closest('.sc-hit')
      const k = hit?.getAttribute('data-staff') ?? null
      if (k !== null) onStaff(Number(k))
    })
  }

  if (typeof ResizeObserver !== 'undefined')
    new ResizeObserver(() => {
      const b = boxOf(figure)
      if (Math.abs(b.w - size.w) > 0.5 || Math.abs(b.h - size.h) > 0.5) draw()
    }).observe(figure)

  // ------------------------------------------------------------ a play's clock

  interface Playing {
    readonly p: ScorePlay
    readonly t0: number
    end(heard: boolean): void
  }
  let playing: Playing | null = null
  let drawer = false

  function tick(now: number): void {
    const run = playing
    if (run === null) return
    const t = (now - run.t0) / 1000
    if (t >= run.p.seconds) {
      run.end(true)
      return
    }
    const beat = (run.p.from ?? 0) + Math.max(0, t) / run.p.beatSec
    if (run.p.write === true) api.write(beat)
    api.at(Motion.paused ? Math.floor(beat) : beat, run.p.staffs)
    run.p.onBeat?.(beat)
  }

  function play(p: ScorePlay): Run {
    playing?.end(false)
    if (!drawer) {
      drawer = true
      addDrawer({
        active: () => playing !== null,
        wants: () => playing !== null,
        draw: (now) => {
          tick(now)
        },
      })
    }
    let settle: (heard: boolean) => void = () => undefined
    const done = new Promise<boolean>((resolve) => {
      settle = resolve
    })
    const timer = window.setTimeout(() => {
      me.end(true)
    }, p.seconds * 1000)
    const me: Playing = {
      p,
      t0: performance.now(),
      end(heard) {
        if (playing !== me) return
        playing = null
        window.clearTimeout(timer)
        api.at(null)
        settle(heard)
      },
    }
    playing = me
    if (p.write === true) api.write(p.from ?? 0)
    api.at(p.from ?? 0, p.staffs)
    wake()
    return {
      done,
      stop: () => {
        me.end(false)
      },
    }
  }

  const api: Score = {
    show(next, w = Number.POSITIVE_INFINITY) {
      scene = next
      written = w
      beat = null
      staffs = undefined
      draw()
    },
    write(b) {
      written = b
      if (drawing !== null) writeScore(drawing, b)
    },
    at(b, s) {
      beat = b
      staffs = s
      if (drawing !== null) lightScore(drawing, b, s)
    },
    setView(next) {
      if (next === view) return
      view = next
      draw()
    },
    play,
    get view() {
      return view
    },
    get scene() {
      return scene
    },
    get drawing() {
      return drawing
    },
  }
  return api
}
