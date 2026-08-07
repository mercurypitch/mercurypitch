// ============================================================
// The Lab pitch canvas stops drawing when nothing is happening
// ============================================================
//
// This canvas used to run a requestAnimationFrame loop forever: every frame
// did a full clearRect and a full-canvas drawImage blit whether or not
// anything had changed, for as long as the Lab was mounted. The playhead is
// the only thing here that moves on its own, so those frames were only ever
// earned during playback.
//
// The risk in stopping the loop is the opposite failure -- a canvas that goes
// still through a pan or a zoom, because those used to be picked up by the
// next frame of a loop that was running regardless. Both directions are
// pinned below.

import { render } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OfflinePitchCanvas } from '@/components/OfflinePitchCanvas'

/** A 2D context that only counts the blits. */
function fakeContext(): { ctx: unknown; draws: () => number } {
  let draws = 0
  const noop = (): void => {}
  const ctx = {
    canvas: null as unknown,
    drawImage: () => {
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

describe('OfflinePitchCanvas frame budget while idle', () => {
  let frames: (() => void)[] = []
  let contexts: { draws: () => number }[] = []

  beforeEach(() => {
    frames = []
    contexts = []
    vi.stubGlobal('requestAnimationFrame', (cb: () => void) => {
      frames.push(cb)
      return frames.length
    })
    vi.stubGlobal('cancelAnimationFrame', () => {})
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
      },
    )
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(640)
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(200)
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

  /** Run queued frames until none are left, or `cap` is hit. Returns how many
   *  ran; hitting the cap means the queue was refilling itself. */
  const drain = (cap = 200): number => {
    let ran = 0
    while (frames.length > 0 && ran < cap) {
      const next = frames.shift()
      ran += 1
      next?.()
    }
    return ran
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

  it('settles instead of queueing frames forever', () => {
    const { unmount } = mount()

    // Nothing is playing, so the queue must run dry. With the old
    // unconditional loop each frame queued the next one and this hits the cap.
    const ran = drain()
    expect(ran).toBeLessThan(200)
    expect(frames.length).toBe(0)

    // And it stays dry -- no timer or effect refills it behind our back.
    expect(drain()).toBe(0)

    unmount()
  })

  it('still paints the first frame', () => {
    const { unmount } = mount()
    drain()
    // Stopping the loop must not mean never drawing at all.
    expect(contexts.some((c) => c.draws() > 0)).toBe(true)
    unmount()
  })

  it('repaints on a zoom, which no longer has a loop to catch it', () => {
    const { container, unmount } = mount()
    drain()
    const before = contexts.reduce((sum, c) => sum + c.draws(), 0)
    expect(frames.length).toBe(0)

    const canvas = container.querySelector('canvas')
    expect(canvas).not.toBeNull()
    // ctrl+wheel is the zoom gesture. A plain wheel cannot be used here: at
    // zoom 1 maxScroll is 0, so scrollX clamps back to itself and nothing
    // changed -- which is correctly not a repaint.
    canvas!.dispatchEvent(
      new WheelEvent('wheel', {
        deltaY: -100,
        ctrlKey: true,
        cancelable: true,
        bubbles: true,
      }),
    )

    // The zoom change has to have queued exactly the work it needs.
    expect(frames.length).toBeGreaterThan(0)
    drain()
    expect(contexts.reduce((sum, c) => sum + c.draws(), 0)).toBeGreaterThan(
      before,
    )

    unmount()
  })
})
