// Drum Night transport tests — one clock owns count-in, loops and take timing.
// ============================================================

import { describe, expect, it, vi } from 'vitest'
import type { DrumRuntimeClock } from './drum-transport'
import { createDrumTransport, MAX_DRUM_AUTHORED_TEMPO_CHANGES, } from './drum-transport'

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

  elapseWithoutFrame(milliseconds: number): void {
    this.timestampMs += milliseconds
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

  it('bounds retained take evidence and reports older discarded hits', () => {
    const clock = new FakeClock()
    const transport = createDrumTransport({
      clock,
      tempoBpm: 120,
      countInBeats: 0,
      maxRecordedHits: 3,
    })
    transport.setRecording(true)
    transport.start()

    for (let index = 0; index < 5; index += 1) {
      transport.captureHit({
        gmKey: 38,
        velocity: 100,
        timestampMs: index * 10,
        source: 'midi',
        sourceId: 'kit-1',
      })
    }

    expect(transport.recordedHits().map((hit) => hit.id)).toEqual([3, 4, 5])
    expect(transport.state()).toMatchObject({
      recordedHitCount: 3,
      recordedHitOmissionCount: 2,
    })

    transport.clearRecording()
    expect(transport.recordedHits()).toEqual([])
    expect(transport.state()).toMatchObject({
      recordedHitCount: 0,
      recordedHitOmissionCount: 0,
    })
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

  it('follows authored tempo changes and splits lookahead at the exact boundary', () => {
    const clock = new FakeClock()
    const transport = createDrumTransport({
      clock,
      countInBeats: 0,
      authoredTiming: {
        tempoBpm: 120,
        tempoChanges: [
          { beat: 0, usPerBeat: 500_000 },
          { beat: 1, usPerBeat: 1_000_000 },
        ],
        durationBeats: 4,
      },
    })
    transport.seek(0.9)
    transport.start()

    const windows = transport.schedulingWindows(120)
    expect(windows).toMatchObject([
      {
        fromTimestampMs: 0,
        fromTimelineBeat: 0.9,
        toTimelineBeat: 1,
        fromPositionBeat: 0.9,
        toPositionBeat: 1,
        loopIteration: 0,
        localTempoBpm: 120,
        effectiveTempoBpm: 120,
        speedScale: 1,
        endsAt: 'tempo',
        includeEndBeat: false,
        loop: null,
      },
      {
        toTimestampMs: 120,
        fromTimelineBeat: 1,
        toTimelineBeat: 1.07,
        fromPositionBeat: 1,
        toPositionBeat: 1.07,
        loopIteration: 0,
        localTempoBpm: 60,
        effectiveTempoBpm: 60,
        speedScale: 1,
        endsAt: 'lookahead',
        includeEndBeat: false,
        loop: null,
      },
    ])
    expect(windows[0]?.toTimestampMs).toBeCloseTo(50)
    expect(windows[1]?.fromTimestampMs).toBeCloseTo(50)

    clock.advance(50)
    expect(transport.state()).toMatchObject({
      positionBeats: 1,
      localTempoBpm: 60,
      tempoBpm: 60,
    })
    clock.advance(1_000)
    expect(transport.state().positionBeats).toBeCloseTo(2)
  })

  it('maps authored beats and display seconds exactly through tempo and speed changes', () => {
    const transport = createDrumTransport({
      clock: new FakeClock(),
      countInBeats: 0,
      authoredTiming: {
        tempoBpm: 120,
        tempoChanges: [
          { beat: 0, usPerBeat: 500_000 },
          { beat: 2, usPerBeat: 1_000_000 },
        ],
        durationBeats: 6,
      },
    })

    expect(transport.secondsForBeat(0)).toBe(0)
    expect(transport.secondsForBeat(2)).toBeCloseTo(1)
    expect(transport.secondsForBeat(3)).toBeCloseTo(2)
    expect(transport.beatForSeconds(2)).toBeCloseTo(3)
    expect(transport.durationSeconds()).toBeCloseTo(5)

    transport.setSpeedScale(0.5)
    expect(transport.secondsForBeat(3)).toBeCloseTo(4)
    expect(transport.beatForSeconds(4)).toBeCloseTo(3)
    expect(transport.durationSeconds()).toBeCloseTo(10)

    transport.seekSeconds(4)
    expect(transport.state().positionBeats).toBeCloseTo(3)
  })

  it('clamps finite timeline conversion and stays zero-safe without a duration', () => {
    const finite = createDrumTransport({
      clock: new FakeClock(),
      authoredTiming: { tempoBpm: 60, durationBeats: 4 },
    })
    expect(finite.secondsForBeat(-5)).toBe(0)
    expect(finite.secondsForBeat(99)).toBe(4)
    expect(finite.beatForSeconds(-5)).toBe(0)
    expect(finite.beatForSeconds(99)).toBe(4)
    expect(finite.secondsForBeat(Number.NaN)).toBe(0)
    expect(finite.beatForSeconds(Number.POSITIVE_INFINITY)).toBe(0)

    const open = createDrumTransport({
      clock: new FakeClock(),
      tempoBpm: 120,
    })
    expect(open.durationSeconds()).toBe(0)
    expect(open.secondsForBeat(4)).toBe(2)
    expect(open.beatForSeconds(2)).toBe(4)
  })

  it('reports validated, omitted and playable-range-adjusted tempo changes', () => {
    const clock = new FakeClock()
    const transport = createDrumTransport({
      clock,
      countInBeats: 0,
      authoredTiming: {
        tempoBpm: 120,
        tempoChanges: [
          { beat: 0, usPerBeat: 500_000 },
          // Too close to the previous change for safe authored scheduling.
          { beat: 0.01, usPerBeat: 500_000 },
          // Valid timing, adjusted from 60,000 BPM to the 280 BPM ceiling.
          { beat: 1, usPerBeat: 1_000 },
          { beat: 2, usPerBeat: -1 },
        ],
        durationBeats: 4,
      },
    })

    expect(transport.state()).toMatchObject({
      appliedTempoChangeCount: 2,
      omittedTempoChangeCount: 2,
      adjustedTempoChangeCount: 1,
    })
    transport.seek(1)
    expect(transport.state().localTempoBpm).toBeCloseTo(280)
  })

  it('bounds a 500k tempo map across the whole song without truncating lookahead', () => {
    const clock = new FakeClock()
    const tempoChanges = Array.from({ length: 500_000 }, (_, index) => ({
      beat: (index * 8) / 499_999,
      usPerBeat: 500_000,
    }))
    const transport = createDrumTransport({
      clock,
      countInBeats: 0,
      authoredTiming: {
        tempoBpm: 120,
        tempoChanges,
        durationBeats: 64,
      },
    })

    expect(transport.state()).toMatchObject({
      appliedTempoChangeCount: MAX_DRUM_AUTHORED_TEMPO_CHANGES,
      omittedTempoChangeCount:
        tempoChanges.length - MAX_DRUM_AUTHORED_TEMPO_CHANGES,
      adjustedTempoChangeCount: 0,
    })

    transport.start()
    const windows = transport.schedulingWindows(2_000)
    expect(windows.length).toBeLessThanOrEqual(
      MAX_DRUM_AUTHORED_TEMPO_CHANGES + 1,
    )
    expect(windows[0]?.fromTimestampMs).toBe(0)
    expect(windows.at(-1)?.toTimestampMs).toBeCloseTo(2_000)
  })

  it('uses local authored tempo for a fractional-seek count-in and speed scale', () => {
    const clock = new FakeClock()
    const transport = createDrumTransport({
      clock,
      countInBeats: 1,
      authoredTiming: {
        tempoBpm: 120,
        tempoChanges: [{ beat: 2, usPerBeat: 1_000_000 }],
        durationBeats: 8,
      },
    })
    transport.seek(2.5)
    transport.setSpeedScale(2)
    transport.start()

    expect(transport.state()).toMatchObject({
      phase: 'count-in',
      positionBeats: 2.5,
      localTempoBpm: 60,
      tempoBpm: 120,
      speedScale: 2,
    })
    clock.advance(499)
    expect(transport.state().phase).toBe('count-in')
    clock.advance(1)
    expect(transport.state()).toMatchObject({
      phase: 'playing',
      positionBeats: 2.5,
    })
    clock.advance(250)
    expect(transport.state().positionBeats).toBeCloseTo(3)
  })

  it('keeps playing through written trailing duration and then ends in place', () => {
    const clock = new FakeClock()
    const transport = createDrumTransport({
      clock,
      countInBeats: 0,
      authoredTiming: {
        tempoBpm: 60,
        durationBeats: 4,
      },
    })
    transport.start()
    clock.advance(3_999)
    expect(transport.state()).toMatchObject({
      phase: 'playing',
      positionBeats: 3.999,
    })
    clock.advance(1)
    expect(transport.state()).toMatchObject({
      phase: 'stopped',
      positionBeats: 4,
      authoredDurationBeats: 4,
    })
    expect(clock.pendingFrames()).toBe(0)
  })

  it('plays again from the top after a natural end even when the timing was re-applied', () => {
    // The stem play-along pipeline re-applies its authored timing before
    // every Play; that cleared the end flag, so Play resumed at the end
    // and stopped again on the first frame.
    const clock = new FakeClock()
    const transport = createDrumTransport({
      clock,
      countInBeats: 0,
      authoredTiming: {
        tempoBpm: 60,
        durationBeats: 4,
      },
    })
    transport.start()
    clock.advance(4_000)
    expect(transport.state().phase).toBe('stopped')

    transport.setAuthoredTiming({ tempoBpm: 60, durationBeats: 4 })
    transport.start()
    expect(transport.state()).toMatchObject({
      phase: 'playing',
      positionBeats: 0,
    })
    expect(clock.pendingFrames()).toBe(1)
    clock.advance(1_000)
    expect(transport.state().positionBeats).toBeCloseTo(1)
  })

  it.each([0, 2])(
    'replays from beat zero after natural end with %i count-in beats',
    (countInBeats) => {
      const clock = new FakeClock()
      const transport = createDrumTransport({
        clock,
        countInBeats,
        authoredTiming: {
          tempoBpm: 120,
          durationBeats: 1,
        },
      })
      transport.start()
      if (countInBeats > 0) clock.advance(countInBeats * 500)
      clock.advance(500)
      expect(transport.state()).toMatchObject({
        phase: 'stopped',
        positionBeats: 1,
      })

      transport.start()
      expect(transport.state()).toMatchObject({
        phase: countInBeats > 0 ? 'count-in' : 'playing',
        positionBeats: 0,
        timelineBeats: 0,
      })
      if (countInBeats > 0) {
        clock.advance(countInBeats * 500)
        expect(transport.state()).toMatchObject({
          phase: 'playing',
          positionBeats: 0,
        })
      }
    },
  )

  it('splits loop windows while keeping an unwrapped occurrence timeline', () => {
    const clock = new FakeClock()
    const transport = createDrumTransport({
      clock,
      tempoBpm: 120,
      countInBeats: 0,
    })
    expect(transport.setLoop({ startBeat: 0, endBeat: 1 })).toBe(true)
    transport.start()

    const windows = transport.schedulingWindows(600)
    expect(windows).toHaveLength(2)
    expect(windows[0]).toMatchObject({
      fromTimelineBeat: 0,
      toTimelineBeat: 1,
      fromPositionBeat: 0,
      toPositionBeat: 1,
      loopIteration: 0,
      endsAt: 'loop',
    })
    expect(windows[1]).toMatchObject({
      fromTimelineBeat: 1,
      toTimelineBeat: 1.2,
      fromPositionBeat: 0,
      toPositionBeat: 0.2,
      loopIteration: 1,
      endsAt: 'lookahead',
    })
  })

  it('clears a loop from its visible position after multiple iterations', () => {
    const clock = new FakeClock()
    const transport = createDrumTransport({
      clock,
      countInBeats: 0,
      authoredTiming: { tempoBpm: 60, durationBeats: 32 },
    })
    transport.seek(4)
    expect(transport.setLoop({ startBeat: 4, endBeat: 8 })).toBe(true)
    transport.start()
    clock.advance(10_000)
    expect(transport.state()).toMatchObject({
      timelineBeats: 14,
      positionBeats: 6,
      loopIteration: 2,
    })

    // No animation frame observes this quarter beat; setLoop must reanchor it.
    clock.elapseWithoutFrame(250)
    expect(transport.setLoop(null)).toBe(true)
    expect(transport.state()).toMatchObject({
      phase: 'playing',
      timelineBeats: 6.25,
      positionBeats: 6.25,
      loopIteration: 0,
    })
    clock.advance(750)
    expect(transport.state()).toMatchObject({
      phase: 'playing',
      positionBeats: 7,
    })
  })

  it('enters a newly committed A/B range atomically unless already inside it', () => {
    const clock = new FakeClock()
    const transport = createDrumTransport({
      clock,
      countInBeats: 0,
      authoredTiming: { tempoBpm: 60, durationBeats: 16 },
    })
    transport.seek(2)
    const beforeFirstCommit = transport.scheduleRevision()

    expect(transport.setLoop({ startBeat: 4, endBeat: 8 })).toBe(true)
    expect(transport.state()).toMatchObject({
      timelineBeats: 4,
      positionBeats: 4,
      loopIteration: 0,
    })
    expect(transport.scheduleRevision()).toBe(beforeFirstCommit + 1)

    transport.seek(6)
    expect(transport.setLoop({ startBeat: 5, endBeat: 9 })).toBe(true)
    expect(transport.state().positionBeats).toBe(6)
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
