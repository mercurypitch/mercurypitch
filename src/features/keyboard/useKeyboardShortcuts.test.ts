import { createRoot, createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { KeyboardShortcutHandlers } from '@/features/keyboard/useKeyboardShortcuts'
import { useKeyboardShortcuts } from '@/features/keyboard/useKeyboardShortcuts'
import { PLAYBACK_MODE_ONCE, TAB_SINGING, TAB_STUDIO_NIGHT, } from '@/features/tabs/constants'
import { installSpacePlaybackToggle } from '@/lib/space-playback'
import * as transportStore from '@/stores/transport-store'
import type { PlaybackMode } from '@/types'

function mountShortcuts(handlers: Partial<KeyboardShortcutHandlers>) {
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
    new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }),
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

describe('the speed keys', () => {
  // A television leaves both arrows to its remote's D-pad instead;
  // useKeyboardShortcuts.tv.test.ts holds that.
  it('Up and Down step the playback speed', async () => {
    transportStore.setPlaybackSpeed(1)
    const dispose = mountShortcuts({})
    await Promise.resolve()

    keydown({ code: 'ArrowUp' })
    expect(transportStore.playbackSpeed()).toBe(1.5)

    keydown({ code: 'ArrowDown' })
    keydown({ code: 'ArrowDown' })
    expect(transportStore.playbackSpeed()).toBe(0.75)
    dispose()
  })
})

// Studio drives its own audio graph, as Karaoke does: its Home seeks its own
// song (StudioWorkspace.tsx) and its Space is its own transport
// (installSpacePlaybackToggle). The singing transport's keys must not reach
// through it to change modes, speed or position behind the page.
describe('the Studio tab', () => {
  const unmount: (() => void)[] = []
  afterEach(() => {
    for (const dispose of unmount.splice(0)) dispose()
  })

  async function mountOn(tab: KeyboardShortcutHandlers['activeTab']) {
    const singing = {
      play: vi.fn(),
      seekToStart: vi.fn(),
    }
    const [playMode, setPlayMode] =
      createSignal<PlaybackMode>(PLAYBACK_MODE_ONCE)
    unmount.push(
      mountShortcuts({ ...singing, activeTab: tab, playMode, setPlayMode }),
    )
    await Promise.resolve()
    return { singing, playMode }
  }

  it('leaves Home, R, P, Up, Down and Space to the page', async () => {
    transportStore.setPlaybackSpeed(1)
    const { singing, playMode } = await mountOn(() => TAB_STUDIO_NIGHT)

    const prevented = ['Home', 'KeyR', 'KeyP', 'ArrowUp', 'ArrowDown', 'Space']
      .map((code) => keydown({ code }))
      .map((notCancelled) => !notCancelled)

    expect(prevented).toEqual([false, false, false, false, false, false])
    expect(singing.seekToStart).not.toHaveBeenCalled()
    expect(singing.play).not.toHaveBeenCalled()
    expect(playMode()).toBe(PLAYBACK_MODE_ONCE)
    expect(transportStore.playbackSpeed()).toBe(1)
  })

  it('still lets the same keys drive the singing transport on Singing', async () => {
    transportStore.setPlaybackSpeed(1)
    const { singing, playMode } = await mountOn(() => TAB_SINGING)

    keydown({ code: 'Home' })
    keydown({ code: 'KeyR' })
    keydown({ code: 'ArrowUp' })

    expect(singing.seekToStart).toHaveBeenCalledTimes(1)
    expect(playMode()).toBe('repeat')
    expect(transportStore.playbackSpeed()).toBe(1.5)
  })

  it("keeps Space for Studio's own transport toggle", async () => {
    const { singing } = await mountOn(() => TAB_STUDIO_NIGHT)
    const studioToggle = vi.fn()
    unmount.push(installSpacePlaybackToggle({ toggle: studioToggle }))

    keydown({ code: 'Space' })

    expect(studioToggle).toHaveBeenCalledTimes(1)
    expect(singing.play).not.toHaveBeenCalled()
  })
})
