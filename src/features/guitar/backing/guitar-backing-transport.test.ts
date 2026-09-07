// ============================================================
// Guitar backing transport tests protect one-clock playback, safe replacement, and bounded decoding
// ============================================================

import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_GUITAR_ELECTRIC_AMP_PARAMETERS } from '@/lib/guitar/guitar-electric-amp'
import type { GuitarBackingSession, GuitarBackingTrack, } from './guitar-backing-transport'
import { createGuitarBackingTransport, estimateGuitarBackingPcmBytes, } from './guitar-backing-transport'

interface ParameterOperation {
  kind: 'cancel' | 'linear' | 'set' | 'target'
  value?: number
  when: number
  timeConstant?: number
}

class FakeAudioParameter {
  value = 1
  readonly operations: ParameterOperation[] = []

  cancelScheduledValues(when: number): void {
    this.operations.push({ kind: 'cancel', when })
  }

  setValueAtTime(value: number, when: number): void {
    this.value = value
    this.operations.push({ kind: 'set', value, when })
  }

  linearRampToValueAtTime(value: number, when: number): void {
    this.value = value
    this.operations.push({ kind: 'linear', value, when })
  }

  setTargetAtTime(value: number, when: number, timeConstant: number): void {
    this.value = value
    this.operations.push({ kind: 'target', value, when, timeConstant })
  }
}

class FakeGainNode {
  readonly gain = new FakeAudioParameter()
  readonly connect = vi.fn((destination: unknown) => destination)
  readonly disconnect = vi.fn()
}

class FakeBufferSourceNode {
  buffer: AudioBuffer | null = null
  loop = false
  loopStart = 0
  loopEnd = 0
  onended: (() => void) | null = null
  readonly connect = vi.fn((destination: unknown) => destination)
  readonly disconnect = vi.fn()
  readonly start = vi.fn((_when?: number, _offset?: number) => undefined)
  readonly stop = vi.fn((_when?: number) => undefined)
}

class FakeMediaElementSourceNode {
  readonly connect = vi.fn((destination: unknown) => destination)
  readonly disconnect = vi.fn()
}

class FakeMediaElement extends EventTarget {
  duration = 240
  bufferedEnd = 240
  bufferAfterSeekSeconds = 0
  readyState = 4
  seeking = false
  paused = true
  preload = ''
  src = ''
  playbackRate = 1
  preservesPitch = false
  readonly play = vi.fn(async () => {
    this.paused = false
  })
  readonly pause = vi.fn(() => {
    this.paused = true
  })
  readonly load = vi.fn()
  seekLatencyMs = 0

  private position = 0
  private seekTimer: ReturnType<typeof setTimeout> | null = null

  get currentTime(): number {
    return this.position
  }

  set currentTime(value: number) {
    if (this.seekTimer !== null) clearTimeout(this.seekTimer)
    if (this.seekLatencyMs <= 0) {
      this.position = value
      this.seeking = false
      return
    }
    this.seeking = true
    this.seekTimer = setTimeout(() => {
      this.seekTimer = null
      this.position = value
      this.seeking = false
      if (this.bufferAfterSeekSeconds > 0) {
        this.bufferedEnd = value + this.bufferAfterSeekSeconds
      }
      this.dispatchEvent(new Event('seeked'))
      this.dispatchEvent(new Event('progress'))
    }, this.seekLatencyMs)
  }

  get buffered(): TimeRanges {
    const end = this.bufferedEnd
    return {
      length: end > 0 ? 1 : 0,
      start: () => 0,
      end: () => end,
    }
  }

  removeAttribute(name: string): void {
    if (name === 'src') this.src = ''
  }
}

function decodedBuffer(duration = 12): AudioBuffer {
  return {
    duration,
    numberOfChannels: 2,
    sampleRate: 48_000,
  } as unknown as AudioBuffer
}

function pcmBuffer(
  length: number,
  channels = 1,
  sampleRate = 100,
): AudioBuffer {
  const data = Array.from({ length: channels }, () => new Float32Array(length))
  return {
    length,
    duration: length / sampleRate,
    numberOfChannels: channels,
    sampleRate,
    getChannelData: (channel: number) => data[channel]!,
    copyToChannel: (source: Float32Array, channel: number) =>
      data[channel]!.set(source),
  } as unknown as AudioBuffer
}

class FakeAudioContext {
  sampleRate = 48_000
  currentTime = 10
  state: AudioContextState = 'suspended'
  readonly destination = {} as AudioDestinationNode
  readonly gains: FakeGainNode[] = []
  readonly sources: FakeBufferSourceNode[] = []
  readonly mediaSources: FakeMediaElementSourceNode[] = []
  readonly resume = vi.fn(async () => {
    this.state = 'running'
  })
  readonly close = vi.fn(async () => {
    this.state = 'closed'
  })
  decodeImpl: (encoded: ArrayBuffer) => Promise<AudioBuffer> = async () =>
    decodedBuffer()
  readonly decodeAudioData = vi.fn((encoded: ArrayBuffer) =>
    this.decodeImpl(encoded),
  )

  createGain(): GainNode {
    const node = new FakeGainNode()
    this.gains.push(node)
    return node as unknown as GainNode
  }

  createBuffer(
    channels: number,
    length: number,
    sampleRate: number,
  ): AudioBuffer {
    return pcmBuffer(length, channels, sampleRate)
  }

  createDynamicsCompressor(): DynamicsCompressorNode {
    return {
      threshold: new FakeAudioParameter(),
      knee: new FakeAudioParameter(),
      ratio: new FakeAudioParameter(),
      attack: new FakeAudioParameter(),
      release: new FakeAudioParameter(),
      connect: vi.fn((destination: unknown) => destination),
      disconnect: vi.fn(),
    } as unknown as DynamicsCompressorNode
  }

  createWaveShaper(): WaveShaperNode {
    return {
      curve: null,
      oversample: 'none',
      connect: vi.fn((destination: unknown) => destination),
      disconnect: vi.fn(),
    } as unknown as WaveShaperNode
  }

  createBiquadFilter(): BiquadFilterNode {
    return {
      type: 'lowpass',
      frequency: new FakeAudioParameter(),
      Q: new FakeAudioParameter(),
      gain: new FakeAudioParameter(),
      connect: vi.fn((destination: unknown) => destination),
      disconnect: vi.fn(),
    } as unknown as BiquadFilterNode
  }

  createBufferSource(): AudioBufferSourceNode {
    const source = new FakeBufferSourceNode()
    this.sources.push(source)
    return source as unknown as AudioBufferSourceNode
  }

  createMediaElementSource(
    _element: HTMLMediaElement,
  ): MediaElementAudioSourceNode {
    const source = new FakeMediaElementSourceNode()
    this.mediaSources.push(source)
    return source as unknown as MediaElementAudioSourceNode
  }
}

function deferred<T>(): {
  promise: Promise<T>
  resolve(value: T): void
} {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((settle) => {
    resolve = settle
  })
  return { promise, resolve }
}

function track(
  id: string,
  overrides: Partial<GuitarBackingTrack> = {},
): GuitarBackingTrack {
  return {
    id,
    label: id === 'guitar' ? 'Guitar' : 'Drums',
    url: `blob:${id}`,
    sizeBytes: 64,
    durationSeconds: 12,
    channelCount: 2,
    ...overrides,
  }
}

function session(
  sessionId: string,
  tracks: readonly GuitarBackingTrack[] = [track('drums')],
): GuitarBackingSession {
  return {
    sessionId,
    title: `Room ${sessionId}`,
    tracks,
  }
}

function audioHarness(
  options: { fadeSeconds?: number; memoryBudgetBytes?: number } = {},
) {
  const context = new FakeAudioContext()
  const contextFactory = vi.fn(() => context as unknown as AudioContext)
  const activateContext = vi.fn(async (audioContext: AudioContext) => {
    await audioContext.resume()
  })
  const fetchArrayBuffer = vi.fn(
    async (_url: string, _signal: AbortSignal) => new ArrayBuffer(8),
  )
  const mediaElements: FakeMediaElement[] = []
  const mediaElementFactory = vi.fn(() => {
    const element = new FakeMediaElement()
    mediaElements.push(element)
    return element as unknown as HTMLAudioElement
  })
  const transport = createGuitarBackingTransport({
    mixStorage: null,
    contextFactory,
    activateContext,
    fetchArrayBuffer,
    mediaElementFactory,
    fadeSeconds: options.fadeSeconds ?? 0,
    memoryBudgetBytes: options.memoryBudgetBytes,
    scheduleLeadSeconds: 0.012,
  })
  return {
    activateContext,
    context,
    contextFactory,
    fetchArrayBuffer,
    mediaElementFactory,
    mediaElements,
    transport,
  }
}

