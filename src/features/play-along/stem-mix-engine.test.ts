// ============================================================
// Play-along stem mix engine tests — one-clock scheduling and bounded ownership
// ============================================================

import { describe, expect, it, vi } from 'vitest'
import type { PlayAlongStemAsset, PlayAlongStemLease, PlayAlongStemMixEngineOptions, } from './stem-mix-engine'
import { createPlayAlongStemMixEngine, estimatePlayAlongStemPcmBytes, } from './stem-mix-engine'

interface ParameterOperation {
  kind: 'cancel' | 'exponential' | 'hold' | 'linear' | 'set' | 'target'
  value?: number
  when: number
  timeConstant?: number
}

class FakeAudioParameter {
  value = 1
  readonly operations: ParameterOperation[] = []

  cancelAndHoldAtTime(when: number): void {
    this.operations.push({ kind: 'hold', when })
  }

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

  exponentialRampToValueAtTime(value: number, when: number): void {
    this.value = value
    this.operations.push({ kind: 'exponential', value, when })
  }

  setTargetAtTime(value: number, when: number, timeConstant: number): void {
    this.value = value
    this.operations.push({ kind: 'target', value, when, timeConstant })
  }
}

class FakeOutputNode {
  readonly disconnect = vi.fn()
}

class FakeGainNode {
  readonly gain = new FakeAudioParameter()
  readonly connect = vi.fn((destination: unknown) => destination)
  readonly disconnect = vi.fn()
}

class FakeBufferSourceNode {
  buffer: AudioBuffer | null = null
  onended: (() => void) | null = null
  readonly playbackRate = new FakeAudioParameter()
  readonly connect = vi.fn((destination: unknown) => destination)
  readonly disconnect = vi.fn()
  readonly start = vi.fn((_when?: number, _offset?: number) => undefined)
  readonly stop = vi.fn((_when?: number) => undefined)

  end(): void {
    this.onended?.()
  }
}

function decodedBuffer(
  duration = 12,
  channels = 2,
  sampleRate = 48_000,
): AudioBuffer {
  return {
    duration,
    length: Math.ceil(duration * sampleRate),
    numberOfChannels: channels,
    sampleRate,
  } as unknown as AudioBuffer
}

class FakeAudioContext {
  currentTime = 10
  sampleRate = 48_000
  readonly gains: FakeGainNode[] = []
  readonly sources: FakeBufferSourceNode[] = []
  decodeImpl: (encoded: ArrayBuffer) => Promise<AudioBuffer> = async () =>
    decodedBuffer()
  readonly decodeAudioData = vi.fn((encoded: ArrayBuffer) =>
    this.decodeImpl(encoded),
  )

  createGain(): GainNode {
    const gain = new FakeGainNode()
    this.gains.push(gain)
    return gain as unknown as GainNode
  }

  createBufferSource(): AudioBufferSourceNode {
    const source = new FakeBufferSourceNode()
    this.sources.push(source)
    return source as unknown as AudioBufferSourceNode
  }
}

function stem(
  id: string,
  overrides: Partial<PlayAlongStemAsset> = {},
): PlayAlongStemAsset {
  return {
    id,
    label: id === 'drums' ? 'Drums' : 'Band',
    bus: id === 'drums' ? 'drums' : 'backing',
    url: `blob:${id}`,
    sizeBytes: 8,
    durationSeconds: 12,
    channelCount: 2,
    ...overrides,
  }
}

