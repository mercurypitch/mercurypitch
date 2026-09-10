// ============================================================
// The voice tour can only point at things that are on screen
// ============================================================
//
// Both facts here were bugs first, caught by the release walk rather than by
// anything cheap: four of five steps spotlighted nothing because Settings'
// tabs are a switch and not a scroll, and the pill exists in two places
// depending on the viewport. The walk is still the real check — it proves
// the target is VISIBLE — but it needs a build, a server and two browsers.
// This is the half that runs on every PR.

import { describe, expect, it } from 'vitest'
import { TAB_SETTINGS } from '@/features/tabs/constants'
import { VOICE_TOUR_STEPS } from '@/stores/app-store'

const SINGING_TAB = '[data-testid="settings-tab-singing"]'
const PILL = '[data-voice-control-hud]'

describe('the voice tour', () => {
  it('opens the Settings tab that holds what it points at', () => {
    const settingsSteps = VOICE_TOUR_STEPS.filter(
      (step) => step.requiredTab === TAB_SETTINGS,
    )
    expect(settingsSteps.length).toBeGreaterThan(0)
    for (const step of settingsSteps) {
      expect(
        step.navigate,
        `${step.title} never opens its Settings tab`,
      ).toContain(SINGING_TAB)
    }
  })

  it('spotlights the pill once per viewport, never twice on one', () => {
    const pillSteps = VOICE_TOUR_STEPS.filter(
      (step) => step.targetSelector === PILL,
    )
    // Desktop puts it bottom-left with room above; a phone docks it in the
    // header, where a tooltip placed above opens off the top of the screen.
    expect(pillSteps.map((step) => step.viewport).sort()).toEqual([
      'desktop',
      'mobile',
    ])
    expect(pillSteps.map((step) => step.placement)).toEqual(['top', 'bottom'])
  })

  it('teaches Mercury Sing, which nothing else in the app does', () => {
    // It is the one feature with no button at all: the only way in is to say
    // it. A tour that skipped it would leave it undiscoverable.
    const said = VOICE_TOUR_STEPS.map((step) => step.description).join(' ')
    expect(said).toContain('what song is this')
    expect(said).toContain('Mercury Sing')
  })
})
