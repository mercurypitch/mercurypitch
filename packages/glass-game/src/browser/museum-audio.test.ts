// Museum audio tests — actual controller and shared leases around deferred transport and audio clocks.
import { resetSharedAudioContext, sharedAudioContextOwners, suspendSharedAudioContext, } from '@irchiinnuss/audio-io/shared-audio-context'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createBrowserMuseumAudio } from './museum-audio'

class ParamFake {
  setValueAtTime = vi.fn()
  exponentialRampToValueAtTime = vi.fn()
  setTargetAtTime = vi.fn()
  cancelScheduledValues = vi.fn()
}
class NodeFake {
  gain = new ParamFake()
  buffer: AudioBuffer | null = null
  loop = false
  onended: (() => void) | null = null
  connect = vi.fn((node: NodeFake) => node)
  disconnect = vi.fn()
  start = vi.fn<(when?: number, offset?: number) => void>()
  stop = vi.fn()
}

function buffer(channels = 2, length = 1000, sampleRate = 1000): AudioBuffer {
  const data = Array.from({ length: channels }, () =>
    new Float32Array(length).fill(0.1),
  )
  return {
    numberOfChannels: channels,
    length,
    sampleRate,
    getChannelData: (channel: number) => data[channel],
  } as AudioBuffer
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
  createBuffer = buffer
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
  for (let n = 0; n < 15; n++) await Promise.resolve()
}
let context: ContextFake
let stored: string | null
type AudioResponse = { ok: boolean; arrayBuffer(): Promise<ArrayBuffer> }
type AudioFetch = (
  url: string,
  init: { signal: AbortSignal },
) => Promise<AudioResponse>
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
  options.writePreference.mockClear()
  context = new ContextFake()
  resetSharedAudioContext({
    createContext: () => context as unknown as AudioContext,
  })
  fetcher = vi.fn<AudioFetch>().mockResolvedValue({
    ok: true,
    arrayBuffer: async () => new ArrayBuffer(4),
  })
  vi.stubGlobal('fetch', fetcher)
})
afterEach(() => {
  resetSharedAudioContext()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('approved museum soundtrack', () => {
  it('survives the previous last lease queued suspension while its fresh unlock is pending', async () => {
    const resumed = deferred<undefined>()
    context.resume.mockImplementation(() => resumed.promise)
    const music = createBrowserMuseumAudio(options)
    const start = music.start()
    context.state = 'suspended'
    context.dispatchEvent(new Event('statechange'))
    context.state = 'running'
    resumed.resolve(undefined)
    expect(await start).toBe(true)
    expect(context.sources).toHaveLength(2)
    music.dispose()
    await vi.advanceTimersByTimeAsync(240)
  })

  it('unlocks in the initiating gesture, loads only M01/A01 and deduplicates repeated scene requests', async () => {
    const music = createBrowserMuseumAudio(options)
    const first = music.start()
    expect(context.resume).toHaveBeenCalledOnce()
    expect(music.start()).toBe(first)
    expect(await first).toBe(true)
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      '/assets/audio-m01-loop.mp3',
      '/assets/audio-a01-loop.mp3',
    ])
    expect(context.sources).toHaveLength(2)
    expect(context.sources.every((source) => source.loop)).toBe(true)
    expect(
      context.gains[0].gain.exponentialRampToValueAtTime,
    ).toHaveBeenCalledWith(1, 0.6)
    await music.start()
    expect(context.sources).toHaveLength(2)
    music.dispose()
    await vi.advanceTimersByTimeAsync(240)
    expect(sharedAudioContextOwners()).toHaveLength(0)
  })

  it('uses the approved garden score and water basin ambience for the journey map', async () => {
    const music = createBrowserMuseumAudio(options)

    expect(await music.start('journey')).toBe(true)
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      '/assets/audio-m03-loop.mp3',
      '/assets/audio-a02-loop.mp3',
    ])

    music.dispose()
    await vi.advanceTimersByTimeAsync(240)
  })

  it('waits for physical silence before handing the microphone its capture permission', async () => {
    const music = createBrowserMuseumAudio(options)
    await music.start()
    let silent = false
    const handoff = music.silenceForVoice().then(() => {
      silent = true
    })
    expect(context.gains[0].gain.setTargetAtTime).toHaveBeenCalledWith(
      0,
      0,
      0.036,
    )
    await vi.advanceTimersByTimeAsync(239)
    expect(silent).toBe(false)
    expect(context.sources[0].disconnect).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    await handoff
    expect(silent).toBe(true)
    expect(
      context.sources.every(
        (source) => source.disconnect.mock.calls.length === 1,
      ),
    ).toBe(true)
    context.state = 'running'
    context.dispatchEvent(new Event('statechange'))
    await flush()
    expect(context.sources).toHaveLength(2)
    music.dispose()
  })

  it('cancels a pending decode immediately and never plays its late result into the mic', async () => {
    const decoded = deferred<AudioBuffer>()
    context.decodeAudioData.mockImplementation(() => decoded.promise)
    const music = createBrowserMuseumAudio(options)
    const start = music.start()
    await flush()
    expect(context.decodeAudioData).toHaveBeenCalledTimes(2)
    await music.silenceForVoice()
    expect(await start).toBe(false)
    decoded.resolve(buffer())
    await flush()
    expect(context.sources).toHaveLength(0)
    expect(sharedAudioContextOwners()).toHaveLength(0)
    music.dispose()
  })

  it('bounds a hanging unlock or transport and cleans its lease without a late start', async () => {
    const unlock = deferred<undefined>()
    context.resume.mockImplementation(() => unlock.promise)
    const music = createBrowserMuseumAudio(options)
    const start = music.start()
    await vi.advanceTimersByTimeAsync(15_000)
    expect(await start).toBe(false)
    expect(sharedAudioContextOwners()).toHaveLength(0)
    unlock.resolve(undefined)
    await flush()
    expect(context.sources).toHaveLength(0)
    music.dispose()
  })

  it('aborts a transport that ignores cancellation and cannot decode its late payload', async () => {
    const payload = deferred<{
      ok: boolean
      arrayBuffer: () => Promise<ArrayBuffer>
    }>()
    fetcher.mockImplementation(() => payload.promise)
    const music = createBrowserMuseumAudio(options)
    const start = music.start()
    await flush()
    const signal = fetcher.mock.calls[0][1].signal as AbortSignal
    music.pause()
    expect(signal.aborted).toBe(true)
    expect(await start).toBe(false)
    payload.resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) })
    await flush()
    expect(context.decodeAudioData).not.toHaveBeenCalled()
    expect(sharedAudioContextOwners()).toHaveLength(0)
    music.dispose()
  })

  it('anchors a mid-attack release at the actual scheduled gain and never extends its deadline', async () => {
    const music = createBrowserMuseumAudio(options)
    await music.start()
    context.currentTime = 0.3
    music.pause()
    expect(context.gains[0].gain.setValueAtTime).toHaveBeenLastCalledWith(
      0.01,
      0.3,
    )
    await vi.advanceTimersByTimeAsync(100)
    music.pause()
    await vi.advanceTimersByTimeAsync(140)
    expect(context.sources[0].disconnect).toHaveBeenCalledOnce()
    expect(sharedAudioContextOwners()).toHaveLength(0)
    music.dispose()
  })

  it('lets the shared context suspend only once its entire release has completed', async () => {
    const music = createBrowserMuseumAudio(options)
    await music.start()
    suspendSharedAudioContext()
    await vi.advanceTimersByTimeAsync(239)
    expect(context.suspend).not.toHaveBeenCalled()
    expect(context.sources[0].disconnect).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(context.suspend).toHaveBeenCalledOnce()
    expect(context.sources[0].disconnect).toHaveBeenCalledOnce()
    expect(sharedAudioContextOwners()).toHaveLength(0)
    music.dispose()
  })

  it('retains the old scene while the garden loads and fades only after both replacements are ready', async () => {
    const music = createBrowserMuseumAudio(options)
    await music.start()
    const delayed = deferred<AudioBuffer>()
    context.decodeAudioData.mockImplementation(() => delayed.promise)
    const change = music.start('garden')
    await flush()
    expect(context.sources).toHaveLength(2)
    expect(context.sources[0].stop).not.toHaveBeenCalled()
    delayed.resolve(buffer())
    expect(await change).toBe(true)
    expect(context.sources).toHaveLength(4)
    expect(context.sources[0].stop).toHaveBeenCalledWith(0.24)
    expect(context.sources[2].stop).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(240)
    expect(context.sources[0].disconnect).toHaveBeenCalledOnce()
    expect(context.sources[2].disconnect).not.toHaveBeenCalled()
    music.dispose()
    await vi.advanceTimersByTimeAsync(240)
  })

  it('keeps the newest scene when an older delayed garden load finishes afterwards', async () => {
    const music = createBrowserMuseumAudio(options)
    await music.start()
    const delayed = deferred<AudioBuffer>()
    context.decodeAudioData.mockImplementationOnce(() => delayed.promise)
    const stale = music.start('garden')
    await flush()
    const current = music.start('gallery')
    expect(await current).toBe(true)
    expect(await stale).toBe(false)
    delayed.resolve(buffer())
    await flush()
    expect(context.sources).toHaveLength(4)
    music.dispose()
    await vi.advanceTimersByTimeAsync(240)
  })

  it('cannot let an old release disconnect or suspend a newer start', async () => {
    const music = createBrowserMuseumAudio(options)
    await music.start()
    const cancelled = expect(music.silenceForVoice()).rejects.toThrow(
      'cancelled',
    )
    await vi.advanceTimersByTimeAsync(100)
    expect(await music.start()).toBe(true)
    await vi.advanceTimersByTimeAsync(140)
    await cancelled
    expect(context.sources[0].disconnect).toHaveBeenCalledOnce()
    expect(context.sources[2].disconnect).not.toHaveBeenCalled()
    expect(context.suspend).not.toHaveBeenCalled()
    music.dispose()
    await vi.advanceTimersByTimeAsync(240)
  })

  it('resumes each track from its release position after voice silence rather than repeating its introduction', async () => {
    const music = createBrowserMuseumAudio(options)
    await music.start()
    context.currentTime = 1.45
    const silence = music.silenceForVoice()
    await vi.advanceTimersByTimeAsync(240)
    await silence
    context.currentTime = 3
    expect(await music.start()).toBe(true)
    expect(context.sources[2].start.mock.calls[0][0]).toBe(3)
    expect(context.sources[2].start.mock.calls[0][1]).toBeCloseTo(0.53)
    expect(context.sources[3].start.mock.calls[0][1]).toBeCloseTo(0.53)
    music.dispose()
    await vi.advanceTimersByTimeAsync(240)
  })

  it('takes the shared M01 playhead when the replacement scene is ready, and ignores stale decode positions', async () => {
    const music = createBrowserMuseumAudio(options)
    await music.start()
    context.currentTime = 0.2
    const staleDecode = deferred<AudioBuffer>()
    context.decodeAudioData.mockImplementationOnce(() => staleDecode.promise)
    const stale = music.start('garden')
    await flush()
    context.currentTime = 0.7
    expect(await music.start('gallery')).toBe(true)
    expect(context.sources[2].start.mock.calls[0][1]).toBeCloseTo(0.7)
    expect(context.sources[3].start.mock.calls[0][1]).toBe(0)
    expect(await stale).toBe(false)
    context.currentTime = 1.5
    staleDecode.resolve(buffer())
    await flush()
    const silence = music.silenceForVoice()
    await vi.advanceTimersByTimeAsync(240)
    await silence
    expect(await music.start('gallery')).toBe(true)
    expect(context.sources[4].start.mock.calls[0][1]).toBeCloseTo(0.58)
    expect(context.sources[5].start.mock.calls[0][1]).toBeCloseTo(0.8)
    music.dispose()
    await vi.advanceTimersByTimeAsync(240)
  })

  it('grants shared suspension a bounded tail then discards it permanently on interruption', async () => {
    const music = createBrowserMuseumAudio(options)
    await music.start()
    suspendSharedAudioContext()
    expect(context.suspend).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(100)
    context.state = 'interrupted'
    context.dispatchEvent(new Event('statechange'))
    expect(context.sources[0].disconnect).toHaveBeenCalledOnce()
    expect(sharedAudioContextOwners()).toHaveLength(0)
    context.state = 'running'
    context.dispatchEvent(new Event('statechange'))
    await vi.advanceTimersByTimeAsync(1000)
    expect(context.sources).toHaveLength(2)
    music.dispose()
  })

  it('cancels pending decode on native background before an active graph exists', async () => {
    const delayed = deferred<AudioBuffer>()
    context.decodeAudioData.mockImplementation(() => delayed.promise)
    const music = createBrowserMuseumAudio(options)
    const start = music.start()
    await flush()
    suspendSharedAudioContext()
    expect(await start).toBe(false)
    delayed.resolve(buffer())
    await flush()
    expect(context.sources).toHaveLength(0)
    expect(sharedAudioContextOwners()).toHaveLength(0)
    music.dispose()
  })

  it('persists clamped volumes, ramps live edits and does not unmute during a voice handoff', async () => {
    stored = '{"musicVolume":10,"ambienceVolume":-2,"muted":false}'
    const music = createBrowserMuseumAudio(options)
    expect(music.preferences()).toEqual({
      muted: false,
      musicVolume: 1,
      ambienceVolume: 0,
    })
    await music.start()
    music.setPreferences({ musicVolume: 0.3, ambienceVolume: 0.2 })
    expect(context.gains[1].gain.setTargetAtTime).toHaveBeenCalledWith(
      0.3,
      0,
      0.024,
    )
    expect(JSON.parse(stored!)).toEqual(music.preferences())
    const silence = music.silenceForVoice()
    music.setPreferences({ muted: true })
    music.setPreferences({ muted: false })
    await vi.advanceTimersByTimeAsync(240)
    await silence
    expect(context.sources).toHaveLength(2)
    music.dispose()
  })

  it('restores a muted exploration only on explicit unmute and keeps settings snapshots isolated', async () => {
    stored = '{"muted":true}'
    const music = createBrowserMuseumAudio(options)
    expect(await music.start()).toBe(true)
    expect(fetcher).not.toHaveBeenCalled()
    music.preferences().muted = false
    expect(music.preferences().muted).toBe(true)
    music.setPreferences({ muted: false })
    await flush()
    expect(context.sources).toHaveLength(2)
    music.pause()
    await vi.advanceTimersByTimeAsync(240)
    music.setPreferences({ muted: true })
    music.setPreferences({ muted: false })
    await flush()
    expect(context.sources).toHaveLength(2)
    music.dispose()
  })

  it('fails optional audio cleanly on unavailable context or failed asset, and tolerates blocked storage', async () => {
    resetSharedAudioContext({ createContext: () => undefined })
    const unavailable = createBrowserMuseumAudio(options)
    expect(await unavailable.start()).toBe(false)
    await unavailable.silenceForVoice()
    unavailable.dispose()
    resetSharedAudioContext({
      createContext: () => context as unknown as AudioContext,
    })
    fetcher.mockResolvedValue({
      ok: false,
      arrayBuffer: async () => new ArrayBuffer(4),
    })
    const music = createBrowserMuseumAudio({
      ...options,
      readPreference: () => {
        throw new Error('private')
      },
      writePreference: () => {
        throw new Error('private')
      },
    })
    expect(await music.start()).toBe(false)
    expect(() =>
      music.setPreferences({ musicVolume: Number.NaN }),
    ).not.toThrow()
    expect(music.preferences().musicVolume).toBe(0.65)
    expect(sharedAudioContextOwners()).toHaveLength(0)
    music.dispose()
  })
})
