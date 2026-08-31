// ============================================================
// Decoded Voice Playback tests — terminal state and room graph contracts
// ============================================================

import { cleanup, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { VoiceTakeRecord } from '@/db/entities'
import type { FxSettings } from '@/lib/voice-fx-rack'
import type { DecodedVoicePlayback, DecodedVoicePlaybackAttemptOptions, } from './decoded-voice-playback'
import { attemptDecodedVoicePlayback, createDecodedVoicePlayback, shouldDecodeVoicePlayback, } from './decoded-voice-playback'
import { VoicePlaybackTransport } from './VoicePlaybackTransport'

const TAKE: VoiceTakeRecord = {
  id: 'take-webm',
  createdAt: '2026-08-28T08:00:00.000Z',
  updatedAt: '2026-08-28T08:00:00.000Z',
  capturedAt: '2026-08-28T08:00:00.000Z',
  source: 'freeform',
  comparisonKey: 'thread-1',
  contextVersion: 1,
  durationMs: 10_000,
  mimeType: 'audio/webm;codecs=opus',
  sizeBytes: 12_000,
  peaks: [0.1, 0.6, 0.3],
  title: 'Morning vowels',
  favorite: false,
  contextJson: '{}',
}

class FakeAudioParam {
  value = 0
  readonly cancelScheduledValues = vi.fn()
  readonly setValueAtTime = vi.fn((value: number) => {
    this.value = value
  })
  readonly exponentialRampToValueAtTime = vi.fn((value: number) => {
    this.value = value
  })
  readonly linearRampToValueAtTime = vi.fn((value: number) => {
    this.value = value
  })
  readonly setTargetAtTime = vi.fn((value: number) => {
    this.value = value
  })
}

class FakeGainNode {
  readonly gain = new FakeAudioParam()
  readonly connectedTo: unknown[] = []
  readonly disconnect = vi.fn()

  connect(target: unknown): unknown {
    this.connectedTo.push(target)
    return target
  }
}

class FakeBufferSourceNode {
  buffer: AudioBuffer | null = null
  onended: (() => void) | null = null
  readonly connectedTo: unknown[] = []
  readonly start = vi.fn()
  readonly stop = vi.fn()
  readonly disconnect = vi.fn()

  connect(target: unknown): unknown {
    this.connectedTo.push(target)
    return target
  }
}

class FakeAudioContext {
  currentTime = 0
  state: AudioContextState = 'running'
  failNextStart = false
  readonly gain = new FakeGainNode()
  readonly sources: FakeBufferSourceNode[] = []
  readonly resume = vi.fn(async () => {
    this.state = 'running'
  })
  readonly decodeAudioData = vi.fn(
    async (_encoded: ArrayBuffer) => ({ duration: 10 }) as AudioBuffer,
  )

  createGain(): GainNode {
    return this.gain as unknown as GainNode
  }

  createBufferSource(): AudioBufferSourceNode {
    const source = new FakeBufferSourceNode()
    if (this.failNextStart) {
      this.failNextStart = false
      source.start.mockImplementationOnce(() => {
        throw new Error('buffer source rejected')
      })
    }
    this.sources.push(source)
    return source as unknown as AudioBufferSourceNode
  }
}

function createFrameScheduler(): {
  request: (callback: FrameRequestCallback) => number
  cancel: (id: number) => void
  runNext: () => void
} {
  let nextId = 0
  const callbacks = new Map<number, FrameRequestCallback>()
  return {
    request: (callback) => {
      const id = ++nextId
      callbacks.set(id, callback)
      return id
    },
    cancel: (id) => {
      callbacks.delete(id)
    },
    runNext: () => {
      const entry = callbacks.entries().next().value as
        | [number, FrameRequestCallback]
        | undefined
      if (entry === undefined) return
      callbacks.delete(entry[0])
      entry[1](0)
    },
  }
}

function createAttemptHarness() {
  const context = new FakeAudioContext()
  const scheduler = createFrameScheduler()
  const rackInput = { name: 'room-input' } as unknown as AudioNode
  const setSettings = vi.fn<(settings: FxSettings) => void>()
  const disposeRack = vi.fn()
  let active: DecodedVoicePlayback | null = null
  const onPrepared = vi.fn((playback: DecodedVoicePlayback) => {
    active = playback
  })
  const onDiscarded = vi.fn((playback: DecodedVoicePlayback) => {
    if (active === playback) active = null
  })
  const baseOptions: DecodedVoicePlaybackAttemptOptions = {
    context: context as unknown as AudioContext,
    blob: {
      type: 'audio/webm;codecs=opus',
      arrayBuffer: vi.fn(async () => new ArrayBuffer(3)),
    } as unknown as Blob,
    persistedMimeType: 'audio/webm;codecs=opus',
    settings: { echo: 0, reverb: 0, hall: 0 },
    autoplay: true,
    isCurrent: () => true,
    onPrepared,
    onDiscarded,
    onProgress: vi.fn(),
    onPlayingChange: vi.fn(),
    onEnded: vi.fn(),
    onError: vi.fn(),
    playbackFactory: (options) =>
      createDecodedVoicePlayback({
        ...options,
        frameScheduler: scheduler,
        rackFactory: () => ({
          input: rackInput,
          setSettings,
          dispose: disposeRack,
        }),
      }),
  }
  return {
    context,
    disposeRack,
    onPrepared,
    onDiscarded,
    active: () => active,
    attempt: (overrides: Partial<DecodedVoicePlaybackAttemptOptions> = {}) =>
      attemptDecodedVoicePlayback({ ...baseOptions, ...overrides }),
  }
}

function createHarness(
  callbacks: {
    onProgress?: (progress: number) => void
    onPlayingChange?: (playing: boolean) => void
    onEnded?: () => void
    onError?: () => void
  } = {},
) {
  const context = new FakeAudioContext()
  const scheduler = createFrameScheduler()
  const rackInput = { name: 'room-input' } as unknown as AudioNode
  const setSettings = vi.fn<(settings: FxSettings) => void>()
  const disposeRack = vi.fn()
  const controller = createDecodedVoicePlayback({
    context: context as unknown as AudioContext,
    buffer: { duration: 10 } as AudioBuffer,
    settings: { echo: 0, reverb: 0, hall: 0 },
    onProgress: callbacks.onProgress ?? vi.fn(),
    onPlayingChange: callbacks.onPlayingChange ?? vi.fn(),
    onEnded: callbacks.onEnded ?? vi.fn(),
    onError: callbacks.onError,
    frameScheduler: scheduler,
    rackFactory: () => ({
      input: rackInput,
      setSettings,
      dispose: disposeRack,
    }),
  })
  return {
    context,
    scheduler,
    rackInput,
    setSettings,
    disposeRack,
    controller,
  }
}

describe('decoded voice playback', () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('returns a naturally ended take to Play at terminal progress', async () => {
    const [playing, setPlaying] = createSignal(false)
    const [progress, setProgress] = createSignal(0)
    const onEnded = vi.fn()
    const harness = createHarness({
      onProgress: setProgress,
      onPlayingChange: setPlaying,
      onEnded,
    })
    render(() => (
      <VoicePlaybackTransport
        take={TAKE}
        activeId={TAKE.id}
        progress={progress()}
        playing={playing()}
        eyebrow="Selected take"
        onPlay={() => void harness.controller.play()}
        onSeek={(_id, nextProgress) => harness.controller.seek(nextProgress)}
      />
    ))

    await harness.controller.play()
    expect(
      screen.getByRole('button', { name: 'Pause Morning vowels' }),
    ).toBeInTheDocument()

    harness.context.currentTime = 10
    harness.scheduler.runNext()

    expect(
      screen.getByRole('button', { name: 'Play Morning vowels' }),
    ).toBeInTheDocument()
    expect(
      (
        screen.getByRole('slider', {
          name: 'Seek Morning vowels',
        }) as HTMLInputElement
      ).value,
    ).toBe('1000')
    expect(onEnded).toHaveBeenCalledOnce()
  })

  it('routes app-owned recording containers through decoded room playback', async () => {
    const harness = createHarness()

    await harness.controller.play()
    harness.controller.setSettings({ echo: 8, reverb: 20, hall: 65 })

    expect(shouldDecodeVoicePlayback('audio/webm;codecs=opus')).toBe(true)
    expect(shouldDecodeVoicePlayback('video/webm')).toBe(true)
    expect(shouldDecodeVoicePlayback('audio/mp4')).toBe(true)
    expect(shouldDecodeVoicePlayback('video/mp4;codecs=mp4a.40.2')).toBe(true)
    expect(shouldDecodeVoicePlayback('audio/m4a')).toBe(true)
    expect(shouldDecodeVoicePlayback('audio/x-m4a')).toBe(true)
    expect(shouldDecodeVoicePlayback('audio/mpeg')).toBe(false)
    expect(harness.context.sources[0].connectedTo).toEqual([
      harness.context.gain,
    ])
    expect(harness.context.gain.connectedTo).toEqual([harness.rackInput])
    expect(harness.setSettings).toHaveBeenNthCalledWith(1, {
      echo: 0,
      reverb: 0,
      hall: 0,
    })
    expect(harness.setSettings).toHaveBeenLastCalledWith({
      echo: 8,
      reverb: 20,
      hall: 65,
    })
  })

  it('attempts decoded playback for an iOS MP4 take', async () => {
    const harness = createAttemptHarness()

    const result = await harness.attempt({
      autoplay: false,
      blob: {
        type: 'audio/mp4',
        arrayBuffer: vi.fn(async () => new ArrayBuffer(4)),
      } as unknown as Blob,
      persistedMimeType: 'video/mp4',
    })

    expect(result.status).toBe('handled')
    expect(harness.context.decodeAudioData).toHaveBeenCalledOnce()
    if (result.status === 'handled') result.playback.dispose()
  })

  it('keeps native playback available when MP4 decoding fails', async () => {
    const harness = createAttemptHarness()
    harness.context.decodeAudioData.mockRejectedValueOnce(
      new DOMException('Unsupported codec', 'EncodingError'),
    )

    const result = await harness.attempt({
      blob: {
        type: 'audio/mp4',
        arrayBuffer: vi.fn(async () => new ArrayBuffer(4)),
      } as unknown as Blob,
      persistedMimeType: 'audio/mp4',
    })

    expect(result).toEqual({ status: 'native-fallback' })
    expect(harness.onPrepared).not.toHaveBeenCalled()
  })

  it('restores stopped state when a decoded source cannot start', async () => {
    const onPlayingChange = vi.fn()
    const harness = createHarness({ onPlayingChange })
    harness.context.failNextStart = true

    await expect(harness.controller.play()).rejects.toThrow(
      'buffer source rejected',
    )

    expect(harness.controller.playing).toBe(false)
    expect(onPlayingChange.mock.calls).toEqual([[true], [false]])
    expect(harness.context.sources[0].stop).toHaveBeenCalledOnce()
    harness.controller.dispose()
    expect(harness.disposeRack).toHaveBeenCalledOnce()
  })

  it('disposes a failed decoded attempt before requesting native fallback', async () => {
    const harness = createAttemptHarness()
    harness.context.failNextStart = true

    const result = await harness.attempt()

    expect(result).toEqual({ status: 'native-fallback' })
    expect(harness.active()).toBeNull()
    expect(harness.onPrepared).toHaveBeenCalledOnce()
    expect(harness.onDiscarded).toHaveBeenCalledOnce()
    expect(harness.disposeRack).toHaveBeenCalledOnce()
  })

  it('keeps native fallback available when failed graph disposal also throws', async () => {
    const harness = createAttemptHarness()
    const dispose = vi.fn(() => {
      throw new Error('graph teardown rejected')
    })
    const failedPlayback: DecodedVoicePlayback = {
      playing: false,
      progress: 0,
      play: vi.fn(async () => {
        throw new Error('buffer source rejected')
      }),
      pause: vi.fn(),
      seek: vi.fn(),
      setSettings: vi.fn(),
      dispose,
    }

    const result = await harness.attempt({
      playbackFactory: () => failedPlayback,
    })

    expect(result).toEqual({ status: 'native-fallback' })
    expect(harness.active()).toBeNull()
    expect(harness.onDiscarded).toHaveBeenCalledWith(failedPlayback)
    expect(dispose).toHaveBeenCalledOnce()
  })

  it('prepares a requested scrub without autoplaying the decoded take', async () => {
    const harness = createAttemptHarness()

    const result = await harness.attempt({
      autoplay: false,
      requestedProgress: 0.4,
    })

    expect(result.status).toBe('handled')
    if (result.status !== 'handled') throw new Error('Expected handled result')
    expect(result.started).toBeNull()
    expect(result.playback.progress).toBe(0.4)
    expect(harness.context.sources).toHaveLength(0)
    result.playback.dispose()
  })

  it('disposes a decoded candidate when its request becomes stale', async () => {
    const harness = createAttemptHarness()
    let checks = 0

    const result = await harness.attempt({
      isCurrent: () => {
        checks += 1
        return checks < 3
      },
    })

    expect(result).toEqual({ status: 'cancelled' })
    expect(harness.onPrepared).not.toHaveBeenCalled()
    expect(harness.disposeRack).toHaveBeenCalledOnce()
  })

  it('swaps safely after a paused seek and releases before stopping', async () => {
    vi.useFakeTimers()
    const onPlayingChange = vi.fn()
    const harness = createHarness({ onPlayingChange })

    await harness.controller.play()
    const firstSource = harness.context.sources[0]
    harness.context.currentTime = 1
    harness.controller.pause()
    harness.controller.seek(0.5)
    await harness.controller.play()

    expect(firstSource.stop).not.toHaveBeenCalled()
    expect(harness.context.sources).toHaveLength(1)
    vi.advanceTimersByTime(20)
    expect(firstSource.stop).toHaveBeenCalledOnce()
    expect(harness.context.sources).toHaveLength(2)
    expect(harness.context.sources[1].start).toHaveBeenCalledWith(0, 5)

    harness.controller.seek(0.75)
    vi.advanceTimersByTime(20)
    const thirdSource = harness.context.sources[2]
    expect(harness.context.sources[1].stop).toHaveBeenCalledOnce()
    expect(thirdSource.start).toHaveBeenCalledWith(0, 7.5)

    harness.controller.pause()
    vi.advanceTimersByTime(239)
    expect(thirdSource.stop).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(thirdSource.stop).toHaveBeenCalledOnce()

    harness.controller.dispose()
    harness.controller.dispose()
    expect(harness.disposeRack).toHaveBeenCalledOnce()
    expect(onPlayingChange).toHaveBeenLastCalledWith(false)
  })

  it('stops cleanly when a delayed seek source cannot start', async () => {
    vi.useFakeTimers()
    const onPlayingChange = vi.fn()
    const onError = vi.fn()
    const harness = createHarness({ onPlayingChange, onError })
    await harness.controller.play()
    harness.controller.pause()
    harness.controller.seek(0.5)
    harness.context.failNextStart = true
    await harness.controller.play()

    expect(() => vi.advanceTimersByTime(20)).not.toThrow()

    expect(harness.controller.playing).toBe(false)
    expect(onPlayingChange).toHaveBeenLastCalledWith(false)
    expect(onError).toHaveBeenCalledOnce()
  })
})
