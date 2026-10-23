// ============================================================
// Audio output: the phone's answer read as a volume and a route
// ============================================================
//
// The payloads below are the shapes the two native halves send
// (AudioSession.snapshot() on iOS, AudioOutputPlugin.snapshot() on Android),
// written out by hand. The web registers nothing and reads nothing.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const capacitor = vi.hoisted(() => ({
  isNativePlatform: vi.fn(() => false),
  getPlatform: vi.fn(() => 'web'),
}))
const plugin = vi.hoisted(() => ({
  read: vi.fn(),
  addListener: vi.fn(),
}))
const registerPlugin = vi.hoisted(() => vi.fn((_name: string) => plugin))

vi.mock('@capacitor/core', () => ({ Capacitor: capacitor, registerPlugin }))

const {
  onAudioOutput,
  onAudioRoute,
  readAudioOutput,
  resetAudioOutputForTests,
  toAudioOutputReading,
} = await import('./audio-output')

/** An iPhone on its speaker, the app's session as AudioSessionKit sets it. */
const IOS_SPEAKER = {
  outputVolume: 0.5625,
  outputs: [{ type: 'Speaker', name: 'Speaker' }],
  inputs: [{ type: 'MicrophoneBuiltIn', name: 'iPhone Microphone' }],
  category: 'AVAudioSessionCategoryPlayAndRecord',
  mode: 'AVAudioSessionModeDefault',
  options: ['mixWithOthers', 'defaultToSpeaker', 'allowBluetoothA2DP'],
  otherAudioPlaying: false,
  silenceHint: false,
  sampleRate: 48000,
  ioBufferDuration: 0.0213,
  outputLatency: 0.012,
}

/** An Android phone with a wired headset, on the media stream. */
const ANDROID_HEADSET = {
  outputVolume: 0.2,
  volumeStep: 3,
  volumeSteps: 15,
  volumeMin: 0,
  stream: 'music',
  streamMuted: false,
  musicVolume: 0.2,
  callVolume: 0.6,
  mode: 'normal',
  musicActive: true,
  outputs: [{ type: 'wired-headset', name: 'USB-C to 3.5mm' }],
}

beforeEach(() => {
  capacitor.isNativePlatform.mockReturnValue(false)
  capacitor.getPlatform.mockReturnValue('web')
  registerPlugin.mockClear()
  plugin.read.mockReset()
  plugin.addListener.mockReset()
  resetAudioOutputForTests()
})

afterEach(() => vi.clearAllMocks())

describe('toAudioOutputReading', () => {
  it("reads an iPhone's volume and route, and keeps its session for the readout", () => {
    const reading = toAudioOutputReading(IOS_SPEAKER)
    expect(reading).toMatchObject({
      volume: 0.5625,
      step: null,
      steps: null,
      route: 'speaker',
      outputs: [{ type: 'Speaker', name: 'Speaker' }],
      reason: null,
    })
    expect(reading?.detail).toMatchObject({
      category: 'AVAudioSessionCategoryPlayAndRecord',
      mode: 'AVAudioSessionModeDefault',
      options: ['mixWithOthers', 'defaultToSpeaker', 'allowBluetoothA2DP'],
    })
    expect(reading?.detail).not.toHaveProperty('outputVolume')
  })

  it("reads an Android phone's steps as well as its volume", () => {
    expect(toAudioOutputReading(ANDROID_HEADSET)).toMatchObject({
      volume: 0.2,
      step: 3,
      steps: 15,
      route: 'headphones',
      detail: { stream: 'music', mode: 'normal' },
    })
  })

  it.each([
    ['Receiver', 'receiver'],
    ['builtin-earpiece', 'receiver'],
    ['Headphones', 'headphones'],
    ['BluetoothA2DPOutput', 'bluetooth'],
    ['BluetoothHFP', 'bluetooth'],
    ['bluetooth-a2dp', 'bluetooth'],
    ['ble-headset', 'bluetooth'],
    ['builtin-speaker', 'speaker'],
    ['AirPlay', 'airplay'],
    ['HDMI', 'hdmi'],
    ['hdmi', 'hdmi'],
    ['CarAudio', 'other'],
    ['type-25', 'other'],
  ])('names a %s port %s', (type, route) => {
    expect(
      toAudioOutputReading({ outputVolume: 1, outputs: [{ type }] })?.route,
    ).toBe(route)
  })

  it('says none when nothing plays the sound', () => {
    expect(toAudioOutputReading({ outputVolume: 1, outputs: [] })?.route).toBe(
      'none',
    )
  })

  it('keeps what moved a change', () => {
    expect(
      toAudioOutputReading({ ...IOS_SPEAKER, reason: 'volume' })?.reason,
    ).toBe('volume')
  })

  it('is no reading at all without a volume it can trust', () => {
    expect(toAudioOutputReading(null)).toBeNull()
    expect(toAudioOutputReading({})).toBeNull()
    expect(toAudioOutputReading({ outputVolume: Number.NaN })).toBeNull()
    expect(toAudioOutputReading({ outputVolume: '0.5' })).toBeNull()
  })

  it('holds the volume to 0..1', () => {
    expect(toAudioOutputReading({ outputVolume: 1.2 })?.volume).toBe(1)
    expect(toAudioOutputReading({ outputVolume: -0.1 })?.volume).toBe(0)
  })
})

