import { describe, expect, it } from 'vitest'
import { TAB_META } from '@/components/AppNavTabs'
import type { ActiveTab } from '@/features/tabs/constants'
import { isTabVisible, MAX_INLINE_GROUP_TABS, MOBILE_BAR_TAB_PRIORITY, mobileBarTabs, PRIMARY_TABS, splitGroupTabs, TAB_ANALYSIS, TAB_CHALLENGES, TAB_COMPOSE, TAB_EAR_LAB, TAB_EXERCISES, TAB_GROUPS, TAB_GUITAR, TAB_HOME, TAB_ORDER, TAB_PATH, TAB_PIANO, TAB_PROGRESS, TAB_SETTINGS, TAB_SINGING, TAB_VOICE_HISTORY, tabGroupOf, visibleTabOrder, } from '@/features/tabs/constants'

// These tests pin the single source of truth that drives BOTH the visible tab
// bar (AppNavTabs) and the mobile swipe navigation (App.tsx). If a tab is
// reordered, both follow automatically — and these guard against regressions
// like Guitar/Exercises drifting out of order on swipe.
describe('tab order', () => {
  it('flattens the groups in declared order', () => {
    const fromGroups = TAB_GROUPS.flatMap((g) => [...g.tabs])
    expect([...TAB_ORDER]).toEqual(fromGroups)
  })

  it('has no duplicate tabs across groups', () => {
    expect(new Set(TAB_ORDER).size).toBe(TAB_ORDER.length)
  })

  it('keeps Piano immediately before Guitar (the instrument selector order)', () => {
    const guitar = TAB_ORDER.indexOf(TAB_GUITAR)
    const piano = TAB_ORDER.indexOf(TAB_PIANO)
    expect(piano).toBeGreaterThanOrEqual(0)
    expect(guitar).toBe(piano + 1)
  })

  it('includes every tab the swipe gesture steps through', () => {
    // Regression: Exercises used to be missing from the hand-maintained swipe
    // array, so swiping skipped it entirely.
    for (const tab of [TAB_PIANO, TAB_GUITAR, TAB_EXERCISES, TAB_CHALLENGES]) {
      expect(TAB_ORDER).toContain(tab)
    }
  })

  it('keeps Progress immediately after Path', () => {
    const path = TAB_ORDER.indexOf(TAB_PATH)
    const progress = TAB_ORDER.indexOf(TAB_PROGRESS)

    expect(path).toBeGreaterThanOrEqual(0)
    expect(progress).toBe(path + 1)
  })

  it('keeps Hear Yourself immediately after Progress', () => {
    const progress = TAB_ORDER.indexOf(TAB_PROGRESS)
    const voiceHistory = TAB_ORDER.indexOf(TAB_VOICE_HISTORY)

    expect(progress).toBeGreaterThanOrEqual(0)
    expect(voiceHistory).toBe(progress + 1)
  })

  it.each(['all', 'singing', 'guitar', 'piano'] as const)(
    'keeps Progress visible in simple mode for the %s scope',
    (scope) => {
      expect(visibleTabOrder(scope, 'simple')).toContain(TAB_PROGRESS)
    },
  )

  it('pins the Progress navigation identity and accessible label', () => {
    expect(TAB_META[TAB_PROGRESS]).toMatchObject({
      id: 'tab-progress',
      ariaLabel: 'Practice progress',
    })
  })
})

describe('tab groups', () => {
  it('keeps orientation and personal records together in You', () => {
    const you = TAB_GROUPS.find((group) => group.id === 'you')
    expect(you?.tabs).toEqual([
      TAB_HOME,
      TAB_PATH,
      TAB_PROGRESS,
      TAB_VOICE_HISTORY,
    ])
    expect(tabGroupOf(TAB_VOICE_HISTORY)?.id).toBe('you')
  })

  it('keeps the Practice group an instrument selector plus drills', () => {
    const practice = TAB_GROUPS.find((g) => g.id === 'practice')
    expect(practice?.tabs).toEqual([
      TAB_SINGING,
      TAB_PIANO,
      TAB_GUITAR,
      TAB_EXERCISES,
      TAB_EAR_LAB,
    ])
  })

  it('never lets Settings overflow — it is the way back from simple mode', () => {
    const studio = TAB_GROUPS.find((g) => g.id === 'studio')
    expect(studio).toBeDefined()
    const { inline } = splitGroupTabs(
      studio?.tabs ?? [],
      TAB_COMPOSE,
      studio?.maxInline,
    )
    expect(inline).toContain(TAB_SETTINGS)
  })

  it('gives every group a label and at least one tab', () => {
    for (const group of TAB_GROUPS) {
      expect(group.label.length).toBeGreaterThan(0)
      expect(group.tabs.length).toBeGreaterThan(0)
    }
  })
})

