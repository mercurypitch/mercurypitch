import { afterEach, describe, expect, it } from 'vitest'
import { loadExperimentalFeatures, resetExperimentalFeaturesStoreForTests, } from '@/stores/experimental-features-store'
import type { PracticeScope, UiMode } from './constants'
import { isTabAvailabilityPending, isTabAvailable, isTabVisible, mobileBarTabs, TAB_HOME, TAB_ORDER, TAB_STUDIO_NIGHT, visibleTabOrder, } from './constants'

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

    expect(visibleTabOrder('all', 'advanced')).toEqual(
      before.filter((tab) => tab !== TAB_STUDIO_NIGHT),
    )
    for (const tab of TAB_ORDER.filter((t) => t !== TAB_STUDIO_NIGHT))
      expect(isTabAvailable(tab), tab).toBe(true)
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
