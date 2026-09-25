// ============================================================
// The V keys in the native app
// ============================================================
//
// Voice control has no place in the native app yet: its shell draws no web
// header for the pill to dock in, and the floating pill mounts nowhere there
// (hud-placement.ts). V still toggled it on every build, opening a recognizer
// that nothing on screen showed or could stop, and Shift+V opened the list of
// what it answers to. In the native build neither key does anything, and
// both are left to the page. useKeyboardShortcuts.test.ts keeps the web's.

import { createRoot, createSignal } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
import { useKeyboardShortcuts } from '@/features/keyboard/useKeyboardShortcuts'
import { PLAYBACK_MODE_ONCE, TAB_SINGING } from '@/features/tabs/constants'
import type { PlaybackMode } from '@/types'

vi.mock('@/lib/native-build', () => ({
  IS_NATIVE_BUILD: true,
  CAN_TAKE_PAYMENT: false,
}))

function mountShortcuts(handlers: {
  onVoiceToggle?: () => void
  onShowVoiceCommands?: () => void
  onMicToggle?: () => void
}) {
  const [playMode, setPlayMode] = createSignal<PlaybackMode>(PLAYBACK_MODE_ONCE)
  return createRoot((disposeRoot) => {
    useKeyboardShortcuts({
      isPlaying: () => false,
      isPaused: () => false,
      play: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      stop: vi.fn(),
      seekToStart: vi.fn(),
      playMode,
      setPlayMode,
      activeTab: () => TAB_SINGING,
      ...handlers,
    })
    return disposeRoot
  })
}

/** A keydown on the page, returned so its default can be read after. */
const keydown = (init: KeyboardEventInit): KeyboardEvent => {
  const event = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    ...init,
  })
  document.body.dispatchEvent(event)
  return event
}

describe('the V keys in the native app', () => {
  it('neither toggles voice control nor opens its command list', async () => {
    const toggle = vi.fn()
    const showCommands = vi.fn()
    const dispose = mountShortcuts({
      onVoiceToggle: toggle,
      onShowVoiceCommands: showCommands,
    })
    await Promise.resolve()

    const v = keydown({ code: 'KeyV' })
    const shiftV = keydown({ code: 'KeyV', shiftKey: true })

    expect(toggle).not.toHaveBeenCalled()
    expect(showCommands).not.toHaveBeenCalled()
    // Left to the page, not swallowed on the way to nothing.
    expect(v.defaultPrevented).toBe(false)
    expect(shiftV.defaultPrevented).toBe(false)
    dispose()
  })

  it('still answers the keys that are not voice control', async () => {
    // So the silence above is the V keys', not a hook that never listened.
    const mic = vi.fn()
    const dispose = mountShortcuts({ onMicToggle: mic })
    await Promise.resolve()

    const m = keydown({ code: 'KeyM' })

    expect(mic).toHaveBeenCalledTimes(1)
    expect(m.defaultPrevented).toBe(true)
    dispose()
  })
})
