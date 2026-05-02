import type { Accessor, Setter } from 'solid-js'
import { onCleanup, onMount } from 'solid-js'
import * as notifStore from '@/stores/notifications-store'
import * as transportStore from '@/stores/transport-store'
import * as uiStore from '@/stores/ui-store'
import type { PlaybackMode } from '@/types'

interface KeyboardShortcutHandlers {
  isPlaying: Accessor<boolean>
  isPaused: Accessor<boolean>
  play: () => void
  pause: () => void
  resume: () => void
  stop: () => void
  seekToStart: () => void
  playMode: Accessor<PlaybackMode>
  setPlayMode: Setter<PlaybackMode>
}

export function useKeyboardShortcuts(handlers: KeyboardShortcutHandlers): void {
  const onKeyDown = (e: KeyboardEvent) => {
    // Skip if typing in input/select/textarea
    const isTyping = (e.target as Element | null)?.closest(
      'input,textarea,select,[contenteditable]',
    )

    if (e.code === 'Space' && !isTyping) {
      e.preventDefault()
      if (uiStore.focusMode()) {
        if (handlers.isPlaying()) handlers.pause()
        else if (handlers.isPaused()) handlers.resume()
        else handlers.play()
      }
    }

    // Escape → exit focus mode, or stop playback (only if running/paused)
    if (e.code === 'Escape' && !isTyping) {
      if (uiStore.focusMode()) {
        e.preventDefault()
        uiStore.exitFocusMode()
      } else if (handlers.isPlaying() || handlers.isPaused()) {
        e.preventDefault()
        handlers.stop()
        handlers.seekToStart()
      }
    }

    // Home → go to beginning
    if (e.code === 'Home' && !isTyping) {
      e.preventDefault()
      handlers.seekToStart()
    }

    // R → toggle Repeat mode (but allow Ctrl+R / Cmd+R for browser reload)
    if (e.code === 'KeyR' && !e.ctrlKey && !e.metaKey && !isTyping) {
      e.preventDefault()
      if (handlers.playMode() !== 'repeat') {
        handlers.setPlayMode('repeat')
        notifStore.showNotification('Mode: Repeat', 'info')
      }
    }

    // P → toggle Practice mode
    if (e.code === 'KeyP' && !isTyping) {
      e.preventDefault()
      if (handlers.playMode() !== 'practice') {
        handlers.setPlayMode('practice')
        notifStore.showNotification('Mode: Practice', 'info')
      }
    }

    // ↑ → faster playback
    if (e.code === 'ArrowUp' && !isTyping) {
      e.preventDefault()
      const current = transportStore.playbackSpeed()
      const steps = [0.25, 0.5, 0.75, 1.0, 1.5, 2.0]
      const idx = steps.indexOf(current)
      if (idx < steps.length - 1) {
        const next = steps[idx + 1]
        transportStore.setPlaybackSpeed(next)
      }
    }

    // ↓ → slower playback
    if (e.code === 'ArrowDown' && !isTyping) {
      e.preventDefault()
      const current = transportStore.playbackSpeed()
      const steps = [0.25, 0.5, 0.75, 1.0, 1.5, 2.0]
      const idx = steps.indexOf(current)
      if (idx > 0) {
        const next = steps[idx - 1]
        transportStore.setPlaybackSpeed(next)
      }
    }
  }

  onMount(() => {
    window.addEventListener('keydown', onKeyDown)
  })

  onCleanup(() => {
    window.removeEventListener('keydown', onKeyDown)
  })
}
