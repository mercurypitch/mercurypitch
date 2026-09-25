import { describe, expect, it } from 'vitest'
import { appModeBounce } from './app-mode-guard'
import { TAB_EAR_LAB, TAB_GUITAR, TAB_HOME, TAB_SINGING } from './constants'

describe('the App Mode guard', () => {
  it('bounces a tab the scope hides, on the web', () => {
    expect(appModeBounce(TAB_SINGING, 'guitar', 'advanced', false)).toBe(
      TAB_HOME,
    )
  })

  it('leaves a tab the scope shows, on the web', () => {
    expect(appModeBounce(TAB_GUITAR, 'guitar', 'advanced', false)).toBeNull()
    expect(appModeBounce(TAB_EAR_LAB, 'guitar', 'simple', false)).toBeNull()
  })

  it('never bounces under the native build: the doors reach their rooms', () => {
    // More > Settings > "I practice" = Guitar, then the Sing door.
    expect(appModeBounce(TAB_SINGING, 'guitar', 'advanced', true)).toBeNull()
    expect(appModeBounce(TAB_SINGING, 'piano', 'simple', true)).toBeNull()
  })
})
