import { beforeEach, describe, expect, it } from 'vitest'
import { recordTakeFrame, resetTakeRecording, takeElapsedSeconds, takeRecording, } from './take-recorder'

beforeEach(() => {
  resetTakeRecording()
})

function sing(atMs: number, freq = 440, over: Record<string, unknown> = {}) {
  recordTakeFrame({ atMs, freq, cents: 0, midi: 69, trail: true, ...over })
}

describe('the trail', () => {
  it('measures its x axis in seconds of run time', () => {
    sing(1000)
    sing(1100)
    sing(1200)
    expect(takeRecording.trail.map((s) => s.time)).toEqual([0, 0.1, 0.2])
  })

  it('breaks the line on silence rather than joining across it', () => {
    sing(0)
    sing(16, 0)
    sing(32)
    expect(takeRecording.trail[1].freq).toBeNull()
  })

  it('stays the same array, because the canvas is holding it', () => {
    const held = takeRecording.trail
    sing(0)
    resetTakeRecording()
    sing(0)
    expect(takeRecording.trail).toBe(held)
    expect(held).toHaveLength(1)
  })

  it('is not collected at all for a melody run', () => {
    sing(0, 440, { trail: false })
    expect(takeRecording.trail).toHaveLength(0)
    expect(takeRecording.summary.frameCount).toBe(1)
  })

  it('keeps its length bounded on a long take', () => {
    for (let i = 0; i < 4000; i++) sing(i * 16)
    expect(takeRecording.trail.length).toBeLessThanOrEqual(1500)
    // And it keeps the NEWEST end, which is the part being drawn.
    const last = takeRecording.trail[takeRecording.trail.length - 1]
    expect(last.time).toBeCloseTo(takeElapsedSeconds(), 6)
  })
})

describe('the take clock', () => {
  it('counts the frames, not the wall', () => {
    sing(0)
    sing(1000)
    sing(2000)
    // Three frames a second apart: two gaps, each clamped to 250 ms.
    expect(takeElapsedSeconds()).toBeCloseTo(0.5, 6)
  })

  it('leaves out the span a parked take spent on another tab', () => {
    for (let i = 0; i <= 60; i++) sing(i * 50)
    const beforePark = takeElapsedSeconds()
    expect(beforePark).toBeCloseTo(3, 6)
    // Forty seconds parked: the room is unmounted, so nothing arrives.
    sing(43_000)
    expect(takeElapsedSeconds()).toBeLessThan(beforePark + 0.3)
  })

  it('does not jump the canvas window when the room comes back', () => {
    for (let i = 0; i <= 20; i++) sing(i * 50)
    const before = takeRecording.trail[takeRecording.trail.length - 1].time
    sing(60_000)
    const after = takeRecording.trail[takeRecording.trail.length - 1].time
    expect(after - before).toBeLessThanOrEqual(0.25)
  })
})

describe('what a frame carries', () => {
  it('keeps the measurement the caller made, not one of its own', () => {
    recordTakeFrame({ atMs: 0, freq: 440, cents: -37, midi: 69, trail: true })
    expect(takeRecording.trail[0]).toEqual({ freq: 440, cents: -37, time: 0 })
  })

  it('records silence as a frame, not as a missing one', () => {
    recordTakeFrame({ atMs: 0, freq: 0, cents: 99, midi: 60, trail: true })
    expect(takeRecording.summary.frameCount).toBe(1)
    expect(takeRecording.trail[0].freq).toBeNull()
  })

  it('keeps every frame: the summary costs nothing to feed', () => {
    for (let i = 0; i < 60; i++) sing(i * 16)
    expect(takeRecording.trail).toHaveLength(60)
    expect(takeRecording.summary.frameCount).toBe(60)
  })
})

describe('starting a take', () => {
  it('throws the previous one away, clock included', () => {
    sing(0)
    sing(1000)
    resetTakeRecording()
    expect(takeRecording.summary.frameCount).toBe(0)
    expect(takeRecording.trail).toHaveLength(0)
    expect(takeElapsedSeconds()).toBe(0)
  })

  it('is NOT called by a resume: the take survives a park', () => {
    sing(1000)
    sing(1050)
    // A park unmounts the room; nothing here is the component's.
    sing(60_000)
    expect(takeRecording.summary.frameCount).toBe(3)
    expect(takeElapsedSeconds()).toBeCloseTo(0.3, 6)
  })
})
