// Studio live wave tests — a chunk draws only its own columns and the one before; a scroll, a zoom or a loop's next pass draws it all again.
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { StudioLiveTake } from '@/lib/studio/record/recorder-types'
import { createStudioLivePeaks } from '@/lib/studio/record/take-audio'
import type { StudioLiveWaveView } from './live-wave'
import { createStudioLiveWave } from './live-wave'

afterEach(() => vi.restoreAllMocks())

/** A canvas whose context counts what it is asked to draw. */
function canvas() {
  const calls = { fill: 0, cleared: [] as number[][], styleReads: 0 }
  const context = {
    setTransform: vi.fn(),
    clearRect: (x: number, y: number, w: number, h: number) =>
      calls.cleared.push([x, y, w, h]),
    fillRect: () => calls.fill++,
    fillStyle: '',
    globalAlpha: 1,
  }
  const element = document.createElement('canvas')
  element.getContext = (() =>
    context) as unknown as HTMLCanvasElement['getContext']
  const style = window.getComputedStyle
  vi.spyOn(window, 'getComputedStyle').mockImplementation((target) => {
    calls.styleReads++
    return style(target)
  })
  return { element, calls }
}

function take(seconds: number): StudioLiveTake {
  const peaks = createStudioLivePeaks(48000, 48000 * 10)
  peaks.push(new Float32Array(48000 * seconds).fill(0.5))
  return {
    title: 'Take 1',
    heardFirst: 0,
    fromFrame: 0,
    peaks,
    sampleRate: 48000,
    count: peaks.count,
  }
}

/** 100 px a second over a 400 px view. */
const view = (
  live: StudioLiveTake,
  patch: Partial<StudioLiveWaveView> = {},
): StudioLiveWaveView => ({
  live,
  origin: 0,
  firstFrame: 0,
  framesPerPixel: 480,
  width: Math.round((live.count * live.peaks.bucketFrames) / 480),
  viewWidth: 400,
  ...patch,
})

describe('createStudioLiveWave', () => {
  it('draws the columns a chunk adds, and the one before them, without sizing the canvas again', () => {
    const { element, calls } = canvas()
    const wave = createStudioLiveWave()
    wave.draw(element, view(take(1)))
    expect(element.width).toBe(400)
    expect(calls.fill).toBe(2 * 100)
    const reads = calls.styleReads

    wave.draw(element, view(take(2)))
    // Columns 99 to 199: the last one again, then the new hundred.
    expect(calls.fill).toBe(2 * 100 + 2 * 101)
    expect(calls.cleared.at(-1)).toEqual([99, 0, 101, 40])
    expect(calls.styleReads).toBe(reads)
  })

  it('draws it all again for a scroll, a zoom or the next pass of a loop', () => {
    const { element, calls } = canvas()
    const wave = createStudioLiveWave()
    const live = take(2)
    wave.draw(element, view(live))
    for (const moved of [
      { firstFrame: 4800 },
      { framesPerPixel: 960, width: 100 },
      { origin: -96000 },
    ]) {
      const before = calls.fill
      wave.draw(element, view(live, moved))
      const drawn = Math.min(400, view(live, moved).width)
      expect(calls.fill - before).toBe(2 * drawn)
      expect(calls.cleared.at(-2)).toEqual([0, 0, 400, 40])
    }
  })
})
