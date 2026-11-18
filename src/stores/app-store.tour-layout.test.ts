// @vitest-environment jsdom
// ============================================================
// The Guide's tours pick their steps by the layout the screen shows
// ============================================================
//
// A step that exists twice, once for a phone's layout and once for a desk's,
// is picked as the tour starts. It was picked by the width alone, and a
// phone on its side is wider than the 768 px breakpoint: at 844x390 the
// Singing tab draws its phone stage, and the Singing and Toolbar sections
// showed the desk's steps, fourteen bubbles in the middle of the screen
// with nothing lit (scripts/walk-tours.mjs, MOBILE=1 VIEWPORT=844x390).
//
// So a step for a phone's layout asks isPhoneStage, and a step whose target
// changes at the breakpoint alone asks the width: the bottom tab bar, which
// a phone on its side wider than 768 px does not have (it keeps the top
// bar), and the Guitar and Piano pages, which draw their desk layouts there.
// The walk is the real check that each picked step finds its target; this
// pins the choice.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { TAB_GUITAR, TAB_PIANO } from '@/features/tabs/constants'
import { endWalkthrough, startPageTour, startVoiceTour, startWalkthrough, tourSteps, } from '@/stores/app-store'

const viewport = vi.hoisted(() => ({ narrow: false, sideways: false }))

vi.mock('@/lib/use-viewport', () => ({
  isNarrow: () => viewport.narrow,
  isPhoneStage: () => viewport.narrow || viewport.sideways,
}))

const UPRIGHT = { narrow: true, sideways: false }
const SIDEWAYS_WIDE = { narrow: false, sideways: true }
const SIDEWAYS_NARROW = { narrow: true, sideways: true }
const DESK = { narrow: false, sideways: false }

/** The titles of a tour started on a screen. */
function titlesOn(
  screen: { narrow: boolean; sideways: boolean },
  start: () => void,
): string[] {
  Object.assign(viewport, screen)
  start()
  const titles = tourSteps().map((step) => step.title)
  endWalkthrough()
  return titles
}

const singing = () => startWalkthrough(['practice'])
const toolbar = () => startWalkthrough(['toolbar'])

afterEach(() => {
  endWalkthrough()
  Object.assign(viewport, DESK)
})

describe('a phone on its side, wider than the breakpoint', () => {
  it("walks the Singing tab's phone stage, and not the bottom tab bar it has no room for", () => {
    const titles = titlesOn(SIDEWAYS_WIDE, singing)

    expect({
      stage: ['Your practice bar', 'Pick a song'].filter((t) =>
        titles.includes(t),
      ),
      elsewhere: [
        'Mic Button',
        'Play / Pause / Stop',
        'Practice Mode',
        'Move around',
      ].filter((t) => titles.includes(t)),
    }).toEqual({ stage: ['Your practice bar', 'Pick a song'], elsewhere: [] })
  })

  it("shows the toolbar as the phone stage's options sheet", () => {
    expect(titlesOn(SIDEWAYS_WIDE, toolbar)).toEqual(['Practice options'])
  })

  it('walks the desk layouts the Guitar and Piano pages draw there', () => {
    const tours = [TAB_GUITAR, TAB_PIANO].map((tab) =>
      titlesOn(SIDEWAYS_WIDE, () => startPageTour(tab)),
    )
    const desk = [TAB_GUITAR, TAB_PIANO].map((tab) =>
      titlesOn(DESK, () => startPageTour(tab)),
    )

    expect(tours).toEqual(desk)
  })

  it('opens the voice tour under the pill docked in the header', () => {
    Object.assign(viewport, SIDEWAYS_WIDE)

    startVoiceTour()

    expect(tourSteps()[0]).toMatchObject({
      title: 'The mic pill',
      placement: 'bottom',
    })
  })
})

describe('everywhere else, the steps it always had', () => {
  it('keeps the bottom tab bar where there is one: upright, and on its side when narrow', () => {
    const shown = [UPRIGHT, SIDEWAYS_NARROW].map((screen) =>
      titlesOn(screen, singing).includes('Move around'),
    )

    expect(shown).toEqual([true, true])
  })

  it("keeps a desk's Singing section on the desk's panel", () => {
    const titles = titlesOn(DESK, singing)

    expect(
      ['Mic Button', 'Practice Mode', 'Your practice bar'].map((t) =>
        titles.includes(t),
      ),
    ).toEqual([true, true, false])
  })

  it("keeps an upright phone's Guitar and Piano on their phone layouts", () => {
    const guitar = titlesOn(UPRIGHT, () => startPageTour(TAB_GUITAR))
    const piano = titlesOn(UPRIGHT, () => startPageTour(TAB_PIANO))

    expect([
      guitar.includes('Sound, view & more'),
      guitar.includes('Three ways to play'),
      piano.includes('Pick a song'),
      piano.includes('Open Piano Night'),
    ]).toEqual([true, false, true, false])
  })
})
