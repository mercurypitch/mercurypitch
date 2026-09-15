// Glass sound tests — real shared-lease policy around a controlled Web Audio boundary.
import { resetSharedAudioContext, sharedAudioContextOwners, suspendSharedAudioContext, } from '@irchiinnuss/audio-io/shared-audio-context'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createBrowserGlassSound } from './glass-sound'

class AudioParamFake {
  value = 1
  setValueAtTime = vi.fn()
  exponentialRampToValueAtTime = vi.fn()
  setTargetAtTime = vi.fn()
  cancelScheduledValues = vi.fn()
}
class NodeFake {
  gain = new AudioParamFake()
  frequency = new AudioParamFake()
  type = ''
  buffer: unknown
  onended: (() => void) | null = null
  connect = vi.fn((node: NodeFake) => node)
  disconnect = vi.fn()
  start = vi.fn()
  stop = vi.fn()
}
class ContextFake extends EventTarget {
  state = 'running'
  currentTime = 0
  sampleRate = 48000
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
  createGain = () => {
    const node = new NodeFake()
    this.gains.push(node)
    return node
  }
  createOscillator = () => {
    const node = new NodeFake()
    this.sources.push(node)
    return node
  }
  createBufferSource = this.createOscillator
  createBiquadFilter = () => new NodeFake()
  createBuffer = (_channels: number, length: number) => ({
    getChannelData: () => new Float32Array(length),
  })
}

let context: ContextFake
const flush = async (): Promise<void> => {
  for (let n = 0; n < 5; n++) await Promise.resolve()
}
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

describe('museum audio release', () => {
  it('rejects unavailable or refused output instead of silently completing a reference', async () => {
    resetSharedAudioContext({ createContext: () => undefined })
    const unavailable = createBrowserGlassSound()
    await expect(unavailable.reference(57)).rejects.toThrow('unavailable')
    unavailable.dispose()
    resetSharedAudioContext({
      createContext: () => context as unknown as AudioContext,
    })
    context.state = 'suspended'
    context.resume.mockRejectedValue(new Error('blocked'))
    const blocked = createBrowserGlassSound()
    await expect(blocked.reference(57)).rejects.toThrow('could not start')
    expect(context.sources).toHaveLength(0)
    blocked.dispose()
    expect(sharedAudioContextOwners()).toHaveLength(0)
  })

  it('waits for the played reference and quiet gap on audio time', async () => {
    const sound = createBrowserGlassSound()
    let done = false
    const played = sound.reference(57).then(() => {
      done = true
    })
    await flush()
    expect(context.sources).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1500)
    expect(done).toBe(false)
    context.currentTime = 1.15
    await vi.advanceTimersByTimeAsync(25)
    await played
    expect(done).toBe(true)
    sound.dispose()
    await vi.advanceTimersByTimeAsync(240)
    expect(sharedAudioContextOwners()).toHaveLength(0)
  })

  it('cancels a pending unlock without allowing its late success to start sound', async () => {
    let resume!: () => void
    context.resume.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resume = resolve
        }),
    )
    const sound = createBrowserGlassSound()
    const cancelled = expect(sound.reference(57)).rejects.toThrow('cancelled')
    sound.dispose()
    await cancelled
    resume()
    await flush()
    expect(context.sources).toHaveLength(0)
    expect(sharedAudioContextOwners()).toHaveLength(0)
  })

  it('rejects a platform unlock that never settles instead of parking the encounter forever', async () => {
    context.resume.mockImplementation(() => new Promise<void>(() => undefined))
    const sound = createBrowserGlassSound()
    const failed = expect(sound.reference(57)).rejects.toThrow(
      'could not start',
    )
    await vi.advanceTimersByTimeAsync(4000)
    await failed
    expect(context.sources).toHaveLength(0)
    expect(sharedAudioContextOwners()).toHaveLength(0)
  })

  it('bounds a clock that claims running but never advances', async () => {
    const sound = createBrowserGlassSound()
    const failed = expect(sound.reference(57)).rejects.toThrow('not advancing')
    await flush()
    await vi.advanceTimersByTimeAsync(4000)
    await failed
    await vi.advanceTimersByTimeAsync(240)
    expect(context.sources[0].disconnect).toHaveBeenCalledOnce()
    expect(sharedAudioContextOwners()).toHaveLength(0)
  })

  it('grants a bounded soft tail before native suspension and rejects pending reference immediately', async () => {
    const sound = createBrowserGlassSound()
    const cancelled = expect(sound.reference(57)).rejects.toThrow('cancelled')
    await flush()
    suspendSharedAudioContext()
    await cancelled
    expect(context.gains[0].gain.setTargetAtTime).toHaveBeenCalledWith(
      0,
      0,
      0.036,
    )
    expect(context.suspend).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(239)
    expect(context.sources[0].disconnect).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(context.sources[0].disconnect).toHaveBeenCalledOnce()
    expect(context.suspend).toHaveBeenCalledOnce()
    expect(sharedAudioContextOwners()).toHaveLength(0)
  })

  it('an old release cannot disconnect or suspend a newer encounter', async () => {
    const previous = createBrowserGlassSound()
    await flush()
    previous.shatter()
    const previousSourceCount = context.sources.length
    previous.dispose()
    await vi.advanceTimersByTimeAsync(100)
    const current = createBrowserGlassSound()
    await flush()
    current.shatter()
    const currentSource = context.sources[previousSourceCount]
    await vi.advanceTimersByTimeAsync(140)
    expect(context.sources[0].disconnect).toHaveBeenCalledOnce()
    expect(currentSource.disconnect).not.toHaveBeenCalled()
    expect(context.suspend).not.toHaveBeenCalled()
    expect(sharedAudioContextOwners()).toHaveLength(1)
    current.dispose()
    await vi.advanceTimersByTimeAsync(240)
    expect(currentSource.disconnect).toHaveBeenCalledOnce()
    expect(sharedAudioContextOwners()).toHaveLength(0)
  })

  it('retires interrupted sources before the audio clock can resume them', async () => {
    const sound = createBrowserGlassSound()
    const cancelled = expect(sound.reference(57)).rejects.toThrow('cancelled')
    await flush()
    const source = context.sources[0]
    context.state = 'interrupted'
    context.dispatchEvent(new Event('statechange'))
    await cancelled
    expect(source.disconnect).toHaveBeenCalledOnce()
    expect(sharedAudioContextOwners()).toHaveLength(0)
    context.state = 'running'
    context.dispatchEvent(new Event('statechange'))
    await vi.advanceTimersByTimeAsync(4000)
    expect(source.start).toHaveBeenCalledOnce()
    expect(source.disconnect).toHaveBeenCalledOnce()
  })
})
