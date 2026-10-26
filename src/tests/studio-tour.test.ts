// Studio tour tests — choose the mounted screen and respect the controls each layout renders.
import { afterEach, describe, expect, it, vi } from 'vitest'

const viewport = vi.hoisted(() => ({ narrow: false }))
vi.mock('@/lib/use-viewport', () => ({ isNarrow: () => viewport.narrow }))

import { TAB_STUDIO_NIGHT } from '@/features/tabs/constants'
import { TOUR_IDS } from '@/lib/tour-ids'
import { endWalkthrough, PAGE_TOUR_CATALOG, pageTourKey, pageTourSteps, startPageTour, tourSteps, walkthroughActive, } from '@/stores/app-store'

function mountHooks(hooks: string[]): void {
  document.body.replaceChildren(
    ...hooks.map((hook) => {
      const element = document.createElement('button')
      element.dataset.tour = `studio.${hook}`
      element.textContent = hook
      return element
    }),
  )
}

const targets = () => tourSteps().map((step) => step.targetSelector)
const selector = (hook: string) => `[data-tour="studio.${hook}"]`

afterEach(() => {
  endWalkthrough()
  document.body.replaceChildren()
  viewport.narrow = false
})

describe('Studio tour selection', () => {
  it('can launch from Guide on another page before Studio is mounted', () => {
    expect(TAB_STUDIO_NIGHT).toBe('studio-night')
    startPageTour(TAB_STUDIO_NIGHT)
    expect(walkthroughActive()).toBe(true)
    expect(targets()).toEqual(
      ['library', 'new-song', 'open-backup', 'local-note'].map(selector),
    )
    expect(tourSteps()[0].requiredTab).toBe(TAB_STUDIO_NIGHT)
  })

  it('opens the library tour with the permanent Studio identity', () => {
    mountHooks(['library', 'new-song', 'open-backup', 'local-note'])
    startPageTour(TAB_STUDIO_NIGHT)

    expect(walkthroughActive()).toBe(true)
    expect(targets()).toEqual(
      ['library', 'new-song', 'open-backup', 'local-note'].map(selector),
    )
    expect(
      tourSteps().every((step) => step.requiredTab === TAB_STUDIO_NIGHT),
    ).toBe(true)
    expect(pageTourKey(TAB_STUDIO_NIGHT)).toBe('studio')
    expect(TOUR_IDS.studio).toBe(20)
    expect(
      PAGE_TOUR_CATALOG.find((entry) => entry.tab === TAB_STUDIO_NIGHT)?.title,
    ).toBe('Studio')
  })

  it('keeps tablet arranging steps when the app considers the viewport narrow', () => {
    viewport.narrow = true
    const hooks = [
      'song-options',
      'add-takes',
      'view-controls',
      'snap',
      'timeline',
      'track-controls',
      'history',
      'transport',
      'sound',
      'export',
    ]
    mountHooks(['workspace', ...hooks])
    startPageTour(TAB_STUDIO_NIGHT)

    expect(targets()).toEqual(hooks.map(selector))
    expect(targets()).not.toContain(selector('mix'))
    expect(targets()).not.toContain(selector('timeline-overview'))
  })

  it('uses phone overview and Mix without pointing at absent arranging controls', () => {
    viewport.narrow = true
    const hooks = [
      'song-options',
      'add-takes',
      'timeline-overview',
      'mix',
      'history',
      'transport',
      'sound',
      'export',
    ]
    mountHooks(['workspace', ...hooks])
    const clicked = vi.fn()
    for (const button of document.querySelectorAll('button'))
      button.addEventListener('click', clicked)
    const before = document.body.innerHTML
    startPageTour(TAB_STUDIO_NIGHT)

    expect(targets()).toEqual(hooks.map(selector))
    expect(clicked).not.toHaveBeenCalled()
    expect(document.body.innerHTML).toBe(before)
    expect(
      tourSteps().every(
        (step) => step.navigate === undefined && step.reveal === undefined,
      ),
    ).toBe(true)
  })

  it('returns to the library tour after the workspace unmounts', () => {
    mountHooks(['workspace', 'song-options'])
    expect(pageTourSteps(TAB_STUDIO_NIGHT)?.[0].targetSelector).toBe(
      selector('song-options'),
    )
    mountHooks(['library', 'new-song'])
    startPageTour(TAB_STUDIO_NIGHT)
    expect(targets()).toEqual(
      ['library', 'new-song', 'open-backup', 'local-note'].map(selector),
    )
  })
})
