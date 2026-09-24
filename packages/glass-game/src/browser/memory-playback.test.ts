// Local memory playback tests — cancellation, audio ownership and soft release.

import { resetSharedAudioContext, sharedAudioContextOwners, } from '@irchiinnuss/audio-io/shared-audio-context'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createBrowserMemoryPlayback } from './memory-playback'

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
  buffer: { duration: number } | null = null
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

  readonly decodeAudioData = vi.fn(async () => ({ duration: 3 }) as AudioBuffer)
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

describe('local memory playback', () => {
  it('waits for museum quiet before starting and fades a requested stop', async () => {
    const player = createBrowserMemoryPlayback()
    let quiet!: () => void
    const barrier = new Promise<void>((resolve) => {
      quiet = resolve
    })
    const ended = vi.fn()
    const played = player.play(
      new Blob(['take'], { type: 'audio/webm' }),
      ended,
      barrier,
    )
    await flush()
    expect(
      context.sources.some((source) => source.buffer?.duration === 3),
    ).toBe(false)
    quiet()
    expect(await played).toBe(true)
    const source = context.sources.find(
      (candidate) => candidate.buffer?.duration === 3,
    )!
    expect(source.start).toHaveBeenCalledOnce()
    const gain = context.gains.find((candidate) =>
      candidate.gain.exponentialRampToValueAtTime.mock.calls.some(
        (call) => call[0] === 1,
      ),
    )!
    expect(gain).toBeDefined()
    const stopped = player.stop()
    expect(gain.gain.setTargetAtTime).toHaveBeenCalledWith(0, 0, 0.024)
    expect(source.stop).toHaveBeenCalledWith(0.12)
    await vi.advanceTimersByTimeAsync(120)
    await stopped
    expect(ended).toHaveBeenCalledOnce()
    expect(sharedAudioContextOwners()).toHaveLength(0)
    player.dispose()
  })

  it('cannot start a late decoded take after cancellation', async () => {
    let resolve!: (buffer: AudioBuffer) => void
    context.decodeAudioData.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
    const player = createBrowserMemoryPlayback()
    const played = player.play(new Blob(['take'], { type: 'audio/webm' }))
    await flush()
    await player.stop()
    resolve({ duration: 3 } as AudioBuffer)
    expect(await played).toBe(false)
    expect(
      context.sources.some((source) => source.buffer?.duration === 3),
    ).toBe(false)
    expect(sharedAudioContextOwners()).toHaveLength(0)
  })

  it('releases failed codecs and interrupted audio without touching saved bytes', async () => {
    const player = createBrowserMemoryPlayback()
    context.decodeAudioData.mockRejectedValueOnce(
      new Error('unsupported codec'),
    )
    expect(await player.play(new Blob(['take'], { type: 'audio/webm' }))).toBe(
      false,
    )
    expect(sharedAudioContextOwners()).toHaveLength(0)
    const ended = vi.fn()
    expect(
      await player.play(new Blob(['take'], { type: 'audio/webm' }), ended),
    ).toBe(true)
    context.state = 'interrupted'
    context.dispatchEvent(new Event('statechange'))
    await flush()
    expect(ended).toHaveBeenCalledOnce()
    expect(sharedAudioContextOwners()).toHaveLength(0)
  })

  it('replaces a playing take only after the old release completes', async () => {
    const player = createBrowserMemoryPlayback()
    const audio = new Blob(['take'], { type: 'audio/webm' })
    expect(await player.play(audio)).toBe(true)
    const second = player.play(audio)
    await flush()
    expect(
      context.sources.filter((source) => source.buffer?.duration === 3),
    ).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(120)
    expect(await second).toBe(true)
    expect(
      context.sources.filter((source) => source.buffer?.duration === 3),
    ).toHaveLength(2)
    player.dispose()
    await vi.advanceTimersByTimeAsync(120)
    expect(sharedAudioContextOwners()).toHaveLength(0)
  })
})
