import { describe, expect, it } from 'vitest'
import { TAB_CHALLENGES, TAB_EXERCISES, TAB_GROUPS, TAB_GUITAR, TAB_ORDER, TAB_PIANO, } from '@/features/tabs/constants'

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

  it('keeps Guitar immediately before Exercises (their fixed order)', () => {
    const guitar = TAB_ORDER.indexOf(TAB_GUITAR)
    const exercises = TAB_ORDER.indexOf(TAB_EXERCISES)
    expect(guitar).toBeGreaterThanOrEqual(0)
    expect(exercises).toBe(guitar + 1)
  })

  it('includes every tab the swipe gesture steps through', () => {
    // Regression: Exercises used to be missing from the hand-maintained swipe
    // array, so swiping skipped it entirely.
    for (const tab of [TAB_PIANO, TAB_GUITAR, TAB_EXERCISES, TAB_CHALLENGES]) {
      expect(TAB_ORDER).toContain(tab)
    }
  })
})
