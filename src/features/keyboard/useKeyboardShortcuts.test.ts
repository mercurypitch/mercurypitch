import { createRoot, createSignal } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
import { useKeyboardShortcuts } from '@/features/keyboard/useKeyboardShortcuts'
import { PLAYBACK_MODE_ONCE, TAB_SINGING } from '@/features/tabs/constants'
import type { PlaybackMode } from '@/types'

function mountShortcuts(onVoiceToggle: () => void) {
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
      onVoiceToggle,
    })
    return disposeRoot
  })
}

describe('the V voice-control shortcut', () => {
  it('fires on KeyV regardless of shift state', async () => {
    const toggle = vi.fn()
    const dispose = mountShortcuts(toggle)
    await Promise.resolve()

    document.body.dispatchEvent(
      new KeyboardEvent('keydown', { code: 'KeyV', bubbles: true }),
    )
    document.body.dispatchEvent(
      new KeyboardEvent('keydown', {
        code: 'KeyV',
        shiftKey: true,
        bubbles: true,
      }),
    )
    expect(toggle).toHaveBeenCalledTimes(2)
    dispose()
  })

  it('leaves Ctrl+V (paste) and typing surfaces alone', async () => {
    const toggle = vi.fn()
    const dispose = mountShortcuts(toggle)
    await Promise.resolve()

    document.body.dispatchEvent(
      new KeyboardEvent('keydown', {
        code: 'KeyV',
        ctrlKey: true,
        bubbles: true,
      }),
    )

    const input = document.createElement('input')
    document.body.appendChild(input)
    input.dispatchEvent(
      new KeyboardEvent('keydown', { code: 'KeyV', bubbles: true }),
    )
    input.remove()

    expect(toggle).not.toHaveBeenCalled()
    dispose()
  })
})