describe('transport-owned song loops', () => {
  const harnesses: ReturnType<typeof audioHarness>[] = []
  const setup = (options: Parameters<typeof audioHarness>[0] = {}) => {
    const harness = audioHarness(options)
    harnesses.push(harness)
    return harness
  }

  afterEach(async () => {
    for (const harness of harnesses.splice(0)) await harness.transport.dispose()
    vi.useRealTimers()
  })

  it('validates pending marks without opening audio and clamps to the song duration', () => {
    const h = setup()
    h.transport.configure(session('marks'))
    for (const range of [
      { start: 4, end: 2 },
      { start: 0, end: 0.24 },
      { start: NaN, end: 4 },
    ]) {
      expect(h.transport.setLoopRange(range)).toBe(false)
      expect(h.transport.getLoopRange()).toBeNull()
    }
    expect(h.transport.setLoopRange({ start: -1, end: 100 })).toBe(true)
    expect(h.transport.getLoopRange()).toEqual({ start: 0, end: 12 })
    expect(h.contextFactory).not.toHaveBeenCalled()
    h.transport.configure(session('replacement'))
    expect(h.transport.getLoopRange()).toBeNull()
  })

  it('uses one native epoch for many wraps without source restarts or UI frames', async () => {
    const h = setup()
    h.transport.configure(session('native', [track('drums'), track('guitar')]))
    h.transport.setLoopRange({ start: 2, end: 4 })
    await h.transport.play()
    for (const source of h.context.sources) {
      expect(source.loop).toBe(true)
      expect(source.loopStart).toBe(2)
      expect(source.loopEnd).toBe(4)
      expect(source.start).toHaveBeenCalledExactlyOnceWith(10.012, 0)
    }
    h.context.currentTime = 10.012 + 101.25
    expect(h.transport.getCurrentTime()).toBeCloseTo(3.25)
    expect(h.transport.getStatus()).toBe('playing')
    expect(h.context.sources).toHaveLength(2)
    expect(
      h.context.sources.every((source) => source.stop.mock.calls.length === 0),
    ).toBe(true)
  })

  it('queues native seam dips on a separate gate without changing track or master levels', async () => {
    const h = setup()
    h.transport.configure(session('seam'))
    h.transport.setLoopRange({ start: 0, end: 1 })
    await h.transport.play()
    const trackGain = h.context.sources[0]!.connect.mock
      .calls[0]![0] as FakeGainNode
    const seamGain = trackGain.connect.mock.calls[0]![0] as FakeGainNode
    expect(seamGain.gain.operations).toContainEqual({
      kind: 'linear',
      value: 0,
      when: 11.012,
    })
    expect(trackGain.gain.value).toBe(1)
    expect(h.transport.getMasterVolume()).toBe(0.78)
    h.transport.pause()
    expect(seamGain.gain.operations.at(-1)?.value).toBe(1)
  })

  it('preserves intro seeks, maps seeks after B to A, and clears from the audible wrapped position', async () => {
    const h = setup()
    h.transport.configure(session('seek'))
    h.transport.setLoopRange({ start: 2, end: 4 })
    h.transport.seek(1)
    await h.transport.play()
    expect(h.context.sources.at(-1)!.start).toHaveBeenLastCalledWith(10.012, 1)
    h.transport.seek(12)
    expect(h.context.sources.at(-1)!.start).toHaveBeenLastCalledWith(10.012, 2)
    expect(h.transport.getStatus()).toBe('playing')
    h.context.currentTime = 13.512
    expect(h.transport.getCurrentTime()).toBeCloseTo(3.5)
    h.transport.setLoopRange(null)
    expect(h.context.sources.at(-1)!.loop).toBe(false)
    expect(h.context.sources.at(-1)!.start.mock.calls[0]![1]).toBeCloseTo(3.5)
    h.context.currentTime += 1.012
    expect(h.transport.getCurrentTime()).toBeCloseTo(4.5)
  })

  it('keeps paused edits silent and restart preserves a full-song loop at B=end', async () => {
    const h = setup()
    h.transport.configure(session('paused'))
    await h.transport.play()
    h.transport.pause()
    const count = h.context.sources.length
    h.transport.seek(11)
    h.transport.setLoopRange({ start: 0, end: 12 })
    expect(h.context.sources).toHaveLength(count)
    await h.transport.play()
    h.context.currentTime = 10.012 + 1.5
    expect(h.transport.getCurrentTime()).toBeCloseTo(0.5)
    h.transport.stop()
    expect(h.transport.getLoopRange()).toEqual({ start: 0, end: 12 })
    expect(h.transport.getCurrentTime()).toBe(0)
    await h.transport.play()
    expect(h.context.sources.at(-1)!.start.mock.calls[0]![1]).toBe(0)
  })

  it('applies the latest marks after an asynchronous decode', async () => {
    const h = setup()
    const pending = deferred<AudioBuffer>()
    h.context.decodeImpl = () => pending.promise
    h.transport.configure(session('loading'))
    h.transport.setLoopRange({ start: 1, end: 5 })
    const playing = h.transport.play()
    await vi.waitFor(() => expect(h.context.decodeAudioData).toHaveBeenCalled())
    h.transport.setLoopRange({ start: 2, end: 3 })
    pending.resolve(decodedBuffer())
    await playing
    expect(h.context.sources[0]!.loopStart).toBe(2)
    expect(h.context.sources[0]!.loopEnd).toBe(3)
  })

  it('pads short stems with silence through B instead of wrapping them at their own end', async () => {
    const h = setup({ memoryBudgetBytes: 20_000 })
    h.context.sampleRate = 100
    const short = pcmBuffer(200)
    short.getChannelData(0).fill(0.5)
    h.context.decodeImpl = async () =>
      h.context.decodeAudioData.mock.calls.length === 1 ? short : pcmBuffer(600)
    h.transport.configure(
      session('short', [
        track('drums', { durationSeconds: 2, channelCount: 1 }),
        track('guitar', { durationSeconds: 6, channelCount: 1 }),
      ]),
    )
    h.transport.setLoopRange({ start: 1, end: 5 })
    await h.transport.play()
    const padded = h.context.sources[0]!.buffer!
    expect(padded.length).toBe(500)
    expect([...padded.getChannelData(0).slice(0, 200)]).toEqual(
      Array(200).fill(0.5),
    )
    expect([...padded.getChannelData(0).slice(200)]).toEqual(Array(300).fill(0))
    expect(h.context.sources[0]!.loopEnd).toBe(5)
  })

  it('refuses loop-only padding above the existing memory budget without claiming an active loop', async () => {
    const h = setup({ memoryBudgetBytes: 3_500 })
    h.context.sampleRate = 100
    h.context.decodeImpl = async () =>
      pcmBuffer(h.context.decodeAudioData.mock.calls.length === 1 ? 200 : 600)
    h.transport.configure(
      session('budget', [
        track('drums', { durationSeconds: 2, channelCount: 1 }),
        track('guitar', { durationSeconds: 6, channelCount: 1 }),
      ]),
    )
    await h.transport.play()
    expect(h.transport.getLoadMode()).toBe('buffered')
    expect(h.transport.setLoopRange({ start: 1, end: 5 })).toBe(false)
    expect(h.transport.getLoopRange()).toBeNull()
    expect(h.transport.getLoopError()).toMatch(/memory/)
    expect(h.context.sources.every((source) => !source.loop)).toBe(true)
    expect(h.transport.getStatus()).toBe('playing')
  })

  it('hands loops to streamed playback on rate changes and waits for every seek before reopening', async () => {
    vi.useFakeTimers()
    const h = setup()
    h.transport.configure(session('stream', [track('drums'), track('guitar')]))
    h.transport.setLoopRange({ start: 2, end: 4 })
    await h.transport.play()
    await h.transport.setPlaybackRate(0.75)
    expect(h.transport.getLoopMode()).toBe('streamed')
    for (const element of h.mediaElements) {
      element.currentTime = 4
      element.seekLatencyMs = 120
    }
    await vi.advanceTimersByTimeAsync(100)
    expect(h.transport.getStatus()).toBe('loading')
    await vi.advanceTimersByTimeAsync(350)
    expect(h.transport.getStatus()).toBe('playing')
    for (const element of h.mediaElements) {
      expect(element.currentTime).toBe(2)
      expect(element.playbackRate).toBe(0.75)
      expect(element.seeking).toBe(false)
    }
    expect(h.transport.getCurrentTime()).toBe(2)
    expect(h.context.decodeAudioData).toHaveBeenCalledTimes(2)
  })

  it('clearing during a streamed wrap continues from B and a later pause wins over readiness', async () => {
    vi.useFakeTimers()
    const h = setup()
    h.transport.configure(session('clear-stream'))
    await h.transport.setPlaybackRate(0.75)
    h.transport.setLoopRange({ start: 2, end: 4 })
    await h.transport.play()
    const media = h.mediaElements[0]!
    media.currentTime = 4
    media.seekLatencyMs = 100
    await vi.advanceTimersByTimeAsync(100)
    expect(h.transport.getStatus()).toBe('loading')
    h.transport.setLoopRange(null)
    await vi.advanceTimersByTimeAsync(500)
    expect(media.currentTime).toBe(4)
    expect(h.transport.getStatus()).toBe('playing')
    h.transport.setLoopRange({ start: 2, end: 4 })
    h.transport.pause()
    await vi.advanceTimersByTimeAsync(500)
    expect(h.transport.getStatus()).toBe('paused')
    expect(media.paused).toBe(true)
  })

  it('an old streamed wrap cannot pause or erase a newer Play and seek after Pause', async () => {
    vi.useFakeTimers()
    const h = setup()
    h.transport.configure(session('stale-stream'))
    await h.transport.setPlaybackRate(0.75)
    h.transport.setLoopRange({ start: 2, end: 4 })
    await h.transport.play()
    const media = h.mediaElements[0]!
    const oldPlay = deferred<undefined>()
    media.play.mockImplementationOnce(() => oldPlay.promise)
    media.currentTime = 4
    await vi.advanceTimersByTimeAsync(115)
    expect(h.transport.getStatus()).toBe('loading')
    h.transport.pause()
    await h.transport.play()
    expect(h.transport.getStatus()).toBe('playing')
    media.seekLatencyMs = 100
    h.transport.seek(3)
    oldPlay.resolve(undefined)
    await vi.advanceTimersByTimeAsync(300)
    expect(h.transport.getStatus()).toBe('playing')
    expect(h.transport.getCurrentTime()).toBe(3)
    expect(media.paused).toBe(false)
    expect(h.transport.getLoopRange()).toEqual({ start: 2, end: 4 })
  })

  it('uses the real shorter streamed duration and newest loop while a cold start settles', async () => {
    const h = setup()
    h.transport.configure(session('metadata'))
    await h.transport.setPlaybackRate(0.75)
    h.transport.seek(10)
    h.transport.setLoopRange({ start: 8, end: 12 })
    const initialPlay = deferred<undefined>()
    const factory = h.mediaElementFactory.getMockImplementation()!
    h.mediaElementFactory.mockImplementation(() => {
      const element = factory() as unknown as FakeMediaElement
      element.duration = 6
      element.play.mockImplementationOnce(() => initialPlay.promise)
      return element as unknown as HTMLAudioElement
    })
    const playing = h.transport.play()
    await vi.waitFor(() => expect(h.mediaElements).toHaveLength(1))
    h.transport.setLoopRange({ start: 1, end: 5 })
    initialPlay.resolve(undefined)
    expect(await playing).toBe(true)
    expect(h.transport.getDuration()).toBe(6)
    expect(h.transport.getLoopRange()).toEqual({ start: 1, end: 5 })
    expect(h.transport.getCurrentTime()).toBe(1)
    expect(h.mediaElements[0]!.currentTime).toBe(1)
  })

  it('surfaces an invalid native loop when the decoded recording is shorter than declared', async () => {
    const h = setup()
    h.context.decodeImpl = async () => decodedBuffer(6)
    h.transport.configure(session('short-metadata'))
    h.transport.setLoopRange({ start: 8, end: 12 })
    await h.transport.play()
    expect(h.transport.getLoopRange()).toBeNull()
    expect(h.transport.getLoopError()).toMatch(/outside this recording/)
    expect(h.context.sources[0]!.loop).toBe(false)
  })

  it('finishes the streamed dip before pausing media and cancels the dip for a newer Stop', async () => {
    vi.useFakeTimers()
    const h = setup({ memoryBudgetBytes: 1 })
    h.transport.configure(session('dip'))
    await h.transport.play()
    const media = h.mediaElements[0]!
    media.pause.mockClear()
    media.play.mockClear()
    h.transport.seek(2)
    await vi.advanceTimersByTimeAsync(14)
    expect(media.pause).not.toHaveBeenCalled()
    expect(media.play).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(media.pause).toHaveBeenCalledOnce()
    expect(media.play).toHaveBeenCalledOnce()
    h.transport.seek(4)
    h.transport.stop()
    await vi.advanceTimersByTimeAsync(100)
    expect(media.play).toHaveBeenCalledOnce()
    expect(h.transport.getStatus()).toBe('ready')
    expect(h.transport.getCurrentTime()).toBe(0)
  })

  it('a terminal seek cancels an older streamed re-prime without changing complete to error', async () => {
    vi.useFakeTimers()
    const h = setup({ memoryBudgetBytes: 1 })
    h.transport.configure(session('terminal'))
    await h.transport.play()
    const pending = deferred<undefined>()
    const media = h.mediaElements[0]!
    media.play.mockImplementationOnce(() => pending.promise)
    h.transport.seek(2)
    await vi.advanceTimersByTimeAsync(15)
    h.transport.seek(12)
    pending.resolve(undefined)
    await vi.advanceTimersByTimeAsync(100)
    expect(h.transport.getStatus()).toBe('complete')
    expect(h.transport.getCurrentTime()).toBe(12)
    expect(h.transport.getError()).toBeNull()
    expect(media.paused).toBe(true)
  })

  it('a terminal seek during the audible dip releases before pausing media', async () => {
    vi.useFakeTimers()
    const h = setup({ memoryBudgetBytes: 1 })
    h.transport.configure(session('terminal-dip'))
    await h.transport.play()
    const media = h.mediaElements[0]!
    media.currentTime = 1
    media.pause.mockClear()
    media.play.mockClear()
    h.transport.seek(2)
    await vi.advanceTimersByTimeAsync(5)
    h.transport.seek(12)
    expect(media.pause).not.toHaveBeenCalled()
    expect(media.currentTime).toBe(1)
    expect(h.transport.getStatus()).toBe('complete')
    expect(h.transport.getCurrentTime()).toBe(12)
    await vi.advanceTimersByTimeAsync(100)
    expect(media.paused).toBe(true)
    expect(media.play).not.toHaveBeenCalled()
    expect(h.transport.getStatus()).toBe('complete')
    expect(h.transport.getError()).toBeNull()
  })

  it('a terminal seek cancels a cold streamed Play before it can reopen at its old offset', async () => {
    const h = setup({ memoryBudgetBytes: 1 })
    const pending = deferred<undefined>()
    const factory = h.mediaElementFactory.getMockImplementation()!
    h.mediaElementFactory.mockImplementation(() => {
      const media = factory() as unknown as FakeMediaElement
      media.play.mockImplementationOnce(() => pending.promise)
      return media as unknown as HTMLAudioElement
    })
    h.transport.configure(session('terminal-cold'))
    const playing = h.transport.play()
    await vi.waitFor(() =>
      expect(h.mediaElements[0]?.play).toHaveBeenCalledOnce(),
    )
    h.transport.seek(12)
    pending.resolve(undefined)
    expect(await playing).toBe(false)
    expect(h.transport.getStatus()).toBe('complete')
    expect(h.transport.getCurrentTime()).toBe(12)
    expect(h.mediaElements[0]!.paused).toBe(true)
    expect(h.transport.getError()).toBeNull()
  })

  it.each(['pause', 'stop'] as const)(
    '%s during an audible dip releases before halting and never seeks live media',
    async (action) => {
      vi.useFakeTimers()
      const h = setup({ memoryBudgetBytes: 1 })
      h.transport.configure(session(`dip-${action}`))
      await h.transport.play()
      const media = h.mediaElements[0]!
      media.currentTime = 1
      media.pause.mockClear()
      media.play.mockClear()
      h.transport.seek(4)
      await vi.advanceTimersByTimeAsync(5)
      h.transport[action]()
      expect(media.pause).not.toHaveBeenCalled()
      expect(media.currentTime).toBe(1)
      expect(h.transport.getCurrentTime()).toBe(action === 'stop' ? 0 : 4)
      await vi.advanceTimersByTimeAsync(100)
      expect(media.paused).toBe(true)
      expect(media.play).not.toHaveBeenCalled()
      expect(h.transport.getStatus()).toBe(
        action === 'stop' ? 'ready' : 'paused',
      )
      await h.transport.play()
      expect(media.currentTime).toBe(action === 'stop' ? 0 : 4)
    },
  )
})

