// Studio timeline geometry tests — source trims and viewport coordinates preserve exact frame positions.
import { describe, expect, it } from 'vitest'
import { clipEndFrame, formatStudioMoment, formatStudioTime, frameToPixel, parseStudioTime, pixelToFrame, studioRulerTicks, } from './timeline-geometry'

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

  it('writes a moment for a sentence without the trailing zeros of the clock', () => {
    expect(formatStudioMoment(240000)).toBe('0:05')
    expect(formatStudioMoment(264000)).toBe('0:05.5')
    expect(formatStudioMoment(2023200)).toBe('0:42.15')
    expect(formatStudioMoment(480000)).toBe('0:10')
    expect(formatStudioMoment(2880000)).toBe('1:00')
    expect(formatStudioMoment(0)).toBe('0:00')
  })

  it('reads typed clock times in seconds or minutes and refuses anything else', () => {
    expect(parseStudioTime('9.5')).toBe(9.5)
    expect(parseStudioTime(' 1:05.25 ')).toBe(65.25)
    expect(parseStudioTime('0:42.150')).toBeCloseTo(42.15)
    expect(parseStudioTime('1:00:30')).toBe(3630)
    expect(parseStudioTime(formatStudioTime(2023200))).toBeCloseTo(42.15)
    for (const text of [
      '',
      '.',
      '1:',
      ':5',
      '1:75',
      '-2',
      '2e3',
      'abc',
      '1:2:3:4',
    ])
      expect(parseStudioTime(text)).toBeNull()
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
