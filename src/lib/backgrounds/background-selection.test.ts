// ============================================================
// Background selection persistence tests
// ============================================================

import { describe, expect, it } from 'vitest'
import type { BackgroundSelectionStorage } from './background-selection'
import { BACKGROUND_SELECTION_KEYS, persistBackgroundId, readPersistedBackgroundId, } from './background-selection'

function memoryStorage(): BackgroundSelectionStorage & {
  values: Map<string, string>
} {
  const values = new Map<string, string>()
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  }
}

describe('route-neutral background selection persistence', () => {
  it('stores and restores a known Piano Night preference', () => {
    const storage = memoryStorage()

    expect(persistBackgroundId('piano', 'piano-afterglow', storage)).toBe(true)
    expect(storage.values.get(BACKGROUND_SELECTION_KEYS.piano)).toBe(
      'piano-afterglow',
    )
    expect(readPersistedBackgroundId('piano', storage)).toBe('piano-afterglow')
  })

  it('rejects unknown and cross-surface identifiers', () => {
    const storage = memoryStorage()

    expect(persistBackgroundId('piano', 'karaoke-theatre', storage)).toBe(false)
    storage.setItem(BACKGROUND_SELECTION_KEYS.piano, 'room-stage')
    expect(readPersistedBackgroundId('piano', storage)).toBeNull()
  })

  it('honours the key Guitar Night used before it joined the catalog', () => {
    // Guitar Night picked rooms from its own module under its own key long
    // before there was a catalog. Ignoring that key would have moved every
    // existing player back to the default room on the release that unified
    // them — a silent takeaway of a setting they had chosen.
    const storage = memoryStorage()
    storage.setItem('pitchperfect_guitar_night_backdrop', 'valve-corner')

    expect(readPersistedBackgroundId('guitar', storage)).toBe('valve-corner')
  })

  it('prefers the current key once anything has been chosen since', () => {
    const storage = memoryStorage()
    storage.setItem('pitchperfect_guitar_night_backdrop', 'valve-corner')
    expect(persistBackgroundId('guitar', 'blue-hour-roof', storage)).toBe(true)

    expect(readPersistedBackgroundId('guitar', storage)).toBe('blue-hour-roof')
    // And the old key is left alone rather than rewritten: nothing else reads
    // it, and clearing it would break a rollback to the previous build.
    expect(storage.values.get('pitchperfect_guitar_night_backdrop')).toBe(
      'valve-corner',
    )
  })

  it('trusts a legacy key only for the surface that owned it', () => {
    // The legacy key holds a bare id, so a value that names another surface's
    // room must not be honoured just because it is a known id.
    const storage = memoryStorage()
    storage.setItem('pitchperfect_guitar_night_backdrop', 'piano-afterglow')

    expect(readPersistedBackgroundId('guitar', storage)).toBeNull()
    expect(readPersistedBackgroundId('piano', storage)).toBeNull()
  })

  it('ignores a legacy key for a surface that never had one', () => {
    const storage = memoryStorage()
    storage.setItem('pitchperfect_guitar_night_backdrop', 'valve-corner')

    expect(readPersistedBackgroundId('karaoke', storage)).toBeNull()
    expect(readPersistedBackgroundId('jam', storage)).toBeNull()
  })

  it('reads nothing at all when there is no storage', () => {
    // Safari in private mode, or site data blocked: the caller passes null
    // rather than a stub, and every read has to answer "no preference".
    expect(readPersistedBackgroundId('guitar', null)).toBeNull()
    expect(persistBackgroundId('guitar', 'valve-corner', null)).toBe(false)
  })

  it('fails closed when storage access is denied', () => {
    const storage: BackgroundSelectionStorage = {
      getItem: () => {
        throw new Error('denied')
      },
      setItem: () => {
        throw new Error('denied')
      },
    }

    expect(readPersistedBackgroundId('piano', storage)).toBeNull()
    expect(persistBackgroundId('piano', 'piano-afterglow', storage)).toBe(false)
  })
})