describe('createGuitarBackingTransport', () => {
  it('arms and exposes a mix without creating or activating audio', () => {
    const harness = audioHarness()
    const onChange = vi.fn()
    const unsubscribe = harness.transport.subscribe(onChange)

    harness.transport.configure(
      session('quiet-entry', [
        track('drums'),
        track('guitar', { muted: true, level: 0.4 }),
      ]),
    )

    expect(harness.contextFactory).not.toHaveBeenCalled()
    expect(harness.activateContext).not.toHaveBeenCalled()
    expect(harness.fetchArrayBuffer).not.toHaveBeenCalled()
    expect(harness.transport.getStatus()).toBe('armed')
    expect(harness.transport.getDuration()).toBe(12)
    expect(harness.transport.getTrackStates()).toEqual([
      {
        id: 'drums',
        label: 'Drums',
        muted: false,
        effectiveMuted: false,
        levelDb: 0,
        level: 1,
        available: true,
      },
      {
        id: 'guitar',
        label: 'Guitar',
        muted: true,
        effectiveMuted: true,
        levelDb: 20 * Math.log10(0.4 ** 2),
        level: 0.4,
        available: true,
      },
    ])
    expect(onChange).toHaveBeenCalledOnce()

    harness.transport.configure(null)
    expect(harness.transport.getStatus()).toBe('idle')
    expect(harness.contextFactory).not.toHaveBeenCalled()
    unsubscribe()
  })

  it('keeps the canonical master position available across room mounts', () => {
    const harness = audioHarness()

    expect(harness.transport.getMasterVolume()).toBe(0.78)

    harness.transport.setMasterVolume(0.31)
    expect(harness.transport.getMasterVolume()).toBe(0.31)

    harness.transport.configure(session('same-route-new-room'))
    expect(harness.transport.getMasterVolume()).toBe(0.31)

    harness.transport.setMasterVolume(2)
    expect(harness.transport.getMasterVolume()).toBe(1)
  })

  it('keeps amp state dormant until activation and updates the live graph in place', async () => {
    const harness = audioHarness()
    const initial = {
      ...DEFAULT_GUITAR_ELECTRIC_AMP_PARAMETERS,
      drive: 0.18,
      bass: 0.35,
    }

    harness.transport.setElectricAmpParameters(initial)
    expect(harness.contextFactory).not.toHaveBeenCalled()

    await expect(harness.transport.activate()).resolves.toBe(true)
    const graph = harness.transport.getAudioGraph()
    const gainCount = harness.context.gains.length
    expect(graph?.getElectricAmpParameters()).toEqual(initial)

    const edited = { ...initial, drive: 0.83, enabled: false }
    harness.transport.setElectricAmpParameters(edited)
    expect(graph?.getElectricAmpParameters()).toEqual(edited)
    expect(harness.context.gains).toHaveLength(gainCount)
  })

  it('creates and resumes one context, then sample-aligns every stem', async () => {
    const harness = audioHarness()
    const durations = [12, 10]
    harness.context.decodeImpl = async () =>
      decodedBuffer(durations.shift() ?? 1)
    harness.transport.configure(
      session('aligned', [track('drums'), track('guitar')]),
    )

    await expect(harness.transport.play()).resolves.toBe(true)

    expect(harness.contextFactory).toHaveBeenCalledOnce()
    expect(harness.activateContext).toHaveBeenCalledOnce()
    expect(harness.context.resume).toHaveBeenCalledOnce()
    expect(harness.fetchArrayBuffer).toHaveBeenCalledTimes(2)
    expect(harness.context.decodeAudioData).toHaveBeenCalledTimes(2)
    expect(harness.context.sources).toHaveLength(2)
    const starts = harness.context.sources.map(
      (source) => source.start.mock.calls[0],
    )
    expect(starts[0][0]).toBe(starts[1][0])
    expect(starts[0][1]).toBe(0)
    expect(starts[1][1]).toBe(0)
    expect(harness.transport.getStatus()).toBe('playing')
    expect(harness.transport.getDuration()).toBe(12)
  })

  // The room renders these through a `<For>`, so a fresh object per call meant
  // the whole channel strip was destroyed and rebuilt on every transport
  // event — including every `input` of a seek or a volume drag, which is
  // exactly when new DOM is most visible as jank.
  it('hands out the same track state until that track changes', async () => {
    const harness = audioHarness({ fadeSeconds: 0.05 })
    harness.transport.configure(
      session('stable-identity', [track('drums'), track('guitar')]),
    )
    await harness.transport.play()

    const first = harness.transport.getTrackStates()
    expect(harness.transport.getTrackStates()[0]).toBe(first[0])
    expect(harness.transport.getTrackStates()[1]).toBe(first[1])

    harness.transport.setTrackMuted('guitar', true)
    const afterMute = harness.transport.getTrackStates()

    // Only the track that changed is a new object.
    expect(afterMute[0]).toBe(first[0])
    expect(afterMute[1]).not.toBe(first[1])
    expect(afterMute[1].muted).toBe(true)
  })

  it('never hands out the array it mutates', async () => {
    const harness = audioHarness({ fadeSeconds: 0.05 })
    harness.transport.configure(
      session('copy-out', [track('drums', { muted: true })]),
    )
    await harness.transport.play()

    const states = harness.transport.getTrackStates()
    ;(states[0] as { muted: boolean }).muted = false

    harness.transport.setTrackMuted('drums', true)
    expect(harness.transport.getTrackStates()[0].muted).toBe(true)
  })

  it('starts a guitar channel muted and ramps it in without rebuilding the graph', async () => {
    const harness = audioHarness({ fadeSeconds: 0.05 })
    harness.transport.configure(
      session('guitar-muted', [
        track('drums'),
        track('guitar', { muted: true, level: 0.4 }),
      ]),
    )
    await harness.transport.play()
    const contextCreationCount = harness.contextFactory.mock.calls.length
    const guitarGain = harness.context.sources[1].connect.mock
      .calls[0][0] as FakeGainNode

    expect(guitarGain.gain.value).toBe(0)
    expect(harness.transport.getTrackStates()[1].muted).toBe(true)
    guitarGain.gain.operations.length = 0
    harness.context.currentTime = 12

    harness.transport.setTrackMuted('guitar', false)

    expect(harness.transport.getTrackStates()[1].muted).toBe(false)
    expect(guitarGain.gain.operations).toEqual([
      { kind: 'cancel', when: 12 },
      { kind: 'set', value: 0, when: 12 },
      expect.objectContaining({
        kind: 'linear',
        when: 12.05,
      }),
    ])
    expect(guitarGain.gain.operations.at(-1)?.value).toBeGreaterThan(0)
    expect(harness.contextFactory).toHaveBeenCalledTimes(contextCreationCount)
  })

  it('parks one common offset on pause and resumes every stem from it', async () => {
    const harness = audioHarness()
    harness.transport.configure(
      session('resume', [track('drums'), track('guitar')]),
    )
    await harness.transport.play()
    const firstStartTime = harness.context.sources[0].start.mock.calls[0][0]!
    harness.context.currentTime = firstStartTime + 3.5

    harness.transport.pause()

    expect(harness.transport.getStatus()).toBe('paused')
    expect(harness.transport.getCurrentTime()).toBeCloseTo(3.5)
    await expect(harness.transport.play()).resolves.toBe(true)

    const resumedSources = harness.context.sources.slice(-2)
    const resumedStarts = resumedSources.map(
      (source) => source.start.mock.calls[0],
    )
    expect(resumedStarts[0][0]).toBe(resumedStarts[1][0])
    expect(resumedStarts[0][1]).toBeCloseTo(3.5)
    expect(resumedStarts[1][1]).toBeCloseTo(3.5)
    expect(harness.contextFactory).toHaveBeenCalledOnce()
    expect(harness.fetchArrayBuffer).toHaveBeenCalledTimes(2)
    expect(harness.context.decodeAudioData).toHaveBeenCalledTimes(2)
  })

  it('edits faders and temporary Solo in place without changing retained mutes or transport', async () => {
    const harness = audioHarness({ fadeSeconds: 0.05 })
    harness.transport.configure(
      session('live-mix', [
        track('drums'),
        track('guitar', { level: 0.4 }),
        track('vocals', { muted: true }),
      ]),
    )
    harness.transport.setTrackLevelDb('drums', 6)
    harness.transport.toggleTrackSolo('drums')
    expect(harness.contextFactory).not.toHaveBeenCalled()
    await harness.transport.play()
    const gains = harness.context.sources.map(
      (source) => source.connect.mock.calls[0][0] as FakeGainNode,
    )
    expect(gains.map((gain) => gain.gain.value)).toEqual([10 ** (6 / 20), 0, 0])
    expect(
      harness.transport.getTrackStates().map((state) => state.muted),
    ).toEqual([false, false, true])

    const time = harness.transport.getCurrentTime()
    harness.transport.setTrackLevelDb('guitar', -6)
    expect(gains[1].gain.value).toBe(0)
    harness.transport.toggleTrackSolo('drums')
    expect(gains[1].gain.value).toBeCloseTo(10 ** (-6 / 20), 8)
    expect(gains[2].gain.value).toBe(0)
    harness.transport.toggleTrackSolo('guitar')
    harness.transport.setTrackMuted('guitar', true)
    expect(harness.transport.getSoloedTrackId()).toBeNull()
    expect(gains[0].gain.value).toBeCloseTo(10 ** (6 / 20), 8)
    expect(gains[1].gain.value).toBe(0)
    expect(harness.transport.getCurrentTime()).toBe(time)
    expect(harness.transport.getStatus()).toBe('playing')
    expect(harness.context.sources).toHaveLength(3)
    expect(
      harness.context.sources.every(
        (source) => source.stop.mock.calls.length === 0,
      ),
    ).toBe(true)
    expect(harness.fetchArrayBuffer).toHaveBeenCalledTimes(3)

    harness.transport.toggleTrackSolo('drums')
    harness.transport.resetTrackLevels()
    expect(harness.transport.getSoloedTrackId()).toBe('drums')
    expect(
      harness.transport.getTrackStates().map((state) => state.level),
    ).toEqual([1, 0.4, 1])
    expect(
      harness.transport.getTrackStates().map((state) => state.muted),
    ).toEqual([false, true, true])
    expect(gains.map((gain) => gain.gain.value)).toEqual([1, 0, 0])
    await harness.transport.dispose()
  })

  it('bounds unsafe fader values and preserves zero-gain faders through mute and Solo', async () => {
    const harness = audioHarness()
    harness.transport.configure(
      session('safe-gains', [track('drums'), track('guitar', { level: 0.1 })]),
    )
    await harness.transport.play()
    const gain = harness.context.sources[0].connect.mock
      .calls[0][0] as FakeGainNode
    const quietDefault = harness.context.sources[1].connect.mock
      .calls[0][0] as FakeGainNode
    expect(quietDefault.gain.value).toBeCloseTo(0.01, 8)
    for (const db of [
      Number.NaN,
      Number.POSITIVE_INFINITY,
      -100,
      1e9,
      Number.NEGATIVE_INFINITY,
    ]) {
      harness.transport.setTrackLevelDb('drums', db)
      expect(Number.isFinite(gain.gain.value)).toBe(true)
      expect(gain.gain.value).toBeGreaterThanOrEqual(0)
      expect(gain.gain.value).toBeLessThanOrEqual(2)
    }
    harness.transport.toggleTrackSolo('drums')
    harness.transport.setTrackMuted('drums', true)
    harness.transport.setTrackMuted('drums', false)
    expect(gain.gain.value).toBe(0)
    expect(harness.transport.getTrackStates()[0].levelDb).toBe(
      Number.NEGATIVE_INFINITY,
    )
    harness.transport.resetTrackLevels()
    expect(quietDefault.gain.value).toBeCloseTo(0.01, 8)
    expect(gain.gain.value).toBe(1)
    await harness.transport.dispose()
  })

  it('uses the latest mix after edits while a later stem is still decoding', async () => {
    const harness = audioHarness()
    const pending = deferred<AudioBuffer>()
    let decodes = 0
    harness.context.decodeImpl = async () =>
      ++decodes === 1 ? decodedBuffer() : pending.promise
    harness.transport.configure(
      session('loading-mix', [track('drums'), track('guitar')]),
    )
    const starting = harness.transport.play()
    await vi.waitFor(() =>
      expect(harness.context.decodeAudioData).toHaveBeenCalledTimes(2),
    )
    harness.transport.setTrackLevelDb('drums', 6)
    harness.transport.setTrackLevelDb('guitar', -6)
    harness.transport.toggleTrackSolo('guitar')
    pending.resolve(decodedBuffer())
    await expect(starting).resolves.toBe(true)
    const gains = harness.context.sources.map(
      (source) => source.connect.mock.calls[0][0] as FakeGainNode,
    )
    expect(gains[0].gain.value).toBe(0)
    expect(gains[1].gain.value).toBeCloseTo(10 ** (-6 / 20), 8)
    // Newly loaded gains must already be exact when sources start, not reach
    // their mute/level only after the live 18ms ramp finishes.
    expect(gains.map((gain) => gain.gain.operations)).toEqual([[], []])
    harness.transport.toggleTrackSolo('guitar')
    expect(gains[0].gain.value).toBeCloseTo(10 ** (6 / 20), 8)
    expect(harness.context.sources).toHaveLength(2)
    await harness.transport.dispose()
  })

  it('clears Solo when its stem fails decoding and restores surviving levels and explicit mutes', async () => {
    const harness = audioHarness()
    let decodes = 0
    harness.context.decodeImpl = async () => {
      if (++decodes === 1) throw new Error('damaged drums')
      return decodedBuffer()
    }
    harness.transport.configure(
      session('failed-solo', [
        track('drums'),
        track('guitar'),
        track('vocal', { muted: true }),
      ]),
    )
    harness.transport.setTrackLevelDb('guitar', -6)
    harness.transport.toggleTrackSolo('drums')
    await expect(harness.transport.play()).resolves.toBe(true)
    expect(harness.transport.getSoloedTrackId()).toBeNull()
    expect(harness.transport.getTrackStates()[0].available).toBe(false)
    const gains = harness.context.sources.map(
      (source) => source.connect.mock.calls[0][0] as FakeGainNode,
    )
    expect(gains[0].gain.value).toBeCloseTo(10 ** (-6 / 20), 8)
    expect(gains[1].gain.value).toBe(0)
    expect(
      harness.transport.getTrackStates().map((state) => state.muted),
    ).toEqual([false, false, true])
    await harness.transport.dispose()
  })

  it('clears Solo after a streamed stem error without restarting the surviving track', async () => {
    const harness = audioHarness({ memoryBudgetBytes: 1 })
    harness.transport.configure(
      session('stream-failed-solo', [track('drums'), track('guitar')]),
    )
    harness.transport.setTrackLevelDb('guitar', -6)
    harness.transport.toggleTrackSolo('drums')
    await harness.transport.play()
    const gains = harness.context.mediaSources.map(
      (source) => source.connect.mock.calls[0][0] as FakeGainNode,
    )
    expect(gains[1].gain.value).toBe(0)
    const starts = harness.mediaElements[1].play.mock.calls.length
    harness.mediaElements[0].dispatchEvent(new Event('error'))
    expect(harness.transport.getSoloedTrackId()).toBeNull()
    expect(harness.transport.getTrackStates()[0].available).toBe(false)
    expect(gains[0].gain.value).toBe(0)
    expect(gains[1].gain.value).toBeCloseTo(10 ** (-6 / 20), 8)
    expect(harness.mediaElements[1].play).toHaveBeenCalledTimes(starts)
    expect(harness.transport.getStatus()).toBe('playing')
    await harness.transport.dispose()
  })

  it('keeps faders and mute masks through buffered-to-streamed rate handoff and paused edits', async () => {
    const harness = audioHarness()
    harness.transport.configure(
      session('rate-mix', [track('drums'), track('guitar')]),
    )
    await harness.transport.play()
    harness.transport.setTrackLevelDb('drums', 6)
    harness.transport.setTrackLevelDb('guitar', -6)
    harness.transport.toggleTrackSolo('drums')
    await harness.transport.setPlaybackRate(0.75)
    const gains = harness.context.mediaSources.map(
      (source) => source.connect.mock.calls[0][0] as FakeGainNode,
    )
    expect(gains[0].gain.value).toBeCloseTo(10 ** (6 / 20), 8)
    expect(gains[1].gain.value).toBe(0)
    const starts = harness.mediaElements.map(
      (element) => element.play.mock.calls.length,
    )
    harness.transport.setTrackLevelDb('drums', -3)
    harness.transport.toggleTrackSolo('drums')
    expect(gains[0].gain.value).toBeCloseTo(10 ** (-3 / 20), 8)
    expect(gains[1].gain.value).toBeCloseTo(10 ** (-6 / 20), 8)
    expect(
      harness.mediaElements.map((element) => element.play.mock.calls.length),
    ).toEqual(starts)
    expect(
      harness.mediaElements.map((element) => element.playbackRate),
    ).toEqual([0.75, 0.75])
    harness.transport.pause()
    harness.transport.setTrackLevelDb('drums', 0)
    harness.transport.setTrackMuted('guitar', true)
    expect(harness.transport.getStatus()).toBe('paused')
    expect(gains.map((gain) => gain.gain.value)).toEqual([1, 0])
    await harness.transport.play()
    expect(gains.map((gain) => gain.gain.value)).toEqual([1, 0])
    await harness.transport.dispose()
  })

  it('gates only backing stems on pause and restores them on resume', async () => {
    const harness = audioHarness({ fadeSeconds: 0.05 })
    harness.transport.setMasterVolume(0.31)
    harness.transport.configure(
      session('shared-graph-pause', [track('drums'), track('guitar')]),
    )
    await harness.transport.play()

    const graph = harness.transport.getAudioGraph()!
    const master = graph.master as unknown as FakeGainNode
    const guide = graph.buses.guide as unknown as FakeGainNode
    const monitor = graph.buses.monitor as unknown as FakeGainNode
    const stems = graph.buses.stems as unknown as FakeGainNode
    const masterGain = master.gain.value
    const guideGain = guide.gain.value
    const monitorGain = monitor.gain.value
    master.gain.operations.length = 0
    guide.gain.operations.length = 0
    monitor.gain.operations.length = 0
    stems.gain.operations.length = 0

    harness.context.currentTime = 12
    harness.transport.pause()

    // The documented pause shape: asymptotic decay (setTargetAtTime), not
    // a linear ramp to zero — linear at a silence boundary is the
    // "squeezed pop". This pin used to demand the linear shape.
    expect(stems.gain.operations).toEqual([
      { kind: 'cancel', when: 12 },
      { kind: 'set', value: 1, when: 12 },
      { kind: 'target', value: 0, when: 12, timeConstant: 0.012 },
    ])
    expect(stems.gain.value).toBe(0)
    expect(master.gain.value).toBe(masterGain)
    expect(master.gain.operations).toEqual([])
    expect(guide.gain.value).toBe(guideGain)
    expect(guide.gain.operations).toEqual([])
    expect(guide.connect).toHaveBeenCalledWith(master)
    expect(monitor.gain.value).toBe(monitorGain)
    expect(monitor.gain.operations).toEqual([])
    expect(monitor.connect).toHaveBeenCalledWith(master)

    await expect(harness.transport.play()).resolves.toBe(true)

    expect(stems.gain.value).toBe(1)
    expect(stems.gain.operations.at(-1)).toMatchObject({
      kind: 'linear',
      value: 1,
    })
    expect(stems.gain.operations.at(-1)?.when).toBeCloseTo(12.062)
    expect(master.gain.value).toBe(masterGain)
    expect(master.gain.operations).toEqual([])
  })

  it('restarts all active stems at the same target when seeking', async () => {
    const harness = audioHarness()
    harness.transport.configure(
      session('seek', [track('drums'), track('guitar')]),
    )
    await harness.transport.play()

    harness.context.currentTime = 15
    harness.transport.seek(7.25)

    const soughtSources = harness.context.sources.slice(-2)
    const soughtStarts = soughtSources.map(
      (source) => source.start.mock.calls[0],
    )
    expect(soughtStarts[0][0]).toBe(soughtStarts[1][0])
    expect(soughtStarts[0][1]).toBe(7.25)
    expect(soughtStarts[1][1]).toBe(7.25)
    expect(harness.transport.getCurrentTime()).toBeCloseTo(7.25)
    expect(harness.transport.getStatus()).toBe('playing')
  })

  it('re-primes streamed stems on a seek instead of seeking them live', async () => {
    // Setting currentTime on a PLAYING element stalls it for as long as its
    // pipeline needs. This used to reopen the bus 18 ms later, onto elements
    // that were still seeking — the stutter the player heard after every
    // seek. The stems are paused, moved, and started again, and the bus stays
    // shut for all of it.
    const harness = audioHarness({
      fadeSeconds: 0.05,
      memoryBudgetBytes: 1,
    })
    harness.transport.setMasterVolume(0.31)
    harness.transport.configure(
      session('streamed-seek', [track('drums'), track('guitar')]),
    )
    await expect(harness.transport.play()).resolves.toBe(true)
    expect(harness.transport.getLoadMode()).toBe('streamed')

    const graph = harness.transport.getAudioGraph()!
    const master = graph.master as unknown as FakeGainNode
    const stems = graph.buses.stems as unknown as FakeGainNode
    const masterGain = master.gain.value
    for (const element of harness.mediaElements) element.pause.mockClear()
    master.gain.operations.length = 0
    stems.gain.operations.length = 0
    harness.context.currentTime = 14

    harness.transport.seek(7.25)
    expect(harness.transport.getStatus()).toBe('loading')
    await vi.waitFor(() =>
      expect(harness.transport.getStatus()).toBe('playing'),
    )

    expect(stems.gain.operations).toEqual([
      // Down, and it stays down across the re-prime...
      { kind: 'cancel', when: 14 },
      { kind: 'set', value: 1, when: 14 },
      { kind: 'linear', value: 0, when: 14.015 },
      // ...then up, anchored at the moment the stems are actually running
      // again rather than chained onto a dip that has long since finished.
      { kind: 'cancel', when: 14 },
      { kind: 'set', value: 0, when: 14 },
      { kind: 'linear', value: 1, when: 14.05 },
    ])
    for (const element of harness.mediaElements) {
      expect(element.pause).toHaveBeenCalled()
      expect(element.currentTime).toBe(7.25)
    }
    expect(master.gain.value).toBe(masterGain)
    expect(master.gain.operations).toEqual([])
    // The existing Play spinner owns this brief re-prime, then clears as soon
    // as every stem can play the requested window continuously.
    expect(harness.transport.getStatus()).toBe('playing')
    expect(harness.transport.getCurrentTime()).toBeCloseTo(7.25)
  })

  it('keeps a streamed seek on the loading spinner until its window is ready', async () => {
    const harness = audioHarness({ memoryBudgetBytes: 1 })
    harness.transport.configure(session('iphone-seek', [track('drums')]))
    await expect(harness.transport.play()).resolves.toBe(true)
    const element = harness.mediaElements[0]
    element.bufferedEnd = 7.5

    harness.transport.seek(7)
    await vi.waitFor(() => expect(element.currentTime).toBe(7))

    expect(harness.transport.getStatus()).toBe('loading')
    expect(harness.transport.getCurrentTime()).toBeCloseTo(7)

    element.bufferedEnd = 14
    element.dispatchEvent(new Event('progress'))
    await vi.waitFor(() =>
      expect(harness.transport.getStatus()).toBe('playing'),
    )

    expect(harness.transport.getStatus()).toBe('playing')
    expect(harness.transport.getCurrentTime()).toBeCloseTo(7)
  })

  it('keeps loading through an accepted iOS seek slower than 1.2 seconds', async () => {
    vi.useFakeTimers()
    try {
      const harness = audioHarness({ memoryBudgetBytes: 1 })
      harness.transport.configure(
        session('iphone-slow-seek', [track('drums', { durationSeconds: 60 })]),
      )
      await expect(harness.transport.play()).resolves.toBe(true)
      const element = harness.mediaElements[0]
      element.seekLatencyMs = 2000
      element.bufferedEnd = 8
      element.bufferAfterSeekSeconds = 8

      harness.transport.seek(20)
      await Promise.resolve()
      expect(harness.transport.getStatus()).toBe('loading')

      await vi.advanceTimersByTimeAsync(1300)
      expect(harness.transport.getStatus()).toBe('loading')

      await vi.advanceTimersByTimeAsync(900)
      expect(harness.transport.getStatus()).toBe('playing')
      expect(harness.transport.getCurrentTime()).toBeCloseTo(20)
    } finally {
      vi.useRealTimers()
    }
  })

  it('lands a scrubber drag once, where the finger stopped', async () => {
    // A range input emits an `input` per pixel. Each one used to be its own
    // pause-seek-play of every stem — a drag's worth of re-primes, which is
    // the same stutter by another route.
    const harness = audioHarness({ memoryBudgetBytes: 1 })
    harness.transport.configure(
      session('drag', [track('drums'), track('guitar')]),
    )
    await expect(harness.transport.play()).resolves.toBe(true)
    const firstPrime = deferred<undefined>()
    for (const element of harness.mediaElements) {
      element.play.mockClear()
      element.play.mockImplementationOnce(() => firstPrime.promise)
    }

    harness.transport.seek(2)
    await vi.waitFor(() =>
      expect(harness.mediaElements[0]!.play).toHaveBeenCalledOnce(),
    )
    harness.transport.seek(4)
    harness.transport.seek(6.5)
    // The playhead reports where the finger is, not where the in-flight
    // re-prime is heading and not where the stalled element still reads.
    expect(harness.transport.getStatus()).toBe('loading')
    expect(harness.transport.getCurrentTime()).toBeCloseTo(6.5)
    firstPrime.resolve(undefined)
    await vi.waitFor(() =>
      expect(harness.transport.getStatus()).toBe('playing'),
    )

    for (const element of harness.mediaElements) {
      // Two re-primes, not three: the first, and the last position asked for.
      expect(element.play).toHaveBeenCalledTimes(2)
      expect(element.currentTime).toBe(6.5)
    }
    expect(harness.transport.getStatus()).toBe('playing')
  })

  it('never opens the bus at a scrub target superseded during warm-up', async () => {
    const harness = audioHarness({ memoryBudgetBytes: 1 })
    harness.transport.configure(session('superseded-warm-up'))
    await expect(harness.transport.play()).resolves.toBe(true)
    const element = harness.mediaElements[0]
    const stems = harness.transport.getAudioGraph()!.buses
      .stems as unknown as FakeGainNode
    const reportedStatuses: string[] = []
    const unsubscribe = harness.transport.subscribe(() => {
      reportedStatuses.push(harness.transport.getStatus())
    })
    stems.gain.operations.length = 0
    element.bufferedEnd = 2.5

    harness.transport.seek(2)
    await vi.waitFor(() => expect(element.currentTime).toBe(2))
    harness.transport.seek(6)
    expect(harness.transport.getStatus()).toBe('loading')

    // Enough for target 2, but not the newer target 6. Target 2 may finish
    // warming internally; it must never become audible or report playing.
    element.bufferedEnd = 7.5
    element.dispatchEvent(new Event('progress'))
    await vi.waitFor(() => expect(element.currentTime).toBe(6))

    expect(harness.transport.getStatus()).toBe('loading')
    expect(reportedStatuses).not.toContain('playing')
    expect(
      stems.gain.operations.filter(
        (operation) => operation.kind === 'linear' && operation.value === 1,
      ),
    ).toEqual([])

    element.bufferedEnd = 12
    element.dispatchEvent(new Event('progress'))
    await new Promise((resolve) => setTimeout(resolve, 0))
    unsubscribe()

    expect(harness.transport.getStatus()).toBe('playing')
    expect(harness.transport.getCurrentTime()).toBeCloseTo(6)
    expect(
      stems.gain.operations.filter(
        (operation) => operation.kind === 'linear' && operation.value === 1,
      ),
    ).toHaveLength(1)
  })

  it('lets a pause outrank a seek that is still in the air', async () => {
    const harness = audioHarness({ memoryBudgetBytes: 1 })
    harness.transport.configure(session('pause-wins'))
    await expect(harness.transport.play()).resolves.toBe(true)

    harness.transport.seek(5)
    expect(harness.transport.getStatus()).toBe('loading')
    harness.transport.pause()
    await vi.waitFor(() => expect(harness.mediaElements[0]!.paused).toBe(true))

    // The re-prime finishes after the pause; the room must not come back up,
    // and it stays parked where the player left it — at the seek they had
    // already asked for, which is what the playhead was showing.
    expect(harness.transport.getStatus()).toBe('paused')
    expect(harness.mediaElements[0].paused).toBe(true)
    expect(harness.transport.getCurrentTime()).toBeCloseTo(5)
  })

  it('lets a stop outrank a seek, and stop means the top', async () => {
    // Stop parks at zero and reports 'ready'. A re-prime landing afterwards
    // used to force 'paused' at the seek target instead — the player's own
    // decision overwritten by one that was already in the air.
    const harness = audioHarness({ memoryBudgetBytes: 1 })
    harness.transport.configure(session('stop-wins'))
    await expect(harness.transport.play()).resolves.toBe(true)

    harness.transport.seek(5)
    harness.transport.stop()
    await vi.waitFor(() => expect(harness.mediaElements[0]!.paused).toBe(true))

    expect(harness.transport.getStatus()).toBe('ready')
    expect(harness.transport.getCurrentTime()).toBe(0)
    expect(harness.mediaElements[0].paused).toBe(true)
  })

  it('moves a paused streamed room to where it will resume from', async () => {
    // Scrubbing while paused is how a player lines up the bar they want to
    // work on. Nothing is audible, so there is no re-prime — but the elements
    // still have to be sitting on the target, or the first frame after Play
    // comes from wherever they were left and then jumps.
    const harness = audioHarness({ memoryBudgetBytes: 1 })
    harness.transport.configure(
      session('paused-seek', [track('drums'), track('guitar')]),
    )
    await expect(harness.transport.play()).resolves.toBe(true)
    expect(harness.transport.getLoadMode()).toBe('streamed')
    harness.transport.pause()
    await new Promise((resolve) => setTimeout(resolve, 0))
    for (const element of harness.mediaElements) element.play.mockClear()

    harness.transport.seek(9)
    await new Promise((resolve) => setTimeout(resolve, 0))

    for (const element of harness.mediaElements) {
      expect(element.currentTime).toBe(9)
      // Silent means silent: a seek while paused starts nothing.
      expect(element.play).not.toHaveBeenCalled()
    }
    expect(harness.transport.getStatus()).toBe('paused')
    expect(harness.transport.getCurrentTime()).toBeCloseTo(9)
  })

  it('drops a re-prime whose song has already been replaced', async () => {
    // Seek, then pick another song before the stems have come back up. The
    // in-flight re-prime belongs to a session that no longer exists; carrying
    // on would start the old stems under the new one's transport.
    const harness = audioHarness({ memoryBudgetBytes: 1 })
    harness.transport.configure(session('first-song', [track('drums')]))
    await expect(harness.transport.play()).resolves.toBe(true)

    const stale = harness.mediaElements[0]
    harness.transport.seek(5)
    // A second seek queues behind the first, so the loop still has work
    // pending when the song is swapped out from under it.
    harness.transport.seek(7)
    stale.play.mockClear()
    harness.transport.configure(session('second-song', [track('guitar')]))
    const reported: number[] = []
    const unsubscribe = harness.transport.subscribe(() => {
      reported.push(harness.transport.getCurrentTime())
    })
    await new Promise((resolve) => setTimeout(resolve, 0))
    unsubscribe()

    // Never the old song's playhead: the new room starts at its own zero.
    expect(reported.filter((value) => value !== 0)).toEqual([])

    // A freshly armed session, not the old one's re-prime landing on top of
    // it: nothing playing, nothing to resume from.
    expect(harness.transport.getStatus()).toBe('armed')
    expect(harness.transport.getCurrentTime()).toBe(0)
    expect(stale.play).not.toHaveBeenCalled()
  })

  it('parks the whole room when one stem is stopped from outside', async () => {
    // Each stem is its own media element and so its own OS media session. On
    // iOS the Now Playing control pauses the one it attached to; the rest
    // used to keep playing under a transport that still said "playing".
    const harness = audioHarness({ memoryBudgetBytes: 1 })
    harness.transport.configure(
      session('interrupted', [track('drums'), track('guitar')]),
    )
    await expect(harness.transport.play()).resolves.toBe(true)
    expect(harness.transport.getStatus()).toBe('playing')

    harness.mediaElements[1].currentTime = 6.5
    harness.mediaElements[1].dispatchEvent(new Event('pause'))

    expect(harness.transport.getStatus()).toBe('paused')
    expect(harness.transport.getCurrentTime()).toBeCloseTo(6.5)
  })

  it('parks at the song position when the stopped stem has no clock to give', async () => {
    // A stem torn down by the OS can read back NaN. Parking there would put
    // the playhead — and the resume point — at "not a number".
    const harness = audioHarness({ memoryBudgetBytes: 1 })
    harness.transport.configure(
      session('interrupted-nan', [track('drums'), track('guitar')]),
    )
    await expect(harness.transport.play()).resolves.toBe(true)
    harness.context.currentTime += 3

    harness.mediaElements[1].currentTime = Number.NaN
    harness.mediaElements[1].dispatchEvent(new Event('pause'))

    expect(harness.transport.getStatus()).toBe('paused')
    expect(Number.isFinite(harness.transport.getCurrentTime())).toBe(true)
    expect(harness.transport.getCurrentTime()).toBeGreaterThanOrEqual(0)
  })

  it('keeps playing when it is the transport doing the pausing', async () => {
    const harness = audioHarness({ memoryBudgetBytes: 1 })
    harness.transport.configure(session('own-pause'))
    await expect(harness.transport.play()).resolves.toBe(true)

    harness.transport.pause()
    harness.mediaElements[0].dispatchEvent(new Event('pause'))

    expect(harness.transport.getStatus()).toBe('paused')
  })

  it('rejects an unsafe decoded-size estimate before fetching or decoding', async () => {
    const oversizedTrack = track('drums', {
      durationSeconds: 10,
      channelCount: 2,
      sizeBytes: 1,
    })
    const estimatedBytes = estimateGuitarBackingPcmBytes(
      [oversizedTrack],
      48_000,
    )
    expect(estimatedBytes).toBe(3_840_000)
    const harness = audioHarness()
    const transport = createGuitarBackingTransport({
      contextFactory: harness.contextFactory,
      activateContext: harness.activateContext,
      fetchArrayBuffer: harness.fetchArrayBuffer,
      memoryBudgetBytes: estimatedBytes - 1,
      streamingFallback: false,
    })
    transport.configure(session('too-large', [oversizedTrack]))

    await expect(transport.play()).resolves.toBe(false)

    expect(harness.fetchArrayBuffer).not.toHaveBeenCalled()
    expect(harness.context.decodeAudioData).not.toHaveBeenCalled()
    expect(transport.getStatus()).toBe('error')
    expect(transport.getError()).toMatch(/too large|memory|safely/i)
  })

  it('streams a realistic full band instead of rejecting its decoded PCM size', async () => {
    const harness = audioHarness()
    const fullBand = [
      track('vocal'),
      track('drums'),
      track('bass'),
      track('guitar', { muted: true }),
      track('piano'),
      track('other'),
    ].map((candidate) => ({
      ...candidate,
      durationSeconds: 240,
      sizeBytes: 92 * 1024 * 1024,
    }))
    const transport = createGuitarBackingTransport({
      contextFactory: harness.contextFactory,
      activateContext: harness.activateContext,
      fetchArrayBuffer: harness.fetchArrayBuffer,
      mediaElementFactory: harness.mediaElementFactory,
      memoryBudgetBytes: 512 * 1024 * 1024,
      fadeSeconds: 0,
      streamSyncIntervalMs: 0,
    })
    transport.configure(session('full-band', fullBand))

    await expect(transport.play()).resolves.toBe(true)

    expect(estimateGuitarBackingPcmBytes(fullBand)).toBe(552_960_000)
    expect(harness.fetchArrayBuffer).not.toHaveBeenCalled()
    expect(harness.context.decodeAudioData).not.toHaveBeenCalled()
    expect(harness.mediaElements).toHaveLength(6)
    expect(harness.mediaElements.every((element) => !element.paused)).toBe(true)
    expect(transport.getLoadMode()).toBe('streamed')
    expect(transport.getStatus()).toBe('playing')
  })

  it('uses pitch-preserving streams for practice speed and keeps the song position when changing live', async () => {
    const harness = audioHarness()
    harness.transport.configure(
      session('speed-trainer', [track('drums'), track('guitar')]),
    )
    await expect(harness.transport.play()).resolves.toBe(true)
    expect(harness.transport.getLoadMode()).toBe('buffered')

    const firstStartTime = harness.context.sources[0].start.mock.calls[0][0]!
    harness.context.currentTime = firstStartTime + 3.25
    await expect(harness.transport.setPlaybackRate(0.75)).resolves.toBe(true)

    expect(harness.transport.getPlaybackRate()).toBe(0.75)
    expect(harness.transport.getLoadMode()).toBe('streamed')
    expect(harness.context.sources[0].stop).toHaveBeenCalled()
    expect(harness.mediaElements).toHaveLength(2)
    expect(
      harness.mediaElements.every(
        (element) =>
          element.playbackRate === 0.75 && element.preservesPitch === true,
      ),
    ).toBe(true)
    expect(harness.mediaElements[0].currentTime).toBeCloseTo(3.25)
    expect(harness.transport.getCurrentTime()).toBeCloseTo(3.25)
    expect(harness.transport.getStatus()).toBe('playing')
  })

  it('rejects a mix whose decoded buffers exceed the gate despite sparse metadata', async () => {
    const harness = audioHarness()
    const transport = createGuitarBackingTransport({
      contextFactory: harness.contextFactory,
      activateContext: harness.activateContext,
      fetchArrayBuffer: harness.fetchArrayBuffer,
      memoryBudgetBytes: 1_024,
      streamingFallback: false,
    })
    transport.configure(
      session('decoded-too-large', [
        track('drums', { durationSeconds: undefined, sizeBytes: 1 }),
      ]),
    )

    await expect(transport.play()).resolves.toBe(false)

    expect(harness.fetchArrayBuffer).toHaveBeenCalledOnce()
    expect(harness.context.decodeAudioData).toHaveBeenCalledOnce()
    expect(harness.context.sources).toHaveLength(0)
    expect(transport.getStatus()).toBe('error')
    expect(transport.getError()).toMatch(/too large|safely/i)
  })

  it('cannot install or play a decode that resolves after session replacement', async () => {
    const harness = audioHarness()
    const oldDecode = deferred<AudioBuffer>()
    harness.context.decodeImpl = () => oldDecode.promise
    harness.transport.configure(session('old', [track('drums')]))

    const oldPlay = harness.transport.play()
    await vi.waitFor(() =>
      expect(harness.context.decodeAudioData).toHaveBeenCalledOnce(),
    )
    const oldSignal = harness.fetchArrayBuffer.mock.calls[0][1]

    harness.transport.configure(
      session('new', [track('guitar', { durationSeconds: 6 })]),
    )
    expect(oldSignal.aborted).toBe(true)
    oldDecode.resolve(decodedBuffer(12))

    await expect(oldPlay).resolves.toBe(false)
    expect(harness.context.sources).toHaveLength(0)
    expect(harness.transport.getStatus()).toBe('armed')
    expect(harness.transport.getDuration()).toBe(6)
    expect(harness.transport.getTrackStates()).toEqual([
      expect.objectContaining({ id: 'guitar' }),
    ])
  })

  it('cancels a pending start when paused during loading and can retry safely', async () => {
    const harness = audioHarness()
    const firstDecode = deferred<AudioBuffer>()
    harness.context.decodeImpl = vi
      .fn()
      .mockImplementationOnce(() => firstDecode.promise)
      .mockResolvedValue(decodedBuffer())
    harness.transport.configure(session('cancel-pending'))

    const pendingPlay = harness.transport.play()
    await vi.waitFor(() =>
      expect(harness.context.decodeAudioData).toHaveBeenCalledOnce(),
    )
    expect(harness.transport.getStatus()).toBe('loading')

    harness.transport.pause()
    firstDecode.resolve(decodedBuffer())

    await expect(pendingPlay).resolves.toBe(false)
    expect(harness.context.sources).toHaveLength(0)
    expect(harness.transport.getStatus()).toBe('armed')

    await expect(harness.transport.play()).resolves.toBe(true)
    expect(harness.context.sources).toHaveLength(1)
    expect(harness.transport.getStatus()).toBe('playing')
  })

  it('stops active sources and closes its owned context exactly once', async () => {
    const harness = audioHarness()
    harness.transport.configure(session('dispose'))
    await harness.transport.play()
    const source = harness.context.sources[0]

    await harness.transport.dispose()
    await harness.transport.dispose()

    expect(source.stop).toHaveBeenCalledOnce()
    expect(source.disconnect).toHaveBeenCalledOnce()
    expect(harness.context.close).toHaveBeenCalledOnce()
  })
})

