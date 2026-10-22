// ============================================================
// The device, as a room under `src/` reaches it
// ============================================================
//
// The root package does not depend on `packages/audio-io`, and must not
// import `@irchiinnuss/mobile-runtime/platform` at all (eslint refuses every
// entry but asset-fetch under src/). So the one AudioContext and the screen's
// keep-awake reach the Karaoke room through the bridge, and this is the side
// of it that the app fills in: the broker's lease, by name, and the plugin.

import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'

const platform = vi.hoisted(() => ({
  keepAwake: vi.fn(async (_on: boolean) => Promise.resolve()),
  setNowPlaying: vi.fn(async (_song: unknown) => Promise.resolve()),
  onMediaAction: vi.fn((_handler: (action: string) => void) => vi.fn()),
  setPictureInPictureAutoEnter: vi.fn(async (_on: boolean) =>
    Promise.resolve(),
  ),
  onPictureInPicture: vi.fn((_handler: (inPip: boolean) => void) => vi.fn()),
  pictureInPictureNeedsLyrics: vi.fn(() => false),
  setPictureInPictureLyrics: vi.fn(async (_script: unknown) =>
    Promise.resolve(),
  ),
  onNowPlayingHoldsAudio: vi.fn((_listener: (holds: boolean) => void) =>
    vi.fn(),
  ),
  claimNowPlaying: vi.fn(),
  micStopsOtherApps: vi.fn(() => false),
  readAudioOutput: vi.fn(async () => Promise.resolve(null as unknown)),
  onAudioOutput: vi.fn((_handler: (reading: unknown) => void) => vi.fn()),
  readTvLyrics: vi.fn(async () =>
    Promise.resolve(
      null as { enabled: boolean; connected: boolean; showing: boolean } | null,
    ),
  ),
  onTvLyrics: vi.fn(
    (_handler: (state: { connected: boolean; showing: boolean }) => void) =>
      vi.fn(),
  ),
  readTvStage: vi.fn(async () =>
    Promise.resolve(
      null as { enabled: boolean; connected: boolean; showing: boolean } | null,
    ),
  ),
  onTvStage: vi.fn(
    (_handler: (state: { connected: boolean; showing: boolean }) => void) =>
      vi.fn(),
  ),
  sendTvStage: vi.fn(async (_message: unknown) => Promise.resolve()),
}))

const unlock = vi.hoisted(() => ({
  standUnlockClipAside: vi.fn(
    (_aside: boolean, _take?: () => void) => undefined,
  ),
}))

vi.mock('@irchiinnuss/mobile-runtime/platform', () => platform)
vi.mock('@/lib/audio-unlock', () => unlock)

import { resetSharedAudioContext, sharedAudioContextOwners, suspendSharedAudioContext, } from '@irchiinnuss/audio-io'
// @ts-expect-error -- a plain .mjs manifest with no types, read as is.
import { globToRegExp, NATIVE_ASSETS } from '../../native-assets.mjs'
import { createNativeDevice, standUnlockClipAsideForNowPlaying, } from './native-device'

