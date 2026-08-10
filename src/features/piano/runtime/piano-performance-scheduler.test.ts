// ============================================================
// Piano performance scheduler tests protect audio-clock timing and cleanup
// ============================================================

import { describe, expect, it, vi } from 'vitest'
import type { PianoAudioClockTransport } from './piano-audio-clock-transport'
import type { PianoFallbackSynth } from './piano-fallback-synth'
import { createPianoPerformanceScheduler } from './piano-performance-scheduler'
import type { PianoProjectStageNote } from './piano-project-stage'

function harness() {
  let beat = 0
  let phase: 'playing' | 'paused' = 'playing'
  const context = { currentTime: 10, state: 'running' } as AudioContext
  const transport = {
    phase: () => phase,
    speed: () => 1,
    timeline: {
      playheadBeat: () => beat,
      totalBeats: () => 8,
      tempoBpm: () => 120,
    },
    getAudioContext: () => context,
  } as unknown as PianoAudioClockTransport
  const noteOn = vi.fn(() => true)
  const noteOff = vi.fn(() => true)
  const synth = { noteOn, noteOff } as Pick<
    PianoFallbackSynth,
    'noteOn' | 'noteOff'
  >
  let tick: (() => void) | null = null
  const clearInterval = vi.fn()
  const scheduler = createPianoPerformanceScheduler({
    transport,
    synth,
    notes: [
      {
        id: 'n1',
        midi: 60,
        name: 'C',
        startBeat: 0.2,
        duration: 1,
        targetFreq: 261.63,
        velocity: 0.8,
        releaseVelocity: 0.3,
        channel: 0,
      },
    ] satisfies PianoProjectStageNote[],
    scheduleAheadSeconds: 0.2,
    schedulerIntervalMs: 20,
    setInterval: (callback) => {
      tick = callback
      return 7
    },
    clearInterval,
  })
  return {
    context,
    noteOff,
    noteOn,
    scheduler,
    setBeat(value: number) {
      beat = value
    },
    setPhase(value: 'playing' | 'paused') {
      phase = value
    },
    tick() {
      tick?.()
    },
  }
}

describe('createPianoPerformanceScheduler', () => {
  it('schedules from transport beats onto AudioContext time', () => {
    const instance = harness()

    expect(instance.scheduler.start()).toBe(true)
    expect(instance.noteOn).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'score:0:n1',
        midi: 60,
        atContextTime: 10.1,
      }),
    )
    expect(instance.noteOff).toHaveBeenCalledWith('score:0:n1', 10.6)
  })

  it('does not create a clock until transport is playing', () => {
    const instance = harness()
    instance.setPhase('paused')

    expect(instance.scheduler.start()).toBe(false)
    expect(instance.noteOn).not.toHaveBeenCalled()
  })

  it('clears only its score generation across a discontinuity', () => {
    const instance = harness()
    instance.scheduler.start()
    instance.noteOff.mockClear()

    instance.setBeat(0.1)
    expect(instance.scheduler.refresh()).toBe(true)
    expect(instance.noteOff).toHaveBeenCalledWith('score:0:n1', 10)
    expect(instance.noteOn).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: 'score:1:n1' }),
    )
  })
})