describe('haltAudible — every stop path closes the bus first', () => {
  const closeOps = (when: number): ParameterOperation[] => [
    { kind: 'cancel', when },
    { kind: 'set', value: 1, when },
    { kind: 'target', value: 0, when, timeConstant: 0.012 },
  ]

  it('keeps a pausing voice wired until its scheduled stop fires', async () => {
    const harness = audioHarness()
    harness.transport.configure(session('deferred', [track('drums')]))
    await harness.transport.play()
    const source = harness.context.sources[0]!
    harness.context.currentTime = 13

    harness.transport.pause()

    // The stop is scheduled past the bus close…
    expect(source.stop).toHaveBeenLastCalledWith(13.08)
    // …and disconnect() is immediate, so it must NOT happen now — that
    // would cut the material at open gain, the pop the close prevents.
    expect(source.disconnect).not.toHaveBeenCalled()
    source.onended?.()
    expect(source.disconnect).toHaveBeenCalled()
  })

  it('closes the stems bus before a streamed pause and holds the element for the tail', async () => {
    vi.useFakeTimers()
    try {
      const harness = audioHarness({ memoryBudgetBytes: 1 })
      harness.transport.configure(session('streamed-pause'))
      await expect(harness.transport.play()).resolves.toBe(true)
      expect(harness.transport.getLoadMode()).toBe('streamed')
      const stems = harness.transport.getAudioGraph()!.buses
        .stems as unknown as FakeGainNode
      stems.gain.operations.length = 0
      harness.context.currentTime = 12
      // Element pauses during arming don't count; only the one after ours.
      const pausesBefore = harness.mediaElements[0]!.pause.mock.calls.length

      harness.transport.pause()

      expect(stems.gain.operations).toEqual(closeOps(12))
      // The element keeps feeding the closing bus until the tail is silent.
      expect(harness.mediaElements[0]!.pause.mock.calls.length).toBe(
        pausesBefore,
      )
      vi.advanceTimersByTime(100)
      expect(harness.mediaElements[0]!.pause.mock.calls.length).toBe(
        pausesBefore + 1,
      )
      expect(harness.transport.getStatus()).toBe('paused')
    } finally {
      vi.useRealTimers()
    }
  })

  it('stop() mid-play closes the bus; from silence it halts immediately', async () => {
    const harness = audioHarness()
    harness.transport.configure(session('full-stop', [track('drums')]))
    await harness.transport.play()
    const stems = harness.transport.getAudioGraph()!.buses
      .stems as unknown as FakeGainNode
    const source = harness.context.sources[0]!
    stems.gain.operations.length = 0
    harness.context.currentTime = 15

    harness.transport.stop()

    expect(stems.gain.operations).toEqual(closeOps(15))
    expect(source.stop).toHaveBeenLastCalledWith(15.08)

    // A second stop from the silent state has nothing to close.
    stems.gain.operations.length = 0
    harness.transport.stop()
    expect(stems.gain.operations).toEqual([])
  })

  it('disconnects immediately when a scheduled stop cannot be taken', async () => {
    const harness = audioHarness()
    harness.transport.configure(session('stubborn', [track('drums')]))
    await harness.transport.play()
    const source = harness.context.sources[0]!
    source.stop.mockImplementation(() => {
      throw new DOMException('already ended')
    })

    harness.transport.pause()

    // No onended will ever fire for a source that refused the stop; the
    // teardown must not leak on that path.
    expect(source.disconnect).toHaveBeenCalled()
  })

  it('halts bare when stopped before any graph exists', () => {
    const harness = audioHarness()
    harness.transport.configure(session('never-played', [track('drums')]))
    harness.transport.stop()
    expect(harness.transport.getStatus()).toBe('armed')
    expect(harness.context.gains).toHaveLength(0)
  })

  it('a seek past the end closes the bus before completing', async () => {
    const harness = audioHarness()
    harness.transport.configure(session('seek-end', [track('drums')]))
    await harness.transport.play()
    const stems = harness.transport.getAudioGraph()!.buses
      .stems as unknown as FakeGainNode
    const source = harness.context.sources[0]!
    stems.gain.operations.length = 0
    harness.context.currentTime = 16

    harness.transport.seek(9999)

    expect(stems.gain.operations).toEqual(closeOps(16))
    expect(source.stop).toHaveBeenLastCalledWith(16.08)
    expect(harness.transport.getStatus()).toBe('complete')
  })
})

