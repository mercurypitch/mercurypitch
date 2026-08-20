// Drum Night transport tests — one clock owns count-in, loops and take timing.
// ============================================================

import { describe, expect, it, vi } from 'vitest'
import type { DrumRuntimeClock } from './drum-transport'
import { createDrumTransport } from './drum-transport'

class FakeClock implements DrumRuntimeClock {
  private timestampMs = 0
  private nextFrameId = 1
  private frames = new Map<number, (timestampMs: number) => void>()

  nowMs = (): number => this.timestampMs

  requestFrame = (callback: (timestampMs: number) => void): number => {
    const id = this.nextFrameId++
    this.frames.set(id, callback)
    return id
  }

  cancelFrame = (handle: number): void => {
    this.frames.delete(handle)
  }

  advance(milliseconds: number): void {
    this.timestampMs += milliseconds
    const pending = [...this.frames.values()]
    this.frames.clear()
    for (const callback of pending) callback(this.timestampMs)
  }

  pendingFrames(): number {
    return this.frames.size
  }
}

describe('Drum Night transport', () => {
  it('runs count-in and playback from the same tempo clock', () => {
    const clock = new FakeClock()
    const transport = createDrumTransport({
      clock,
      tempoBpm: 120,
      countInBeats: 4,
    })
    const listener = vi.fn()
    transport.subscribe(listener)

    transport.start()
    expect(transport.state()).toMatchObject({
      phase: 'count-in',
      countInBeat: 1,
      positionBeats: 0,
    })
    clock.advance(500)
    expect(transport.state().countInBeat).toBe(2)
    clock.advance(1_500)
    expect(transport.state()).toMatchObject({
      phase: 'playing',
      positionBeats: 0,
    })
    clock.advance(250)
    expect(transport.state().positionBeats).toBeCloseTo(0.5)
    expect(listener).toHaveBeenCalled()
    expect(clock.pendingFrames()).toBe(1)
  })

  it('resumes a pause without replaying count-in and stops at zero', () => {
    const clock = new FakeClock()
    const transport = createDrumTransport({
      clock,
      tempoBpm: 60,
      countInBeats: 0,
    })
    transport.start()
    clock.advance(1_500)
    transport.pause()
    expect(transport.state()).toMatchObject({
      phase: 'paused',
      positionBeats: 1.5,
    })
    expect(clock.pendingFrames()).toBe(0)

    clock.advance(5_000)
    transport.start()
    expect(transport.state().phase).toBe('playing')
    clock.advance(500)
    expect(transport.state().positionBeats).toBeCloseTo(2)

    transport.stop()
    expect(transport.state()).toMatchObject({
      phase: 'stopped',
      positionBeats: 0,
      timelineBeats: 0,
    })
    expect(clock.pendingFrames()).toBe(0)
  })

  it('restarts an interrupted count-in from beat one before resuming', () => {
    const clock = new FakeClock()
    const transport = createDrumTransport({
      clock,
      tempoBpm: 120,
      countInBeats: 4,
    })
    transport.start()
    clock.advance(750)
    expect(transport.state().countInBeat).toBe(2)
    transport.pause()
    expect(transport.state()).toMatchObject({
      phase: 'paused',
      pausedFromPhase: 'count-in',
    })

    clock.advance(5_000)
    transport.start()
    expect(transport.state()).toMatchObject({
      phase: 'count-in',
      countInBeat: 1,
      pausedFromPhase: null,
    })
    clock.advance(2_000)
    expect(transport.state().phase).toBe('playing')
    expect(transport.state().positionBeats).toBeCloseTo(0)
  })

  it('wraps the visible playhead while retaining loop iteration authority', () => {
    const clock = new FakeClock()
    const transport = createDrumTransport({
      clock,
      tempoBpm: 120,
      countInBeats: 0,
    })
    expect(transport.setLoop({ startBeat: 0, endBeat: 4 })).toBe(true)
    expect(transport.setLoop({ startBeat: 4, endBeat: 4 })).toBe(false)
    transport.start()
    clock.advance(2_250)

    expect(transport.state()).toMatchObject({
      positionBeats: 0.5,
      timelineBeats: 4.5,
      loopIteration: 1,
    })
  })

  it('reanchors tempo changes without moving the playhead', () => {
    const clock = new FakeClock()
    const transport = createDrumTransport({
      clock,
      tempoBpm: 120,
      countInBeats: 0,
    })
    transport.start()
    clock.advance(500)
    transport.setTempoBpm(60)
    expect(transport.state().positionBeats).toBeCloseTo(1)
    clock.advance(500)
    expect(transport.state().positionBeats).toBeCloseTo(1.5)

    transport.setTempoBpm(1_000)
    expect(transport.state().tempoBpm).toBe(280)
    transport.setCountInBeats(99)
    expect(transport.state().countInBeats).toBe(8)
  })

  it('records velocity, compensated timestamps, loop position and grid timing', () => {
    const clock = new FakeClock()
    const transport = createDrumTransport({
      clock,
      tempoBpm: 120,
      countInBeats: 0,
    })
    transport.setLoop({ startBeat: 0, endBeat: 1 })
    transport.setRecording(true)
    transport.start()
    const hit = transport.captureHit({
      gmKey: 38,
      velocity: 117,
      timestampMs: 630,
      source: 'midi',
      sourceId: 'kit-1',
      rawMidiKey: 40,
    })

    expect(hit).toMatchObject({
      gmKey: 38,
      velocity: 117,
      timestampMs: 630,
      transportBeat: 0.26,
      timelineBeat: 1.26,
      loopIteration: 1,
      nearestGridBeat: 0.25,
    })
    expect(hit?.timingOffsetMs).toBeCloseTo(5)
    expect(transport.recordedHits()).toEqual([hit])

    transport.setRecording(false)
    expect(
      transport.captureHit({
        gmKey: 42,
        velocity: 80,
        timestampMs: 700,
        source: 'touch',
      }),
    ).toBeNull()
  })

  it('records the first hit past a count-in boundary before the next frame', () => {
    const clock = new FakeClock()
    const transport = createDrumTransport({
      clock,
      tempoBpm: 120,
      countInBeats: 4,
    })
    transport.setRecording(true)
    transport.start()

    const hit = transport.captureHit({
      gmKey: 38,
      velocity: 100,
      timestampMs: 2_005,
      source: 'midi',
      sourceId: 'kit-1',
    })

    expect(hit).not.toBeNull()
    expect(hit?.timelineBeat).toBeCloseTo(0.01)
    expect(transport.state().phase).toBe('playing')
    expect(transport.state().positionBeats).toBeCloseTo(0.01)
  })

  it('provides a bounded authored-event lookahead on the same clock', () => {
    const clock = new FakeClock()
    const transport = createDrumTransport({
      clock,
      tempoBpm: 120,
      countInBeats: 0,
    })
    expect(transport.schedulingWindow()).toBeNull()
    transport.start()
    clock.advance(250)

    expect(transport.schedulingWindow(100)).toEqual({
      fromTimestampMs: 250,
      toTimestampMs: 350,
      fromTimelineBeat: 0.5,
      toTimelineBeat: 0.7,
      loop: null,
    })
    expect(transport.schedulingWindow(10_000)?.toTimestampMs).toBe(2_250)
  })

  it('cancels its animation ownership when disposed', () => {
    const clock = new FakeClock()
    const transport = createDrumTransport({ clock, countInBeats: 0 })
    transport.start()
    expect(clock.pendingFrames()).toBe(1)
    transport.dispose()
    expect(clock.pendingFrames()).toBe(0)
  })
})
