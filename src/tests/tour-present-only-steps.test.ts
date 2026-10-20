// A tour step about a control some hosts leave out
// ============================================================
//
// The mixer's Open in Karaoke Night is not drawn in the native app, in the
// Karaoke room or inside Karaoke Night itself, and the lyrics panel's sync
// and export buttons are not drawn until a song has lyrics. A tour step pointing at it
// would land on nothing there and show its words in the middle of the
// screen, about a button that is not on it. Such a step is marked
// `whenPresent`, and drops out of the tour when its target is not on the
// page as the tour starts.

import { afterEach, describe, expect, it } from 'vitest'
import type { WalkthroughStep } from '@/stores/app-store'
import { endWalkthrough, startTour, STEM_MIXER_TOUR_STEPS, tourSteps, } from '@/stores/app-store'

const steps: WalkthroughStep[] = [
  {
    title: 'Always',
    description: 'Here on every host.',
    targetSelector: '[data-tour="always"]',
  },
  {
    title: 'Sometimes',
    description: 'Only where the host draws it.',
    targetSelector: '[data-tour="sometimes"]',
    whenPresent: true,
  },
]

afterEach(() => {
  endWalkthrough()
  document.body.innerHTML = ''
})

describe('a step only some hosts can show', () => {
  it('drops out when its target is not on the page', () => {
    startTour(steps, 'mixer')

    expect(tourSteps().map((step) => step.title)).toEqual(['Always'])
  })

  it('stays when its target is there', () => {
    document.body.innerHTML = '<button data-tour="sometimes"></button>'

    startTour(steps, 'mixer')

    expect(tourSteps().map((step) => step.title)).toEqual([
      'Always',
      'Sometimes',
    ])
  })

  it('is how the mixer tour treats Karaoke Night', () => {
    const night = STEM_MIXER_TOUR_STEPS.find(
      (step) => step.targetSelector === '[data-tour="mixer.karaoke-night"]',
    )

    expect(night?.whenPresent).toBe(true)
  })

  it('is how the mixer tour treats the lyrics panel’s own buttons', () => {
    // Sync and export show once a song has lyrics; without them the two
    // steps would talk about buttons that are not there.
    const lyricButtons = STEM_MIXER_TOUR_STEPS.filter((step) =>
      [
        '[data-tour="mixer.lyric-sync"]',
        '[data-tour="mixer.lyric-export"]',
      ].includes(step.targetSelector),
    )

    expect(lyricButtons.map((step) => step.whenPresent)).toEqual([true, true])
  })
})
