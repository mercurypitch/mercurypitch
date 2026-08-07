// ============================================================
// The Lab pitch canvas survives a collapsed container
// ============================================================
//
// Reported from dev: opening devtools snapped the viewport to a phone-width
// column and the whole app fell to the error boundary with
//
//   InvalidStateError: Failed to execute 'drawImage' on
//   'CanvasRenderingContext2D': The image argument is a canvas element with
//   a width or height of 0.
//
// The container measured 0, the back-buffer canvas was sized 0x0 from that
// measurement, and a zero-dimension canvas is not a legal drawImage source.
// The throw came out of a requestAnimationFrame callback, so nothing caught
// it -- one skipped frame became a dead session.
//
// jsdom has no 2D context, so the real Chrome behaviour is stubbed: this
// fake throws on a zero-dimension source exactly where Chrome does. Without
// the guards in OfflinePitchCanvas this test fails with that error, which is
// what keeps it honest.

import { render } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OfflinePitchCanvas } from '@/components/OfflinePitchCanvas'

/** Records draws and refuses an unpaintable source, as Chrome does. */
function fakeContext(): { ctx: unknown; draws: () => number } {
  let draws = 0
  const noop = (): void => {}
  const ctx = {
    canvas: null as unknown,
    drawImage: (source: unknown) => {
      const img = source as { width: number; height: number }
      if (img.width === 0 || img.height === 0) {
        throw new DOMException(
          "Failed to execute 'drawImage' on 'CanvasRenderingContext2D': " +
            'The image argument is a canvas element with a width or height ' +
            'of 0.',
          'InvalidStateError',
        )
      }
      draws += 1
    },
    setTransform: noop,
    clearRect: noop,
    fillRect: noop,
    beginPath: noop,
    moveTo: noop,
    lineTo: noop,
    stroke: noop,
    fill: noop,
    closePath: noop,
    arc: noop,
    fillText: noop,
    strokeText: noop,
    save: noop,
    restore: noop,
    translate: noop,
    scale: noop,
    rect: noop,
    measureText: () => ({ width: 10 }) as TextMetrics,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: 'left',
    textBaseline: 'top',
    globalAlpha: 1,
  }
  return { ctx, draws: () => draws }
}

/** Pin the size a container reports, the way a real layout would. */
function sizeParent(width: number, height: number): void {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(width)
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(height)
}

describe('OfflinePitchCanvas in a collapsed container', () => {
  let frames: (() => void)[] = []
  let contexts: { draws: () => number }[] = []
  let observers: (() => void)[] = []

  /** Deliver a resize, as the browser does when the container changes. A
   *  stub that only records observe() would leave resizeCanvas running once
   *  at mount and never again, which makes the backing-store assertion below
   *  pass without testing anything. */
  const triggerResize = (): void => {
    for (const notify of observers) notify()
  }

  beforeEach(() => {
    frames = []
    contexts = []
    observers = []
    // Hold frames rather than run them, so a test drives the loop by hand.
    vi.stubGlobal('requestAnimationFrame', (cb: () => void) => {
      frames.push(cb)
      return frames.length
    })
    vi.stubGlobal('cancelAnimationFrame', () => {})
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(private readonly cb: () => void) {}
        observe(): void {
          observers.push(() => this.cb())
        }
        unobserve(): void {}
        disconnect(): void {
          observers = observers.filter(() => false)
        }
      },
    )
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(((
      contextId: string,
    ) => {
      if (contextId !== '2d') return null
      const made = fakeContext()
      contexts.push(made)
      return made.ctx as CanvasRenderingContext2D
    }) as typeof HTMLCanvasElement.prototype.getContext)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  /** Run the frames queued so far (a frame queues the next one). */
  const runFrames = (count: number): void => {
    for (let i = 0; i < count; i += 1) {
      const next = frames.shift()
      if (next === undefined) return
      next()
    }
  }

  const mount = () =>
    render(() => (
      <OfflinePitchCanvas
        waveform={new Float32Array([0.1, -0.2, 0.3, -0.4])}
        durationSec={4}
        analysisResults={[
          {
            algorithm: 'yin',
            pitches: [
              { time: 0.5, freq: 220, clarity: 0.9 },
              { time: 1.5, freq: 330, clarity: 0.8 },
            ],
          },
        ]}
      />
    ))

  it('draws no frame instead of throwing when the container has zero area', () => {
    sizeParent(0, 0)
    const { unmount } = mount()

    // Ten frames of a collapsed pane. The reported crash happened on the
    // first one; if any of these throws, it escapes rAF exactly as it did
    // in the browser.
    expect(() => triggerResize()).not.toThrow()
    expect(() => runFrames(10)).not.toThrow()
    // Nothing was painted -- the point is that it declined, not that it
    // drew something invisible.
    expect(contexts.every((c) => c.draws() === 0)).toBe(true)

    unmount()
  })

  it('still paints once the container has a real size', () => {
    sizeParent(640, 200)
    const { unmount } = mount()

    expect(() => runFrames(3)).not.toThrow()
    // Guards must not have turned a working canvas into a silent one.
    expect(contexts.some((c) => c.draws() > 0)).toBe(true)

    unmount()
  })

  it('keeps the last good backing store through a collapse', () => {
    sizeParent(640, 200)
    const { container, unmount } = mount()
    runFrames(3)

    const canvas = container.querySelector('canvas')
    expect(canvas).not.toBeNull()
    const goodWidth = canvas!.width
    expect(goodWidth).toBeGreaterThan(0)

    // The pane collapses and the observer delivers it. A zero measurement
    // must not be written through to the backing store, or there is nothing
    // left to show on the way back.
    sizeParent(0, 0)
    expect(() => triggerResize()).not.toThrow()
    expect(() => runFrames(10)).not.toThrow()
    expect(canvas!.width).toBe(goodWidth)

    // And it paints again once the container comes back, without waiting for
    // anything but the next resize.
    sizeParent(640, 200)
    const before = contexts.reduce((sum, c) => sum + c.draws(), 0)
    expect(() => triggerResize()).not.toThrow()
    runFrames(3)
    expect(contexts.reduce((sum, c) => sum + c.draws(), 0)).toBeGreaterThan(
      before,
    )

    unmount()
  })
})
