// Studio zoom control tests — a step keeps the playhead where it is or brings it to the middle, a pinch keeps the moment under the fingers, and several wheel events zoom once a frame.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createStudioZoom } from './zoom-control'

const RATE = 48_000

/** A timeline 800 px of lane wide behind 240 px of headers, drawn at `scale`. */
function setup(
  options: { scale?: number; playhead?: number; scroll?: number } = {},
) {
  let scale = options.scale ?? 40
  const viewport = {
    scrollLeft: options.scroll ?? 0,
    getBoundingClientRect: () => ({ left: 100 }),
  }
  const apply = vi.fn((next: number) => {
    scale = next
  })
  const fit = vi.fn()
  const zoom = createStudioZoom({
    viewport: () => viewport,
    headerWidth: () => 240,
    contentWidth: () => 800,
    scale: () => scale,
    floor: () => 10,
    playheadFrame: () => options.playhead ?? 0,
    apply,
    fit,
  })
  return { zoom, viewport, apply, fit, scale: () => scale }
}

/** Seconds of song `x` pixels into the lanes. */
const secondsAt = (view: { scrollLeft: number }, x: number, scale: number) =>
  (view.scrollLeft + x) / scale

describe('Studio zoom control', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame'] })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('steps in about the playhead, which stays where it stood on screen', async () => {
    // At 40 px/s, scrolled 400 px: the playhead at 15 s stands 200 px in.
    const { zoom, viewport, apply, scale } = setup({
      playhead: 15 * RATE,
      scroll: 400,
    })

    zoom.step(1)
    await Promise.resolve()

    expect(apply).toHaveBeenCalledExactlyOnceWith(60)
    expect(viewport.scrollLeft).toBe(15 * 60 - 200)
    expect(secondsAt(viewport, 200, scale())).toBe(15)
  })

  it('brings a playhead out of sight to the middle of the lanes', async () => {
    const { zoom, viewport, scale } = setup({ playhead: 100 * RATE })

    zoom.step(-1)
    await Promise.resolve()

    expect(scale()).toBe(30)
    expect(secondsAt(viewport, 400, scale())).toBe(100)
  })

  it('zooms about the pointer, at most once a frame, by everything the wheel turned', async () => {
    // The pointer is 300 px into the lanes: 100 + 240 of edge and headers.
    const { zoom, viewport, apply, scale } = setup({ scroll: 500 })

    zoom.zoomBy(1.25, 640)
    zoom.zoomBy(1.25, 640)
    expect(apply).not.toHaveBeenCalled()
    vi.advanceTimersToNextFrame()
    await Promise.resolve()

    expect(apply).toHaveBeenCalledExactlyOnceWith(62.5)
    expect(secondsAt(viewport, 300, scale())).toBeCloseTo(20, 10)
  })

  it('keeps a zoom between its floor and the closest stop', async () => {
    const { zoom, apply } = setup()

    zoom.zoomTo(2, 640)
    zoom.zoomTo(900, 640)
    await Promise.resolve()

    expect(apply.mock.calls).toEqual([[10], [200]])
  })

  it('says whether each way can still zoom, and reads its level', () => {
    const { zoom, apply } = setup({ scale: 10 })
    expect(zoom.canStep(-1)).toBe(false)
    expect(zoom.canStep(1)).toBe(true)
    expect(zoom.percent()).toBe(25)
    zoom.step(-1)
    expect(apply).not.toHaveBeenCalled()
  })
})
