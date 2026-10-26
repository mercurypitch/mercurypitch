// A tour step about a control some hosts leave out
// ============================================================
//
// The mixer's Open in Karaoke Night is not drawn in the native app, in the
// Karaoke room or inside Karaoke Night itself, and the lyrics panel's sync
// and export buttons are not drawn until a song has lyrics. Home's plan card
// is drawn only in the week after the plan, and never in the native app. A
// tour step pointing at one of them would land on nothing there and show its
// words in the middle of the screen, about something that is not on it. Such
// a step is marked `whenPresent`, and drops out of the tour when its target
// is not on the page as the tour starts.

import { afterEach, describe, expect, it } from 'vitest'
import { TAB_HOME } from '@/features/tabs/constants'
import type { WalkthroughStep } from '@/stores/app-store'
import { endWalkthrough, PAGE_TOURS, startTour, STEM_MIXER_TOUR_STEPS, tourSteps, } from '@/stores/app-store'

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

describe('Home’s plan card, drawn only in the week after the plan', () => {
  const home = PAGE_TOURS[TAB_HOME] ?? []

  it('has a step that drops out without the card', () => {
    const plan = home.find(
      (step) => step.targetSelector === '[data-testid="home-plan-card"]',
    )

    expect(plan?.whenPresent).toBe(true)
  })

  it('opens Home’s tour on the card while it is there', () => {
    document.body.innerHTML = '<section data-testid="home-plan-card"></section>'

    startTour(home, 'home')

    expect(tourSteps()[0]?.title).toBe('Your plan')
  })

  it('leaves Home’s tour as it was without the card', () => {
    startTour(home, 'home')

    const titles = tourSteps().map((step) => step.title)
    expect(titles).not.toContain('Your plan')
    expect(titles[0]).toBe('Your daily home')
  })
})

describe('Home’s weekly Check-up card, drawn only while one is due', () => {
  const home = PAGE_TOURS[TAB_HOME] ?? []

  it('has a step that drops out without the card', () => {
    const checkup = home.find(
      (step) => step.targetSelector === '[data-testid="home-checkup-card"]',
    )

    expect(checkup?.whenPresent).toBe(true)
  })

  it('shows the step while the card is there', () => {
    document.body.innerHTML =
      '<section data-testid="home-checkup-card"></section>'

    startTour(home, 'home')

    expect(tourSteps()[0]?.title).toBe('Your weekly Check-up')
  })
})
