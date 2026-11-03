// ============================================================
// ZenPitchRibbon tests — the band follows the notes on any screen
// ============================================================
//
// The ribbon eases its band of pitch toward the notes in view. The ease was
// a tenth per frame scaled by the tier's frame cap, and an uncapped device's
// cap is Infinity, so on a capable phone it was nothing: the band stayed at
// 55 to 79 for good, and a low voice's notes all sat on its bottom edge.
// Drawn here on a canvas that records where each note's pill goes, with the
// frames run by hand, on a device set to full quality (uncapped).

import { render } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setPerformanceMode } from '@/lib/device-tier'
import { ZenPitchRibbon } from './ZenPitchRibbon'

/** A canvas that records the top of every pill drawn. */
function pillCanvas() {
  const pills: number[] = []
  const noop = (): void => undefined
  const ctx = new Proxy(
    { roundRect: (_x: number, y: number) => pills.push(y) },
    {
      get: (target, key) =>
        key in target ? target[key as keyof typeof target] : noop,
      set: () => true,
    },
  )
  return { ctx, pills }
}

let frames: FrameRequestCallback[] = []
let canvas = pillCanvas()

beforeEach(() => {
  frames = []
  vi.stubGlobal('requestAnimationFrame', (run: FrameRequestCallback) => {
    frames.push(run)
    return frames.length
  })
  vi.stubGlobal('cancelAnimationFrame', () => undefined)
  vi.stubGlobal('matchMedia', () => ({ matches: false }))
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {}
      disconnect(): void {}
    },
  )
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(360)
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(56)
  canvas = pillCanvas()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(((
    id: string,
  ) =>
    id === '2d'
      ? (canvas.ctx as unknown as CanvasRenderingContext2D)
      : null) as typeof HTMLCanvasElement.prototype.getContext)
  setPerformanceMode('high')
})

afterEach(() => {
  setPerformanceMode('auto')
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

/** Runs the next animation frame at `ms`. */
function frameAt(ms: number): void {
  const run = frames.shift()
  if (run === undefined) throw new Error('no frame asked for')
  run(ms)
}

describe('the ribbon’s band', () => {
  it('fits a low voice’s notes on an uncapped screen, a higher note drawn higher', async () => {
    render(() => (
      <ZenPitchRibbon
        playing={() => true}
        elapsed={() => 1}
        notes={() => [
          { startBeat: 0, endBeat: 2, midi: 48 },
          { startBeat: 2, endBeat: 4, midi: 52 },
        ]}
        micPitch={() => null}
      />
    ))
    await Promise.resolve()

    frameAt(1000)
    frameAt(1016.7)

    // The last frame's two pills: C3, then E3 above it.
    const [c3, e3] = canvas.pills.slice(-2)
    expect(e3).toBeLessThan(c3 - 10)
  })
})
