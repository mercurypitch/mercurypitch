// ============================================================
// Karaoke stage transparency preference tests
// ============================================================

import { describe, expect, it, vi } from 'vitest'
import { KARAOKE_STAGE_ALPHA, loadKaraokeStageAlpha, persistKaraokeStageAlpha, } from './stage-transparency'

describe('karaoke stage transparency preference', () => {
  it('uses the atmospheric default when the preference is missing or invalid', () => {
    expect(
      loadKaraokeStageAlpha({
        getItem: () => null,
        setItem: vi.fn(),
      }),
    ).toBe(KARAOKE_STAGE_ALPHA.defaultValue)
    expect(
      loadKaraokeStageAlpha({
        getItem: () => 'not-a-number',
        setItem: vi.fn(),
      }),
    ).toBe(KARAOKE_STAGE_ALPHA.defaultValue)
    expect(
      loadKaraokeStageAlpha({
        getItem: () => '0.01',
        setItem: vi.fn(),
      }),
    ).toBe(KARAOKE_STAGE_ALPHA.defaultValue)
  })

  it('restores and persists a shared in-range value', () => {
    const setItem = vi.fn()
    const storage = {
      getItem: () => '0.67',
      setItem,
    }

    expect(loadKaraokeStageAlpha(storage)).toBe(0.67)
    persistKaraokeStageAlpha(0.67, storage)
    expect(setItem).toHaveBeenCalledWith(KARAOKE_STAGE_ALPHA.storageKey, '0.67')
  })

  it('clamps writes at the shared slider bounds', () => {
    const setItem = vi.fn()
    const storage = {
      getItem: () => null,
      setItem,
    }

    expect(persistKaraokeStageAlpha(4, storage)).toBe(KARAOKE_STAGE_ALPHA.max)
    expect(setItem).toHaveBeenLastCalledWith(
      KARAOKE_STAGE_ALPHA.storageKey,
      String(KARAOKE_STAGE_ALPHA.max),
    )

    expect(persistKaraokeStageAlpha(-2, storage)).toBe(KARAOKE_STAGE_ALPHA.min)
    expect(setItem).toHaveBeenLastCalledWith(
      KARAOKE_STAGE_ALPHA.storageKey,
      String(KARAOKE_STAGE_ALPHA.min),
    )

    expect(persistKaraokeStageAlpha(Number.NaN, storage)).toBe(
      KARAOKE_STAGE_ALPHA.defaultValue,
    )
    expect(setItem).toHaveBeenLastCalledWith(
      KARAOKE_STAGE_ALPHA.storageKey,
      String(KARAOKE_STAGE_ALPHA.defaultValue),
    )
  })

  it('fails closed to the default when storage is unavailable', () => {
    const storage = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    }

    expect(loadKaraokeStageAlpha(storage)).toBe(
      KARAOKE_STAGE_ALPHA.defaultValue,
    )
    expect(() => persistKaraokeStageAlpha(0.7, storage)).not.toThrow()
  })
})
