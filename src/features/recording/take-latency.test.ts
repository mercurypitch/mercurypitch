// ============================================================
// Recorded takes and the measured mic round trip
// ============================================================
//
// A frame reaching the recorder now was sung one measured round trip ago, so
// every raw frame must be stamped with the beat it was SUNG on. These tests
// drive the real controller (real pipeline, real stores) through the same
// calls App makes and read the result off the pending take — the boundary the
// review panel and Keep actually consume.

import { createRoot } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AudioEngine } from '@/lib/audio-engine'
import type { PlaybackRuntime } from '@/lib/playback-runtime'
import type { PracticeEngine } from '@/lib/practice-engine'
import { setMicLatencyByDevice } from '@/stores/mic-latency-store'
import type { PitchResult } from '@/types'
import { shiftTakeFrames, useRecordingController, } from './useRecordingController'

const audioEngineStub = (bpm: number | undefined): AudioEngine =>
  ({
    setVolume: () => {},
    getBpm: bpm === undefined ? undefined : () => bpm,
  }) as unknown as AudioEngine

const practiceEngineStub = (): PracticeEngine =>
  ({ startMic: () => Promise.resolve(true) }) as unknown as PracticeEngine

const playbackRuntimeStub = (): PlaybackRuntime =>
  ({ getCurrentBeat: () => 0 }) as unknown as PlaybackRuntime

const voicedFrame = (freq: number): PitchResult =>
  ({ frequency: freq, clarity: 0.9, cents: 0 }) as PitchResult

/** Record one voiced frame at `beat` and return the beat the take stored. */
const recordOneFrameAt = async (
  beat: number,
  bpm: number | undefined,
): Promise<number> => {
  let stored = 0
  await createRoot(async (dispose) => {
    const controller = useRecordingController({
      audioEngine: audioEngineStub(bpm),
      playbackRuntime: playbackRuntimeStub(),
      practiceEngine: practiceEngineStub(),
      applyTake: () => {},
    })
    await controller.handleRecordToggle()
    controller.processPitchFrame(voicedFrame(261.63), beat, true)
    controller.finalizeRecording(beat + 1)
    const take = controller.pendingTake()
    expect(take).not.toBeNull()
    stored = take!.frames[0].beat
    dispose()
  })
  return stored
}

describe('recording under mic latency', () => {
  beforeEach(() => {
    setMicLatencyByDevice({})
  })

  afterEach(() => {
    setMicLatencyByDevice({})
    vi.restoreAllMocks()
  })

  it('stores the arrival beat unchanged on an unmeasured device', async () => {
    expect(await recordOneFrameAt(4, 120)).toBe(4)
  })

  it('stores the beat the frame was sung on once a round trip is measured', async () => {
    setMicLatencyByDevice({ default: 95 })
    // 120 bpm is two beats a second: 95 ms of round trip is 0.19 beats.
    expect(await recordOneFrameAt(4, 120)).toBeCloseTo(3.81, 5)
  })

  it('scales the shift with the tempo', async () => {
    setMicLatencyByDevice({ default: 95 })
    expect(await recordOneFrameAt(4, 60)).toBeCloseTo(4 - 0.095, 5)
  })

  it('falls back to 120 bpm when the audio engine cannot answer', async () => {
    setMicLatencyByDevice({ default: 95 })
    expect(await recordOneFrameAt(4, undefined)).toBeCloseTo(3.81, 5)
  })
})

describe('shiftTakeFrames — the review panel Timing slider', () => {
  const frames = [
    { beat: 0, timeSec: 10, freq: 261.63, clarity: 0.9 },
    { beat: 1, timeSec: 10.5, freq: 293.66, clarity: 0.9 },
  ]

  it('returns the frames untouched at zero, without copying', () => {
    expect(shiftTakeFrames(frames, 0, 120)).toBe(frames)
  })

  it('moves the contour later by positive ms', () => {
    const shifted = shiftTakeFrames(frames, 100, 120)
    expect(shifted.map((f) => f.beat)).toEqual([0.2, 1.2])
    // timeSec is the pipeline's duration clock and must not move with it.
    expect(shifted.map((f) => f.timeSec)).toEqual([10, 10.5])
  })

  it('moves the contour earlier by negative ms, below zero if that is the truth', () => {
    const shifted = shiftTakeFrames(frames, -100, 120)
    expect(shifted[0].beat).toBeCloseTo(-0.2, 5)
  })

  it('never mutates the take it was given', () => {
    shiftTakeFrames(frames, 50, 120)
    expect(frames[0].beat).toBe(0)
  })

  it('refuses a nonsense tempo instead of producing NaN beats', () => {
    expect(shiftTakeFrames(frames, 100, 0)).toBe(frames)
  })
})
