// Studio timeline geometry tests — source trims and viewport coordinates preserve exact frame positions.
import { describe, expect, it } from 'vitest'
import { clipEndFrame, formatStudioTime, frameToPixel, pixelToFrame, studioRulerTicks, } from './timeline-geometry'

describe('Studio timeline geometry', () => {
  it('round-trips frame positions at fractional zoom and clamps seeks to the song range', () => {
    for (const scale of [1, 3.5, 20, 400]) {
      expect(pixelToFrame(frameToPixel(123456, scale), scale, 500000)).toBe(
        123456,
      )
      expect(pixelToFrame(-40, scale, 500000)).toBe(0)
      expect(pixelToFrame(1e8, scale, 500000)).toBe(500000)
    }
    expect(pixelToFrame(Number.NaN, 20, 500000)).toBe(0)
  })

  it('uses the retained source interval for duration and displays milliseconds without accumulated rounding', () => {
    expect(
      clipEndFrame({
        id: 'clip',
        trackId: 'track',
        assetId: 'asset',
        startFrame: 96000,
        sourceInFrame: 48000,
        sourceOutFrame: 144000,
        gainDb: 0,
        fades: { curve: 'linear-amplitude' },
      }),
    ).toBe(192000)
    expect(formatStudioTime(2023200)).toBe('0:42.150')
    expect(formatStudioTime(2879999)).toBe('1:00.000')
  })

  it('only emits visible ruler ticks and uses whole beats at high zoom', () => {
    const ticks = studioRulerTicks(20000, 600, 20, 1e10)
    expect(ticks.length).toBeLessThan(15)
    expect(ticks[0].pixel).toBeLessThanOrEqual(20000)
    expect(ticks.at(-1)!.pixel).toBeLessThanOrEqual(20600)
    const beats = studioRulerTicks(0, 900, 400, 480000, 120)
    expect(new Set(beats.map((tick) => tick.label)).size).toBe(beats.length)
    expect(beats.map((tick) => tick.label).slice(0, 4)).toEqual([
      '1.1',
      '1.2',
      '1.3',
      '1.4',
    ])
  })
})
