// ============================================================
// Piano performance scheduler tests protect audio-clock timing and cleanup
// ============================================================

import { describe, expect, it, vi } from 'vitest'
import type { PianoAudioClockTransport } from './piano-audio-clock-transport'
import type { PianoFallbackSynth } from './piano-fallback-synth'
import { createPianoPerformanceScheduler } from './piano-performance-scheduler'
import type { PianoProjectStageNote } from './piano-project-stage'

interface HarnessOptions {
  notes?: PianoProjectStageNote[]
  contextTimeAtBeat?: (
    targetBeat: number,
    playheadBeat: number,
    contextTime: number,
  ) => number
  beatAtContextTime?: (
    targetTime: number,
    playheadBeat: number,
    contextTime: number,
  ) => number
}

function harness(options: HarnessOptions = {}) {
  let beat = 0
  let phase: 'playing' | 'paused' = 'playing'
  let notes: PianoProjectStageNote[] = options.notes ?? [
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
  ]
  const context = { currentTime: 10, state: 'running' }
  const transport = {
    phase: () => phase,
    speed: () => 1,
    timeline: {
      playheadBeat: () => beat,
      totalBeats: () => 8,
      tempoBpm: () => 120,
    },
    contextTimeAtBeat: (targetBeat: number) =>
      options.contextTimeAtBeat?.(targetBeat, beat, context.currentTime) ??
      context.currentTime + (targetBeat - beat) / 2,
    beatAtContextTime: (targetTime: number) =>
      options.beatAtContextTime?.(targetTime, beat, context.currentTime) ??
      beat + (targetTime - context.currentTime) * 2,
    getAudioContext: () => context as unknown as AudioContext,
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
    notes: () => notes,
    scheduleAheadSeconds: 0.2,
    schedulerIntervalMs: 20,
    setInterval: (callback) => {
      tick = callback
      return 7
    },
    clearInterval,
  })
  return {
    clearInterval,
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
    setNotes(value: PianoProjectStageNote[]) {
      notes = value
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

  it('uses piecewise transport time for a note spanning a tempo boundary', () => {
    const contextTimeAtBeat = (
      targetBeat: number,
      playheadBeat: number,
      contextTime: number,
    ): number => {
      const scoreSeconds = (beat: number): number =>
        beat <= 1 ? beat / 2 : 0.5 + (beat - 1)
      return contextTime + scoreSeconds(targetBeat) - scoreSeconds(playheadBeat)
    }
    const beatAtContextTime = (
      targetTime: number,
      playheadBeat: number,
      contextTime: number,
    ): number => {
      const playheadSeconds =
        playheadBeat <= 1 ? playheadBeat / 2 : 0.5 + (playheadBeat - 1)
      const targetSeconds = playheadSeconds + targetTime - contextTime
      return targetSeconds <= 0.5
        ? targetSeconds * 2
        : 1 + (targetSeconds - 0.5)
    }
    const instance = harness({ contextTimeAtBeat, beatAtContextTime })

    instance.scheduler.start()

    expect(instance.noteOn).toHaveBeenCalledWith(
      expect.objectContaining({ atContextTime: 10.1 }),
    )
    expect(instance.noteOff).toHaveBeenCalledWith('score:0:n1', 10.7)
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

  it('reads replacement notes without creating a second scheduler clock', () => {
    const instance = harness()
    instance.scheduler.start()
    instance.noteOn.mockClear()
    instance.noteOff.mockClear()

    instance.scheduler.stop()
    instance.setNotes([
      {
        id: 'replacement',
        midi: 67,
        name: 'G',
        startBeat: 0.2,
        duration: 1,
        targetFreq: 392,
        velocity: 0.7,
        releaseVelocity: 0.2,
        channel: 0,
      },
    ])

    expect(instance.scheduler.start()).toBe(true)
    expect(instance.clearInterval).toHaveBeenCalledWith(7)
    expect(instance.noteOff).toHaveBeenCalledWith('score:0:n1', 10)
    expect(instance.noteOn).toHaveBeenCalledOnce()
    expect(instance.noteOn).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'score:1:replacement',
        midi: 67,
      }),
    )
  })

  it('advances a sorted cursor instead of rescanning a large score each tick', () => {
    let startBeatReads = 0
    const notes = Array.from({ length: 5_000 }, (_, index) => {
      const note = {
        id: `large-${index}`,
        midi: 60 + (index % 12),
        name: 'C',
        duration: 0.5,
        targetFreq: 261.63,
        velocity: 0.8,
        releaseVelocity: 0.3,
        channel: 0,
      } as PianoProjectStageNote
      Object.defineProperty(note, 'startBeat', {
        enumerable: true,
        get() {
          startBeatReads += 1
          return 100 + index
        },
      })
      return note
    })
    const instance = harness({ notes })
    instance.scheduler.start()
    startBeatReads = 0

    instance.tick()

    expect(startBeatReads).toBeLessThan(20)
    expect(instance.noteOn).not.toHaveBeenCalled()
  })

  it('finds sustained notes on a deep seek without scanning the score prefix', () => {
    let startBeatReads = 0
    const notes = Array.from({ length: 5_000 }, (_, index) => {
      const note = {
        id: `deep-${index}`,
        midi: 60 + (index % 12),
        name: 'C',
        duration: index === 0 ? 5_000 : 0.25,
        targetFreq: 261.63,
        velocity: 0.8,
        releaseVelocity: 0.3,
        channel: 0,
      } as PianoProjectStageNote
      Object.defineProperty(note, 'startBeat', {
        enumerable: true,
        get() {
          startBeatReads += 1
          return index
        },
      })
      return note
    })
    const instance = harness({ notes })
    instance.scheduler.start()
    instance.noteOn.mockClear()
    startBeatReads = 0
    instance.setBeat(4_990.5)

    expect(instance.scheduler.refresh()).toBe(true)
    expect(startBeatReads).toBeLessThan(50)
    expect(instance.noteOn).toHaveBeenCalledOnce()
    expect(instance.noteOn).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'score:1:deep-0' }),
    )
  })

  it('prunes completed releases before bounded stop cleanup', () => {
    const instance = harness({
      notes: [
        {
          id: 'past',
          midi: 60,
          name: 'C',
          startBeat: 0.1,
          duration: 0.1,
          targetFreq: 261.63,
          velocity: 0.8,
          releaseVelocity: 0.3,
          channel: 0,
        },
        {
          id: 'current',
          midi: 64,
          name: 'E',
          startBeat: 2.1,
          duration: 1,
          targetFreq: 329.63,
          velocity: 0.8,
          releaseVelocity: 0.3,
          channel: 0,
        },
      ],
    })
    instance.scheduler.start()
    instance.context.currentTime = 11
    instance.setBeat(2)
    instance.tick()
    instance.noteOff.mockClear()

    instance.scheduler.stop()

    expect(instance.noteOff).toHaveBeenCalledOnce()
    expect(instance.noteOff).toHaveBeenCalledWith('score:0:current', 11)
  })
})
