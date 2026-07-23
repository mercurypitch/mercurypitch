import { describe, expect, it } from 'vitest'
import { parseLrcTimingMetadata, withLrcTimingMetadata, } from '@/lib/lrc-timing-metadata'
import { appendSweepPoint, interpolateSweepProgress } from '@/lib/lyric-sweep'

describe('lyric marker sweep curves', () => {
  it('keeps repeated positions so a held vowel becomes a dwell', () => {
    let points = appendSweepPoint([], 10, 0)
    points = appendSweepPoint(points, 10.5, 0.35)
    points = appendSweepPoint(points, 12, 0.35)
    points = appendSweepPoint(points, 13, 0.35)
    points = appendSweepPoint(points, 13, 1)

    expect(interpolateSweepProgress(points, 11, 0)).toBeCloseTo(0.35)
    expect(interpolateSweepProgress(points, 12.5, 0)).toBeCloseTo(0.35)
  })

  it('never lets a backwards pointer move reverse the karaoke sweep', () => {
    let points = appendSweepPoint([], 2, 0.6)
    points = appendSweepPoint(points, 3, 0.2)
    expect(points.at(-1)?.progress).toBe(0.6)
  })
})

describe('MercuryPitch LRC timing metadata', () => {
  it('round-trips exact word ends and sub-word curves', () => {
    const extension = {
      wordEndTimings: { 0: [1.8, 2.4] },
      wordSweepTimings: {
        0: {
          0: [
            { time: 1, progress: 0 },
            { time: 1.8, progress: 1 },
          ],
        },
      },
    }
    const lrc = withLrcTimingMetadata(
      '[00:01.00] Hello [00:01.80]world',
      extension,
    )

    expect(lrc).toContain('[x-mp-timing:')
    expect(parseLrcTimingMetadata(lrc)).toEqual(extension)
  })

  it('ignores malformed metadata without rejecting the LRC', () => {
    expect(
      parseLrcTimingMetadata(
        '[x-mp-timing:not-base64]\n[00:01.00] Still valid',
      ),
    ).toBeNull()
  })
})
