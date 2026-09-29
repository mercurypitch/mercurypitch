// ============================================================
// The arrow keys on a television
// ============================================================
//
// A remote's D-pad sends ArrowUp and ArrowDown, and on a TV that is how focus
// moves from one row to the next. The playback-speed shortcuts took both keys
// on every tab but Karaoke and cancelled their default, so a remote could not
// leave the row it was on. On a television they are left to the page.
// useKeyboardShortcuts.test.ts keeps the speed keys everywhere else.

import { createRoot, createSignal } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
import { useKeyboardShortcuts } from '@/features/keyboard/useKeyboardShortcuts'
import { PLAYBACK_MODE_ONCE, TAB_SINGING } from '@/features/tabs/constants'
import type * as DeviceTier from '@/lib/device-tier'
import * as transportStore from '@/stores/transport-store'
import type { PlaybackMode } from '@/types'

vi.mock('@/lib/device-tier', async (importOriginal) => ({
  ...(await importOriginal<typeof DeviceTier>()),
  isTvDevice: () => true,
}))

function mountShortcuts(handlers: { onMicToggle?: () => void } = {}) {
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

describe('the arrow keys on a television', () => {
  it('leave the playback speed alone and let focus move', async () => {
    transportStore.setPlaybackSpeed(1)
    const dispose = mountShortcuts()
    await Promise.resolve()

    // Checked after each key: Up then Down would land back on 1 anyway.
    const up = keydown({ code: 'ArrowUp' })
    expect(transportStore.playbackSpeed()).toBe(1)
    const down = keydown({ code: 'ArrowDown' })
    expect(transportStore.playbackSpeed()).toBe(1)

    expect(up.defaultPrevented).toBe(false)
    expect(down.defaultPrevented).toBe(false)
    dispose()
  })

  it('still answers the keys a remote does not own', async () => {
    // So the silence above is the arrows', not a hook that never listened.
    const mic = vi.fn()
    const dispose = mountShortcuts({ onMicToggle: mic })
    await Promise.resolve()

    const m = keydown({ code: 'KeyM' })

    expect(mic).toHaveBeenCalledTimes(1)
    expect(m.defaultPrevented).toBe(true)
    dispose()
  })
})
