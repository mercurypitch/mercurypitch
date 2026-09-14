// Character voice output regressions — retired starts and independent fade tails.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AudioSourceVariant } from '../content/audio-manifest'
import { createVoiceAudioOutput } from './voice-audio-output'

const source: AudioSourceVariant = {
  src: 'audio/voice/en/the-scroll/meet.m4a',
  mimeType: 'audio/mp4',
  sha256: 'a'.repeat(64),
  byteLength: 100,
  durationMs: 2_000,
  sampleRateHz: 48_000,
  channels: 1,
}

const buffer = {
  duration: 2,
  length: 96_000,
  numberOfChannels: 1,
} as AudioBuffer

class FakeSource {
  buffer: AudioBuffer | null = null
  loop = false
  onended: (() => void) | null = null
  readonly connect = vi.fn()
  readonly disconnect = vi.fn()
  readonly start = vi.fn()
  readonly stop = vi.fn()
}

class FakeGain {
  readonly gain = {
    value: 1,
    cancelScheduledValues: vi.fn(),
    cancelAndHoldAtTime: vi.fn(),
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
  }
  readonly connect = vi.fn()
  readonly disconnect = vi.fn()
}

class FakeContext extends EventTarget {
  state: AudioContextState = 'suspended'
  readonly currentTime = 10
  readonly destination = {}
  readonly sources: FakeSource[] = []
  readonly gains: FakeGain[] = []
  readonly decodeAudioData = vi.fn(async () => buffer)
  readonly resume = vi.fn(async () => {
    this.state = 'running'
  })
  readonly close = vi.fn(async () => {
    this.state = 'closed'
  })

  createBufferSource(): FakeSource {
    const node = new FakeSource()
    this.sources.push(node)
    return node
  }

  createGain(): FakeGain {
    const node = new FakeGain()
    this.gains.push(node)
    return node
  }
}

function audioBoundary() {
  const context = new FakeContext()
  const createContext = vi.fn(() => context as unknown as AudioContext)
  const fetchArrayBuffer = vi.fn(
    async (_url: string, _signal: AbortSignal) => new ArrayBuffer(8),
  )
  const supportsMimeType = vi.fn((mimeType: string) => mimeType === 'audio/mp4')
  const port = createVoiceAudioOutput({
    createContext,
    fetchArrayBuffer,
    supportsMimeType,
    resolveAssetUrl: (src) => `/packaged/${src}`,
  })
  return { port, context, createContext, fetchArrayBuffer, supportsMimeType }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.runOnlyPendingTimers()
  vi.useRealTimers()
})

describe('character voice audio output', () => {
  it('resumes in the gesture and releases a full-gain one-shot without cutting its graph', async () => {
    const { port, context, createContext, fetchArrayBuffer, supportsMimeType } =
      audioBoundary()
    expect(port.supportsMimeType('audio/mp4')).toBe(true)
    expect(port.supportsMimeType('audio/unsupported')).toBe(false)
    expect(supportsMimeType).toHaveBeenCalledWith('audio/mp4')
    expect(createContext).not.toHaveBeenCalled()

    const cue = port.play(source)
    expect(context.resume).toHaveBeenCalledOnce()
    await expect(cue.started).resolves.toBeUndefined()
    expect(fetchArrayBuffer).toHaveBeenCalledWith(
      `/packaged/${source.src}`,
      expect.any(AbortSignal),
    )
    const node = context.sources[0]!
    expect(node.start).toHaveBeenCalledOnce()
    expect(node.loop).toBe(false)
    expect(context.gains[1]!.gain.setValueAtTime).toHaveBeenCalledWith(1, 10)

    cue.stop()
    await expect(cue.finished).resolves.toBe('stopped')
    expect(context.gains[0]!.gain.setTargetAtTime).toHaveBeenCalledWith(
      0,
      10,
      expect.any(Number),
    )
    expect(node.stop.mock.calls[0]![0]).toBeGreaterThan(context.currentTime)
    expect(node.disconnect).not.toHaveBeenCalled()
    node.onended?.()
    expect(node.disconnect).toHaveBeenCalledOnce()
    port.dispose()
  })

  it('never fetches or starts a handle stopped immediately after play', async () => {
    const { port, context, fetchArrayBuffer } = audioBoundary()
    const cue = port.play(source)
    const started = expect(cue.started).rejects.toThrow()
    cue.stop()
    await started
    await expect(cue.finished).resolves.toBe('stopped')
    expect(fetchArrayBuffer).not.toHaveBeenCalled()
    expect(context.sources).toHaveLength(0)
    port.dispose()
  })

  it.each(['stop', 'dispose'] as const)(
    'rejects a pending decode after %s without creating a source',
    async (action) => {
      const { port, context, fetchArrayBuffer } = audioBoundary()
      let resolveDecode!: (value: AudioBuffer) => void
      let notifyDecode!: () => void
      const decoding = new Promise<void>((resolve) => {
        notifyDecode = resolve
      })
      context.decodeAudioData.mockImplementation(() => {
        notifyDecode()
        return new Promise<AudioBuffer>((resolve) => {
          resolveDecode = resolve
        })
      })
      const cue = port.play(source)
      const started = expect(cue.started).rejects.toThrow()
      await decoding
      if (action === 'stop') cue.stop()
      else port.dispose()
      resolveDecode(buffer)
      await started
      await expect(cue.finished).resolves.toBe('stopped')
      expect(fetchArrayBuffer.mock.calls[0]![1].aborted).toBe(true)
      expect(context.sources).toHaveLength(0)
      port.dispose()
    },
  )

  it('starts only the latest same-asset handle and ignores repeated stale stops', async () => {
    const { port, context } = audioBoundary()
    const first = port.play(source)
    const retired = expect(first.started).rejects.toThrow()
    first.stop()
    const latest = port.play(source)
    await Promise.all([retired, latest.started])
    expect(context.sources).toHaveLength(1)
    expect(context.sources[0]!.start).toHaveBeenCalledOnce()
    first.stop()
    expect(context.sources[0]!.stop).not.toHaveBeenCalled()
    context.sources[0]!.onended?.()
    await expect(latest.finished).resolves.toBe('ended')
    port.dispose()
  })

  it('rejects failed starts so the voice player can try another source', async () => {
    const port = createVoiceAudioOutput({ createContext: () => undefined })
    const cue = port.play(source)
    await expect(cue.started).rejects.toThrow()
    await expect(cue.finished).resolves.toBe('failed')
    port.dispose()
  })

  it('rejects future playback after disposal without creating a context', () => {
    const { port, createContext } = audioBoundary()
    port.dispose()
    expect(() => port.play(source)).toThrow('disposed')
    expect(port.supportsMimeType(source.mimeType)).toBe(false)
    expect(createContext).not.toHaveBeenCalled()
  })
})
