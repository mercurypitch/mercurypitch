import { afterEach, describe, expect, it } from 'vitest'
import { loadExperimentalFeatures, resetExperimentalFeaturesStoreForTests, } from '@/stores/experimental-features-store'
import { appModeBounce } from './app-mode-guard'
import { TAB_EAR_LAB, TAB_GUITAR, TAB_HOME, TAB_SINGING, TAB_STUDIO_NIGHT, } from './constants'

/** Studio switched off for this page, as GET /api/features would say it. */
async function switchStudioOff(): Promise<void> {
  await loadExperimentalFeatures({
    base: 'https://api.test',
    fetcher: async () => Response.json({ studio: false }),
  })
}

describe('the App Mode guard', () => {
  afterEach(() => {
    resetExperimentalFeaturesStoreForTests()
  })

  it('bounces a tab the scope hides, on the web', () => {
    expect(appModeBounce(TAB_SINGING, 'guitar', 'advanced', false)).toBe(
      TAB_HOME,
    )
  })

  it('leaves a tab the scope shows, on the web', () => {
    expect(appModeBounce(TAB_GUITAR, 'guitar', 'advanced', false)).toBeNull()
    expect(appModeBounce(TAB_EAR_LAB, 'guitar', 'simple', false)).toBeNull()
  })

  it('never bounces an App Mode hidden tab under the native build: the doors reach their rooms', () => {
    // More > Settings > "I practice" = Guitar, then the Sing door.
    expect(appModeBounce(TAB_SINGING, 'guitar', 'advanced', true)).toBeNull()
    expect(appModeBounce(TAB_SINGING, 'piano', 'simple', true)).toBeNull()
  })

  it('leaves Studio where it is while its feature is on', () => {
    expect(appModeBounce(TAB_STUDIO_NIGHT, 'all', 'advanced', false)).toBeNull()
  })

  it('sends Studio home under either build once its feature is off', async () => {
    await switchStudioOff()

    expect(appModeBounce(TAB_STUDIO_NIGHT, 'all', 'advanced', false)).toBe(
      TAB_HOME,
    )
    expect(appModeBounce(TAB_STUDIO_NIGHT, 'all', 'advanced', true)).toBe(
      TAB_HOME,
    )
  })
})
