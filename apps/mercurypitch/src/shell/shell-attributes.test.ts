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
import { TAB_KARAOKE } from '@/features/tabs/constants'
import type { NativeRunControls } from '@/stores/native-shell-store'
import { consumeRunParked, registerRunControls, } from '@/stores/native-shell-store'
import { setActiveTab } from '@/stores/ui-store'
import { resetRunShell } from './run-shell-store'
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
