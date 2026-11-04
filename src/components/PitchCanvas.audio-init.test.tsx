// A canvas whose sound cannot start still mounts as a canvas.
//
// PitchCanvas builds its own AudioEngine for click-to-play, and the engine's
// init() constructs an AudioContext. A browser refuses one now and then (too
// many contexts in the document, or none outside a gesture), and init()
// rejects. Mount fired init() and walked away, so the rejection reached the
// window unhandled and the app's error boundary raised the crash screen over
// a canvas that only lacked its click sound.

import { render } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PitchCanvas } from '@/components/PitchCanvas'
import { buildMultiOctaveScale } from '@/lib/scale-data'

const refused = new Error(
  'The number of hardware contexts provided (6) is exceeded',
)

vi.mock('@/lib/audio-engine', () => ({
  AudioEngine: class {
    init(): Promise<void> {
      return Promise.reject(refused)
    }
    destroy(): void {}
  },
}))

const SCALE = buildMultiOctaveScale('C', 3, 3, 'major')

/** A 2D context that accepts every call and draws nothing. */
function silentContext(): CanvasRenderingContext2D {
  const known: Record<string | symbol, unknown> = {
    measureText: () => ({ width: 10 }),
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} }),
    getLineDash: () => [],
  }
  return new Proxy(known, {
    get: (target, key) =>
      key in target ? target[key] : key === 'then' ? undefined : () => {},
    set: (target, key, value) => {
      target[key] = value
      return true
    },
  }) as unknown as CanvasRenderingContext2D
}

const unhandled: unknown[] = []
const onUnhandled = (reason: unknown): void => {
  unhandled.push(reason)
}

beforeEach(() => {
  unhandled.length = 0
  process.on('unhandledRejection', onUnhandled)
  vi.stubGlobal('requestAnimationFrame', () => 1)
  vi.stubGlobal('cancelAnimationFrame', () => {})
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {}
      disconnect(): void {}
    },
  )
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(750)
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(400)
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(((
    id: string,
  ) =>
    id === '2d'
      ? silentContext()
      : null) as typeof HTMLCanvasElement.prototype.getContext)
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  process.off('unhandledRejection', onUnhandled)
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('PitchCanvas when the browser refuses it an AudioContext', () => {
  it('reports the refusal instead of leaving it to reach the window', async () => {
    const { unmount } = render(() => (
      <PitchCanvas
        melody={() => []}
        scale={() => SCALE}
        totalBeats={() => 17}
        currentBeat={() => 1}
        pitchHistory={() => []}
        currentNoteIndex={() => -1}
        isPlaying={() => false}
        isPaused={() => false}
        isScrolling={() => true}
        traceStyle={() => 'spectrum'}
        targetStyle={() => 'line'}
      />
    ))

    // Long enough for Node to call an unhandled rejection unhandled.
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(unhandled).toEqual([])
    expect(console.error).toHaveBeenCalledWith(
      '[PitchCanvas] audio init failed:',
      refused,
    )
    unmount()
  })
})
