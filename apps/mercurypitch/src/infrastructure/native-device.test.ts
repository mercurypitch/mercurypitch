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
}))

vi.mock('@irchiinnuss/mobile-runtime/platform', () => platform)

import { resetSharedAudioContext, sharedAudioContextOwners, suspendSharedAudioContext, } from '@irchiinnuss/audio-io'
// @ts-expect-error -- a plain .mjs manifest with no types, read as is.
import { globToRegExp, NATIVE_ASSETS } from '../../native-assets.mjs'
import { createNativeDevice } from './native-device'

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
})
