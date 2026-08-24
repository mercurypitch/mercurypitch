// ============================================================
// Cinematic onboarding audio tests — decode, offset and envelopes
// ============================================================

import { describe, expect, it } from 'vitest'
import { createCinematicOnboardingAudioClock } from './cinematic-onboarding-audio'

interface ParamEvent {
  readonly type: 'cancel' | 'hold' | 'set' | 'exponential' | 'target'
  readonly value?: number
  readonly time: number
  readonly constant?: number
}

class FakeAudioParam {
  value = 1
  readonly events: ParamEvent[] = []

  cancelScheduledValues(time: number): this {
    this.events.push({ type: 'cancel', time })
    return this
  }

  cancelAndHoldAtTime(time: number): this {
    this.events.push({ type: 'hold', time })
    return this
  }

  setValueAtTime(value: number, time: number): this {
    this.value = value
    this.events.push({ type: 'set', value, time })
    return this
  }

  exponentialRampToValueAtTime(value: number, time: number): this {
    this.value = value
    this.events.push({ type: 'exponential', value, time })
    return this
  }

  setTargetAtTime(value: number, time: number, constant: number): this {
    this.events.push({ type: 'target', value, time, constant })
    return this
  }
}

class FakeSource {
  buffer: AudioBuffer | null = null
  onended: (() => void) | null = null
  readonly starts: ReadonlyArray<number>[] = []
  readonly stops: number[] = []

  connect(): void {}
  disconnect(): void {}
  start(_when: number, offset: number): void {
    this.starts.push([offset])
  }
  stop(when: number): void {
    this.stops.push(when)
  }
}

class FakeGain {
  readonly gain = new FakeAudioParam()
  connect(): void {}
  disconnect(): void {}
}

function createFakeContext() {
  const sources: FakeSource[] = []
  const gains: FakeGain[] = []
  let resumeCount = 0
  let closeCount = 0
  const context = {
    currentTime: 10,
    destination: {},
    async decodeAudioData() {
      return { duration: 31.083333 } as AudioBuffer
    },
    async resume() {
      resumeCount += 1
    },
    async close() {
      closeCount += 1
    },
    createBufferSource() {
      const source = new FakeSource()
      sources.push(source)
      return source as unknown as AudioBufferSourceNode
    },
    createGain() {
      const gain = new FakeGain()
      gains.push(gain)
      return gain as unknown as GainNode
    },
  } as unknown as AudioContext
  return {
    context,
    sources,
    gains,
    resumeCount: () => resumeCount,
    closeCount: () => closeCount,
  }
}

describe('cinematic onboarding audio clock', () => {
  it('opens and releases every decoded source with the mandatory pop-free shapes', async () => {
    const fake = createFakeContext()
    const clock = createCinematicOnboardingAudioClock({
      createContext: () => fake.context,
      fetchArrayBuffer: async () => new ArrayBuffer(8),
    })

    await expect(
      clock.load('onboarding/v0.7/audio/review-mix.m4a'),
    ).resolves.toBe(true)
    await expect(clock.start(4)).resolves.toBe(true)

    expect(fake.sources[0]?.starts).toEqual([[4]])
    expect(fake.gains[0]?.gain.events).toEqual([
      { type: 'cancel', time: 10 },
      { type: 'set', value: 0.0001, time: 10 },
      { type: 'exponential', value: 1, time: 10.09 },
    ])

    clock.pause()
    expect(fake.gains[0]?.gain.events.slice(-2)).toEqual([
      { type: 'hold', time: 10 },
      { type: 'target', value: 0, time: 10, constant: 0.036 },
    ])
    expect(fake.sources[0]?.stops).toEqual([10.24])
  })

  it('gives each restart an independent gain so a fading source cannot reopen', async () => {
    const fake = createFakeContext()
    const clock = createCinematicOnboardingAudioClock({
      createContext: () => fake.context,
      fetchArrayBuffer: async () => new ArrayBuffer(8),
    })
    await clock.load('onboarding/v0.7/audio/review-mix.m4a')

    await clock.start(0)
    await clock.start(8)

    expect(fake.sources).toHaveLength(2)
    expect(fake.gains).toHaveLength(2)
    expect(fake.sources[0]?.stops).toEqual([10.24])
    expect(fake.sources[1]?.starts).toEqual([[8]])
  })

  it('unlocks the context directly from the pre-roll user gesture', async () => {
    const fake = createFakeContext()
    const clock = createCinematicOnboardingAudioClock({
      createContext: () => fake.context,
      fetchArrayBuffer: async () => new ArrayBuffer(8),
    })
    await clock.load('onboarding/v0.7/audio/review-mix.m4a')

    await expect(clock.unlock()).resolves.toBe(true)
    expect(fake.resumeCount()).toBe(1)
  })

  it('cancels a pending start when playback pauses before context resume', async () => {
    const fake = createFakeContext()
    let finishResume: (() => void) | undefined
    Object.defineProperty(fake.context, 'resume', {
      value: () =>
        new Promise<void>((resolve) => {
          finishResume = resolve
        }),
    })
    const clock = createCinematicOnboardingAudioClock({
      createContext: () => fake.context,
      fetchArrayBuffer: async () => new ArrayBuffer(8),
    })
    await clock.load('onboarding/v0.7/audio/review-mix.m4a')

    const start = clock.start(4)
    clock.pause()
    finishResume?.()

    await expect(start).resolves.toBe(false)
    expect(fake.sources).toHaveLength(0)
  })

  it('treats AudioContext construction failure as unavailable sound', async () => {
    const clock = createCinematicOnboardingAudioClock({
      createContext: () => {
        throw new DOMException('Denied', 'NotAllowedError')
      },
      fetchArrayBuffer: async () => new ArrayBuffer(8),
    })

    await expect(clock.load('/onboarding/review-mix.m4a')).resolves.toBe(false)
    await expect(clock.unlock()).resolves.toBe(false)
  })

  it('closes its audio context when the onboarding surface is disposed', async () => {
    const fake = createFakeContext()
    const clock = createCinematicOnboardingAudioClock({
      createContext: () => fake.context,
      fetchArrayBuffer: async () => new ArrayBuffer(8),
    })
    await clock.load('onboarding/v0.7/audio/review-mix.m4a')

    clock.dispose()
    expect(fake.closeCount()).toBe(1)
    await expect(clock.unlock()).resolves.toBe(false)
    expect(fake.resumeCount()).toBe(0)
  })

  it('reports unavailable audio without blocking quiet picture playback', async () => {
    const clock = createCinematicOnboardingAudioClock({
      createContext: () => undefined,
      fetchArrayBuffer: async () => new ArrayBuffer(8),
    })

    await expect(clock.load('/onboarding/missing.m4a')).resolves.toBe(false)
    await expect(clock.start(0)).resolves.toBe(false)
    expect(() => clock.pause()).not.toThrow()
    expect(() => clock.dispose()).not.toThrow()
  })
})
