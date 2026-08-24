// ============================================================
// Cinematic onboarding preference tests — privacy-safe persistence
// ============================================================

import { describe, expect, it } from 'vitest'
import { clearCinematicOnboardingPreference, readCinematicOnboardingPreference, writeCinematicOnboardingPreference, } from './cinematic-onboarding-preference'

function createMemoryStorage(): Pick<
  Storage,
  'getItem' | 'setItem' | 'removeItem'
> {
  const values = new Map<string, string>()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  }
}

describe('cinematic onboarding preference', () => {
  it('records completion per media revision outside cue state', () => {
    const storage = createMemoryStorage()

    writeCinematicOnboardingPreference(
      'corky-v0.7',
      'finished',
      storage,
      () => new Date('2026-08-24T12:00:00.000Z'),
    )

    expect(readCinematicOnboardingPreference('corky-v0.7', storage)).toEqual({
      revision: 'corky-v0.7',
      outcome: 'finished',
      recordedAt: '2026-08-24T12:00:00.000Z',
    })
    expect(
      readCinematicOnboardingPreference('corky-v0.8', storage),
    ).toBeUndefined()
  })

  it('ignores malformed data and supports a full local reset', () => {
    const storage = createMemoryStorage()
    storage.setItem('beside-cue:cinematic-onboarding', '{bad json')
    expect(
      readCinematicOnboardingPreference('corky-v0.7', storage),
    ).toBeUndefined()

    writeCinematicOnboardingPreference('corky-v0.7', 'dismissed', storage)
    clearCinematicOnboardingPreference(storage)
    expect(
      readCinematicOnboardingPreference('corky-v0.7', storage),
    ).toBeUndefined()
  })

  it('fails open when a WebView denies every storage operation', () => {
    const denied = {
      getItem() {
        throw new DOMException('Denied', 'SecurityError')
      },
      setItem() {
        throw new DOMException('Denied', 'SecurityError')
      },
      removeItem() {
        throw new DOMException('Denied', 'SecurityError')
      },
    }

    expect(() =>
      writeCinematicOnboardingPreference('corky-v0.7', 'finished', denied),
    ).not.toThrow()
    expect(
      readCinematicOnboardingPreference('corky-v0.7', denied),
    ).toBeUndefined()
    expect(() => clearCinematicOnboardingPreference(denied)).not.toThrow()
  })
})
