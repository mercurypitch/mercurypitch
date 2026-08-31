// ============================================================
// useGuideTourController — Walkthrough guide selection & launch controller
// ============================================================
//
// Manages the guide picker dialog state, tracks transition from welcome screen,
// and initiates multi-section walkthrough tours without losing modal focus.
//

import type { Accessor, Setter } from 'solid-js'
import { createSignal } from 'solid-js'
import { startWalkthrough } from '@/stores/app-store'
import { dismissWelcome } from '@/stores/ui-store'

export interface UseGuideTourControllerDeps {
  showWelcome: Accessor<boolean>
  setShowWelcome: (show: boolean) => void
}

export interface UseGuideTourControllerReturn {
  showGuideSelection: Accessor<boolean>
  setShowGuideSelection: Setter<boolean>
  guideFromWelcome: Accessor<boolean>
  setGuideFromWelcome: Setter<boolean>
  openGuideSelection: () => void
  closeGuideSelection: () => void
  startGuideTour: (sectionIds: string[]) => void
}

export function useGuideTourController(
  deps: UseGuideTourControllerDeps,
): UseGuideTourControllerReturn {
  const [showGuideSelection, setShowGuideSelection] = createSignal(false)
  // True when the guide picker was opened from the welcome overlay, so backing
  // out of the picker returns to welcome instead of dropping into the app.
  const [guideFromWelcome, setGuideFromWelcome] = createSignal(false)

  const openGuideSelection = () => {
    // Open the picker first so a tour surface is always up during the hand-off
    // (tourSurfaceOpen), then hide welcome WITHOUT marking it seen — closing
    // the picker can bring it back.
    setGuideFromWelcome(deps.showWelcome())
    setShowGuideSelection(true)
    deps.setShowWelcome(false)
  }

  const closeGuideSelection = () => {
    setShowGuideSelection(false)
    // Backed out of the picker → slide back to the welcome screen.
    if (guideFromWelcome()) {
      setGuideFromWelcome(false)
      deps.setShowWelcome(true)
    }
  }

  const startGuideTour = (sectionIds: string[]) => {
    // Start before closing the dialog so a tour surface stays open across the
    // hand-off (the deferred survey checks for one — see tourSurfaceOpen).
    startWalkthrough(sectionIds)
    setShowGuideSelection(false)
    // Committed to the tour → retire the welcome for good.
    if (guideFromWelcome()) {
      setGuideFromWelcome(false)
      dismissWelcome()
    }
  }

  return {
    showGuideSelection,
    setShowGuideSelection,
    guideFromWelcome,
    setGuideFromWelcome,
    openGuideSelection,
    closeGuideSelection,
    startGuideTour,
  }
}
