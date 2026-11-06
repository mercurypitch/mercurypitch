// ============================================================
// TV stage loop tests — messages folded in, a frame drawn per display frame
// ============================================================

import { describe, expect, it, vi } from 'vitest'
import { EMPTY_TV_STAGE } from '@/lib/tv-stage/model'
import type { TvStageSong } from '@/lib/tv-stage/protocol'
import { TV_STAGE_IDLE, TV_STAGE_PROTOCOL } from '@/lib/tv-stage/protocol'
import type { TvStageCanvas } from '@/lib/tv-stage/stage-loop'
import { fitTvStageCanvas, startTvStageLoop } from '@/lib/tv-stage/stage-loop'

const SONG: TvStageSong = {
  v: TV_STAGE_PROTOCOL,
  kind: 'song',
  title: 'A song',
  duration: 30,
  notes: [{ t0: 1, t1: 2, midi: 60 }],
  lyrics: [],
}

function fakeCanvas(clientWidth = 960, clientHeight = 540) {
  const ctx = {} as CanvasRenderingContext2D
  const canvas: TvStageCanvas = {
    clientWidth,
    clientHeight,
    width: 0,
    height: 0,
    getContext: () => ctx,
  }
  return { canvas, ctx }
}

/** A display whose frames run only when the test says so. */
function fakeDisplay() {
  let pending: ((time: number) => void) | null = null
  return {
    requestFrame: (frame: (time: number) => void) => {
      pending = frame
    },
    frame(time: number) {
      const run = pending
      pending = null
      run?.(time)
    },
  }
}

describe('the stage loop', () => {
  it('folds each message into one state', () => {
    const display = fakeDisplay()
    const loop = startTvStageLoop(null, {
      requestFrame: display.requestFrame,
      draw: vi.fn(),
    })
    expect(loop.state()).toBe(EMPTY_TV_STAGE)
    loop.receive(SONG)
    expect(loop.state().song).toBe(SONG)
    loop.receive(TV_STAGE_IDLE)
    expect(loop.state()).toBe(EMPTY_TV_STAGE)
  })

  it('draws the state on every frame of the display, at the screen’s own pixels', () => {
    const display = fakeDisplay()
    const { canvas, ctx } = fakeCanvas(960, 540)
    const draw = vi.fn()
    const afterDraw = vi.fn()
    const loop = startTvStageLoop(canvas, {
      requestFrame: display.requestFrame,
      pixelRatio: () => 2,
      now: () => 1234,
      draw,
      afterDraw,
    })
    loop.receive(SONG)
    display.frame(16)
    expect(draw).toHaveBeenCalledTimes(1)
    const [drawnCtx, state, now, size] = draw.mock.calls[0]
    expect(drawnCtx).toBe(ctx)
    expect(state.song).toBe(SONG)
    expect(now).toBe(1234)
    expect(size).toEqual({ width: 1920, height: 1080 })
    expect(canvas).toMatchObject({ width: 1920, height: 1080 })
    expect(afterDraw).toHaveBeenCalledWith(ctx, size, 16)
    // And it asked for the next frame.
    display.frame(33)
    expect(draw).toHaveBeenCalledTimes(2)
  })

  it('still takes messages with no canvas to draw on', () => {
    const display = fakeDisplay()
    const draw = vi.fn()
    const loop = startTvStageLoop(null, {
      requestFrame: display.requestFrame,
      draw,
    })
    loop.receive(SONG)
    display.frame(16)
    expect(draw).not.toHaveBeenCalled()
    expect(loop.state().song).toBe(SONG)
  })
})

describe('fitting the canvas', () => {
  it('sizes the backing store to the CSS box times the pixel ratio, and leaves it when it fits', () => {
    const { canvas } = fakeCanvas(1280, 720)
    expect(fitTvStageCanvas(canvas, 1.5)).toEqual({ width: 1920, height: 1080 })
    canvas.width = 1920
    canvas.height = 1080
    const before = { ...canvas }
    fitTvStageCanvas(canvas, 1.5)
    expect(canvas.width).toBe(before.width)
    expect(canvas.height).toBe(before.height)
  })
})
