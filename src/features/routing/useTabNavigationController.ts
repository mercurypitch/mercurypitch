// ============================================================
// useTabNavigationController — Tab navigation, swipe gestures & transition cleanup
// ============================================================
//
// Encapsulates touch swipe navigation across visible tabs and registers the
// synchronous onTabTransition cleanup listener for audio engines, mics, and game states.
//

import type { Accessor } from 'solid-js'
import type { PracticeScope, UiMode } from '@/features/tabs/constants'
import { TAB_COMPOSE, TAB_GUITAR, TAB_PIANO, TAB_SINGING, visibleTabOrder, } from '@/features/tabs/constants'
import { onTabTransition } from '@/stores/ui-store'
import type { ActiveTab } from '@/types'

export interface UseTabNavigationControllerDeps {
  activeTab: Accessor<ActiveTab>
  setActiveTab: (tab: ActiveTab) => void
  swipeNavEnabled: Accessor<boolean>
  practiceScope: Accessor<PracticeScope>
  uiMode: Accessor<UiMode>
  closeSingingZen: () => void
  closeChallengeStage: () => void
  resetPlaybackState: () => Promise<void> | void
  practiceEngine: {
    stopMic: () => void
  }
  micActive: Accessor<boolean>
  fallingNotes: {
    gameState: Accessor<string>
    stopMic: () => void
    isMicActive: () => boolean
  }
  pianoPerformance: {
    transport: {
      pause: () => void
      stop: () => void
    }
  }
  guitarCtx: {
    guitar: {
      gameState: Accessor<string>
      stopGame: () => void
      stopAllMic: () => void
      releaseGuitarInputDevice: () => void
      applyGuitarInputDevice: () => void
    }
    drumMachine: {
      stop: () => void
    }
  }
  onGuitarDrumActivationInc?: () => void
}

export interface UseTabNavigationControllerReturn {
  handleTouchStart: (e: TouchEvent) => void
  handleTouchEnd: (e: TouchEvent) => void
  handleTabChange: (newTab: ActiveTab) => void
}

export function useTabNavigationController(
  deps: UseTabNavigationControllerDeps,
): UseTabNavigationControllerReturn {
  const handleTabChange = (newTab: ActiveTab) => {
    deps.setActiveTab(newTab)
  }

  // ── Swipe to Change Tabs ──────────────────────────────────
  let touchStartX = 0
  let touchStartY = 0

  const handleTouchStart = (e: TouchEvent) => {
    // Opt-in gesture (off by default) — the bottom tab bar is the primary
    // way to switch views on a phone; accidental swipes were changing tabs.
    if (!deps.swipeNavEnabled()) return
    const target = e.target as HTMLElement | null
    if (!target) return

    // Allow swiping on canvas now, but still ignore buttons, inputs, and modals
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'SELECT' ||
      target.tagName === 'BUTTON' ||
      target.closest('button, input, select, .fn-modal-content, .library-modal')
    ) {
      return
    }
    touchStartX = e.touches[0].clientX
    touchStartY = e.touches[0].clientY
  }

  const handleTouchEnd = (e: TouchEvent) => {
    if (touchStartX === 0) return
    const touchEndX = e.changedTouches[0].clientX
    const touchEndY = e.changedTouches[0].clientY

    const deltaX = touchStartX - touchEndX
    const deltaY = touchStartY - touchEndY

    // Require swiping across at least 35% of the screen width to prevent accidental tab changes
    const swipeThreshold = window.innerWidth * 0.35

    if (Math.abs(deltaX) > swipeThreshold && Math.abs(deltaY) < 80) {
      // Swipe order follows the same canonical order the tab bar renders,
      // filtered by scope/UI mode, so the gesture and the visible tabs can
      // never drift out of sync.
      const order = visibleTabOrder(deps.practiceScope(), deps.uiMode())
      const currentIdx = order.indexOf(deps.activeTab())
      if (currentIdx !== -1) {
        if (deltaX > 0 && currentIdx < order.length - 1) {
          handleTabChange(order[currentIdx + 1])
        } else if (deltaX < 0 && currentIdx > 0) {
          handleTabChange(order[currentIdx - 1])
        }
      }
    }

    touchStartX = 0
    touchStartY = 0
  }

  // ── Tab Transition Listener ────────────────────────────────
  onTabTransition((prevTab, newTab) => {
    deps.closeSingingZen()
    deps.closeChallengeStage()

    // 1. Stop singing/compose playback + mic. resetPlaybackState ends the
    // practice session but leaves the mic running, so without this the mic
    // lingers after leaving and micActive stays stuck on — making the mic
    // button look active (and react to playback) on the next visit. Mirrors
    // the Piano/Guitar cleanup below.
    if (prevTab === TAB_SINGING || prevTab === TAB_COMPOSE) {
      void deps.resetPlaybackState()
      if (deps.micActive()) deps.practiceEngine.stopMic()
    }

    // 2. Pause a running piano game (it otherwise keeps playing — and
    // sounding — invisibly on the previous tab; pause rather than stop so
    // coming back can resume, and discard a run still counting in) and
    // stop the piano mic if active.
    if (prevTab === TAB_PIANO) {
      const pianoState = deps.fallingNotes.gameState()
      if (pianoState === 'playing') deps.pianoPerformance.transport.pause()
      else if (pianoState === 'countdown')
        deps.pianoPerformance.transport.stop()
      if (deps.fallingNotes.isMicActive()) deps.fallingNotes.stopMic()
    }

    // 3. Stop guitar practice if active
    if (
      prevTab === TAB_GUITAR &&
      deps.guitarCtx.guitar.gameState() !== 'idle'
    ) {
      deps.guitarCtx.guitar.stopGame()
    }

    // 4. Stop every Guitar mic claim. Tuner, Riff Tracker, Sing-to-Fretboard
    // and the manual Hero/3D control all share this controller-level arbiter.
    // Clear the legacy PracticeEngine claim too: global controls and older
    // Guitar entry points may still have opened it. Then hand capture back to
    // the system default; the persisted guitar input must only redirect
    // capture while the guitar surface is in use.
    if (prevTab === TAB_GUITAR) {
      deps.onGuitarDrumActivationInc?.()
      deps.guitarCtx.drumMachine.stop()
      deps.guitarCtx.guitar.stopAllMic()
      deps.practiceEngine.stopMic()
      deps.guitarCtx.guitar.releaseGuitarInputDevice()
    }

    // 5. Route capture to the persisted guitar input while on the guitar tab.
    if (newTab === TAB_GUITAR) {
      deps.guitarCtx.guitar.applyGuitarInputDevice()
    }
  })

  // Booting straight into the guitar tab (deep link / restored hash) has no
  // transition for the block above to catch — apply the persisted guitar
  // input now.
  if (deps.activeTab() === TAB_GUITAR) {
    deps.guitarCtx.guitar.applyGuitarInputDevice()
  }

  return {
    handleTouchStart,
    handleTouchEnd,
    handleTabChange,
  }
}
