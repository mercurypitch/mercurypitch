// Browser melody reference tests — compiled curves finish on the real audio clock.

import { resetSharedAudioContext, sharedAudioContextOwners, } from '@irchiinnuss/audio-io/shared-audio-context'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { glassMelody } from '../content/melodies'
import { compileMelody, melodyMidiToFrequency } from '../core/melody-contour'
import { createBrowserMelodyReference } from './melody-reference'

class AudioParamFake {
  value = 1
  readonly setValueAtTime = vi.fn()
  readonly exponentialRampToValueAtTime = vi.fn()
  readonly setTargetAtTime = vi.fn()
  readonly setValueCurveAtTime = vi.fn()
  readonly cancelScheduledValues = vi.fn()
}

class NodeFake {
  readonly gain = new AudioParamFake()
  readonly frequency = new AudioParamFake()
  type = ''
  onended: (() => void) | null = null
  readonly connect = vi.fn((node: NodeFake) => node)
  readonly disconnect = vi.fn()
  readonly start = vi.fn()
  readonly stop = vi.fn()
}

class ContextFake extends EventTarget {
  state = 'running'
  currentTime = 0
  sampleRate = 48000
  readonly destination = new NodeFake()
  readonly gains: NodeFake[] = []
  readonly sources: NodeFake[] = []
  readonly resume = vi.fn(async () => {
    this.state = 'running'
  })
  readonly suspend = vi.fn(async () => {
    this.state = 'suspended'
    this.dispatchEvent(new Event('statechange'))
  })
  readonly close = vi.fn(async () => undefined)

  createGain = (): NodeFake => {
    const node = new NodeFake()
    this.gains.push(node)
    return node
  }

  createOscillator = (): NodeFake => {
    const node = new NodeFake()
    this.sources.push(node)
    return node
  }

  createBufferSource = this.createOscillator
  createBiquadFilter = (): NodeFake => new NodeFake()
  createBuffer = (_channels: number, length: number) => ({
    getChannelData: () => new Float32Array(length),
  })
}

async function flush(): Promise<void> {
  for (let index = 0; index < 6; index++) await Promise.resolve()
}

let context: ContextFake

beforeEach(() => {
  vi.useFakeTimers()
  context = new ContextFake()
  resetSharedAudioContext({
    createContext: () => context as unknown as AudioContext,
  })
})

afterEach(() => {
  resetSharedAudioContext()
  vi.useRealTimers()
})

describe('browser melody reference', () => {
  it('schedules the shared compiled curve and completes only after audio-clock quiet', async () => {
    const melody = compileMelody(glassMelody('first-arc'), { rootMidi: 60 })
    const player = createBrowserMelodyReference(melody)
    const progress: number[] = []
    let done = false
    const played = player
      .play((seconds) => progress.push(seconds))
      .then(() => {
        done = true
      })
    await flush()

    expect(context.sources).toHaveLength(1)
    const [curve, at, duration] = context.sources[0].frequency
      .setValueCurveAtTime.mock.calls[0] as [Float32Array, number, number]
    expect(at).toBeCloseTo(0.035)
    expect(duration).toBeCloseTo(melody.durationSeconds)
    expect(curve[0]).toBeCloseTo(melodyMidiToFrequency(60))
    expect(Math.max(...curve)).toBeCloseTo(melodyMidiToFrequency(62), 3)

    context.currentTime = melody.durationSeconds + 0.3
    await vi.advanceTimersByTimeAsync(25)
    expect(done).toBe(false)
    context.currentTime = melody.durationSeconds + 0.34
    await vi.advanceTimersByTimeAsync(25)
    await played
    expect(done).toBe(true)
    expect(progress.at(-1)).toBeCloseTo(melody.durationSeconds)

    player.dispose()
    await vi.advanceTimersByTimeAsync(240)
    expect(sharedAudioContextOwners()).toHaveLength(0)
  })

  it('uses an actual long melody duration instead of a fixed four-second timeout', async () => {
    const melody = compileMelody(glassMelody('two-windows'), { rootMidi: 60 })
    expect(melody.durationSeconds).toBeGreaterThan(4)
    const player = createBrowserMelodyReference(melody)
    let done = false
    const played = player.play().then(() => {
      done = true
    })
    await flush()

    expect(context.sources).toHaveLength(2)
    const first = melody.phrases[0]
    const second = melody.phrases[1]
    expect(context.sources[1].start).toHaveBeenCalledWith(
      expect.closeTo(0.035 + second.startSeconds),
    )
    expect(second.startSeconds - first.endSeconds).toBeCloseTo(0.85)

    context.currentTime = 4.1
    await vi.advanceTimersByTimeAsync(5000)
    expect(done).toBe(false)
    context.currentTime = melody.durationSeconds + 0.34
    await vi.advanceTimersByTimeAsync(25)
    await played
    expect(done).toBe(true)
    player.dispose()
    await vi.advanceTimersByTimeAsync(240)
  })

  it('keeps authored separate-note gaps silent instead of stretching one oscillator across them', async () => {
    const source = glassMelody('first-arc')
    const melody = compileMelody(
      {
        ...source,
        id: 'separate-first-arc',
        feel: { ...source.feel, connection: 'separate-note' },
      },
      { rootMidi: 60 },
    )
    const player = createBrowserMelodyReference(melody)
    const played = player.play()
    await flush()

    expect(context.sources).toHaveLength(3)
    const firstLanding = melody.segments[0]
    const secondLanding = melody.segments[2]
    expect(context.sources[0].start).toHaveBeenCalledWith(0.035)
    expect(context.sources[1].start).toHaveBeenCalledWith(
      expect.closeTo(0.035 + secondLanding.startSeconds),
    )
    expect(secondLanding.startSeconds - firstLanding.endSeconds).toBeCloseTo(
      0.65,
    )

    context.currentTime = melody.durationSeconds + 0.34
    await vi.advanceTimersByTimeAsync(25)
    await played
    player.dispose()
    await vi.advanceTimersByTimeAsync(240)
  })

  it('cancels a pending unlock and releases the shared owner without starting sound', async () => {
    let resume!: () => void
    context.resume.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resume = resolve
        }),
    )
    const melody = compileMelody(glassMelody('first-arc'), { rootMidi: 60 })
    const player = createBrowserMelodyReference(melody)
    const cancelled = expect(player.play()).rejects.toThrow('cancelled')
    player.stop()
    await cancelled
    resume()
    await flush()
    expect(context.sources).toHaveLength(0)
    expect(sharedAudioContextOwners()).toHaveLength(0)
  })

  it('retires scheduled sound immediately when the audio clock is interrupted', async () => {
    const melody = compileMelody(glassMelody('first-arc'), { rootMidi: 60 })
    const player = createBrowserMelodyReference(melody)
    const stopped = expect(player.play()).rejects.toThrow('cancelled')
    await flush()
    const source = context.sources[0]
    context.state = 'interrupted'
    context.dispatchEvent(new Event('statechange'))
    await stopped
    expect(source.disconnect).toHaveBeenCalledOnce()
    expect(sharedAudioContextOwners()).toHaveLength(0)
  })
})
