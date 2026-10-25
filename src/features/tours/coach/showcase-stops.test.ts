// Where Merc stands on the tab bar in "Show me around", and what he says
// there. Every line is held to the menu it is said over: a room the scope or
// Simple mode hides is never named, and the phone's stops are the rail's own
// buttons, found by the ids the rail gives them.

import { describe, expect, it } from 'vitest'
import { TAB_META } from '@/components/AppNavTabs'
import type { PracticeScope, UiMode } from '@/features/tabs/constants'
import { MOBILE_BAR_TAB_PRIORITY, mobileBarTabs, } from '@/features/tabs/constants'
import { RAIL_IDS, showcaseStops, STOP_MS } from './showcase-stops'

const SCOPES: readonly PracticeScope[] = ['all', 'singing', 'guitar', 'piano']
const MODES: readonly UiMode[] = ['advanced', 'simple']

describe('the desktop stops', () => {
  it('hops the four desktop groups and names the instrument', () => {
    const stops = showcaseStops({
      phone: false,
      scope: 'all',
      mode: 'advanced',
    })

    expect(stops.map((stop) => stop.target)).toEqual([
      '[data-tab-group="you"]',
      '[data-tab-group="practice"]',
      '[data-tab-group="play"]',
      '[data-tab-group="studio"]',
    ])
    expect(stops.map((stop) => stop.line)).toEqual([
      "Home is your day: today's session and your streak.",
      'Singing lives here, with the drills.',
      'Karaoke with your own songs. Jam with a friend.',
      'Your takes, read in plain words.',
    ])
  })

  it('names the instrument the menu is narrowed to, and drops the groups that hold none of what their line names', () => {
    // A guitar menu has no Karaoke, Jam or Analysis: Play shows the boards
    // and Studio only Settings.
    const stops = showcaseStops({
      phone: false,
      scope: 'guitar',
      mode: 'advanced',
    })

    expect(stops.map((stop) => stop.id)).toEqual(['you', 'practice'])
    expect(stops[1]?.line).toBe('Guitar lives here, with the drills.')
  })

  it('drops Play and Studio in Simple mode', () => {
    const stops = showcaseStops({ phone: false, scope: 'all', mode: 'simple' })

    expect(stops.map((stop) => stop.id)).toEqual(['you', 'practice'])
  })
})

describe('the phone stops', () => {
  it("hops the phone rail's four tabs, then More", () => {
    const stops = showcaseStops({
      phone: true,
      scope: 'guitar',
      mode: 'advanced',
    })

    expect(stops.map((stop) => stop.id)).toEqual([
      ...mobileBarTabs('guitar', 'advanced'),
      'more',
    ])
    expect(stops.find((stop) => stop.id === 'guitar')?.line).toBe(
      'Guitar lives here.',
    )
    expect(stops[0]?.target).toBe('nav[data-tour="mobile-tabbar"] #tab-home')
    expect(stops.at(-1)).toMatchObject({
      target: '[data-tour="mobile-tabbar-more"]',
      opens: '[data-testid="sheet-panel"][aria-label="More tabs"]',
    })
  })

  it('reads the rail as it stands: the Ascent, Progress and the instrument', () => {
    const lines = showcaseStops({ phone: true, scope: 'all', mode: 'advanced' })
      .map((stop) => stop.line)
      .slice(0, 4)

    expect(lines).toEqual([
      "Home is your day: today's session and your streak.",
      'The Ascent: a new climb every week.',
      "Progress: every take, and how it's moving.",
      'Singing lives here.',
    ])
  })

  it('names in More only rooms that More holds', () => {
    const more = (scope: PracticeScope, mode: UiMode): string | undefined =>
      showcaseStops({ phone: true, scope, mode }).at(-1)?.line

    expect(more('all', 'advanced')).toBe(
      'Everything else lives here: Karaoke, Jam, Ear Lab and the rest.',
    )
    // A guitar menu holds no Karaoke or Jam.
    expect(more('guitar', 'advanced')).toBe(
      'Everything else lives here: Ear Lab, Hear Yourself, Community and the rest.',
    )
    // Simple mode keeps You and Practice, and Settings.
    expect(more('all', 'simple')).toBe(
      'Everything else lives here: Ear Lab, Exercises, Hear Yourself and the rest.',
    )
  })

  it('finds each rail tab by the id the rail gives its button', () => {
    // The rail draws TAB_META's ids (BottomTabBar.tsx), which are not always
    // the tab's name: Piano's button is #tab-falling-notes.
    for (const tab of MOBILE_BAR_TAB_PRIORITY) {
      expect(RAIL_IDS[tab]).toBe(TAB_META[tab]?.id)
    }
    const piano = showcaseStops({
      phone: true,
      scope: 'piano',
      mode: 'advanced',
    })
    expect(piano.find((stop) => stop.id === 'piano')?.target).toBe(
      'nav[data-tour="mobile-tabbar"] #tab-falling-notes',
    )
  })
})

describe('every stop', () => {
  it('writes no em dash', () => {
    for (const phone of [false, true]) {
      for (const scope of SCOPES) {
        for (const mode of MODES) {
          for (const stop of showcaseStops({ phone, scope, mode })) {
            expect(stop.line).not.toMatch(/—/u)
          }
        }
      }
    }
  })

  it('has a target and a line, and at least two stops, on every menu', () => {
    for (const phone of [false, true]) {
      for (const scope of SCOPES) {
        for (const mode of MODES) {
          const stops = showcaseStops({ phone, scope, mode })
          expect(stops.length).toBeGreaterThanOrEqual(2)
          for (const stop of stops) {
            expect(stop.target.length).toBeGreaterThan(0)
            expect(stop.line.length).toBeGreaterThan(0)
          }
        }
      }
    }
  })

  it('stands for 2.5 s', () => {
    expect(STOP_MS).toBe(2500)
  })
})