describe('splitGroupTabs', () => {
  const four: ActiveTab[] = [TAB_SINGING, TAB_GUITAR, TAB_PIANO, TAB_EXERCISES]

  it('leaves a group at or under the cap alone', () => {
    const { inline, overflow } = splitGroupTabs(
      [TAB_HOME, TAB_PATH],
      TAB_HOME,
      MAX_INLINE_GROUP_TABS,
    )
    expect(inline).toEqual([TAB_HOME, TAB_PATH])
    expect(overflow).toEqual([])
  })

  it('folds everything past the cap into the overflow', () => {
    const { inline, overflow } = splitGroupTabs(four, TAB_SINGING)
    expect(inline).toEqual([TAB_SINGING, TAB_GUITAR, TAB_PIANO])
    expect(overflow).toEqual([TAB_EXERCISES])
  })

  it('promotes an overflowed active tab into the last inline slot', () => {
    // The bar must always show where you are; hiding the current tab in a
    // menu is worse than showing one fewer choice.
    const { inline, overflow } = splitGroupTabs(four, TAB_EXERCISES)
    expect(inline).toEqual([TAB_SINGING, TAB_GUITAR, TAB_EXERCISES])
    expect(overflow).toEqual([TAB_PIANO])
  })

  it('keeps declared order in the overflow after a promotion', () => {
    const five: ActiveTab[] = [...four, TAB_ANALYSIS]
    const { inline, overflow } = splitGroupTabs(five, TAB_ANALYSIS)
    expect(inline).toEqual([TAB_SINGING, TAB_GUITAR, TAB_ANALYSIS])
    expect(overflow).toEqual([TAB_PIANO, TAB_EXERCISES])
  })

  it('never drops or duplicates a tab', () => {
    for (const active of four) {
      const { inline, overflow } = splitGroupTabs(four, active)
      const all = [...inline, ...overflow]
      expect(new Set(all).size).toBe(four.length)
      expect([...all].sort()).toEqual([...four].sort())
    }
  })

  it('honours a per-group cap override', () => {
    const { inline, overflow } = splitGroupTabs(four, TAB_SINGING, 4)
    expect(inline).toEqual(four)
    expect(overflow).toEqual([])
  })
})

describe('simple mode after the regrouping', () => {
  // Regression guard: simple mode used to be defined as "the practice group
  // plus Settings". Moving Home and Path into their own group would have
  // silently taken the daily hub away from every simple-mode user.
  it('keeps Home and the Ascent reachable', () => {
    expect(isTabVisible(TAB_HOME, 'all', 'simple')).toBe(true)
    expect(isTabVisible(TAB_PATH, 'all', 'simple')).toBe(true)
  })

  it('keeps Hear Yourself reachable for every replay-owning practice scope', () => {
    expect(isTabVisible(TAB_VOICE_HISTORY, 'singing', 'simple')).toBe(true)
    expect(visibleTabOrder('singing', 'simple')).toContain(TAB_VOICE_HISTORY)
    expect(isTabVisible(TAB_VOICE_HISTORY, 'guitar', 'simple')).toBe(true)
    expect(visibleTabOrder('guitar', 'simple')).toContain(TAB_VOICE_HISTORY)
    expect(isTabVisible(TAB_VOICE_HISTORY, 'piano', 'simple')).toBe(true)
    expect(visibleTabOrder('piano', 'simple')).toContain(TAB_VOICE_HISTORY)
  })

  it('still hides the Play and Studio surfaces', () => {
    expect(isTabVisible(TAB_CHALLENGES, 'all', 'simple')).toBe(false)
    expect(isTabVisible(TAB_COMPOSE, 'all', 'simple')).toBe(false)
  })

  it('keeps Settings, the way back out of simple mode', () => {
    expect(isTabVisible(TAB_SETTINGS, 'all', 'simple')).toBe(true)
  })

  it('shows nothing simple mode does not already allow', () => {
    const simple = visibleTabOrder('all', 'simple')
    for (const tab of simple) {
      expect([...PRIMARY_TABS, TAB_SETTINGS]).toContain(tab)
    }
  })
})

describe('primary groups and phone priority', () => {
  it('derives the primary tabs from the You and Practice groups', () => {
    const expected = TAB_GROUPS.filter((g) =>
      ['you', 'practice'].includes(g.id),
    ).flatMap((g) => [...g.tabs])
    expect([...PRIMARY_TABS]).toEqual(expected)
  })

  it('puts Home first, so the phone bar always opens on the hub', () => {
    expect(MOBILE_BAR_TAB_PRIORITY[0]).toBe(TAB_HOME)
  })

  it.each([
    ['all', TAB_SINGING],
    ['singing', TAB_SINGING],
    ['guitar', TAB_GUITAR],
    ['piano', TAB_PIANO],
  ] as const)(
    'keeps the %s scope instrument in the fourth phone slot',
    (scope, instrument) => {
      expect(mobileBarTabs(scope, 'advanced')).toEqual([
        TAB_HOME,
        TAB_PATH,
        TAB_PROGRESS,
        instrument,
      ])
    },
  )

  it('keeps Hear Yourself in More without hiding it in simple singing mode', () => {
    const bar = mobileBarTabs('singing', 'simple')
    const more = visibleTabOrder('singing', 'simple').filter(
      (tab) => !bar.includes(tab),
    )

    expect(bar).not.toContain(TAB_VOICE_HISTORY)
    expect(more).toContain(TAB_VOICE_HISTORY)
  })
})