function lease(
  id: string,
  stems: readonly PlayAlongStemAsset[] = [stem('drums'), stem('band')],
): PlayAlongStemLease {
  return { id, stems, release: vi.fn() }
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

function harness(overrides: Partial<PlayAlongStemMixEngineOptions> = {}): {
  context: FakeAudioContext
  output: FakeOutputNode
  getAudioContext: ReturnType<typeof vi.fn>
  getOutput: ReturnType<typeof vi.fn>
  fetchArrayBuffer: ReturnType<typeof vi.fn>
  engine: ReturnType<typeof createPlayAlongStemMixEngine>
} {
  const context = new FakeAudioContext()
  const output = new FakeOutputNode()
  const getAudioContext = vi.fn(() => context as unknown as AudioContext)
  const getOutput = vi.fn(() => output as unknown as AudioNode)
  const fetchArrayBuffer = vi.fn(
    async (
      asset: PlayAlongStemAsset,
      _signal: AbortSignal,
      onProgress: (received: number, total: number) => void,
    ) => {
      onProgress(2, asset.sizeBytes)
      onProgress(asset.sizeBytes, asset.sizeBytes)
      return new ArrayBuffer(asset.sizeBytes)
    },
  )
  const engine = createPlayAlongStemMixEngine({
    getAudioContext,
    getOutput,
    fetchArrayBuffer,
    decodedMemoryBudgetBytes: 64 * 1024 * 1024,
    encodedLoadBudgetBytes: 1024 * 1024,
    ...overrides,
  })
  return {
    context,
    output,
    getAudioContext,
    getOutput,
    fetchArrayBuffer,
    engine,
  }
}

describe('createPlayAlongStemMixEngine', () => {
  it('keeps construction and configuration inert, then releases one owned lease once', () => {
    const room = harness()
    const prepared = lease('quiet-entry')
    const onChange = vi.fn()
    const unsubscribe = room.engine.subscribe(onChange)

    room.engine.configure(prepared)

    expect(room.getAudioContext).not.toHaveBeenCalled()
    expect(room.getOutput).not.toHaveBeenCalled()
    expect(room.fetchArrayBuffer).not.toHaveBeenCalled()
    expect(room.context.decodeAudioData).not.toHaveBeenCalled()
    expect(room.engine.getStatus()).toBe('configured')
    expect(room.engine.getDurationSeconds()).toBe(12)
    expect(room.engine.getTrackStates()).toEqual([
      {
        id: 'drums',
        label: 'Drums',
        bus: 'drums',
        muted: false,
        level: 1,
        available: false,
      },
      {
        id: 'band',
        label: 'Band',
        bus: 'backing',
        muted: false,
        level: 1,
        available: false,
      },
    ])
    expect(onChange).toHaveBeenCalledOnce()

    room.engine.configure(null)
    room.engine.dispose()
    room.engine.dispose()
    expect(prepared.release).toHaveBeenCalledOnce()
    expect(room.output.disconnect).not.toHaveBeenCalled()
    unsubscribe()
  })

  it('reports bounded fetch/decode progress and builds one shared output graph', async () => {
    const room = harness()
    const snapshots: number[] = []
    room.engine.subscribe(() => {
      const current = room.engine.getProgress()
      if (current !== null) snapshots.push(current.fraction)
    })
    room.engine.configure(lease('progress'))

    await expect(room.engine.load()).resolves.toBe(true)

    expect(room.getAudioContext).toHaveBeenCalledOnce()
    expect(room.getOutput).toHaveBeenCalledOnce()
    expect(room.fetchArrayBuffer).toHaveBeenCalledTimes(2)
    expect(room.context.decodeAudioData).toHaveBeenCalledTimes(2)
    expect(room.engine.getStatus()).toBe('ready')
    expect(room.engine.getProgress()).toMatchObject({
      phase: 'complete',
      loadedTracks: 2,
      totalTracks: 2,
      receivedBytes: 16,
      declaredBytes: 16,
      fraction: 1,
    })
    expect(room.engine.getTrackStates().every((track) => track.available)).toBe(
      true,
    )
    expect(snapshots.every((value) => value >= 0 && value <= 1)).toBe(true)
    expect(snapshots).toEqual(
      [...snapshots].sort((left, right) => left - right),
    )
    expect(room.context.gains[0].connect).toHaveBeenCalledWith(room.output)
    expect(room.context.gains[1].connect).toHaveBeenCalledWith(room.output)
    expect(room.output.disconnect).not.toHaveBeenCalled()
  })

  it('sample-aligns every source to the route clock, offset, and rate', async () => {
    const room = harness()
    room.engine.configure(lease('aligned'))
    await room.engine.load()

    expect(
      room.engine.start({
        atContextTime: 12.5,
        sourceOffsetSeconds: 3.25,
        playbackRate: 0.75,
      }),
    ).toBe(true)

    expect(room.context.sources).toHaveLength(2)
    for (const source of room.context.sources) {
      expect(source.start).toHaveBeenCalledWith(12.5, 3.25)
      expect(source.playbackRate.operations).toContainEqual({
        kind: 'set',
        value: 0.75,
        when: 12.5,
      })
    }
    const voiceEnvelopes = room.context.gains.slice(-2)
    for (const envelope of voiceEnvelopes) {
      expect(envelope.gain.operations).toContainEqual({
        kind: 'set',
        value: 0.0001,
        when: 12.5,
      })
      expect(envelope.gain.operations).toContainEqual({
        kind: 'exponential',
        value: 1,
        when: 12.59,
      })
    }
    expect(room.engine.getStatus()).toBe('playing')
  })

  it('loads a three-minute reconstructed mix within budget and subtracts the same drum buffer on the shared clock', async () => {
    const decodedBudgetBytes = 256 * 1024 * 1024
    const room = harness({ decodedMemoryBudgetBytes: decodedBudgetBytes })
    room.context.decodeImpl = async () => decodedBuffer(180)
    const reconstructedStems = [
      stem('vocal', { durationSeconds: 180 }),
      stem('instrumental', {
        durationSeconds: 180,
        subtractAssetId: 'drums',
      }),
      stem('drums', { durationSeconds: 180 }),
    ] as const
    room.engine.configure(
      lease('three-minute-reconstruction', reconstructedStems),
    )

    expect(estimatePlayAlongStemPcmBytes(reconstructedStems)).toBeLessThan(
      decodedBudgetBytes,
    )
    await expect(room.engine.load()).resolves.toBe(true)
    expect(room.context.decodeAudioData).toHaveBeenCalledTimes(3)

    const instrumentalTrackGain = room.context.gains[3]
    const subtractionGain = room.context.gains[4]
    expect(subtractionGain?.gain.value).toBe(-1)
    expect(subtractionGain?.connect).toHaveBeenCalledWith(instrumentalTrackGain)

    expect(
      room.engine.start({
        atContextTime: 12.5,
        sourceOffsetSeconds: 4.25,
        playbackRate: 0.8,
      }),
    ).toBe(true)
    expect(room.context.sources).toHaveLength(4)
    const cancellationSource = room.context.sources[2]
    const positiveDrumSource = room.context.sources[3]
    expect(cancellationSource?.buffer).toBe(positiveDrumSource?.buffer)
    expect(cancellationSource?.start).toHaveBeenCalledWith(12.5, 4.25, 175.75)
    for (const source of room.context.sources.filter(
      (candidate) => candidate !== cancellationSource,
    )) {
      expect(source.start).toHaveBeenCalledWith(12.5, 4.25)
    }
    for (const source of room.context.sources) {
      expect(source.playbackRate.operations).toContainEqual({
        kind: 'set',
        value: 0.8,
        when: 12.5,
      })
    }

    room.engine.pause(15)
    for (const source of room.context.sources) {
      expect(source.stop).toHaveBeenCalledWith(15.24)
    }
  })

  it('ends the inverted drum send with its shorter backing parent', async () => {
    const room = harness()
    const decodedDurations = [8, 12]
    room.context.decodeImpl = async () =>
      decodedBuffer(decodedDurations.shift() ?? 12)
    room.engine.configure(
      lease('shorter-parent', [
        stem('instrumental', { subtractAssetId: 'drums' }),
        stem('drums'),
      ]),
    )

    await expect(room.engine.load()).resolves.toBe(true)
    expect(
      room.engine.start({
        atContextTime: 12.5,
        sourceOffsetSeconds: 2,
        playbackRate: 1,
      }),
    ).toBe(true)

    const cancellationSource = room.context.sources[1]
    const positiveDrumSource = room.context.sources[2]
    expect(cancellationSource?.buffer).toBe(positiveDrumSource?.buffer)
    expect(cancellationSource?.start).toHaveBeenCalledWith(12.5, 2, 6)
    expect(positiveDrumSource?.start).toHaveBeenCalledWith(12.5, 2)
  })

  it('releases pause and stop tails, while seek restarts every source at one point', async () => {
    const room = harness()
    room.engine.configure(lease('transport'))
    await room.engine.load()
    room.engine.start({
      atContextTime: 12,
      sourceOffsetSeconds: 2,
      playbackRate: 1,
    })
    const firstSources = room.context.sources.slice()
    const firstEnvelopes = room.context.gains.slice(-2)

    room.engine.pause(15)

    expect(room.engine.getStatus()).toBe('paused')
    for (const envelope of firstEnvelopes) {
      expect(envelope.gain.operations).toContainEqual({
        kind: 'target',
        value: 0,
        when: 15,
        timeConstant: 0.036,
      })
    }
    for (const source of firstSources) {
      expect(source.stop).toHaveBeenCalledWith(15.24)
    }

    expect(
      room.engine.start({
        atContextTime: 16,
        sourceOffsetSeconds: 5,
        playbackRate: 1,
      }),
    ).toBe(true)
    const resumedSources = room.context.sources.slice(-2)
    for (const source of resumedSources) {
      expect(source.start).toHaveBeenCalledWith(16, 5)
    }

    expect(
      room.engine.seek({
        atContextTime: 17,
        sourceOffsetSeconds: 8,
        playbackRate: 1.25,
      }),
    ).toBe(true)
    const soughtSources = room.context.sources.slice(-2)
    const soughtEnvelopes = room.context.gains.slice(-2)
    for (const source of resumedSources) {
      expect(source.stop).toHaveBeenCalledWith(17.075)
    }
    for (const source of soughtSources) {
      expect(source.start).toHaveBeenCalledWith(17, 8)
    }
    for (const envelope of soughtEnvelopes) {
      expect(envelope.gain.operations).toContainEqual({
        kind: 'linear',
        value: 1,
        when: 17.015,
      })
    }

    expect(
      room.engine.seek({
        atContextTime: Number.NaN,
        sourceOffsetSeconds: 1,
        playbackRate: 1,
      }),
    ).toBe(false)
    for (const source of soughtSources) {
      expect(source.stop).not.toHaveBeenCalled()
    }

    room.engine.stop(18)
    expect(room.engine.getStatus()).toBe('stopped')
    for (const source of soughtSources) {
      expect(source.stop).toHaveBeenCalledWith(18.24)
    }
  })

  it.each(['pause', 'reconfigure', 'dispose'] as const)(
    'pulls every scheduled generation forward when %s happens before a future seek seam',
    async (action) => {
      const room = harness()
      const prepared = lease(`future-seam-${action}`)
      room.context.currentTime = 0
      room.engine.configure(prepared)
      await room.engine.load()
      room.engine.start({
        atContextTime: 0,
        sourceOffsetSeconds: 0,
        playbackRate: 1,
      })
      const audibleSources = room.context.sources.slice()

      room.engine.seek({
        atContextTime: 10,
        sourceOffsetSeconds: 4,
        playbackRate: 1,
      })
      const futureSources = room.context.sources.slice(-2)
      for (const source of audibleSources) {
        expect(source.stop.mock.calls.at(-1)?.[0]).toBeCloseTo(10.075)
      }
      expect(
        futureSources.every((source) => source.start.mock.calls[0]?.[0] === 10),
      ).toBe(true)

      room.context.currentTime = 2
      if (action === 'pause') room.engine.pause(2)
      else if (action === 'reconfigure') room.engine.configure(null)
      else room.engine.dispose()

      for (const source of [...audibleSources, ...futureSources]) {
        expect(source.stop.mock.calls.at(-1)?.[0]).toBeCloseTo(2.24)
      }
      for (const envelope of room.context.gains.slice(-4)) {
        expect(envelope.gain.operations.at(-1)).toEqual({
          kind: 'target',
          value: 0,
          when: 2,
          timeConstant: 0.036,
        })
      }

      room.engine.dispose()
      expect(prepared.release).toHaveBeenCalledOnce()
    },
  )

  it('smooths per-track and aggregate Drums/Backing bus controls', async () => {
    const room = harness()
    room.engine.configure(
      lease('mix', [
        stem('drums', { muted: true, level: 0.25 }),
        stem('band', { level: 0.8 }),
      ]),
    )
    await room.engine.load()
    const drumsBus = room.context.gains[0]
    const backingBus = room.context.gains[1]
    const drumsTrack = room.context.gains[2]
    const backingTrack = room.context.gains[3]
    expect(drumsTrack.gain.value).toBe(0)
    expect(backingTrack.gain.value).toBe(0.8)

    room.context.currentTime = 20
    room.engine.setTrackMuted('drums', false)
    room.engine.setTrackLevel('band', 0.4)
    room.engine.setBusMuted('drums', true)
    room.engine.setBusLevel('backing', 0.3)

    expect(room.engine.getTrackStates()).toMatchObject([
      { id: 'drums', muted: false, level: 0.25 },
      { id: 'band', muted: false, level: 0.4 },
    ])
    expect(room.engine.getBusStates()).toEqual([
      { bus: 'drums', muted: true, level: 1 },
      { bus: 'backing', muted: false, level: 0.3 },
    ])
    expect(drumsTrack.gain.operations.at(-1)).toEqual({
      kind: 'target',
      value: 0.25,
      when: 20,
      timeConstant: 0.012,
    })
    expect(backingTrack.gain.operations.at(-1)).toEqual({
      kind: 'target',
      value: 0.4,
      when: 20,
      timeConstant: 0.012,
    })
    expect(drumsBus.gain.operations.at(-1)).toEqual({
      kind: 'target',
      value: 0,
      when: 20,
      timeConstant: 0.012,
    })
    expect(backingBus.gain.operations.at(-1)).toEqual({
      kind: 'target',
      value: 0.3,
      when: 20,
      timeConstant: 0.012,
    })
  })

  it('aborts stale loads, releases replacements once, and fades active voices on teardown', async () => {
    const pending = deferred<ArrayBuffer>()
    const room = harness({
      fetchArrayBuffer: vi.fn(
        async (asset: PlayAlongStemAsset, signal: AbortSignal) => {
          if (asset.url === 'blob:slow') {
            await pending.promise
            if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
          }
          return new ArrayBuffer(8)
        },
      ),
    })
    const first = lease('first', [stem('slow')])
    const second = lease('second', [stem('drums')])
    room.engine.configure(first)
    const staleLoad = room.engine.load()
    await Promise.resolve()

    room.engine.configure(second)
    pending.resolve(new ArrayBuffer(8))
    await expect(staleLoad).resolves.toBe(false)
    expect(first.release).toHaveBeenCalledOnce()

    await expect(room.engine.load()).resolves.toBe(true)
    room.engine.start({
      atContextTime: 12,
      sourceOffsetSeconds: 0,
      playbackRate: 1,
    })
    const activeSource = room.context.sources.at(-1)!
    room.context.currentTime = 13
    room.engine.configure(null)
    room.engine.dispose()
    room.engine.dispose()

    expect(second.release).toHaveBeenCalledOnce()
    expect(activeSource.stop).toHaveBeenCalledWith(13.24)
    expect(room.output.disconnect).not.toHaveBeenCalled()
    activeSource.end()
    expect(activeSource.disconnect).toHaveBeenCalledOnce()
    expect(room.context.gains[3].disconnect).toHaveBeenCalledOnce()
    expect(room.context.gains[0].disconnect).toHaveBeenCalledOnce()
    expect(room.context.gains[1].disconnect).toHaveBeenCalledOnce()
  })

  it('refuses an estimated decoded mix before touching audio or the network', async () => {
    const room = harness({ decodedMemoryBudgetBytes: 1024 * 1024 })
    const oversized = stem('drums', {
      durationSeconds: 300,
      channelCount: 2,
    })
    room.engine.configure(lease('oversized', [oversized]))

    await expect(room.engine.load()).resolves.toBe(false)

    expect(room.getAudioContext).not.toHaveBeenCalled()
    expect(room.getOutput).not.toHaveBeenCalled()
    expect(room.fetchArrayBuffer).not.toHaveBeenCalled()
    expect(room.context.decodeAudioData).not.toHaveBeenCalled()
    expect(room.engine.getStatus()).toBe('error')
    expect(room.engine.getError()).toMatchObject({
      code: 'memory-budget',
      budgetBytes: 1024 * 1024,
    })
    expect(room.engine.getError()?.message).toContain('decoded')
    expect(estimatePlayAlongStemPcmBytes([oversized])).toBeGreaterThan(
      1024 * 1024,
    )
  })

  it('decodes the fetched buffer in place instead of copying it first', async () => {
    // decodeAudioData detaches its input; passing the exact fetched buffer
    // (no slice) means each stem exists once, not twice, during decode.
    const fetched: ArrayBuffer[] = []
    const room = harness({
      fetchArrayBuffer: vi.fn(async (asset: PlayAlongStemAsset) => {
        const buffer = new ArrayBuffer(asset.sizeBytes)
        fetched.push(buffer)
        return buffer
      }),
    })
    room.engine.configure(lease('in-place', [stem('drums')]))

    await expect(room.engine.load()).resolves.toBe(true)

    expect(room.context.decodeAudioData).toHaveBeenCalledOnce()
    expect(room.context.decodeAudioData.mock.calls[0]?.[0]).toBe(fetched[0])
  })

  it('decodes at a reduced rate rather than refusing a mix that just overflows', async () => {
    // 240 s stereo at 48 kHz is 87.9 MiB; the same stem at 32 kHz is 58.6 MiB.
    const budget = 70 * 1024 * 1024
    const decodeContexts: number[] = []
    const room = harness({
      decodedMemoryBudgetBytes: budget,
      createDecodeContext: (sampleRate: number) => {
        decodeContexts.push(sampleRate)
        return {
          decodeAudioData: async () => decodedBuffer(240, 2, sampleRate),
        } as unknown as BaseAudioContext
      },
    })
    room.engine.configure(
      lease('reduced', [
        stem('drums', { durationSeconds: 240, channelCount: 2 }),
      ]),
    )

    await expect(room.engine.load()).resolves.toBe(true)

    expect(decodeContexts).toEqual([32_000])
    expect(room.context.decodeAudioData).not.toHaveBeenCalled()
    expect(room.engine.getReducedFidelity()).toEqual({
      sampleRate: 32_000,
      mono: false,
    })
    expect(room.engine.getStatus()).toBe('ready')
  })

  it('keeps native fidelity when the mix already fits', async () => {
    const createDecodeContext = vi.fn(() => null)
    const room = harness({ createDecodeContext })
    room.engine.configure(lease('native'))

    await expect(room.engine.load()).resolves.toBe(true)

    expect(createDecodeContext).not.toHaveBeenCalled()
    expect(room.context.decodeAudioData).toHaveBeenCalledTimes(2)
    expect(room.engine.getReducedFidelity()).toBeNull()
  })

  it('names the reduced requirement when even the lowest tier overflows', async () => {
    const room = harness({ decodedMemoryBudgetBytes: 1024 * 1024 })
    room.engine.configure(
      lease('hopeless', [
        stem('drums', { durationSeconds: 300, channelCount: 2 }),
      ]),
    )

    await expect(room.engine.load()).resolves.toBe(false)

    // 300 s mono at 24 kHz is still 27.5 MiB against a 1 MiB budget.
    expect(room.engine.getError()?.message).toContain(
      'Even at reduced quality it still needs about 28 MB',
    )
    expect(room.engine.getReducedFidelity()).toBeNull()
  })

  it('refuses an unexpectedly large decode instead of falling back to media elements', async () => {
    const room = harness({ decodedMemoryBudgetBytes: 1024 })
    room.context.decodeImpl = async () => decodedBuffer(1, 2, 1000)
    room.engine.configure(
      lease('decode-growth', [
        stem('drums', {
          durationSeconds: 0.001,
          channelCount: 1,
          sizeBytes: 1,
        }),
      ]),
    )

    await expect(room.engine.load()).resolves.toBe(false)

    expect(room.context.decodeAudioData).toHaveBeenCalledOnce()
    expect(room.engine.getError()).toMatchObject({
      code: 'memory-budget',
      requiredBytes: 8000,
      budgetBytes: 1024,
    })
    expect(room.context.sources).toHaveLength(0)
  })
})