// iOS sends two volumes: the app's session's, which stopped following the
// keys once a room opened (build 880), and the system's, off a volume view
// nobody sees, which counts once it has been seen to move.
describe("an iPhone's two volumes", () => {
  it('takes the system’s once the volume view has moved', () => {
    const reading = toAudioOutputReading({
      ...IOS_SPEAKER,
      outputVolume: 0,
      systemVolume: 0.5,
      systemVolumeLive: true,
    })
    expect(reading?.volume).toBe(0.5)
    expect(reading?.detail).toMatchObject({
      sessionVolume: 0,
      systemVolume: 0.5,
      systemVolumeLive: true,
    })
  })

  it('keeps the session’s until the volume view has moved', () => {
    const reading = toAudioOutputReading({
      ...IOS_SPEAKER,
      outputVolume: 0.25,
      systemVolume: 0,
      systemVolumeLive: false,
    })
    expect(reading?.volume).toBe(0.25)
    expect(reading?.detail).toMatchObject({ sessionVolume: 0.25 })
  })

  it.each([Number.NaN, '0.5', null])(
    'keeps the session’s over a system volume of %s',
    (systemVolume) => {
      expect(
        toAudioOutputReading({
          ...IOS_SPEAKER,
          outputVolume: 0.25,
          systemVolume,
          systemVolumeLive: true,
        })?.volume,
      ).toBe(0.25)
    },
  )

  it('holds the system’s to 0..1 as well', () => {
    expect(
      toAudioOutputReading({
        ...IOS_SPEAKER,
        systemVolume: 1.5,
        systemVolumeLive: true,
      })?.volume,
    ).toBe(1)
  })

  it('names no session volume on a phone that sends one volume', () => {
    expect(toAudioOutputReading(IOS_SPEAKER)?.detail).not.toHaveProperty(
      'sessionVolume',
    )
    expect(toAudioOutputReading(ANDROID_HEADSET)?.detail).not.toHaveProperty(
      'sessionVolume',
    )
  })
})

// The hint says "zero" only from a volume it can take at its word: one that
// follows the keys, or two readings that agree. An iPhone's own session can
// read 0 while the room plays out loud (build 880).
describe('how far the volume can be taken at its word', () => {
  it('trusts Android’s stream volume, which follows the keys', () => {
    expect(toAudioOutputReading(ANDROID_HEADSET)?.volumeKnown).toBe('live')
  })

  it('trusts an iPhone’s volume view once it has been seen to move', () => {
    const reading = toAudioOutputReading({
      ...IOS_SPEAKER,
      outputVolume: 0,
      systemVolume: 0,
      systemVolumeLive: true,
      systemVolumeSettled: true,
    })
    expect(reading?.volume).toBe(0)
    expect(reading?.volumeKnown).toBe('live')
  })

  it('takes the session at its word when a settled volume view agrees', () => {
    const reading = toAudioOutputReading({
      ...IOS_SPEAKER,
      outputVolume: 0,
      systemVolume: 0,
      systemVolumeLive: false,
      systemVolumeSettled: true,
    })
    expect(reading?.volume).toBe(0)
    expect(reading?.volumeKnown).toBe('agreed')
  })

  it('does not when the volume view disagrees', () => {
    const reading = toAudioOutputReading({
      ...IOS_SPEAKER,
      outputVolume: 0,
      systemVolume: 0.5,
      systemVolumeLive: false,
      systemVolumeSettled: true,
    })
    expect(reading?.volume).toBe(0)
    expect(reading?.volumeKnown).toBe('session')
  })

  it('does not while the volume view may still be filling', () => {
    // A volume view fills its slider a moment after it reaches a window, and
    // reads 0 until then: two zeros then are not two readings.
    const reading = toAudioOutputReading({
      ...IOS_SPEAKER,
      outputVolume: 0,
      systemVolume: 0,
      systemVolumeLive: false,
      systemVolumeSettled: false,
    })
    expect(reading?.volumeKnown).toBe('session')
  })

  it('does not with the session’s reading alone', () => {
    expect(
      toAudioOutputReading({ ...IOS_SPEAKER, outputVolume: 0 })?.volumeKnown,
    ).toBe('session')
  })
})

