import type { Accessor, Setter } from 'solid-js'
import { onCleanup, onMount } from 'solid-js'
import type { ActiveTab } from '@/features/tabs/constants'
import { TAB_PIANO } from '@/features/tabs/constants'
import { PLAYBACK_MODE_SESSION } from '@/features/tabs/constants'
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

  /** Active tab accessor so Space/Esc can be context-aware. */
  activeTab?: Accessor<ActiveTab>

  /** Piano tab game handlers — used when activeTab === 'piano'. */
  piano?: {
    isPlaying: Accessor<boolean>
    isPaused: Accessor<boolean>
    gameState: Accessor<string>
    startGame: () => void
    pauseGame: () => void
    resumeGame: () => void
    resetGame: () => void
  }

  /** Modal dismiss callbacks — Escape closes the topmost open modal. */
  modals?: {
    practiceResult: Accessor<unknown | null>
    closePracticeResult: () => void
    sessionSummary: Accessor<unknown | null>
    closeSessionSummary: () => void
    showScaleBuilder: Accessor<boolean>
    closeScaleBuilder: () => void
    showGuideSelection: Accessor<boolean>
    closeGuideSelection: () => void
  }
}

export function useKeyboardShortcuts(handlers: KeyboardShortcutHandlers): void {
  const onKeyDown = (e: KeyboardEvent) => {
    // Skip if typing in input/select/textarea
    const isTyping = (e.target as Element | null)?.closest(
      'input,textarea,select,[contenteditable]',
    )

    // ── Escape ────────────────────────────────────────────────
    if (e.code === 'Escape') {
      // 1. Close the topmost open modal/overlay first
      if (tryDismissModal(handlers)) {
        e.preventDefault()
        return
      }

      if (isTyping) return

      // 2. Exit focus mode
      if (uiStore.focusMode()) {
        e.preventDefault()
        uiStore.exitFocusMode()
        return
      }

      // 3. Stop piano game
      const tab = handlers.activeTab?.()
      if (tab === TAB_PIANO && handlers.piano) {
        const gs = handlers.piano.gameState()
        if (gs === 'playing' || gs === 'paused' || gs === 'countdown') {
          e.preventDefault()
          handlers.piano.resetGame()
          return
        }
      }

      // 4. Stop singing playback
      if (handlers.isPlaying() || handlers.isPaused()) {
        e.preventDefault()
        handlers.stop()
        handlers.seekToStart()
      }
    }

    // ── Space — play/pause toggle ─────────────────────────────
    if (e.code === 'Space' && !isTyping) {
      e.preventDefault()

      const tab = handlers.activeTab?.()

      // Piano tab — delegate to piano game handlers
      if (tab === TAB_PIANO && handlers.piano) {
        const gs = handlers.piano.gameState()
        if (gs === 'playing') {
          handlers.piano.pauseGame()
        } else if (gs === 'paused') {
          handlers.piano.resumeGame()
        } else if (gs === 'idle' || gs === 'finished') {
          handlers.piano.startGame()
        }
        return
      }

      // Singing / other tabs — play/pause playback
      if (handlers.isPlaying()) {
        handlers.pause()
      } else if (handlers.isPaused()) {
        handlers.resume()
      } else {
        handlers.play()
      }
    }

    // Home -> go to beginning
    if (e.code === 'Home' && !isTyping) {
      e.preventDefault()
      handlers.seekToStart()
    }

    // R -> toggle Repeat mode (but allow Ctrl+R / Cmd+R for browser reload)
    if (e.code === 'KeyR' && !e.ctrlKey && !e.metaKey && !isTyping) {
      e.preventDefault()
      if (handlers.playMode() !== 'repeat') {
        handlers.setPlayMode('repeat')
        notifStore.showNotification('Mode: Repeat', 'info')
      }
    }

    // P -> toggle Practice mode
    if (e.code === 'KeyP' && !isTyping) {
      e.preventDefault()
      if (handlers.playMode() !== PLAYBACK_MODE_SESSION) {
        handlers.setPlayMode(PLAYBACK_MODE_SESSION)
        notifStore.showNotification('Mode: Practice', 'info')
      }
    }

    // Up arrow -> faster playback
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

    // Down arrow -> slower playback
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

/**
 * Attempt to close the topmost open modal/overlay.
 * Returns true if a modal was dismissed, false if nothing was open.
 * Order: specific overlays first, then library modals, then walkthrough.
 */
function tryDismissModal(handlers: KeyboardShortcutHandlers): boolean {
  // App-level modals passed via the handlers
  const m = handlers.modals
  if (m) {
    if (m.practiceResult() !== null) {
      m.closePracticeResult()
      return true
    }
    if (m.sessionSummary() !== null) {
      m.closeSessionSummary()
      return true
    }
    if (m.showScaleBuilder()) {
      m.closeScaleBuilder()
      return true
    }
    if (m.showGuideSelection()) {
      m.closeGuideSelection()
      return true
    }
  }

  // Store-level modals
  if (uiStore.isLibraryModalOpen()) {
    uiStore.hideLibrary()
    return true
  }
  if (uiStore.isSessionLibraryModalOpen()) {
    uiStore.hideSessionLibrary()
    return true
  }
  if (uiStore.showSessionBrowser()) {
    uiStore.hideSessionPresetsLibrary()
    return true
  }
  if (uiStore.showWelcome()) {
    uiStore.dismissWelcome()
    return true
  }

  return false
}
