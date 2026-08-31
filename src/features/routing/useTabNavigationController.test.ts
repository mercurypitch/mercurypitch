// ============================================================
// useTabNavigationController unit tests
// ============================================================

import { createRoot, createSignal } from 'solid-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TAB_EXERCISES, TAB_GUITAR, TAB_HOME, TAB_PIANO, TAB_SINGING, } from '@/features/tabs/constants'
import * as uiStore from '@/stores/ui-store'
import type { ActiveTab } from '@/types'
import { useTabNavigationController } from './useTabNavigationController'

describe('useTabNavigationController', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.innerWidth = 1000
  })

  it('handles tab change explicitly', () => {
    createRoot((dispose) => {
      const setActiveTabMock = vi.fn()
      const controller = useTabNavigationController({
        activeTab: () => TAB_SINGING,
        setActiveTab: setActiveTabMock,
        swipeNavEnabled: () => true,
        practiceScope: () => 'singing',
        uiMode: () => 'advanced',
        closeSingingZen: vi.fn(),
        closeChallengeStage: vi.fn(),
        resetPlaybackState: vi.fn(),
        practiceEngine: { stopMic: vi.fn() },
        micActive: () => false,
        fallingNotes: {
          gameState: () => 'idle',
          stopMic: vi.fn(),
          isMicActive: () => false,
        },
        pianoPerformance: {
          transport: { pause: vi.fn(), stop: vi.fn() },
        },
        guitarCtx: {
          guitar: {
            gameState: () => 'idle',
            stopGame: vi.fn(),
            stopAllMic: vi.fn(),
            releaseGuitarInputDevice: vi.fn(),
            applyGuitarInputDevice: vi.fn(),
          },
          drumMachine: { stop: vi.fn() },
        },
      })

      controller.handleTabChange(TAB_PIANO)
      expect(setActiveTabMock).toHaveBeenCalledWith(TAB_PIANO)

      dispose()
    })
  })

  it('handles swipe gestures across visible tabs', () => {
    createRoot((dispose) => {
      const [activeTab, setActiveTab] = createSignal<ActiveTab>(TAB_SINGING)
      const [swipeEnabled, setSwipeEnabled] = createSignal(true)

      const controller = useTabNavigationController({
        activeTab,
        setActiveTab,
        swipeNavEnabled: swipeEnabled,
        practiceScope: () => 'singing',
        uiMode: () => 'advanced',
        closeSingingZen: vi.fn(),
        closeChallengeStage: vi.fn(),
        resetPlaybackState: vi.fn(),
        practiceEngine: { stopMic: vi.fn() },
        micActive: () => false,
        fallingNotes: {
          gameState: () => 'idle',
          stopMic: vi.fn(),
          isMicActive: () => false,
        },
        pianoPerformance: {
          transport: { pause: vi.fn(), stop: vi.fn() },
        },
        guitarCtx: {
          guitar: {
            gameState: () => 'idle',
            stopGame: vi.fn(),
            stopAllMic: vi.fn(),
            releaseGuitarInputDevice: vi.fn(),
            applyGuitarInputDevice: vi.fn(),
          },
          drumMachine: { stop: vi.fn() },
        },
      })

      const canvasTarget = document.createElement('canvas')
      const buttonTarget = document.createElement('button')

      // 1. Swipe disabled
      setSwipeEnabled(false)
      controller.handleTouchStart({
        target: canvasTarget,
        touches: [{ clientX: 500, clientY: 200 }],
      } as unknown as TouchEvent)
      controller.handleTouchEnd({
        changedTouches: [{ clientX: 100, clientY: 200 }],
      } as unknown as TouchEvent)
      // eslint-disable-next-line solid/reactivity
      expect(activeTab()).toBe(TAB_SINGING)

      // 2. Swiping on a button should be ignored
      setSwipeEnabled(true)
      controller.handleTouchStart({
        target: buttonTarget,
        touches: [{ clientX: 500, clientY: 200 }],
      } as unknown as TouchEvent)
      controller.handleTouchEnd({
        changedTouches: [{ clientX: 100, clientY: 200 }],
      } as unknown as TouchEvent)
      // eslint-disable-next-line solid/reactivity
      expect(activeTab()).toBe(TAB_SINGING)

      // 3. Swipe left (deltaX > 350 on 1000px window) -> advances to next tab
      controller.handleTouchStart({
        target: canvasTarget,
        touches: [{ clientX: 600, clientY: 200 }],
      } as unknown as TouchEvent)
      controller.handleTouchEnd({
        changedTouches: [{ clientX: 100, clientY: 210 }],
      } as unknown as TouchEvent)
      // eslint-disable-next-line solid/reactivity
      expect(activeTab()).toBe(TAB_EXERCISES)

      // 4. Swipe right (deltaX < -350) -> returns to previous tab
      controller.handleTouchStart({
        target: canvasTarget,
        touches: [{ clientX: 100, clientY: 200 }],
      } as unknown as TouchEvent)
      controller.handleTouchEnd({
        changedTouches: [{ clientX: 600, clientY: 210 }],
      } as unknown as TouchEvent)
      // eslint-disable-next-line solid/reactivity
      expect(activeTab()).toBe(TAB_SINGING)

      dispose()
    })
  })

  it('runs cleanup on tab transitions for singing, piano, and guitar', () => {
    createRoot((dispose) => {
      let listener: (prev: ActiveTab, next: ActiveTab) => void = () => {}
      vi.spyOn(uiStore, 'onTabTransition').mockImplementation((fn) => {
        listener = fn
      })

      const resetPlaybackMock = vi.fn()
      const practiceStopMicMock = vi.fn()
      const pianoPauseMock = vi.fn()
      const pianoStopMock = vi.fn()
      const pianoStopMicMock = vi.fn()
      const guitarStopGameMock = vi.fn()
      const guitarStopAllMicMock = vi.fn()
      const guitarReleaseInputMock = vi.fn()
      const guitarApplyInputMock = vi.fn()
      const drumStopMock = vi.fn()
      const onIncMock = vi.fn()

      const [pianoGameState, setPianoGameState] = createSignal('playing')
      const [guitarGameState] = createSignal('running')

      useTabNavigationController({
        activeTab: () => TAB_HOME,
        setActiveTab: vi.fn(),
        swipeNavEnabled: () => true,
        practiceScope: () => 'all',
        uiMode: () => 'advanced',
        closeSingingZen: vi.fn(),
        closeChallengeStage: vi.fn(),
        resetPlaybackState: resetPlaybackMock,
        practiceEngine: { stopMic: practiceStopMicMock },
        micActive: () => true,
        fallingNotes: {
          gameState: pianoGameState,
          stopMic: pianoStopMicMock,
          isMicActive: () => true,
        },
        pianoPerformance: {
          transport: { pause: pianoPauseMock, stop: pianoStopMock },
        },
        guitarCtx: {
          guitar: {
            gameState: guitarGameState,
            stopGame: guitarStopGameMock,
            stopAllMic: guitarStopAllMicMock,
            releaseGuitarInputDevice: guitarReleaseInputMock,
            applyGuitarInputDevice: guitarApplyInputMock,
          },
          drumMachine: { stop: drumStopMock },
        },
        onGuitarDrumActivationInc: onIncMock,
      })

      // 1. Transition away from Singing
      listener(TAB_SINGING, TAB_HOME)
      expect(resetPlaybackMock).toHaveBeenCalled()
      expect(practiceStopMicMock).toHaveBeenCalled()

      // 2. Transition away from Piano (playing state)
      listener(TAB_PIANO, TAB_HOME)
      expect(pianoPauseMock).toHaveBeenCalled()
      expect(pianoStopMicMock).toHaveBeenCalled()

      // 2b. Transition away from Piano (countdown state)
      setPianoGameState('countdown')
      listener(TAB_PIANO, TAB_HOME)
      expect(pianoStopMock).toHaveBeenCalled()

      // 3. Transition away from Guitar
      listener(TAB_GUITAR, TAB_HOME)
      expect(guitarStopGameMock).toHaveBeenCalled()
      expect(guitarStopAllMicMock).toHaveBeenCalled()
      expect(guitarReleaseInputMock).toHaveBeenCalled()
      expect(drumStopMock).toHaveBeenCalled()
      expect(onIncMock).toHaveBeenCalled()

      // 4. Transition into Guitar
      listener(TAB_HOME, TAB_GUITAR)
      expect(guitarApplyInputMock).toHaveBeenCalled()

      dispose()
    })
  })
})