describe('readAudioOutput', () => {
  it('reads nothing on the web, and registers no plugin', async () => {
    expect(await readAudioOutput()).toBeNull()
    expect(registerPlugin).not.toHaveBeenCalled()
  })

  it("reads the phone's answer on a phone", async () => {
    capacitor.isNativePlatform.mockReturnValue(true)
    capacitor.getPlatform.mockReturnValue('ios')
    plugin.read.mockResolvedValue(IOS_SPEAKER)
    expect((await readAudioOutput())?.route).toBe('speaker')
    expect(registerPlugin).toHaveBeenCalledWith('AudioOutput')
  })

  it('reads nothing from an app without the plugin', async () => {
    capacitor.isNativePlatform.mockReturnValue(true)
    plugin.read.mockRejectedValue(new Error('Unimplemented'))
    expect(await readAudioOutput()).toBeNull()
  })
})

describe('onAudioOutput', () => {
  it('hears nothing on the web', () => {
    const handler = vi.fn()
    onAudioOutput(handler)()
    expect(registerPlugin).not.toHaveBeenCalled()
  })

  it('hands on each change it can read, and stops when unsubscribed', async () => {
    capacitor.isNativePlatform.mockReturnValue(true)
    let send: (event: unknown) => void = () => undefined
    const remove = vi.fn(() => Promise.resolve())
    plugin.addListener.mockImplementation(
      (_name: string, listener: (event: unknown) => void) => {
        send = listener
        return Promise.resolve({ remove })
      },
    )
    const handler = vi.fn()
    const stop = onAudioOutput(handler)
    await Promise.resolve()
    await Promise.resolve()
    expect(plugin.addListener).toHaveBeenCalledWith(
      'audioOutputChange',
      expect.any(Function),
    )
    send({ ...IOS_SPEAKER, outputVolume: 0.0625, reason: 'volume' })
    send({ reason: 'route' })
    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ volume: 0.0625, reason: 'volume' }),
    )
    stop()
    expect(remove).toHaveBeenCalled()
  })
})

// A route change on its own, for what follows the route for as long as the
// app runs: the latency offset. An iPhone sends it as AirPlay starts, and as
// the app comes back to the front.
describe('onAudioRoute', () => {
  it('hears nothing on the web, and registers no plugin', () => {
    const handler = vi.fn()
    onAudioRoute(handler)()
    expect(registerPlugin).not.toHaveBeenCalled()
    expect(handler).not.toHaveBeenCalled()
  })

  it('hands on the route of each change, and stops when unsubscribed', async () => {
    capacitor.isNativePlatform.mockReturnValue(true)
    capacitor.getPlatform.mockReturnValue('ios')
    let send: (event: Record<string, unknown>) => void = () => undefined
    const remove = vi.fn(() => Promise.resolve())
    plugin.addListener.mockImplementation(
      (_name: string, listener: (event: Record<string, unknown>) => void) => {
        send = listener
        return Promise.resolve({ remove })
      },
    )
    const handler = vi.fn()

    const stop = onAudioRoute(handler)
    await Promise.resolve()
    await Promise.resolve()
    send({
      ...IOS_SPEAKER,
      outputs: [{ type: 'AirPlay', name: 'Living Room TV' }],
      reason: 'route',
    })
    send({ ...IOS_SPEAKER, reason: 'app in front' })
    send({ reason: 'route' })
    stop()

    expect(plugin.addListener).toHaveBeenCalledWith(
      'audioRouteChange',
      expect.any(Function),
    )
    expect(handler.mock.calls).toEqual([['airplay'], ['speaker'], ['none']])
    expect(remove).toHaveBeenCalled()
  })

  it('hears nothing from an app without the plugin', async () => {
    capacitor.isNativePlatform.mockReturnValue(true)
    plugin.addListener.mockRejectedValue(new Error('Unimplemented'))
    const handler = vi.fn()

    const stop = onAudioRoute(handler)
    await Promise.resolve()
    await Promise.resolve()

    expect(() => {
      stop()
    }).not.toThrow()
    expect(handler).not.toHaveBeenCalled()
  })
})
