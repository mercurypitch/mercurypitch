import { describe, expect, it } from 'vitest'
import { hasLrcTimingMetadata, parseLrcTimingMetadata, withLrcTimingMetadata, } from '@/lib/lrc-timing-metadata'
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

  it('round-trips a line where only one word has an end', () => {
    // The usual shape, not the odd one: an end is marked where a word is
    // held, so most lines carry one mark with holes in front of it. JSON
    // writes each hole as null, and a reader that took only numbers dropped
    // the whole tag -- ends AND sweeps -- for every such file.
    const ends: number[] = []
    ends[9] = 171.141
    const extension = {
      wordEndTimings: { 25: ends },
      wordSweepTimings: {
        25: {
          9: [
            { time: 171.101, progress: 0.8 },
            { time: 171.141, progress: 1 },
          ],
        },
      },
    }
    const lrc = withLrcTimingMetadata('[00:01.00] Held', extension)
    const back = parseLrcTimingMetadata(lrc)

    expect(back).toEqual(extension)
    // Holes, not nulls and not zeros: `0 in ends` is how the mixer tells
    // "no end marked" from "ends at the very start".
    expect(back?.wordEndTimings[25]).toHaveLength(10)
    expect(0 in (back?.wordEndTimings[25] ?? [])).toBe(false)
    expect(back?.wordEndTimings[25][9]).toBe(171.141)
  })

  it('reads a tag written by a build that serialised holes as null', () => {
    // The shape exports in the wild already carry, so it has to be read --
    // changing what the writer emits would not reach a file on a disk.
    const encoded = btoa(
      JSON.stringify({
        v: 1,
        ends: { 25: [null, null, 171.141], 27: [null, 185.504] },
        sweeps: { 27: { 1: [{ time: 185.504, progress: 1 }] } },
      }),
    )
    const back = parseLrcTimingMetadata(
      `[x-mp-timing:${encoded}]\n[00:01.00]Valid`,
    )
    expect(back?.wordEndTimings[25][2]).toBe(171.141)
    expect(back?.wordEndTimings[27][1]).toBe(185.504)
    expect(back?.wordSweepTimings[27][1]).toHaveLength(1)
  })

  it('drops a line that is nothing but holes', () => {
    const encoded = btoa(
      JSON.stringify({ v: 1, ends: { 3: [null, null], 4: [1.5] } }),
    )
    const back = parseLrcTimingMetadata(`[x-mp-timing:${encoded}]\n[00:01.00]x`)
    expect(back?.wordEndTimings).toEqual({ 4: [1.5] })
  })

  it('accepts null as a hole and nothing else', () => {
    for (const slot of ['1.5', true, {}, [], -1]) {
      const encoded = btoa(JSON.stringify({ v: 1, ends: { 0: [null, slot] } }))
      expect(
        parseLrcTimingMetadata(`[x-mp-timing:${encoded}]\n[00:01.00]x`),
        JSON.stringify(slot),
      ).toBeNull()
    }
  })

  it('says whether a tag is there, readable or not', () => {
    expect(hasLrcTimingMetadata('[00:01.00]No tag')).toBe(false)
    expect(hasLrcTimingMetadata('[x-mp-timing:not-base64]\n[00:01.00]x')).toBe(
      true,
    )
    expect(hasLrcTimingMetadata('[ar:x-mp-timing]\n[00:01.00]x')).toBe(false)
  })

  it('ignores malformed metadata without rejecting the LRC', () => {
    expect(
      parseLrcTimingMetadata(
        '[x-mp-timing:not-base64]\n[00:01.00] Still valid',
      ),
    ).toBeNull()
  })

  it('rejects negative times and non-numeric timing keys', () => {
    const encoded = btoa(
      JSON.stringify({
        v: 1,
        ends: { line: [-1] },
        sweeps: {},
      }),
    )
    expect(
      parseLrcTimingMetadata(`[x-mp-timing:${encoded}]\n[00:01.00]Valid`),
    ).toBeNull()
  })
})