// ============================================================
// The stem download the transport does for itself
// ============================================================
//
// Every test above injects `fetchArrayBuffer`, so the default — the one
// that actually runs in the room — was never exercised. It matters now:
// the remote demo song is served with no Cache-Control at all, and
// without a copy of its own the room re-downloads the whole thing on
// every open.

class FakeCache {
  readonly entries = new Map<string, Response>()

  async match(key: RequestInfo | URL): Promise<Response | undefined> {
    return Promise.resolve(this.entries.get(String(key))?.clone())
  }

  async put(key: RequestInfo | URL, value: Response): Promise<void> {
    this.entries.set(String(key), value)
    return Promise.resolve()
  }

  async keys(): Promise<Request[]> {
    return Promise.resolve(
      [...this.entries.keys()].map((url) => ({ url }) as unknown as Request),
    )
  }

  async delete(): Promise<boolean> {
    return Promise.resolve(true)
  }
}

const REMOTE = 'https://cdn.example/demo/goodbye-to-spring/instrumental.m4a'

function downloadingHarness(response: () => Response) {
  const cache = new FakeCache()
  Object.defineProperty(globalThis, 'caches', {
    value: { open: async () => Promise.resolve(cache) },
    configurable: true,
    writable: true,
  })
  const fetchStub = vi.fn(async () => Promise.resolve(response()))
  vi.stubGlobal('fetch', fetchStub)

  const context = new FakeAudioContext()
  const transport = createGuitarBackingTransport({
    contextFactory: () => context as unknown as AudioContext,
    activateContext: async (audioContext) => {
      await audioContext.resume()
    },
    mediaElementFactory: () =>
      new FakeMediaElement() as unknown as HTMLAudioElement,
    fadeSeconds: 0,
    scheduleLeadSeconds: 0.012,
  })
  return { cache, context, fetchStub, transport }
}

