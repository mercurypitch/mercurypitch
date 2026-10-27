// @vitest-environment jsdom
// ============================================================
// A room's tour of the Guide's kind: its page tour, or for Singing the
// Guide's section
// ============================================================
//
// The plan's "Show me around" and the Map's "Take the tour" ask the room tour
// door for a room's tour. Where the tab has no Merc tour, the door starts this
// kind, through `hasGuideRoomTour` and `startGuideRoomTour` (startRoomTour in
// src/features/tours/room-tour.ts, whose tests cover that choice). A tab with
// a page tour gets that tour. Singing never had one, being the Guide's own
// subject, so it gets the Guide's Singing section, as the Guide starts it:
// under the 'guide' key, with the steps for the viewport it starts in. A tab
// with neither gets nothing, and the native build, which runs no spotlight,
// gets nothing at all.
//
// The funnel's call is the observable key, the precedent of
// app-store.tour-events.test.ts; the viewport is faked as in
// src/tests/analysis-tour-viewport.test.ts.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TAB_GUITAR, TAB_SINGING, TAB_VOICE_HISTORY, } from '@/features/tabs/constants'
import { trackTour } from '@/lib/guide-funnel'
import type * as NativeBuild from '@/lib/native-build'
import type * as AppStoreModule from '@/stores/app-store'
import { endWalkthrough, hasGuideRoomTour, hasPageTour, PAGE_TOURS, startGuideRoomTour, tourSteps, WALKTHROUGH_STEPS, walkthroughActive, } from '@/stores/app-store'

const viewport = vi.hoisted(() => ({ narrow: false }))

vi.mock('@/lib/use-viewport', () => ({ isNarrow: () => viewport.narrow }))
vi.mock('@/lib/guide-funnel', () => ({ trackTour: vi.fn() }))

/** The Guide's Singing section as a viewport shows it. */
const singingFor = (narrow: boolean) =>
  WALKTHROUGH_STEPS.filter(
    (step) =>
      step.section === 'practice' &&
      (step.viewport === undefined ||
        step.viewport === (narrow ? 'mobile' : 'desktop')),
  )

beforeEach(() => {
  vi.mocked(trackTour).mockClear()
  localStorage.clear()
  viewport.narrow = false
})

afterEach(() => {
  endWalkthrough()
})

describe("a room's tour", () => {
  it.each([
    ['a phone', true],
    ['a desktop', false],
  ])(
    "starts the Guide's Singing section for Singing on %s, from its first step for that viewport",
    (_name, narrow) => {
      // Arrange
      viewport.narrow = narrow

      // Act
      startGuideRoomTour(TAB_SINGING)

      // Assert
      expect(hasPageTour(TAB_SINGING)).toBe(false)
      expect(hasGuideRoomTour(TAB_SINGING)).toBe(true)
      expect(walkthroughActive()).toBe(true)
      expect(tourSteps()).toEqual(singingFor(narrow))
      expect(tourSteps()[0]).toBe(singingFor(narrow)[0])
      expect(trackTour).toHaveBeenCalledExactlyOnceWith('tour_start', 'guide', {
        of: singingFor(narrow).length,
      })
    },
  )

  it('shows a phone none of the desktop-only steps of the Singing section', () => {
    // Arrange
    viewport.narrow = true

    // Act
    startGuideRoomTour(TAB_SINGING)

    // Assert
    expect(tourSteps().some((step) => step.viewport === 'desktop')).toBe(false)
    expect(tourSteps().some((step) => step.viewport === 'mobile')).toBe(true)
  })

  it('starts the page tour of a tab that has one, under its own key', () => {
    // Act
    startGuideRoomTour(TAB_GUITAR)

    // Assert
    const guitar = PAGE_TOURS[TAB_GUITAR] ?? []
    expect(hasGuideRoomTour(TAB_GUITAR)).toBe(true)
    expect(tourSteps().length).toBeGreaterThan(0)
    expect(tourSteps().every((step) => guitar.includes(step))).toBe(true)
    expect(trackTour).toHaveBeenCalledExactlyOnceWith(
      'tour_start',
      'guitar',
      expect.anything(),
    )
  })

  it('gives a tab with neither a page tour nor a Guide section nothing', () => {
    // Act
    startGuideRoomTour(TAB_VOICE_HISTORY)

    // Assert
    expect(hasGuideRoomTour(TAB_VOICE_HISTORY)).toBe(false)
    expect(walkthroughActive()).toBe(false)
    expect(trackTour).not.toHaveBeenCalled()
  })
})

describe("a room's tour on the native build", () => {
  afterEach(() => {
    vi.doUnmock('@/lib/native-build')
    vi.resetModules()
  })

  it('has none, not even Singing, and starts none', async () => {
    // Arrange: the store as the native shell loads it
    vi.resetModules()
    vi.doMock('@/lib/native-build', async (importOriginal) => ({
      ...(await importOriginal<typeof NativeBuild>()),
      IS_NATIVE_BUILD: true,
    }))
    const store: typeof AppStoreModule = await import('@/stores/app-store')

    // Act
    store.startGuideRoomTour(TAB_SINGING)
    store.startGuideRoomTour(TAB_GUITAR)

    // Assert
    expect(store.TOURS_AVAILABLE).toBe(false)
    expect(store.hasGuideRoomTour(TAB_SINGING)).toBe(false)
    expect(store.hasGuideRoomTour(TAB_GUITAR)).toBe(false)
    expect(store.walkthroughActive()).toBe(false)
  })
})
