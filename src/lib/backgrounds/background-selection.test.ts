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