afterEach(() => {
  Reflect.deleteProperty(globalThis as unknown as object, 'caches')
  vi.unstubAllGlobals()
})

describe('the transport downloads a remote stem once', () => {
  it('keeps a copy the first time and reads it the second', async () => {
    const harness = downloadingHarness(() => new Response(new Uint8Array(2048)))
    harness.transport.configure(
      session('demo', [track('drums', { url: REMOTE })]),
    )

    await expect(harness.transport.play()).resolves.toBe(true)
    expect(harness.fetchStub).toHaveBeenCalledTimes(1)
    expect(harness.cache.entries.has(REMOTE)).toBe(true)

    // A second open of the same song — the whole point of the copy.
    harness.transport.configure(
      session('demo-again', [track('drums', { url: REMOTE })]),
    )
    await expect(harness.transport.play()).resolves.toBe(true)
    expect(harness.fetchStub).toHaveBeenCalledTimes(1)
  })

  it('reports a stem the server would not give', async () => {
    const harness = downloadingHarness(() => new Response('', { status: 404 }))
    harness.transport.configure(
      session('missing', [track('drums', { url: REMOTE })]),
    )

    await expect(harness.transport.play()).resolves.toBe(false)
    expect(harness.transport.getStatus()).toBe('error')
    expect(harness.cache.entries.size).toBe(0)
  })

  it('keeps no copy of a stem that was already on the device', async () => {
    const harness = downloadingHarness(() => new Response(new Uint8Array(2048)))
    // blob: stems are IndexedDB audio the app already holds, and their URLs
    // stop resolving the moment the lease is released.
    harness.transport.configure(session('local', [track('drums')]))

    await expect(harness.transport.play()).resolves.toBe(true)
    expect(harness.cache.entries.size).toBe(0)
  })
})

