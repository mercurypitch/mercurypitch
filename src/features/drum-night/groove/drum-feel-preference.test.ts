// ============================================================
// Drum feel preference tests — defaults, defensive parsing, persistence
// ============================================================

import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_DRUM_FEEL_SETTINGS, DRUM_FEEL_STORAGE_KEY, readDrumFeelSettings, writeDrumFeelSettings, } from './drum-feel-preference'

function memoryStorage(seed: string | null = null): Storage {
  const map = new Map<string, string>()
  if (seed !== null) map.set(DRUM_FEEL_STORAGE_KEY, seed)
  return {
    get length() {
      return map.size
    },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => map.delete(key),
    setItem: (key: string, value: string) => {
      map.set(key, value)
    },
  } as Storage
}

describe('readDrumFeelSettings', () => {
  it('starts off, at moderate intensity, and never humanizes imports', () => {
    expect(DEFAULT_DRUM_FEEL_SETTINGS).toEqual({
      enabled: false,
      style: 'rock',
      intensity: 0.6,
      locked: false,
      applyToImported: false,
    })
    expect(readDrumFeelSettings(null)).toEqual(DEFAULT_DRUM_FEEL_SETTINGS)
    expect(readDrumFeelSettings(memoryStorage())).toEqual(
      DEFAULT_DRUM_FEEL_SETTINGS,
    )
  })

  it('round-trips a written value', () => {
    const storage = memoryStorage()
    const settings = {
      enabled: true,
      style: 'funk' as const,
      intensity: 0.85,
      locked: true,
      applyToImported: true,
    }
    writeDrumFeelSettings(storage, settings)
    expect(readDrumFeelSettings(storage)).toEqual(settings)
  })

  it('falls back per field on malformed, hostile, or partial payloads', () => {
    for (const payload of [
      'not json',
      '[]',
      'null',
      '{"style":"polka","intensity":"loud","enabled":"yes"}',
      '{"intensity":9999}',
      '{"intensity":-4}',
    ]) {
      const parsed = readDrumFeelSettings(memoryStorage(payload))
      expect(parsed.style).toBe('rock')
      expect(parsed.intensity).toBeGreaterThanOrEqual(0)
      expect(parsed.intensity).toBeLessThanOrEqual(1)
      expect(typeof parsed.enabled).toBe('boolean')
      expect(typeof parsed.applyToImported).toBe('boolean')
    }
    const partial = readDrumFeelSettings(
      memoryStorage('{"enabled":true,"style":"jazz"}'),
    )
    expect(partial).toEqual({
      ...DEFAULT_DRUM_FEEL_SETTINGS,
      enabled: true,
      style: 'jazz',
    })
  })

  it('survives a storage that throws on every access', () => {
    const hostile = {
      getItem: () => {
        throw new DOMException('denied', 'SecurityError')
      },
      setItem: () => {
        throw new DOMException('denied', 'SecurityError')
      },
    } as unknown as Storage
    expect(readDrumFeelSettings(hostile)).toEqual(DEFAULT_DRUM_FEEL_SETTINGS)
    expect(() =>
      writeDrumFeelSettings(hostile, DEFAULT_DRUM_FEEL_SETTINGS),
    ).not.toThrow()
  })

  it('writes exactly one storage entry per save', () => {
    const setItem = vi.fn()
    const storage = { getItem: () => null, setItem } as unknown as Storage
    writeDrumFeelSettings(storage, DEFAULT_DRUM_FEEL_SETTINGS)
    expect(setItem).toHaveBeenCalledOnce()
    expect(setItem.mock.calls[0][0]).toBe(DRUM_FEEL_STORAGE_KEY)
  })
})
