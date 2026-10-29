import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadExperimentalFeatures, resetExperimentalFeaturesStoreForTests, } from '@/stores/experimental-features-store'
import type { PracticeScope, UiMode } from './constants'
import type { ActiveTab } from './constants'
import { isTabAvailabilityPending, isTabAvailable, isTabVisible, mobileBarTabs, splitGroupTabs, TAB_ANALYSIS, TAB_CHALLENGES, TAB_COMMUNITY, TAB_COMPOSE, TAB_EAR_LAB, TAB_EXERCISES, TAB_GUITAR, TAB_HOME, TAB_JAM, TAB_KARAOKE, TAB_LEADERBOARD, TAB_PATH, TAB_PIANO, TAB_PROGRESS, TAB_SETTINGS, TAB_SINGING, TAB_STUDIO_NIGHT, TAB_VOICE_HISTORY, tabGroupOf, tabOrder, visibleTabOrder, } from './constants'

const SCOPES: PracticeScope[] = ['all', 'singing', 'guitar', 'piano']
const MODES: UiMode[] = ['simple', 'advanced']

/** Studio switched as the owner set it, as GET /api/features would say it. */
async function switchStudio(enabled: boolean): Promise<void> {
  await loadExperimentalFeatures({
    base: 'https://api.test',
    fetcher: async () => Response.json({ studio: enabled }),
  })
}

afterEach(() => {
  resetExperimentalFeaturesStoreForTests()
})

describe('an experimental tab', () => {
  it('is offered while its feature is on, as on the dev deploy', () => {
    expect(isTabAvailable(TAB_STUDIO_NIGHT)).toBe(true)
    expect(isTabVisible(TAB_STUDIO_NIGHT, 'all', 'advanced')).toBe(true)
    expect(visibleTabOrder('all', 'advanced')).toContain(TAB_STUDIO_NIGHT)
  })

  it('is offered nowhere once its feature is off, under any scope or mode', async () => {
    await switchStudio(false)

    expect(isTabAvailable(TAB_STUDIO_NIGHT)).toBe(false)
    for (const scope of SCOPES) {
      for (const mode of MODES) {
        expect(isTabVisible(TAB_STUDIO_NIGHT, scope, mode), scope + mode).toBe(
          false,
        )
        expect(visibleTabOrder(scope, mode)).not.toContain(TAB_STUDIO_NIGHT)
        expect(mobileBarTabs(scope, mode)).not.toContain(TAB_STUDIO_NIGHT)
      }
    }
  })

  it('takes nothing else with it', async () => {
    const before = visibleTabOrder('all', 'advanced')
    await switchStudio(false)

    expect([...visibleTabOrder('all', 'advanced')].sort()).toEqual(
      before.filter((tab) => tab !== TAB_STUDIO_NIGHT).sort(),
    )
    for (const tab of tabOrder()) expect(isTabAvailable(tab), tab).toBe(true)
  })

  it('waits on the startup read, and no other tab does', async () => {
    const read = switchStudio(true)
    const studioWaits = isTabAvailabilityPending(TAB_STUDIO_NIGHT)
    const homeWaits = isTabAvailabilityPending(TAB_HOME)
    await read

    expect([studioWaits, homeWaits]).toEqual([true, false])
    expect(isTabAvailabilityPending(TAB_STUDIO_NIGHT)).toBe(false)
  })
})

// The web entry connects the store before it renders (src/index.tsx), and the
// tests' shared setup does too. A module graph that never connects it, which
// is the native app's and a Playwright spec's in plain Node, has to fail
// closed: no experimental tab, and nothing waiting on a read nobody started.
describe('the tab constants before the store is connected', () => {
  it('offer no experimental tab, and no tab waits on the startup read', async () => {
    vi.resetModules()
    const fresh = await import('./constants')

    expect(fresh.isTabAvailable(fresh.TAB_STUDIO_NIGHT)).toBe(false)
    expect(fresh.isTabAvailabilityPending(fresh.TAB_STUDIO_NIGHT)).toBe(false)
    expect(fresh.visibleTabOrder('all', 'advanced')).not.toContain(
      fresh.TAB_STUDIO_NIGHT,
    )
    expect(fresh.isTabAvailable(fresh.TAB_COMPOSE)).toBe(true)
  })

  it('follow whatever they are connected to', async () => {
    vi.resetModules()
    const fresh = await import('./constants')
    let on = false

    fresh.connectTabExperiments({ on: () => on, pending: () => true })
    const offAnswer = fresh.isTabAvailable(fresh.TAB_STUDIO_NIGHT)
    on = true

    expect(offAnswer).toBe(false)
    expect(fresh.isTabAvailable(fresh.TAB_STUDIO_NIGHT)).toBe(true)
    expect(fresh.isTabAvailabilityPending(fresh.TAB_STUDIO_NIGHT)).toBe(true)
    expect(fresh.isTabAvailabilityPending(fresh.TAB_HOME)).toBe(false)
  })
})

