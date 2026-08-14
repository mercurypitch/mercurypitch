import { createRoot, createSignal } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
import { useKeyboardShortcuts } from '@/features/keyboard/useKeyboardShortcuts'
import { PLAYBACK_MODE_ONCE, TAB_SINGING } from '@/features/tabs/constants'
import type { PlaybackMode } from '@/types'

function mountShortcuts(handlers: {
  onVoiceToggle?: () => void
  onShowVoiceCommands?: () => void
  onToggleShortcutHelp?: () => void
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

const keydown = (init: KeyboardEventInit) =>
  document.body.dispatchEvent(
    new KeyboardEvent('keydown', { bubbles: true, ...init }),
  )

describe('the V voice-control shortcuts', () => {
  it('V toggles; Shift+V opens the command center instead', async () => {
    const toggle = vi.fn()
    const showCommands = vi.fn()
    const dispose = mountShortcuts({
      onVoiceToggle: toggle,
      onShowVoiceCommands: showCommands,
    })
    await Promise.resolve()

    keydown({ code: 'KeyV' })
    expect(toggle).toHaveBeenCalledTimes(1)
    expect(showCommands).not.toHaveBeenCalled()

    keydown({ code: 'KeyV', shiftKey: true })
    expect(toggle).toHaveBeenCalledTimes(1)
    expect(showCommands).toHaveBeenCalledTimes(1)
    dispose()
  })

  it('leaves Ctrl+V (paste) and typing surfaces alone', async () => {
    const toggle = vi.fn()
    const showCommands = vi.fn()
    const dispose = mountShortcuts({
      onVoiceToggle: toggle,
      onShowVoiceCommands: showCommands,
    })
    await Promise.resolve()

    keydown({ code: 'KeyV', ctrlKey: true })
    keydown({ code: 'KeyV', shiftKey: true, ctrlKey: true })

    const input = document.createElement('input')
    document.body.appendChild(input)
    input.dispatchEvent(
      new KeyboardEvent('keydown', { code: 'KeyV', bubbles: true }),
    )
    input.remove()

    expect(toggle).not.toHaveBeenCalled()
    expect(showCommands).not.toHaveBeenCalled()
    dispose()
  })

  it('? still belongs to the shortcut-help overlay, not voice', async () => {
    // On a US layout "?" IS Shift+/ — one keystroke must open exactly one
    // panel. A second "?" binding for voice commands sat below this one and
    // could never fire; voice commands live on Shift+V instead.
    const showCommands = vi.fn()
    const shortcutHelp = vi.fn()
    const dispose = mountShortcuts({
      onShowVoiceCommands: showCommands,
      onToggleShortcutHelp: shortcutHelp,
    })
    await Promise.resolve()

    keydown({ code: 'Slash', key: '?', shiftKey: true })
    expect(shortcutHelp).toHaveBeenCalledTimes(1)
    expect(showCommands).not.toHaveBeenCalled()
    dispose()
  })
})
