// ============================================================
// The lyrics window's wiring: when the app may go into it, and what then
// ============================================================
//
// The room's own tests drive this through the room (KaraokeRoomStage.test).
// Here it stands alone, with a song that is a signal and a device that
// records, for the rules that are easy to break in a refactor: auto-enter
// told only of a change, off when the room goes, and nothing at all on the
// web, where there is no device. On iOS the window draws itself: it gets the
// song's lyrics, and needs the song to keep playing behind other apps.

import { createRoot, createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LyricWindowScript } from '@/lib/lyric-window-script'
import type { NativeDeviceApi } from '@/stores/native-shell-store'
import { roomInPictureInPicture } from '@/stores/native-shell-store'
import { resetKaraokeRoomForTests, setKaraokePictureInPicture, } from './karaoke-room-store'
import { useKaraokePictureInPicture } from './useKaraokePictureInPicture'

/** A phone: Android's window shows the page, iOS's draws the lyrics. */
function fakeDevice(phone: 'android' | 'ios' = 'android') {
  const handlers = new Set<(inWindow: boolean) => void>()
  const lyrics = vi.fn((_script: LyricWindowScript | null) => undefined)
  const device = {
    pictureInPictureAutoEnter: vi.fn(),
    onPictureInPicture: vi.fn((handler: (inWindow: boolean) => void) => {
      handlers.add(handler)
      return () => {
        handlers.delete(handler)
      }
    }),
    pictureInPictureLyrics: phone === 'ios' ? lyrics : null,
  }
  return {
    device: device as unknown as NativeDeviceApi,
    autoEnter: device.pictureInPictureAutoEnter,
    lyrics,
    windowed: (inWindow: boolean) => {
      for (const handler of [...handlers]) handler(inWindow)
    },
    listeners: () => handlers.size,
  }
}

let dispose: (() => void) | null = null

const SCRIPT: LyricWindowScript = {
  title: 'Harbour Lights',
  duration: 246,
  segments: [{ at: 0, current: [], next: 'Hold the rope', words: [] }],
}

function mount(device: NativeDeviceApi | null) {
  const [playing, setPlaying] = createSignal(false)
  const [backgroundPlay, setBackgroundPlay] = createSignal(true)
  const [script, setScript] = createSignal<LyricWindowScript | null>(SCRIPT)
  // Read in the hook's own memo, a tracked scope the rule cannot see.
  // eslint-disable-next-line solid/reactivity
  const lyrics = vi.fn(script)
  const onEnter = vi.fn()
  const inWindow = createRoot((done) => {
    dispose = done
    return useKaraokePictureInPicture({
      device,
      playing,
      backgroundPlay,
      lyrics,
      onEnter,
    })
  })
  return {
    setPlaying,
    setBackgroundPlay,
    setScript,
    lyrics,
    onEnter,
    inWindow,
  }
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

  it('needs no lyrics on Android, whose window shows the page itself', () => {
    const fake = fakeDevice()
    const room = mount(fake.device)

    room.setPlaying(true)
    room.setBackgroundPlay(false)

    expect(room.lyrics).not.toHaveBeenCalled()
    expect(fake.autoEnter.mock.calls).toEqual([[true]])
  })

  it('is never in the window on the web, where there is no device', () => {
    const room = mount(null)

    room.setPlaying(true)

    expect(room.inWindow()).toBe(false)
    expect(roomInPictureInPicture()).toBe(false)
  })
})

describe('the lyrics window on iOS', () => {
  it('opens only while the song keeps playing behind other apps', () => {
    const fake = fakeDevice('ios')
    const room = mount(fake.device)
    room.setBackgroundPlay(false)

    room.setPlaying(true)
    expect(fake.autoEnter).not.toHaveBeenCalled()

    room.setBackgroundPlay(true)
    room.setPlaying(false)

    expect(fake.autoEnter.mock.calls).toEqual([[true], [false]])
  })

  it("hands the window the song's lyrics, again when they change", () => {
    const fake = fakeDevice('ios')
    const room = mount(fake.device)
    const later = { ...SCRIPT, duration: 250 }

    room.setScript(later)
    room.setScript(null)

    expect(fake.lyrics.mock.calls.map(([script]) => script)).toEqual([
      SCRIPT,
      later,
      null,
    ])
  })

  it('takes the lyrics away once no window could open, closing one', () => {
    const fake = fakeDevice('ios')
    const room = mount(fake.device)

    room.setBackgroundPlay(false)
    room.setBackgroundPlay(true)
    setKaraokePictureInPicture(false)

    expect(fake.lyrics.mock.calls.map(([script]) => script)).toEqual([
      SCRIPT,
      null,
      SCRIPT,
      null,
    ])
  })

  it('takes the lyrics away when the room goes', () => {
    const fake = fakeDevice('ios')
    mount(fake.device)

    dispose?.()
    dispose = null

    expect(fake.lyrics).toHaveBeenLastCalledWith(null)
  })
})
