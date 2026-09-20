// Merc narration tests — real controller races around fake browser transport and audio clocks.
import { resetSharedAudioContext, sharedAudioContextOwners, suspendSharedAudioContext, } from '@irchiinnuss/audio-io/shared-audio-context'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createBrowserMercNarration } from './merc-narration'

class ParamFake {
  setValueAtTime = vi.fn()
  exponentialRampToValueAtTime = vi.fn()
  setTargetAtTime = vi.fn()
  cancelScheduledValues = vi.fn()
}
class NodeFake {
  gain = new ParamFake()
  buffer: AudioBuffer | null = null
  onended: (() => void) | null = null
  connect = vi.fn((node: NodeFake) => node)
  disconnect = vi.fn()
  start = vi.fn<(when?: number) => void>()
  stop = vi.fn<(when?: number) => void>()
}

function buffer(): AudioBuffer {
  return {
    numberOfChannels: 1,
    length: 1000,
    sampleRate: 1000,
    getChannelData: () => new Float32Array(1000),
  } as unknown as AudioBuffer
}
class ContextFake extends EventTarget {
  state = 'running'
  currentTime = 0
  destination = new NodeFake()
  gains: NodeFake[] = []
  sources: NodeFake[] = []
  resume = vi.fn(async () => {
    this.state = 'running'
  })
  suspend = vi.fn(async () => {
    this.state = 'suspended'
    this.dispatchEvent(new Event('statechange'))
  })
  close = vi.fn(async () => undefined)
  decodeAudioData = vi.fn(async () => buffer())
  createGain = () => {
    const node = new NodeFake()
    this.gains.push(node)
    return node
  }
  createBufferSource = () => {
    const node = new NodeFake()
    this.sources.push(node)
    return node
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
const flush = async () => {
  for (let index = 0; index < 12; index++) await Promise.resolve()
}
type AudioResponse = { ok: boolean; arrayBuffer(): Promise<ArrayBuffer> }
type AudioFetch = (
  url: string,
  init: { signal: AbortSignal },
) => Promise<AudioResponse>

let context: ContextFake
let contextsCreated: number
let stored: string | null
let fetcher: ReturnType<typeof vi.fn<AudioFetch>>
const options = {
  assetUrl: (id: string) => `/assets/${id}.mp3`,
  readPreference: (_key: string) => stored,
  writePreference: vi.fn((_key: string, value: string) => {
    stored = value
  }),
}

beforeEach(() => {
  vi.useFakeTimers()
  stored = null
  contextsCreated = 0
  options.writePreference.mockClear()
  context = new ContextFake()
  resetSharedAudioContext({
    createContext: () => {
      contextsCreated++
      return context as unknown as AudioContext
    },
  })
  fetcher = vi.fn<AudioFetch>().mockResolvedValue({
    ok: true,
    arrayBuffer: async () => new ArrayBuffer(16),
  })
  vi.stubGlobal('fetch', fetcher)
})
afterEach(() => {
  resetSharedAudioContext()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('Merc narration', () => {
  it('stays lazy until a gesture and maps the approved tutorial cue', async () => {
    const narration = createBrowserMercNarration(options)
    expect(contextsCreated).toBe(0)

    const started = narration.play('tutorial-note')

    expect(contextsCreated).toBe(1)
    expect(context.resume).toHaveBeenCalledOnce()
    expect(fetcher).toHaveBeenCalledWith(
      '/assets/merc-voice-welcome.mp3',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
    await expect(started).resolves.toBe(true)
    expect(context.sources[0].start).toHaveBeenCalledWith(0)
    expect(
      context.gains[0].gain.exponentialRampToValueAtTime,
    ).toHaveBeenCalledWith(1, 0.018)

    narration.dispose()
    await vi.advanceTimersByTimeAsync(120)
    expect(sharedAudioContextOwners()).toHaveLength(0)
  })

  it('invalidates pending decode before microphone capture and ignores its late result', async () => {
    const decoded = deferred<AudioBuffer>()
    context.decodeAudioData.mockImplementation(() => decoded.promise)
    const narration = createBrowserMercNarration(options)
    const started = narration.play('required-break')
    await flush()
    expect(context.decodeAudioData).toHaveBeenCalledOnce()

    await narration.silenceForVoice()

    await expect(started).resolves.toBe(false)
    decoded.resolve(buffer())
    await flush()
    expect(context.sources).toHaveLength(0)
    expect(sharedAudioContextOwners()).toHaveLength(0)
    narration.dispose()
  })

  it('waits for the active cue release before reporting microphone-safe silence', async () => {
    const narration = createBrowserMercNarration(options)
    await expect(narration.play('required-break')).resolves.toBe(true)
    let silent = false

    const quiet = narration.silenceForVoice().then(() => {
      silent = true
    })

    expect(context.gains[0].gain.setTargetAtTime).toHaveBeenCalledWith(
      0,
      0,
      0.024,
    )
    expect(context.sources[0].stop).toHaveBeenCalledWith(0.12)
    await vi.advanceTimersByTimeAsync(119)
    expect(silent).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    await quiet
    expect(silent).toBe(true)
    expect(sharedAudioContextOwners()).toHaveLength(0)
    narration.dispose()
  })

  it('replaces a pending cue without letting its late transport speak', async () => {
    const late = deferred<AudioResponse>()
    fetcher
      .mockImplementationOnce(() => late.promise)
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(16),
      })
    const narration = createBrowserMercNarration(options)
    const oldCue = narration.play('tutorial-note')
    const oldSignal = fetcher.mock.calls[0][1].signal

    const newCue = narration.play('optional-break')

    expect(oldSignal.aborted).toBe(true)
    await expect(oldCue).resolves.toBe(false)
    await expect(newCue).resolves.toBe(true)
    expect(fetcher.mock.calls[1][0]).toBe(
      '/assets/merc-voice-optional-break.mp3',
    )
    expect(context.sources).toHaveLength(1)
    late.resolve({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(16),
    })
    await flush()
    expect(context.sources).toHaveLength(1)

    narration.dispose()
    await vi.advanceTimersByTimeAsync(120)
  })

  it('waits for an outgoing tail when microphone silence cancels its replacement', async () => {
    const late = deferred<AudioResponse>()
    const narration = createBrowserMercNarration(options)
    await expect(narration.play('tutorial-note')).resolves.toBe(true)
    fetcher.mockImplementationOnce(() => late.promise)
    const replacement = narration.play('required-break')
    let silent = false

    const quiet = narration.silenceForVoice().then(() => {
      silent = true
    })

    await expect(replacement).resolves.toBe(false)
    await vi.advanceTimersByTimeAsync(119)
    expect(silent).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    await quiet
    expect(silent).toBe(true)
    expect(sharedAudioContextOwners()).toHaveLength(0)
    late.resolve({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(16),
    })
    await flush()
    expect(context.sources).toHaveLength(1)
    narration.dispose()
  })

  it('waits for every older tail before a third cue begins', async () => {
    const lateMiddle = deferred<AudioResponse>()
    const narration = createBrowserMercNarration(options)
    await expect(narration.play('tutorial-note')).resolves.toBe(true)
    fetcher.mockImplementationOnce(() => lateMiddle.promise)
    const middle = narration.play('required-break')

    const newest = narration.play('optional-break')

    await expect(middle).resolves.toBe(false)
    await flush()
    expect(context.sources).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(119)
    expect(context.sources).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1)
    await expect(newest).resolves.toBe(true)
    expect(context.sources).toHaveLength(2)
    lateMiddle.resolve({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(16),
    })
    await flush()
    expect(context.sources).toHaveLength(2)

    narration.dispose()
    await vi.advanceTimersByTimeAsync(120)
  })

  it('expires a stalled start and never plays a late success cue', async () => {
    const late = deferred<AudioResponse>()
    fetcher.mockImplementation(() => late.promise)
    const narration = createBrowserMercNarration(options)
    const started = narration.play('required-break')
    const signal = fetcher.mock.calls[0][1].signal

    await vi.advanceTimersByTimeAsync(1800)

    expect(signal.aborted).toBe(true)
    await expect(started).resolves.toBe(false)
    expect(sharedAudioContextOwners()).toHaveLength(0)
    late.resolve({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(16),
    })
    await flush()
    expect(context.sources).toHaveLength(0)
    narration.dispose()
  })

  it('persists an isolated opt-out and does no audio work while disabled', async () => {
    stored = '{"enabled":false}'
    const narration = createBrowserMercNarration(options)
    const snapshot = narration.preferences()
    snapshot.enabled = true
    expect(narration.preferences()).toEqual({ enabled: false })

    await expect(narration.play('tutorial-note')).resolves.toBe(false)
    expect(contextsCreated).toBe(0)
    expect(fetcher).not.toHaveBeenCalled()

    narration.setPreferences({ enabled: true })
    expect(options.writePreference).toHaveBeenLastCalledWith(
      'merc-narration:v1',
      '{"enabled":true}',
    )
    await expect(narration.play('optional-break')).resolves.toBe(true)
    narration.setPreferences({ enabled: false })
    await vi.advanceTimersByTimeAsync(120)
    expect(sharedAudioContextOwners()).toHaveLength(0)
    narration.dispose()
  })

  it('releases its shared audio owner before background suspension completes', async () => {
    const narration = createBrowserMercNarration(options)
    await expect(narration.play('required-break')).resolves.toBe(true)

    suspendSharedAudioContext()

    await vi.advanceTimersByTimeAsync(119)
    expect(context.suspend).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(context.suspend).toHaveBeenCalledOnce()
    expect(sharedAudioContextOwners()).toHaveLength(0)
    narration.dispose()
  })

  it('turns transport and decode failures into a false result', async () => {
    context.decodeAudioData.mockRejectedValue(new Error('bad audio'))
    const narration = createBrowserMercNarration(options)

    await expect(narration.play('required-break')).resolves.toBe(false)

    expect(context.sources).toHaveLength(0)
    expect(sharedAudioContextOwners()).toHaveLength(0)
    narration.dispose()
  })

  it('turns synchronous audio setup failure into a false result', async () => {
    context.createGain = () => {
      throw new Error('audio graph unavailable')
    }
    const narration = createBrowserMercNarration(options)

    await expect(narration.play('required-break')).resolves.toBe(false)

    expect(fetcher).not.toHaveBeenCalled()
    expect(sharedAudioContextOwners()).toHaveLength(0)
    narration.dispose()
  })
})