// What mercurypitch.com showed before Studio existed, and still shows while it
// is off: the fourth group named Studio, holding Compose, Analysis and then
// Settings. Only while Studio is available does the group become Create.
const ORDER_WITHOUT_STUDIO: readonly ActiveTab[] = [
  TAB_HOME,
  TAB_PATH,
  TAB_PROGRESS,
  TAB_VOICE_HISTORY,
  TAB_SINGING,
  TAB_PIANO,
  TAB_GUITAR,
  TAB_EXERCISES,
  TAB_CHALLENGES,
  TAB_EAR_LAB,
  TAB_KARAOKE,
  TAB_JAM,
  TAB_COMMUNITY,
  TAB_LEADERBOARD,
  TAB_COMPOSE,
  TAB_ANALYSIS,
  TAB_SETTINGS,
]

describe('the Studio group while Studio is off', () => {
  it('is the group main shows: Studio, with Compose, Analysis and Settings', async () => {
    await switchStudio(false)

    const group = tabGroupOf(TAB_COMPOSE)
    expect(group?.id).toBe('studio')
    expect(group?.label).toBe('Studio')
    expect(group?.tabs).toEqual([TAB_COMPOSE, TAB_ANALYSIS, TAB_SETTINGS])
    expect(tabGroupOf(TAB_STUDIO_NIGHT)).toBeUndefined()
  })

  it('swipes in the order main swipes', async () => {
    await switchStudio(false)

    expect(visibleTabOrder('all', 'advanced')).toEqual(ORDER_WITHOUT_STUDIO)
  })

  it('never lets Settings overflow, whichever tab is open', async () => {
    await switchStudio(false)
    const group = tabGroupOf(TAB_SETTINGS)

    for (const mode of MODES) {
      const shown = (group?.tabs ?? []).filter((tab) =>
        isTabVisible(tab, 'all', mode),
      )
      for (const active of shown) {
        expect(
          splitGroupTabs(shown, active, group?.maxInline).inline,
          `${mode} ${active}`,
        ).toContain(TAB_SETTINGS)
      }
    }
  })
})

describe('the Studio group while Studio is on', () => {
  it('is Create, Studio first and Settings among the inline tabs', () => {
    const group = tabGroupOf(TAB_STUDIO_NIGHT)

    expect(group?.id).toBe('studio')
    expect(group?.label).toBe('Create')
    expect(group?.tabs).toEqual([
      TAB_STUDIO_NIGHT,
      TAB_COMPOSE,
      TAB_SETTINGS,
      TAB_ANALYSIS,
    ])
    expect(tabGroupOf(TAB_COMPOSE)).toBe(group)
  })

  it('swipes through Studio, Compose, Settings and then Analysis', () => {
    expect(visibleTabOrder('all', 'advanced').slice(-4)).toEqual([
      TAB_STUDIO_NIGHT,
      TAB_COMPOSE,
      TAB_SETTINGS,
      TAB_ANALYSIS,
    ])
  })

  it('keeps Settings in the bar in simple mode, the way back out of it', () => {
    const group = tabGroupOf(TAB_SETTINGS)

    for (const scope of SCOPES) {
      const shown = (group?.tabs ?? []).filter((tab) =>
        isTabVisible(tab, scope, 'simple'),
      )
      for (const active of shown) {
        expect(
          splitGroupTabs(shown, active, group?.maxInline).inline,
          `${scope} ${active}`,
        ).toContain(TAB_SETTINGS)
      }
    }
  })

  it('changes back to the Studio group when the owner switches Studio off', async () => {
    const before = tabGroupOf(TAB_COMPOSE)?.label
    await switchStudio(false)

    expect([before, tabGroupOf(TAB_COMPOSE)?.label]).toEqual([
      'Create',
      'Studio',
    ])
  })
})
