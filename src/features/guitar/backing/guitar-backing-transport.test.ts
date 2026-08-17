// ============================================================
// Guitar backing transport tests protect one-clock playback, safe replacement, and bounded decoding
// ============================================================

import { describe, expect, it, vi } from 'vitest'
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
  currentTime = 0
  duration = 240
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
        level: 1,
        available: true,
      },
      {
        id: 'guitar',
        label: 'Guitar',
        muted: true,
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
    await new Promise((resolve) => setTimeout(resolve, 0))

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
    // A seek is not a load: the transport controls stay live throughout.
    expect(harness.transport.getStatus()).toBe('playing')
    expect(harness.transport.getCurrentTime()).toBeCloseTo(7.25)
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
    for (const element of harness.mediaElements) element.play.mockClear()

    harness.transport.seek(2)
    harness.transport.seek(4)
    harness.transport.seek(6.5)
    // The playhead reports where the finger is, not where the in-flight
    // re-prime is heading and not where the stalled element still reads.
    expect(harness.transport.getCurrentTime()).toBeCloseTo(6.5)
    await new Promise((resolve) => setTimeout(resolve, 0))

    for (const element of harness.mediaElements) {
      // Two re-primes, not three: the first, and the last position asked for.
      expect(element.play).toHaveBeenCalledTimes(2)
      expect(element.currentTime).toBe(6.5)
    }
    expect(harness.transport.getStatus()).toBe('playing')
  })

  it('lets a pause outrank a seek that is still in the air', async () => {
    const harness = audioHarness({ memoryBudgetBytes: 1 })
    harness.transport.configure(session('pause-wins'))
    await expect(harness.transport.play()).resolves.toBe(true)

    harness.transport.seek(5)
    harness.transport.pause()
    await new Promise((resolve) => setTimeout(resolve, 0))

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
    await new Promise((resolve) => setTimeout(resolve, 0))

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