// ============================================================
// What the room can show while a song is still arriving
// ============================================================
//
// An uncached demo song is eight megabytes over whatever connection the
// player has, and the room's only sign of it was a dimmed Play button —
// which is what a broken button looks like too. The transport now reads
// the body a chunk at a time and publishes what has landed.

/** A response whose body arrives in `parts`, released one at a time. */
function chunkedResponse(
  parts: readonly Uint8Array[],
  options: { declareLength?: boolean } = {},
): { response: Response; releaseNext: () => void; sent: () => number } {
  let index = 0
  let release: (() => void) | null = null
  const gate = (): Promise<void> =>
    new Promise((resolve) => {
      release = resolve
    })
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (index >= parts.length) {
        controller.close()
        return
      }
      await gate()
      controller.enqueue(parts[index])
      index += 1
    },
  })
  const total = parts.reduce((sum, part) => sum + part.byteLength, 0)
  return {
    response: new Response(stream, {
      headers:
        options.declareLength === false
          ? {}
          : { 'content-length': String(total) },
    }),
    releaseNext: () => {
      const pending = release
      release = null
      pending?.()
    },
    sent: () => index,
  }
}

describe('a download the room can watch', () => {
  it('publishes bytes as they land and clears them when the song is ready', async () => {
    const parts = [new Uint8Array(1024), new Uint8Array(1024)]
    const body = chunkedResponse(parts)
    const harness = downloadingHarness(() => body.response)
    const seen: (number | null)[] = []
    harness.transport.subscribe(() => {
      seen.push(harness.transport.getLoadProgress()?.fraction ?? null)
    })
    harness.transport.configure(
      session('demo', [track('drums', { url: REMOTE })]),
    )

    const playing = harness.transport.play()
    // One chunk at a time, so the published figure has to be the running
    // one rather than the final one.
    await vi.waitFor(() => {
      body.releaseNext()
      expect(body.sent()).toBe(1)
    })
    await vi.waitFor(() => {
      body.releaseNext()
      expect(body.sent()).toBe(2)
    })
    body.releaseNext()
    await expect(playing).resolves.toBe(true)

    // Half the declared length, published while the other half was still
    // on the wire. Reporting only on completion would never produce this.
    expect(seen).toContain(0.5)
    // And the load owns its own progress: once ready there is none.
    expect(harness.transport.getLoadProgress()).toBeNull()
  })

  it('counts the bytes it has when the server declares no length', async () => {
    const body = chunkedResponse([new Uint8Array(2048)], {
      declareLength: false,
    })
    const harness = downloadingHarness(() => body.response)
    const declared: number[] = []
    harness.transport.subscribe(() => {
      const progress = harness.transport.getLoadProgress()
      if (progress !== null) declared.push(progress.totalBytes)
    })
    harness.transport.configure(
      session('demo', [track('drums', { url: REMOTE })]),
    )

    const playing = harness.transport.play()
    await vi.waitFor(() => {
      body.releaseNext()
      expect(body.sent()).toBeGreaterThan(0)
    })
    body.releaseNext()
    await expect(playing).resolves.toBe(true)

    // A total nobody stated is 0, never a guess — the room shows a turning
    // ring for this case instead of a percentage it would have invented.
    expect(declared.some((total) => total === 0)).toBe(true)
  })

  it('still loads a response with no streaming body at all', async () => {
    // A test double, or a browser without ReadableStream on Response.
    const harness = downloadingHarness(() => {
      const response = new Response(new Uint8Array(2048))
      Object.defineProperty(response, 'body', { value: null })
      return response
    })
    harness.transport.configure(
      session('demo', [track('drums', { url: REMOTE })]),
    )

    await expect(harness.transport.play()).resolves.toBe(true)
    expect(harness.cache.entries.has(REMOTE)).toBe(true)
  })

  it('carries no progress into the next load', async () => {
    const harness = downloadingHarness(() => new Response(new Uint8Array(2048)))
    harness.transport.configure(
      session('demo', [track('drums', { url: REMOTE })]),
    )
    await expect(harness.transport.play()).resolves.toBe(true)

    expect(harness.transport.getLoadProgress()).toBeNull()
  })
})
