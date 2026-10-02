// ============================================================
// What the shell tells a room's stylesheet about the chrome
// ============================================================
//
// A room that owns its own bottom bar (the Karaoke room's zen bar) has to
// rest it ON the rail while the rail is there, and drop it to the bottom
// edge while the rail has stepped aside for a song. The rail is the shell's
// and is portalled to <body>, so the room cannot measure it; the shell says
// so on <html>, the same way it says `data-room-header` and
// `data-shell-chip`.

import { createRoot, createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TAB_KARAOKE, TAB_PROGRESS } from '@/features/tabs/constants'
import type { NativeRunControls } from '@/stores/native-shell-store'
import { consumeRunParked, registerRunControls, setRoomInPictureInPicture, } from '@/stores/native-shell-store'
import { setActiveTab } from '@/stores/ui-store'
import { parkRun, resetRunShell } from './run-shell-store'
import { mirrorShellChrome } from './shell-attributes'

let dispose: (() => void) | null = null
let unregister: (() => void) | null = null

beforeEach(() => {
  setActiveTab(TAB_KARAOKE)
  resetRunShell()
})

afterEach(() => {
  dispose?.()
  dispose = null
  unregister?.()
  unregister = null
  resetRunShell()
  consumeRunParked(TAB_KARAOKE)
})

describe('the rail, as an attribute', () => {
  it('is on while the rail is on screen, and gone while a song has it aside', () => {
    const [playing, setPlaying] = createSignal(false)
    const controls: NativeRunControls = {
      tab: TAB_KARAOKE,
      roomLabel: 'Broadway Theater',
      ownsTransport: true,
      isPlaying: playing,
      isPaused: () => false,
      pause: vi.fn(),
      resume: vi.fn(),
      stop: vi.fn(),
      park: vi.fn(),
    }
    unregister = registerRunControls(controls)
    createRoot((done) => {
      dispose = done
      mirrorShellChrome()
    })
    const root = document.documentElement

    expect(root.getAttribute('data-shell-rail')).toBe('on')

    setPlaying(true)
    expect(root.hasAttribute('data-shell-rail')).toBe(false)
  })

  it('takes the attribute away with the shell', () => {
    createRoot((done) => {
      dispose = done
      mirrorShellChrome()
    })
    expect(document.documentElement.getAttribute('data-shell-rail')).toBe('on')

    dispose?.()
    dispose = null
    expect(document.documentElement.hasAttribute('data-shell-rail')).toBe(false)
  })
})

describe('the session pill, as an attribute', () => {
  // The pill rides above the rail while a run is parked, over the bottom of
  // whatever scrolls under it, and a scroller keeps clear of it only if it
  // knows it is there (mobile-kit.css, shell.css). TestFlight 0.7.1: Storage's
  // Start fresh, and the account's Sign in on its side, sat under it.
  it('is on while a run is parked, and gone once the singer is back in its room', () => {
    const [playing, setPlaying] = createSignal(false)
    const [paused, setPaused] = createSignal(false)
    const controls: NativeRunControls = {
      tab: TAB_KARAOKE,
      roomLabel: 'Broadway Theater',
      ownsTransport: true,
      isPlaying: playing,
      isPaused: paused,
      pause: vi.fn(),
      resume: vi.fn(),
      stop: vi.fn(),
      park: vi.fn(() => {
        setPlaying(false)
        setPaused(true)
      }),
    }
    unregister = registerRunControls(controls)
    createRoot((done) => {
      dispose = done
      mirrorShellChrome()
    })
    const root = document.documentElement
    setPlaying(true)
    expect(root.hasAttribute('data-shell-pill')).toBe(false)

    parkRun()
    setActiveTab(TAB_PROGRESS)
    expect(root.getAttribute('data-shell-pill')).toBe('on')

    setActiveTab(TAB_KARAOKE)
    expect(root.hasAttribute('data-shell-pill')).toBe(false)
  })

  it('takes the attribute away with the shell', () => {
    const controls: NativeRunControls = {
      tab: TAB_KARAOKE,
      roomLabel: 'Broadway Theater',
      isPlaying: () => true,
      isPaused: () => false,
      pause: vi.fn(),
      resume: vi.fn(),
      stop: vi.fn(),
      park: vi.fn(),
    }
    unregister = registerRunControls(controls)
    createRoot((done) => {
      dispose = done
      mirrorShellChrome()
    })
    setActiveTab(TAB_PROGRESS)
    expect(document.documentElement.getAttribute('data-shell-pill')).toBe('on')

    dispose?.()
    dispose = null
    expect(document.documentElement.hasAttribute('data-shell-pill')).toBe(false)
  })
})

describe('the small window, as an attribute', () => {
  // Android's picture-in-picture window holds the Karaoke room's lyrics and
  // nothing of the shell's; shell.css takes the chrome away on this.
  afterEach(() => {
    setRoomInPictureInPicture(false)
  })

  it('is on while a room is in the window, and gone once it is back', () => {
    createRoot((done) => {
      dispose = done
      mirrorShellChrome()
    })
    const root = document.documentElement
    expect(root.hasAttribute('data-picture-in-picture')).toBe(false)

    setRoomInPictureInPicture(true)
    expect(root.getAttribute('data-picture-in-picture')).toBe('on')

    setRoomInPictureInPicture(false)
    expect(root.hasAttribute('data-picture-in-picture')).toBe(false)
  })

  it('takes the attribute away with the shell', () => {
    createRoot((done) => {
      dispose = done
      mirrorShellChrome()
    })
    setRoomInPictureInPicture(true)

    dispose?.()
    dispose = null
    expect(
      document.documentElement.hasAttribute('data-picture-in-picture'),
    ).toBe(false)
  })
})
