// ============================================================
// The lyrics window's wiring: when the app may go into it, and what then
// ============================================================
//
// The room's own tests drive this through the room (KaraokeRoomStage.test).
// Here it stands alone, with a song that is a signal and a device that
// records, for the rules that are easy to break in a refactor: auto-enter
// told only of a change, off when the room goes, and nothing at all on the
// web, where there is no device.

import { createRoot, createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NativeDeviceApi } from '@/stores/native-shell-store'
import { roomInPictureInPicture } from '@/stores/native-shell-store'
import { resetKaraokeRoomForTests, setKaraokePictureInPicture, } from './karaoke-room-store'
import { useKaraokePictureInPicture } from './useKaraokePictureInPicture'

function fakeDevice() {
  const handlers = new Set<(inWindow: boolean) => void>()
  const device = {
    pictureInPictureAutoEnter: vi.fn(),
    onPictureInPicture: vi.fn((handler: (inWindow: boolean) => void) => {
      handlers.add(handler)
      return () => {
        handlers.delete(handler)
      }
    }),
  }
  return {
    device: device as unknown as NativeDeviceApi,
    autoEnter: device.pictureInPictureAutoEnter,
    windowed: (inWindow: boolean) => {
      for (const handler of [...handlers]) handler(inWindow)
    },
    listeners: () => handlers.size,
  }
}

let dispose: (() => void) | null = null

function mount(device: NativeDeviceApi | null) {
  const [playing, setPlaying] = createSignal(false)
  const onEnter = vi.fn()
  const inWindow = createRoot((done) => {
    dispose = done
    return useKaraokePictureInPicture({ device, playing, onEnter })
  })
  return { setPlaying, onEnter, inWindow }
}

beforeEach(() => {
  localStorage.clear()
  resetKaraokeRoomForTests()
})

afterEach(() => {
  dispose?.()
  dispose = null
})

describe('the lyrics window', () => {
  it('is allowed while a song plays, and told only of a change', () => {
    const fake = fakeDevice()
    const room = mount(fake.device)
    expect(fake.autoEnter).not.toHaveBeenCalled()

    room.setPlaying(true)
    room.setPlaying(true)
    room.setPlaying(false)

    expect(fake.autoEnter.mock.calls).toEqual([[true], [false]])
  })

  it('follows the setting mid-song', () => {
    const fake = fakeDevice()
    const room = mount(fake.device)
    room.setPlaying(true)

    setKaraokePictureInPicture(false)
    setKaraokePictureInPicture(true)

    expect(fake.autoEnter.mock.calls).toEqual([[true], [false], [true]])
  })

  it('lets go of the microphone as it opens, and says so to the shell', () => {
    const fake = fakeDevice()
    const room = mount(fake.device)
    room.setPlaying(true)

    fake.windowed(true)
    expect(room.inWindow()).toBe(true)
    expect(room.onEnter).toHaveBeenCalledTimes(1)
    expect(roomInPictureInPicture()).toBe(true)

    fake.windowed(false)
    expect(room.inWindow()).toBe(false)
    expect(room.onEnter).toHaveBeenCalledTimes(1)
    expect(roomInPictureInPicture()).toBe(false)
  })

  it('turns everything off when the room goes', () => {
    const fake = fakeDevice()
    const room = mount(fake.device)
    room.setPlaying(true)
    fake.windowed(true)

    dispose?.()
    dispose = null

    expect(fake.autoEnter).toHaveBeenLastCalledWith(false)
    expect(fake.listeners()).toBe(0)
    expect(roomInPictureInPicture()).toBe(false)
  })

  it('leaves auto-enter alone on the way out when it was never on', () => {
    const fake = fakeDevice()
    mount(fake.device)

    dispose?.()
    dispose = null

    expect(fake.autoEnter).not.toHaveBeenCalled()
  })

  it('is never in the window on the web, where there is no device', () => {
    const room = mount(null)

    room.setPlaying(true)

    expect(room.inWindow()).toBe(false)
    expect(roomInPictureInPicture()).toBe(false)
  })
})
