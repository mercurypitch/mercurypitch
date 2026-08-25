// Drum arrangement player tests — inert graph, envelopes, gain, and voice cap.
// ============================================================

import { describe, expect, it, vi } from 'vitest'
import type { GuitarVoice } from '@/lib/guitar/guitar-synth'
import { sliderToGain } from '@/lib/volume-curve'
import * as arrangementPlayer from './drum-arrangement-player'

type DrumArrangementBackingVoice = arrangementPlayer.DrumArrangementBackingVoice

class FakeAudioParam {
  value = 1
  readonly calls: Array<readonly [string, ...number[]]> = []

  cancelAndHoldAtTime(at: number): void {
    this.calls.push(['hold', at])
  }

  cancelScheduledValues(at: number): void {
    this.calls.push(['cancel', at])
  }

  setValueAtTime(value: number, at: number): this {
    this.value = value
    this.calls.push(['set', value, at])
    return this
  }

  exponentialRampToValueAtTime(value: number, at: number): this {
    this.value = value
    this.calls.push(['exponential', value, at])
    return this
  }

  setTargetAtTime(value: number, at: number, timeConstant: number): this {
    this.value = value
    this.calls.push(['target', value, at, timeConstant])
    return this
  }
}

class FakeGainNode {
  readonly gain = new FakeAudioParam()
  readonly connect = vi.fn()
  readonly disconnect = vi.fn()
}

interface TimerHarness {
  setTimer(callback: () => void, delayMs: number): ReturnType<typeof setTimeout>
  clearTimer(handle: ReturnType<typeof setTimeout>): void
  runAll(): void
}

function timerHarness(): TimerHarness {
  let nextHandle = 1
  const callbacks = new Map<number, () => void>()
  return {
    setTimer(callback) {
      const handle = nextHandle++
      callbacks.set(handle, callback)
      return handle as unknown as ReturnType<typeof setTimeout>
    },
    clearTimer(handle) {
      callbacks.delete(handle as unknown as number)
    },
    runAll() {
      while (callbacks.size > 0) {
        const pending = [...callbacks.values()]
        callbacks.clear()
        for (const callback of pending) callback()
      }
    },
  }
}

describe('Drum arrangement backing player', () => {
  it('constructs inertly and refuses to manufacture a route audio graph', () => {
    const getAudioContext = vi.fn(() => null)
    const getOutput = vi.fn(() => null)
    const createVoice = vi.fn()
    const player = arrangementPlayer.createDrumArrangementBackingPlayer({
      getAudioContext,
      getOutput,
      createVoice,
    })

    expect(getAudioContext).not.toHaveBeenCalled()
    expect(getOutput).not.toHaveBeenCalled()
    expect(createVoice).not.toHaveBeenCalled()
    player.setTrackLevel('bass', 0.5)
    expect(getAudioContext).not.toHaveBeenCalled()
    expect(player.activate()).toBe(false)
    expect(createVoice).not.toHaveBeenCalled()
  })

  it('uses the active route output, shaped voices, live gain, and bounded stealing', async () => {
    const createdGains: FakeGainNode[] = []
    const context = {
      currentTime: 5,
      state: 'running',
      createGain: () => {
        const gain = new FakeGainNode()
        createdGains.push(gain)
        return gain
      },
    } as unknown as AudioContext
    const output = new FakeGainNode() as unknown as AudioNode
    const timers = timerHarness()
    const voices: Array<{
      gain: FakeGainNode
      dispose: ReturnType<typeof vi.fn>
    }> = []
    const createVoice = vi.fn(
      (
        _context: AudioContext,
        _frequency: number,
        _durationMs: number,
        _voice: DrumArrangementBackingVoice,
        _atContextTime: number,
      ): GuitarVoice => {
        const gain = new FakeGainNode()
        const dispose = vi.fn()
        voices.push({ gain, dispose })
        return {
          gain: gain as unknown as GainNode,
          oscillators: [],
          lfos: [],
          lfoGains: [],
          hasCustomEnvelope: true,
          dispose,
        }
      },
    )
    const player = arrangementPlayer.createDrumArrangementBackingPlayer({
      getAudioContext: () => context,
      getOutput: () => output,
      maxVoices: 2,
      createVoice,
      setTimer: timers.setTimer,
      clearTimer: timers.clearTimer,
    })
    player.setTrackLevel('bass', 0.5)

    expect(player.activate()).toBe(true)
    const first = player.trigger({
      trackId: 'bass',
      sourceId: 'bass:0',
      midi: 40,
      atContextTime: 5.1,
      durationSeconds: 0.5,
      voice: 'bass',
    })
    const second = player.trigger({
      trackId: 'bass',
      sourceId: 'bass:1',
      midi: 43,
      atContextTime: 5.2,
      durationSeconds: 0.5,
      voice: 'bass',
    })
    const third = player.trigger({
      trackId: 'bass',
      sourceId: 'bass:2',
      midi: 47,
      atContextTime: 5.3,
      durationSeconds: 0.5,
      voice: 'bass',
    })
    const fourth = player.trigger({
      trackId: 'bass',
      sourceId: 'bass:3',
      midi: 52,
      atContextTime: 5.4,
      durationSeconds: 0.5,
      voice: 'bass',
    })

    expect([first, second, third, fourth]).toEqual([
      'synthesized',
      'synthesized',
      'synthesized-with-steal',
      'synthesized-with-steal',
    ])
    expect(createVoice).toHaveBeenCalledTimes(4)
    expect(voices[0]?.gain.gain.calls).toContainEqual(['exponential', 1, 5.106])
    expect(voices[0]?.gain.gain.calls).toContainEqual(['target', 0, 5.6, 0.018])
    expect(voices[0]?.gain.gain.calls).toContainEqual(['target', 0, 5, 0.018])
    expect(voices[1]?.gain.gain.calls).toContainEqual(['target', 0, 5, 0.018])

    const trackGain = createdGains[1]
    expect(trackGain?.gain.calls).toContainEqual(['set', sliderToGain(0.5), 5])
    player.setTrackLevel('bass', 0.25)
    expect(trackGain?.gain.calls).toContainEqual([
      'target',
      sliderToGain(0.25),
      5,
      0.012,
    ])

    const disposal = player.dispose()
    timers.runAll()
    await disposal
    expect(voices.every((voice) => voice.dispose.mock.calls.length > 0)).toBe(
      true,
    )
    expect(createdGains[0]?.disconnect).toHaveBeenCalled()
  })
})
