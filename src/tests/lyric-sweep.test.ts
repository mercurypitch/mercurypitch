import { describe, expect, it } from 'vitest'
import { parseLrcTimingMetadata, withLrcTimingMetadata, } from '@/lib/lrc-timing-metadata'
import { appendSweepPoint, appendWordSweepSample, beginWordSweep, interpolateSweepProgress, } from '@/lib/lyric-sweep'

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

  it('updates only the active line and word as a song-wide map grows', () => {
    const untouchedLine = {
      0: [
        { time: 1, progress: 0 },
        { time: 2, progress: 1 },
      ],
    }
    const neighboringWord = [{ time: 20, progress: 0 }]
    const initial = {
      0: untouchedLine,
      40: {
        2: neighboringWord,
      },
    }

    const started = beginWordSweep(initial, 40, 3, 21)
    const sampled = appendWordSweepSample(started, 40, 3, 22, 0.5)

    expect(sampled[0]).toBe(untouchedLine)
    expect(sampled[40][2]).toBe(neighboringWord)
    expect(sampled[40][3].at(-1)).toEqual({ time: 22, progress: 0.5 })
    expect(Object.hasOwn(initial[40], 3)).toBe(false)
  })

  it('does not allocate song state for a compacted duplicate sample', () => {
    const timings = {
      0: { 0: [{ time: 10, progress: 0.4 }] },
    }
    const next = appendWordSweepSample(timings, 0, 0, 10.05, 0.405)

    expect(next).toBe(timings)
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
