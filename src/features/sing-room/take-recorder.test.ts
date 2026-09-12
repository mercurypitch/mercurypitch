import { beforeEach, describe, expect, it } from 'vitest'
import { recordTakeFrame, resetTakeRecording, startTakeRecording, takeRecording, } from './take-recorder'

beforeEach(() => {
  resetTakeRecording()
})

function sing(atMs: number, freq = 440, over: Record<string, unknown> = {}) {
  recordTakeFrame({ atMs, freq, cents: 0, midi: 69, trail: true, ...over })
}

describe('the trail', () => {
  it('measures its x axis in seconds since the take began', () => {
    startTakeRecording(1000)
    sing(1500)
    sing(2000)
    expect(takeRecording.trail.map((s) => s.time)).toEqual([0.5, 1])
  })

  it('breaks the line on silence rather than joining across it', () => {
    startTakeRecording(0)
    sing(0)
    sing(16, 0)
    sing(32)
    expect(takeRecording.trail[1].freq).toBeNull()
  })

  it('stays the same array, because the canvas is holding it', () => {
    const held = takeRecording.trail
    startTakeRecording(0)
    sing(0)
    expect(takeRecording.trail).toBe(held)
    expect(held).toHaveLength(1)
  })

  it('is not collected at all for a melody run', () => {
    startTakeRecording(0)
    sing(0, 440, { trail: false })
    expect(takeRecording.trail).toHaveLength(0)
    expect(takeRecording.frames).toHaveLength(1)
  })

  it('keeps its length bounded on a long take', () => {
    startTakeRecording(0)
    for (let i = 0; i < 4000; i++) sing(i * 16)
    expect(takeRecording.trail.length).toBeLessThanOrEqual(1500)
    // And it keeps the NEWEST end, which is the part being drawn.
    const last = takeRecording.trail[takeRecording.trail.length - 1]
    expect(last.time).toBeCloseTo((3999 * 16) / 1000, 3)
  })
})

describe('the take frames', () => {
  it('downsamples the take while the trail keeps every frame', () => {
    startTakeRecording(0)
    for (let i = 0; i < 60; i++) sing(i * 16) // one second at 60 fps
    expect(takeRecording.trail).toHaveLength(60)
    // Every fourth frame of a 60 fps stream — 64 ms apart, which resolves
    // the 150 ms hold the range is measured with two or three times over.
    expect(takeRecording.frames).toHaveLength(15)
    const gaps = takeRecording.frames
      .slice(1)
      .map((frame, i) => frame.atMs - takeRecording.frames[i].atMs)
    expect(Math.max(...gaps)).toBeLessThanOrEqual(80)
  })

  it('carries the measurement the caller made, not one of its own', () => {
    startTakeRecording(0)
    recordTakeFrame({ atMs: 0, freq: 440, cents: -37, midi: 69, trail: true })
    expect(takeRecording.frames[0]).toEqual({
      atMs: 0,
      freq: 440,
      cents: -37,
      midi: 69,
    })
  })

  it('records silence as a frame, not as a missing one', () => {
    startTakeRecording(0)
    recordTakeFrame({ atMs: 0, freq: 0, cents: 99, midi: 60, trail: true })
    expect(takeRecording.frames[0]).toEqual({
      atMs: 0,
      freq: 0,
      cents: 0,
      midi: 0,
    })
  })
})

describe('starting a take', () => {
  it('throws the previous one away, clock included', () => {
    startTakeRecording(0)
    sing(0)
    sing(1000)
    startTakeRecording(5000)
    expect(takeRecording.frames).toHaveLength(0)
    expect(takeRecording.trail).toHaveLength(0)
    expect(takeRecording.startedAtMs).toBe(5000)
    expect(takeRecording.elapsedSeconds).toBe(0)
  })

  it('is NOT called by a resume: the clock survives a park', () => {
    startTakeRecording(1000)
    sing(1500)
    // A park unmounts the room; nothing here is the component's.
    sing(60_000)
    expect(takeRecording.startedAtMs).toBe(1000)
    expect(takeRecording.elapsedSeconds).toBeCloseTo(59, 3)
    expect(takeRecording.frames).toHaveLength(2)
  })
})
