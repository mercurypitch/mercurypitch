// ============================================================
// The detector's warm-up: short tasks, every path, nothing changed
// ============================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { F0_DETECTOR_OPTIONS } from './f0-detector-options'
import type { DetectedPitch } from './pitch-detector'
import { PitchDetector } from './pitch-detector'
import { WARM_IDLE_TIMEOUT_MS, WARM_PASSES, WARM_PASSES_PER_TASK, warmPitchDetector, } from './pitch-detector-warmup'

const RATE = 48000
const SIZE = 2048

/** A take's frames, made up: silence, an onset, a held note, a glide, a breath. */
function takeFrames(): Float32Array[] {
  const frames: Float32Array[] = []
  let seed = 7
  const noise = (): number => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed / 0x7fffffff - 0.5
  }
  let phase = 0
  const sung = (hz: number, level: number, hiss = 0): Float32Array => {
    const frame = new Float32Array(SIZE)
    for (let i = 0; i < SIZE; i++) {
      phase += (2 * Math.PI * hz) / RATE
      frame[i] =
        level * (Math.sin(phase) + 0.4 * Math.sin(2 * phase)) + hiss * noise()
    }
    return frame
  }
  for (let k = 0; k < 4; k++) frames.push(new Float32Array(SIZE))
  frames.push(sung(130.81, 0.02, 0.05))
  for (let k = 0; k < 12; k++) frames.push(sung(130.81, 0.3))
  for (let k = 0; k < 24; k++) frames.push(sung(130.81 * 2 ** (k / 24), 0.3))
  for (let k = 0; k < 3; k++) frames.push(sung(0, 0, 0.4))
  for (let k = 0; k < 8; k++) frames.push(sung(196, 0.25))
  return frames
}

/** What a stream's detector answers for every frame, from its first. */
function answers(frames: readonly Float32Array[]): DetectedPitch[] {
  const detector = new PitchDetector({
    sampleRate: RATE,
    bufferSize: SIZE,
    ...F0_DETECTOR_OPTIONS,
  })
  return frames.map((frame) => detector.detect(frame))
}

describe('the pitch detector warm-up', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('runs its passes in short tasks after its call, none inside it', () => {
    const detect = vi.spyOn(PitchDetector.prototype, 'detect')

    warmPitchDetector()
    expect(detect).not.toHaveBeenCalled()

    vi.advanceTimersToNextTimer()
    expect(detect).toHaveBeenCalledTimes(WARM_PASSES_PER_TASK)

    vi.runAllTimers()
    expect(detect).toHaveBeenCalledTimes(WARM_PASSES)
  })

  it('takes every path a voice takes through the pass', () => {
    const detect = vi.spyOn(PitchDetector.prototype, 'detect')

    warmPitchDetector()
    vi.runAllTimers()

    const answered = detect.mock.results.map((r) => r.value as DetectedPitch)
    const pitches = new Set(
      answered.filter((a) => a.frequency > 0).map((a) => a.frequency),
    )
    // A held pitch, an outlier held to it, a confirmed change: two pitches
    // in each stage; and the rejections, which answer 0.
    expect(pitches.size).toBeGreaterThanOrEqual(4)
    expect(answered.some((a) => a.frequency === 0)).toBe(true)
    // A pitch a hair flat of its note, so the cents step meets -0.
    expect(answered.some((a) => Object.is(a.cents, -0))).toBe(true)
  })

  it('stops where it is told to', () => {
    const detect = vi.spyOn(PitchDetector.prototype, 'detect')

    const stop = warmPitchDetector()
    vi.advanceTimersToNextTimer()
    stop()
    vi.runAllTimers()

    expect(detect).toHaveBeenCalledTimes(WARM_PASSES_PER_TASK)
  })

  it('waits for idle time, two passes a callback, where the browser has it', () => {
    const idle: { task: () => void; timeout: number | undefined }[] = []
    vi.stubGlobal(
      'requestIdleCallback',
      (task: () => void, options?: { timeout?: number }) =>
        idle.push({ task, timeout: options?.timeout }),
    )
    vi.stubGlobal('cancelIdleCallback', () => undefined)
    const detect = vi.spyOn(PitchDetector.prototype, 'detect')

    warmPitchDetector()
    expect(idle).toHaveLength(1)
    expect(idle[0]?.timeout).toBe(WARM_IDLE_TIMEOUT_MS)
    expect(detect).not.toHaveBeenCalled()

    for (let i = 0; i < idle.length; i++) idle[i]?.task()

    expect(WARM_PASSES_PER_TASK).toBe(2)
    expect(idle).toHaveLength(WARM_PASSES / WARM_PASSES_PER_TASK)
    expect(detect).toHaveBeenCalledTimes(WARM_PASSES)
    vi.unstubAllGlobals()
  })

  it("leaves a stream's detector answering exactly as before", () => {
    const frames = takeFrames()
    const cold = answers(frames)

    warmPitchDetector()
    vi.runAllTimers()
    const warmed = answers(frames)

    expect(cold.filter((a) => a.frequency > 0).length).toBeGreaterThan(30)
    expect(warmed).toEqual(cold)
  })
})
