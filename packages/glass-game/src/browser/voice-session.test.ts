// Voice session tests — cancellation ownership and unsmoothed audio-clock observations.
import type { CapturedPitchFrame } from '@irchiinnuss/pitch-engine'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createBrowserVoice } from './voice-session'

const mocks = vi.hoisted(() => ({
  acquire: vi.fn(),
  release: vi.fn(),
  create: vi.fn(),
  audio: vi.fn(),
  recordTake: vi.fn(),
}))
vi.mock('./voice-take', () => ({ createBrowserVoiceTake: mocks.recordTake }))
vi.mock('@irchiinnuss/audio-io', () => ({
  acquireSharedAudioContext: mocks.audio,
}))
vi.mock('@irchiinnuss/pitch-engine', () => ({
  createF0Stream: mocks.create,
  micManager: { acquire: mocks.acquire, release: mocks.release },
}))

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
const context = Object.assign(new EventTarget(), {
  currentTime: 10,
  state: 'running',
})
const leases: {
  release: ReturnType<typeof vi.fn>
  unlock: ReturnType<typeof vi.fn>
}[] = []
let captured: CapturedPitchFrame | null
let callback: ((capture: CapturedPitchFrame) => void) | undefined
let unsubscribe: ReturnType<typeof vi.fn>
let dispose: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
  leases.length = 0
  captured = null
  callback = undefined
  context.currentTime = 10
  context.state = 'running'
  unsubscribe = vi.fn()
  dispose = vi.fn()
  mocks.audio.mockImplementation(() => {
    const lease = {
      release: vi.fn(),
      unlock: vi.fn().mockResolvedValue(true),
      ensure: () => context,
      peek: () => context,
    }
    leases.push(lease)
    return lease
  })
  mocks.acquire.mockResolvedValue({})
  mocks.create.mockImplementation(() => ({
    startTask: vi.fn(),
    latestCaptured: () => captured,
    dispose,
    subscribeCaptured: (listener: (capture: CapturedPitchFrame) => void) => {
      callback = listener
      return unsubscribe
    },
  }))
})

