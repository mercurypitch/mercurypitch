import { createRoot, createSignal } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
import { useKeyboardShortcuts } from '@/features/keyboard/useKeyboardShortcuts'
import { PLAYBACK_MODE_ONCE, TAB_SINGING, TAB_VOICE_HISTORY, } from '@/features/tabs/constants'
import type { PlaybackMode } from '@/types'

describe('global keyboard shortcut suspension', () => {
  it('does not start the hidden singing transport while Zen owns the screen', async () => {
    const play = vi.fn()
    const [playMode, setPlayMode] =
      createSignal<PlaybackMode>(PLAYBACK_MODE_ONCE)

    const dispose = createRoot((disposeRoot) => {
      useKeyboardShortcuts({
        isPlaying: () => false,
        isPaused: () => false,
        play,
        pause: vi.fn(),
        resume: vi.fn(),
        stop: vi.fn(),
        seekToStart: vi.fn(),
        playMode,
        setPlayMode,
        activeTab: () => TAB_SINGING,
        isSuspended: () => true,
      })
      return disposeRoot
    })
    await Promise.resolve()

    window.dispatchEvent(
      new KeyboardEvent('keydown', { code: 'Space', bubbles: true }),
    )

    expect(play).not.toHaveBeenCalled()
    dispose()
  })

  it('yields Space to the Hear Yourself page controller', async () => {
    const play = vi.fn()
    const [playMode, setPlayMode] =
      createSignal<PlaybackMode>(PLAYBACK_MODE_ONCE)

    const dispose = createRoot((disposeRoot) => {
      useKeyboardShortcuts({
        isPlaying: () => false,
        isPaused: () => false,
        play,
        pause: vi.fn(),
        resume: vi.fn(),
        stop: vi.fn(),
        seekToStart: vi.fn(),
        playMode,
        setPlayMode,
        activeTab: () => TAB_VOICE_HISTORY,
      })
      return disposeRoot
    })
    await Promise.resolve()

    const event = new KeyboardEvent('keydown', {
      code: 'Space',
      bubbles: true,
      cancelable: true,
    })
    document.body.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(false)
    expect(play).not.toHaveBeenCalled()
    dispose()
  })
})
