// ============================================================
// Stage glass preference — the clamp both rooms share
// ============================================================
//
// Karaoke Night's own numbers stay pinned in
// `karaoke-night/stage-transparency.test.ts`; this file is about the
// primitive underneath, and in particular the case that only appears once a
// room chooses a minimum of zero.

import type { Mock } from 'vitest'
import { describe, expect, it, vi } from 'vitest'
import type { ClampedPreferenceStorage } from './clamped-preference'
import { createClampedPreference } from './clamped-preference'

const SPEC = {
  storageKey: 'test_glass',
  defaultValue: 0.4,
  min: 0.05,
  max: 1,
  step: 0.05,
}

interface SpyStorage extends ClampedPreferenceStorage {
  setItem: Mock<(key: string, value: string) => void>
}

function storageOf(value: string | null): SpyStorage {
  return { getItem: () => value, setItem: vi.fn() }
}

describe('the shared stage glass preference', () => {
  it('hands back the spec it was given, for the slider to size itself', () => {
    expect(createClampedPreference(SPEC).spec).toEqual(SPEC)
  })

  it('restores a stored in-range value', () => {
    const preference = createClampedPreference(SPEC)
    expect(preference.load(storageOf('0.62'))).toBe(0.62)
  })

  it('falls back to the default for anything unusable', () => {
    const preference = createClampedPreference(SPEC)
    for (const stored of [null, '', '   ', 'not-a-number', 'Infinity']) {
      expect(preference.load(storageOf(stored))).toBe(SPEC.defaultValue)
    }
  })

  it('treats an out-of-range value as unusable rather than clamping it', () => {
    // Only a build with different bounds can write one, and quietly dragging
    // it to the nearest edge hands somebody a room they never chose.
    const preference = createClampedPreference(SPEC)
    expect(preference.load(storageOf('0.01'))).toBe(SPEC.defaultValue)
    expect(preference.load(storageOf('4'))).toBe(SPEC.defaultValue)
  })

  it('accepts a value sitting exactly on either bound', () => {
    const preference = createClampedPreference(SPEC)
    expect(preference.load(storageOf(String(SPEC.min)))).toBe(SPEC.min)
    expect(preference.load(storageOf(String(SPEC.max)))).toBe(SPEC.max)
  })

  /**
   * The reason the raw string is read before `Number()` touches it.
   *
   * `Number(null)` and `Number('')` are both 0. A room whose minimum is 0 —
   * Guitar Night's is, because zero has to mean "the room exactly as it
   * shipped" — would otherwise read a missing preference as a deliberate zero
   * and never once show its own default.
   */
  it('still finds its default when the minimum is zero and nothing is stored', () => {
    const preference = createClampedPreference({
      storageKey: 'zero_floor',
      defaultValue: 0.35,
      min: 0,
      max: 1,
      step: 0.05,
    })
    expect(preference.load(storageOf(null))).toBe(0.35)
    expect(preference.load(storageOf(''))).toBe(0.35)
    // An actual stored zero is still honoured — it is in range.
    expect(preference.load(storageOf('0'))).toBe(0)
  })

  it('writes the chosen value and returns it', () => {
    const preference = createClampedPreference(SPEC)
    const storage = storageOf(null)
    expect(preference.persist(0.5, storage)).toBe(0.5)
    expect(storage.setItem).toHaveBeenCalledWith(SPEC.storageKey, '0.5')
  })

  it('clamps a write to the slider bounds', () => {
    const preference = createClampedPreference(SPEC)
    const storage = storageOf(null)

    expect(preference.persist(9, storage)).toBe(SPEC.max)
    expect(storage.setItem).toHaveBeenLastCalledWith(
      SPEC.storageKey,
      String(SPEC.max),
    )

    expect(preference.persist(-3, storage)).toBe(SPEC.min)
    expect(storage.setItem).toHaveBeenLastCalledWith(
      SPEC.storageKey,
      String(SPEC.min),
    )
  })

  it('writes the default rather than NaN', () => {
    const preference = createClampedPreference(SPEC)
    const storage = storageOf(null)
    expect(preference.persist(Number.NaN, storage)).toBe(SPEC.defaultValue)
    expect(storage.setItem).toHaveBeenLastCalledWith(
      SPEC.storageKey,
      String(SPEC.defaultValue),
    )
  })

  it('survives storage that throws, and storage that is not there at all', () => {
    const preference = createClampedPreference(SPEC)
    const blocked: ClampedPreferenceStorage = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    }

    expect(preference.load(blocked)).toBe(SPEC.defaultValue)
    expect(() => preference.persist(0.7, blocked)).not.toThrow()
    expect(preference.persist(0.7, blocked)).toBe(0.7)

    expect(preference.load(null)).toBe(SPEC.defaultValue)
    expect(preference.persist(0.7, null)).toBe(0.7)
  })

  it('reaches real localStorage when no storage is passed', () => {
    const preference = createClampedPreference({
      ...SPEC,
      storageKey: 'default_storage_glass',
    })
    localStorage.removeItem('default_storage_glass')
    expect(preference.load()).toBe(SPEC.defaultValue)

    expect(preference.persist(0.55)).toBe(0.55)
    expect(localStorage.getItem('default_storage_glass')).toBe('0.55')
    expect(preference.load()).toBe(0.55)
    localStorage.removeItem('default_storage_glass')
  })

  /**
   * Safari in private mode, and any browser with site data blocked: reading
   * `localStorage` at all is a SecurityError, before any key is named. The
   * slider has to keep working for the session — it just does not come back.
   */
  it('keeps working when touching localStorage itself throws', () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('SecurityError')
      },
    })
    try {
      const preference = createClampedPreference(SPEC)
      expect(preference.load()).toBe(SPEC.defaultValue)
      expect(preference.persist(0.6)).toBe(0.6)
    } finally {
      if (original === undefined) {
        // @ts-expect-error restoring an environment that had no localStorage
        delete globalThis.localStorage
      } else {
        Object.defineProperty(globalThis, 'localStorage', original)
      }
    }
  })
})