describe('browser voice ownership', () => {
  it('unlocks audio in the gesture and applies the chosen route before acquiring', async () => {
    const preparation = deferred<undefined>()
    const opened = vi.fn()
    const voice = createBrowserVoice({
      prepareMicrophone: () => preparation.promise,
      microphoneOpened: opened,
    })
    const pending = voice.start()
    expect(leases[0].unlock).toHaveBeenCalledOnce()
    expect(mocks.acquire).not.toHaveBeenCalled()
    preparation.resolve(undefined)
    await pending
    expect(mocks.acquire).toHaveBeenCalledOnce()
    expect(opened).toHaveBeenCalledOnce()
    voice.stop()
    expect(mocks.release).toHaveBeenCalledOnce()
  })

  it('does not acquire after cancellation while preparing the input route', async () => {
    const preparation = deferred<undefined>()
    const voice = createBrowserVoice({
      prepareMicrophone: () => preparation.promise,
    })
    const pending = voice.start()
    await Promise.resolve()
    voice.stop()
    preparation.resolve(undefined)
    await pending
    expect(mocks.acquire).not.toHaveBeenCalled()
    expect(mocks.create).not.toHaveBeenCalled()
    expect(leases[0].release).toHaveBeenCalledOnce()
  })

  it('does not change the route if cancelled before preparation begins', async () => {
    const prepareMicrophone = vi.fn().mockResolvedValue(undefined)
    const voice = createBrowserVoice({ prepareMicrophone })
    const pending = voice.start()
    voice.stop()
    await pending
    expect(prepareMicrophone).not.toHaveBeenCalled()
    expect(mocks.acquire).not.toHaveBeenCalled()
  })

  it('releases a successful acquisition even if input confirmation fails', async () => {
    const voice = createBrowserVoice({
      microphoneOpened: () => {
        throw new Error('Confirmation failed')
      },
    })
    await expect(voice.start()).rejects.toThrow('Confirmation failed')
    expect(mocks.release).toHaveBeenCalledOnce()
    expect(mocks.create).not.toHaveBeenCalled()
    expect(leases[0].release).toHaveBeenCalledOnce()
  })

  it('records only by explicit request and reuses the one already-open capture stream', async () => {
    const acquired = {} as MediaStream
    mocks.acquire.mockResolvedValue(acquired)
    const discard = vi.fn()
    const finish = vi.fn().mockResolvedValue(new Blob(['take']))
    mocks.recordTake.mockReturnValue({ discard, finish })
    const voice = createBrowserVoice()
    expect(() => voice.startRecording?.()).toThrow('Open the microphone')
    await voice.start()
    expect(mocks.recordTake).not.toHaveBeenCalled()
    const take = voice.startRecording!()
    expect(mocks.recordTake).toHaveBeenCalledWith(acquired)
    expect(mocks.acquire).toHaveBeenCalledOnce()
    const saved = take.finish()
    voice.stop()
    expect(discard).not.toHaveBeenCalled()
    expect(await (await saved)?.text()).toBe('take')
    expect(mocks.release).toHaveBeenCalledOnce()
  })

  it('discards an active take when its microphone session is interrupted', async () => {
    const discard = vi.fn()
    mocks.recordTake.mockReturnValue({ discard, finish: vi.fn() })
    const voice = createBrowserVoice()
    await voice.start()
    voice.startRecording!()
    voice.stop()
    expect(discard).toHaveBeenCalledOnce()
  })

  it('acquires permission in the gesture but waits for soundtrack silence before detecting pitch', async () => {
    const quiet = deferred<undefined>()
    const voice = createBrowserVoice()
    const pending = voice.start(quiet.promise)
    expect(mocks.acquire).toHaveBeenCalledOnce()
    expect(leases[0].unlock).toHaveBeenCalledOnce()
    await Promise.resolve()
    await Promise.resolve()
    expect(mocks.create).not.toHaveBeenCalled()
    quiet.resolve(undefined)
    await pending
    expect(mocks.create).toHaveBeenCalledOnce()
    voice.stop()
  })

  it('does not start a detector after cancellation during the fade', async () => {
    const quiet = deferred<undefined>()
    const voice = createBrowserVoice()
    const pending = voice.start(quiet.promise)
    await Promise.resolve()
    voice.stop()
    quiet.resolve(undefined)
    await pending
    expect(mocks.create).not.toHaveBeenCalled()
    expect(mocks.release).toHaveBeenCalledOnce()
  })

  it('rejects a failed silence handoff even when the rejection value is null', async () => {
    const voice = createBrowserVoice()
    await expect(voice.start(Promise.reject(null))).rejects.toBeNull()
    expect(mocks.create).not.toHaveBeenCalled()
    expect(mocks.release).toHaveBeenCalledOnce()
  })

  it('rechecks the context after waiting for silence', async () => {
    const quiet = deferred<undefined>()
    const voice = createBrowserVoice()
    const pending = voice.start(quiet.promise)
    await Promise.resolve()
    await Promise.resolve()
    context.state = 'interrupted'
    quiet.resolve(undefined)
    await expect(pending).rejects.toThrow('interrupted')
    expect(mocks.create).not.toHaveBeenCalled()
    expect(mocks.release).toHaveBeenCalledOnce()
  })

  it('releases a late permission grant without stopping a newer microphone session', async () => {
    const late = deferred<MediaStream>()
    mocks.acquire.mockReturnValueOnce(late.promise)
    const old = createBrowserVoice()
    const pending = old.start()
    old.stop()
    const newest = createBrowserVoice()
    await newest.start()
    late.resolve({} as MediaStream)
    await pending
    expect(mocks.create).toHaveBeenCalledTimes(1)
    expect(mocks.release).toHaveBeenCalledWith(mocks.acquire.mock.calls[0][0])
    expect(mocks.release).not.toHaveBeenCalledWith(
      mocks.acquire.mock.calls[1][0],
    )
    expect(leases[0].release).toHaveBeenCalledTimes(1)
    expect(leases[1].release).not.toHaveBeenCalled()
    newest.stop()
    expect(dispose).toHaveBeenCalledTimes(1)
  })

  it('coalesces repeated start calls and makes a stopped session terminal', async () => {
    const gate = deferred<MediaStream>()
    mocks.acquire.mockReturnValueOnce(gate.promise)
    const voice = createBrowserVoice()
    const first = voice.start()
    expect(voice.start()).toBe(first)
    expect(mocks.acquire).toHaveBeenCalledTimes(1)
    gate.resolve({} as MediaStream)
    await first
    voice.stop()
    voice.stop()
    expect(dispose).toHaveBeenCalledTimes(1)
    await expect(voice.start()).rejects.toThrow('ended')
  })

  it('rejects failed audio unlock and releases the acquired microphone', async () => {
    const voice = createBrowserVoice()
    leases[0].unlock.mockResolvedValue(false)
    await expect(voice.start()).rejects.toThrow('Audio could not start')
    expect(mocks.create).not.toHaveBeenCalled()
    expect(mocks.release).toHaveBeenCalledTimes(1)
    expect(leases[0].release).toHaveBeenCalledTimes(1)
  })

  it('returns the original capture age and raw silence without creating poll observations', async () => {
    const voice = createBrowserVoice()
    await voice.start()
    captured = {
      sequence: 1,
      capturedAudioSeconds: 9.7,
      frame: { t: 0.7, f0: 220, conf: 0.9, rms: 0.1 },
    }
    expect(voice.latest(5000)).toMatchObject({
      sequence: 1,
      captureSeconds: 9.7,
      midi: 57,
    })
    expect(voice.latest(5000)?.capturedAtMs).toBeCloseTo(4700)
    expect(voice.latest(5010)?.sequence).toBe(1)
    captured = {
      sequence: 2,
      capturedAudioSeconds: 9.99,
      frame: { t: 0.99, f0: 0, conf: 0, rms: 0 },
    }
    expect(voice.latest(5000)).toMatchObject({
      sequence: 2,
      midi: null,
      confidence: 0,
    })
    context.state = 'interrupted'
    expect(voice.latest(5000)).toBeNull()
    voice.stop()
  })

  it('delivers every detector callback without rAF and suppresses queued callbacks after stop', async () => {
    const voice = createBrowserVoice()
    await voice.start()
    const listener = vi.fn()
    const remove = voice.subscribe(listener)
    for (let n = 1; n <= 24; n++)
      callback?.({
        sequence: n,
        capturedAudioSeconds: 9.4 + n / 40,
        frame: {
          t: n / 40,
          f0: n === 24 ? 0 : 220,
          conf: n === 24 ? 0 : 0.9,
          rms: 0.1,
        },
      })
    expect(listener).toHaveBeenCalledTimes(24)
    expect(listener.mock.calls[23][0]).toMatchObject({
      sequence: 24,
      midi: null,
    })
    remove()
    expect(unsubscribe).toHaveBeenCalledOnce()
    voice.stop()
    callback?.({
      sequence: 25,
      capturedAudioSeconds: 10,
      frame: { t: 1, f0: 220, conf: 0.9, rms: 0.1 },
    })
    expect(listener).toHaveBeenCalledTimes(24)
  })

  it('unexpected audio interruption is terminal and notifies once without replay on resume', async () => {
    const voice = createBrowserVoice()
    await voice.start()
    const stopped = vi.fn(() => voice.stop())
    voice.subscribe(vi.fn(), stopped)
    context.state = 'interrupted'
    context.dispatchEvent(new Event('statechange'))
    expect(stopped).toHaveBeenCalledOnce()
    expect(dispose).toHaveBeenCalledOnce()
    expect(mocks.release).toHaveBeenCalledOnce()
    context.state = 'running'
    context.dispatchEvent(new Event('statechange'))
    expect(stopped).toHaveBeenCalledOnce()
    expect(voice.latest(1000)).toBeNull()
    await expect(voice.start()).rejects.toThrow('ended')
  })

  it('intentional stop does not report an interruption', async () => {
    const voice = createBrowserVoice()
    await voice.start()
    const stopped = vi.fn()
    voice.subscribe(vi.fn(), stopped)
    voice.stop()
    context.state = 'suspended'
    context.dispatchEvent(new Event('statechange'))
    expect(stopped).not.toHaveBeenCalled()
  })
})