function fakeContext() {
  return {
    state: 'suspended',
    resume: vi.fn(async () => Promise.resolve()),
    suspend: vi.fn(async () => Promise.resolve()),
    close: vi.fn(async () => Promise.resolve()),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as AudioContext
}

afterEach(() => {
  resetSharedAudioContext()
  vi.clearAllMocks()
  platform.pictureInPictureNeedsLyrics.mockReturnValue(false)
})

describe('the device a room reaches through the bridge', () => {
  it('lends the one shared AudioContext, under the name it was asked for', () => {
    const made: AudioContext[] = []
    resetSharedAudioContext({
      createContext: () => {
        const context = fakeContext()
        made.push(context)
        return context
      },
    })
    const device = createNativeDevice()

    const karaoke = device.acquireAudio('karaoke-room')
    const other = device.acquireAudio('another-room')

    expect(karaoke.ensure()).toBe(other.ensure())
    expect(made).toHaveLength(1)
    expect(sharedAudioContextOwners()).toEqual(['karaoke-room', 'another-room'])

    karaoke.release()
    expect(sharedAudioContextOwners()).toEqual(['another-room'])
    other.release()
  })

  it('keeps the screen awake, and lets it sleep again', () => {
    const device = createNativeDevice()

    device.keepAwake(true)
    device.keepAwake(false)

    expect(platform.keepAwake.mock.calls).toEqual([[true], [false]])
  })

  it('does not throw when the plugin refuses', async () => {
    platform.keepAwake.mockImplementationOnce(async () =>
      Promise.reject(new Error('not available')),
    )
    const device = createNativeDevice()

    expect(() => device.keepAwake(true)).not.toThrow()
    await Promise.resolve()
  })

  it('holds the shared clock running while the app is in the background', async () => {
    const context = fakeContext()
    resetSharedAudioContext({ createContext: () => context })
    const device = createNativeDevice()
    const lease = device.acquireAudio('karaoke-room')
    await lease.unlock()
    ;(context as unknown as { state: string }).state = 'running'

    const release = device.holdAudioInBackground('karaoke-room')
    suspendSharedAudioContext()
    expect(context.suspend).not.toHaveBeenCalled()

    release()
    suspendSharedAudioContext()
    expect(context.suspend).toHaveBeenCalledTimes(1)
    lease.release()
  })

  it('tells the system what is playing, and survives a refusal', async () => {
    platform.setNowPlaying.mockImplementationOnce(async () =>
      Promise.reject(new Error('not available')),
    )
    const device = createNativeDevice()
    const song = { title: 'Harbour Lights', playing: true }

    expect(() => device.nowPlaying(song)).not.toThrow()
    device.nowPlaying(null)
    await Promise.resolve()

    expect(platform.setNowPlaying.mock.calls).toEqual([
      [{ ...song, artwork: '/now-playing.webp' }],
      [null],
    ])
  })

  it('gives every song a picture the native bundle ships', () => {
    // A URL with nothing behind it fails nowhere: the notification simply
    // shows no picture. So the file has to be listed, and has to be there.
    const device = createNativeDevice()
    device.nowPlaying({ title: 'Harbour Lights', playing: false })

    const sent = platform.setNowPlaying.mock.calls.at(-1)?.[0] as {
      artwork?: string
    }
    const path = (sent.artwork ?? '').replace(/^\//u, '')
    const shipped = (
      NATIVE_ASSETS as ReadonlyArray<{ glob: string; root?: 'native' }>
    ).filter((entry) => entry.root === 'native')
    expect(
      shipped.some((entry) => (globToRegExp(entry.glob) as RegExp).test(path)),
    ).toBe(true)
    const file = fileURLToPath(
      new URL(`../../native-only/${path}`, import.meta.url),
    )
    expect(existsSync(file)).toBe(true)
  })

  it('says whether the microphone takes the sound from other apps', () => {
    expect(createNativeDevice().micStopsOtherApps).toBe(false)
    platform.micStopsOtherApps.mockReturnValueOnce(true)
    expect(createNativeDevice().micStopsOtherApps).toBe(true)
  })

  it('passes the system media buttons through, with their unsubscribe', () => {
    const stop = vi.fn()
    platform.onMediaAction.mockReturnValueOnce(stop)
    const device = createNativeDevice()
    const handler = vi.fn()

    const unsubscribe = device.onMediaAction(handler)
    platform.onMediaAction.mock.calls[0]?.[0]('pause')
    unsubscribe()

    expect(handler).toHaveBeenCalledWith('pause')
    expect(stop).toHaveBeenCalledTimes(1)
  })

  it('turns the small window on and off, and survives a refusal', async () => {
    platform.setPictureInPictureAutoEnter.mockImplementationOnce(async () =>
      Promise.reject(new Error('not available')),
    )
    const device = createNativeDevice()

    expect(() => device.pictureInPictureAutoEnter(true)).not.toThrow()
    device.pictureInPictureAutoEnter(false)
    await Promise.resolve()

    expect(platform.setPictureInPictureAutoEnter.mock.calls).toEqual([
      [true],
      [false],
    ])
  })

  it('passes the window coming and going through, with its unsubscribe', () => {
    const stop = vi.fn()
    platform.onPictureInPicture.mockReturnValueOnce(stop)
    const device = createNativeDevice()
    const handler = vi.fn()

    const unsubscribe = device.onPictureInPicture(handler)
    platform.onPictureInPicture.mock.calls[0]?.[0](true)
    unsubscribe()

    expect(handler).toHaveBeenCalledWith(true)
    expect(stop).toHaveBeenCalledTimes(1)
  })

  it('hands the lyrics to an iOS window, and survives a refusal', async () => {
    platform.pictureInPictureNeedsLyrics.mockReturnValue(true)
    platform.setPictureInPictureLyrics.mockImplementationOnce(async () =>
      Promise.reject(new Error('not available')),
    )
    const device = createNativeDevice()
    const script = { title: 'Harbour Lights', duration: 0, segments: [] }

    expect(() => device.pictureInPictureLyrics?.(script)).not.toThrow()
    device.pictureInPictureLyrics?.(null)
    await Promise.resolve()

    expect(platform.setPictureInPictureLyrics.mock.calls).toEqual([
      [script],
      [null],
    ])
  })

  it("reads the phone's volume and route, and passes every change through", async () => {
    const reading = {
      volume: 0.125,
      step: 2,
      steps: 15,
      route: 'speaker',
      outputs: [{ type: 'builtin-speaker', name: 'Phone' }],
      detail: {},
      reason: null,
    }
    platform.readAudioOutput.mockResolvedValueOnce(reading)
    const stop = vi.fn()
    platform.onAudioOutput.mockReturnValueOnce(stop)
    const output = createNativeDevice().audioOutput
    const handler = vi.fn()

    expect(await output?.read()).toBe(reading)
    const unsubscribe = output?.watch(handler)
    platform.onAudioOutput.mock.calls[0]?.[0](reading)
    unsubscribe?.()

    expect(handler).toHaveBeenCalledWith(reading)
    expect(stop).toHaveBeenCalledTimes(1)
  })

  it('has no lyrics to hand an Android window, which shows the page', () => {
    expect(createNativeDevice().pictureInPictureLyrics).toBeNull()
  })

  it('hears an iOS TV show the lyrics: as it stands, then every change', async () => {
    platform.pictureInPictureNeedsLyrics.mockReturnValue(true)
    platform.readTvLyrics.mockResolvedValueOnce({
      enabled: true,
      connected: true,
      showing: true,
    })
    const stop = vi.fn()
    platform.onTvLyrics.mockReturnValueOnce(stop)
    const device = createNativeDevice()
    const handler = vi.fn()

    const unsubscribe = device.onTvLyrics?.(handler)
    await new Promise((resolve) => setTimeout(resolve, 0))
    platform.onTvLyrics.mock.calls[0]?.[0]({ connected: true, showing: false })
    unsubscribe?.()

    expect(handler.mock.calls).toEqual([[true], [false]])
    expect(stop).toHaveBeenCalledTimes(1)
  })

  it('drops the first read of the TV once a change has been heard', async () => {
    platform.pictureInPictureNeedsLyrics.mockReturnValue(true)
    platform.readTvLyrics.mockResolvedValueOnce({
      enabled: true,
      connected: true,
      showing: true,
    })
    const device = createNativeDevice()
    const handler = vi.fn()

    device.onTvLyrics?.(handler)
    platform.onTvLyrics.mock.calls[0]?.[0]({ connected: false, showing: false })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(handler.mock.calls).toEqual([[false]])
  })

  it('has no TV to watch on Android', () => {
    expect(createNativeDevice().onTvLyrics).toBeUndefined()
  })

  it('gives an iOS room the TV stage: whether it shows, and what to draw', async () => {
    platform.pictureInPictureNeedsLyrics.mockReturnValue(true)
    platform.readTvStage.mockResolvedValueOnce({
      enabled: true,
      connected: true,
      showing: true,
    })
    platform.sendTvStage.mockImplementationOnce(async () =>
      Promise.reject(new Error('not available')),
    )
    const stage = createNativeDevice().tvStage
    const handler = vi.fn()

    stage?.watch(handler)
    await new Promise((resolve) => setTimeout(resolve, 0))
    platform.onTvStage.mock.calls[0]?.[0]({ connected: true, showing: false })
    expect(() => {
      stage?.send({ v: 1, kind: 'idle' })
    }).not.toThrow()
    await Promise.resolve()

    expect(handler.mock.calls).toEqual([[true], [false]])
    expect(platform.sendTvStage.mock.calls).toEqual([[{ v: 1, kind: 'idle' }]])
  })

  it('has no TV stage on Android', () => {
    expect(createNativeDevice().tvStage).toBeUndefined()
  })

  it('stands the unlock clip aside while the lock screen’s carrier holds the session', () => {
    const stop = vi.fn()
    platform.onNowPlayingHoldsAudio.mockReturnValueOnce(stop)

    const release = standUnlockClipAsideForNowPlaying()
    const heard = platform.onNowPlayingHoldsAudio.mock.calls[0]?.[0]
    heard?.(true)
    heard?.(false)
    release()

    // Aside, a press of play has the carrier take the sound back first.
    expect(unlock.standUnlockClipAside.mock.calls).toEqual([
      [true, platform.claimNowPlaying],
      [false, platform.claimNowPlaying],
    ])
    expect(stop).toHaveBeenCalledTimes(1)
  })
})
