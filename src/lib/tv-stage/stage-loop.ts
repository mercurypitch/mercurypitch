// ============================================================
// TV stage loop — the stage's one state, drawn on every frame of the display
// ============================================================
//
// Both pages that show the stage run this: the iPhone's second screen
// (apps/mercurypitch/src/stage/main.ts), which the app hands messages as
// JSON, and the Cast receiver (src/cast-receiver/main.ts), which gets them
// from a Cast sender. The loop folds each message into one state (model.ts)
// and draws that state on every frame of the display, at the screen's own
// pixels, so the lane moves at the display's rate while the room sends
// twenty frames a second. `afterDraw` lets a page draw over the stage: the
// receiver's meter does.
//
// Tests: src/lib/tv-stage/stage-loop.test.ts.

import type { TvStageSize } from './layout'
import type { TvStageState } from './model'
import { applyTvStageMessage, EMPTY_TV_STAGE } from './model'
import type { TvStageMessage } from './protocol'
import type { TvStageView } from './renderer'
import { createTvStageView, drawTvStage } from './renderer'

/** The canvas the stage draws on, as much of it as the loop uses. */
export interface TvStageCanvas {
  readonly clientWidth: number
  readonly clientHeight: number
  width: number
  height: number
  getContext(kind: '2d'): CanvasRenderingContext2D | null
}

export interface TvStageLoopOptions {
  /** The wall clock, in ms. */
  readonly now?: () => number
  /** Asks for the next frame of the display. */
  readonly requestFrame?: (frame: (time: number) => void) => unknown
  /** Device pixels to a CSS pixel. */
  readonly pixelRatio?: () => number
  /** Draws one frame of the stage. */
  readonly draw?: typeof drawTvStage
  readonly view?: TvStageView
  /** Called after each frame of the stage, to draw over it. */
  readonly afterDraw?: (
    ctx: CanvasRenderingContext2D,
    size: TvStageSize,
    frameTime: number,
  ) => void
}

export interface TvStageLoop {
  /** Folds one message into the stage. */
  receive(message: TvStageMessage): void
  /** What the stage holds now. */
  state(): TvStageState
}

/** The canvas's backing store at the screen's own pixels. */
export function fitTvStageCanvas(
  canvas: TvStageCanvas,
  scale: number,
): TvStageSize {
  const width = Math.round(canvas.clientWidth * scale)
  const height = Math.round(canvas.clientHeight * scale)
  if (canvas.width !== width) canvas.width = width
  if (canvas.height !== height) canvas.height = height
  return { width, height }
}

/**
 * Starts drawing the stage on `canvas` on every frame of the display. With
 * no canvas, or none that draws in 2D, it still takes messages and draws
 * nothing.
 */
export function startTvStageLoop(
  canvas: TvStageCanvas | null,
  options: TvStageLoopOptions = {},
): TvStageLoop {
  const now = options.now ?? (() => Date.now())
  const requestFrame =
    options.requestFrame ?? ((frame) => requestAnimationFrame(frame))
  const pixelRatio = options.pixelRatio ?? (() => window.devicePixelRatio || 1)
  const draw = options.draw ?? drawTvStage
  const view = options.view ?? createTvStageView()
  const ctx = canvas?.getContext('2d') ?? null
  let state: TvStageState = EMPTY_TV_STAGE

  const frame = (time: number): void => {
    if (canvas !== null && ctx !== null) {
      const size = fitTvStageCanvas(canvas, pixelRatio())
      draw(ctx, state, now(), size, view)
      options.afterDraw?.(ctx, size, time)
    }
    requestFrame(frame)
  }
  requestFrame(frame)

  return {
    receive: (message) => {
      state = applyTvStageMessage(state, message)
    },
    state: () => state,
  }
}
