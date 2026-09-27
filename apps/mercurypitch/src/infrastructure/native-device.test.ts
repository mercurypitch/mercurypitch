// ============================================================
// The device, as a room under `src/` reaches it
// ============================================================
//
// The root package does not depend on `packages/audio-io`, and must not
// import `@irchiinnuss/mobile-runtime/platform` at all (eslint refuses every
// entry but asset-fetch under src/). So the one AudioContext and the screen's
// keep-awake reach the Karaoke room through the bridge, and this is the side
// of it that the app fills in: the broker's lease, by name, and the plugin.

import { afterEach, describe, expect, it, vi } from 'vitest'

const platform = vi.hoisted(() => ({
  keepAwake: vi.fn(async (_on: boolean) => Promise.resolve()),
}))

vi.mock('@irchiinnuss/mobile-runtime/platform', () => platform)

import { resetSharedAudioContext, sharedAudioContextOwners, } from '@irchiinnuss/audio-io'
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
})
