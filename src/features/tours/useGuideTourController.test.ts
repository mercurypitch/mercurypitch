// ============================================================
// useGuideTourController unit tests
// ============================================================

import { createRoot, createSignal } from 'solid-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as appStore from '@/stores/app-store'
import * as uiStore from '@/stores/ui-store'
import { useGuideTourController } from './useGuideTourController'

describe('useGuideTourController', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(appStore, 'startWalkthrough').mockImplementation(() => {})
    vi.spyOn(uiStore, 'dismissWelcome').mockImplementation(() => {})
  })

  it('manages opening and closing guide selection without welcome', () => {
    createRoot((dispose) => {
      const [showWelcome, setShowWelcome] = createSignal(false)
      const controller = useGuideTourController({
        showWelcome,
        setShowWelcome,
      })

      expect(controller.showGuideSelection()).toBe(false)
      expect(controller.guideFromWelcome()).toBe(false)

      controller.openGuideSelection()
      expect(controller.showGuideSelection()).toBe(true)
      expect(controller.guideFromWelcome()).toBe(false)
      // eslint-disable-next-line solid/reactivity
      expect(showWelcome()).toBe(false)

      controller.closeGuideSelection()
      expect(controller.showGuideSelection()).toBe(false)
      expect(controller.guideFromWelcome()).toBe(false)
      // eslint-disable-next-line solid/reactivity
      expect(showWelcome()).toBe(false)

      dispose()
    })
  })

  it('restores welcome overlay if backed out when opened from welcome', () => {
    createRoot((dispose) => {
      const [showWelcome, setShowWelcome] = createSignal(true)
      const controller = useGuideTourController({
        showWelcome,
        setShowWelcome,
      })

      // Open from welcome
      controller.openGuideSelection()
      expect(controller.showGuideSelection()).toBe(true)
      expect(controller.guideFromWelcome()).toBe(true)
      // eslint-disable-next-line solid/reactivity
      expect(showWelcome()).toBe(false)

      // Close without starting -> restores welcome
      controller.closeGuideSelection()
      expect(controller.showGuideSelection()).toBe(false)
      expect(controller.guideFromWelcome()).toBe(false)
      // eslint-disable-next-line solid/reactivity
      expect(showWelcome()).toBe(true)

      dispose()
    })
  })

  it('starts guide tour and dismisses welcome', () => {
    createRoot((dispose) => {
      const [showWelcome, setShowWelcome] = createSignal(true)
      const controller = useGuideTourController({
        showWelcome,
        setShowWelcome,
      })

      controller.openGuideSelection()
      expect(controller.guideFromWelcome()).toBe(true)

      controller.startGuideTour(['intro', 'features'])
      expect(appStore.startWalkthrough).toHaveBeenCalledWith([
        'intro',
        'features',
      ])
      expect(controller.showGuideSelection()).toBe(false)
      expect(controller.guideFromWelcome()).toBe(false)
      expect(uiStore.dismissWelcome).toHaveBeenCalled()

      dispose()
    })
  })
})
