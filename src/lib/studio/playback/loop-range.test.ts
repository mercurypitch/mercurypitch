// Studio loop range tests — a range's frames wrap pass after pass, and a run is kept only for the loop it was laid out for.
import { describe, expect, it } from 'vitest'
import { isStudioLoopRange, loopPassEnd, playsLoop, seekInLoop, startInLoop, STUDIO_MIN_LOOP_FRAMES, wrapLoopFrame, } from './loop-range'

describe('Studio loop range', () => {
  it('wraps a run count into the range, pass after pass, losing and doubling no frame', () => {
    const start = 48000
    const end = 72000
    // The first pass plays its frames as they are.
    expect(wrapLoopFrame(48000, start, end)).toBe(48000)
    expect(wrapLoopFrame(71999, start, end)).toBe(71999)
    // The next pass starts on the range's first frame again.
    expect(wrapLoopFrame(72000, start, end)).toBe(48000)
    expect(wrapLoopFrame(95999, start, end)).toBe(71999)
    expect(wrapLoopFrame(96000, start, end)).toBe(48000)
    // Every frame of three passes maps to the range exactly once per pass.
    const seen = new Map<number, number>()
    for (let frame = start; frame < start + 3 * (end - start); frame++) {
      const played = wrapLoopFrame(frame, start, end)
      seen.set(played, (seen.get(played) ?? 0) + 1)
    }
    expect(seen.size).toBe(end - start)
    expect([...seen.values()].every((count) => count === 3)).toBe(true)
  })

  it('is the song loop when the range starts at the song start', () => {
    expect(wrapLoopFrame(250000, 0, 96000)).toBe(250000 % 96000)
    expect(wrapLoopFrame(1000.25, 0, 96000)).toBe(1000.25)
  })

  it('ends each pass one range length after the last', () => {
    expect(loopPassEnd(48000, 72000, 0)).toBe(72000)
    expect(loopPassEnd(48000, 72000, 2)).toBe(120000)
    expect(loopPassEnd(0, 96000, 1)).toBe(192000)
  })

  it('keeps a run only for the loop it was laid out for', () => {
    const song = { firstFrame: 0, fixedEnd: null }
    const range = { firstFrame: 48000, fixedEnd: 72000 }
    expect(playsLoop(song, null)).toBe(true)
    expect(playsLoop(range, null)).toBe(false)
    expect(playsLoop(range, { startFrame: 48000, endFrame: 72000 })).toBe(true)
    expect(playsLoop(range, { startFrame: 48000, endFrame: 96000 })).toBe(false)
    expect(playsLoop(song, { startFrame: 0, endFrame: 96000 })).toBe(false)
  })

  it('starts Play inside the range, or at its start from outside it', () => {
    const range = { startFrame: 48000, endFrame: 72000 }
    expect(startInLoop(50000.7, range)).toBe(50000)
    expect(startInLoop(10, range)).toBe(48000)
    expect(startInLoop(72000, range)).toBe(48000)
  })

  it('lands a seek in the range Repeat plays, or on the song', () => {
    const range = { startFrame: 48000, endFrame: 72000 }
    expect(seekInLoop(60000, range, () => 0)).toEqual({
      target: 60000,
      end: 72000,
    })
    expect(seekInLoop(100, range, () => 0)).toEqual({
      target: 48000,
      end: 72000,
    })
    expect(seekInLoop(200000, null, () => 96000)).toEqual({
      target: 96000,
      end: 96000,
    })
  })

  it('takes only whole-frame ranges at least a quarter second long', () => {
    expect(isStudioLoopRange({ startFrame: 0, endFrame: 12000 })).toBe(true)
    expect(STUDIO_MIN_LOOP_FRAMES).toBe(12000)
    expect(isStudioLoopRange({ startFrame: 0, endFrame: 11999 })).toBe(false)
    expect(isStudioLoopRange({ startFrame: -1, endFrame: 48000 })).toBe(false)
    expect(isStudioLoopRange({ startFrame: 0.5, endFrame: 48000 })).toBe(false)
    expect(isStudioLoopRange(null)).toBe(false)
  })
})
