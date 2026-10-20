import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FIRST_VALUE_KEY, firstValueForSession, firstValueSeen, resetFirstValueForTests, trackFirstValue, } from '@/lib/first-value'
import { GUIDE_FUNNEL_STORAGE_KEY } from '@/lib/guide-funnel'

function sentEvents(): string[] {
  const raw = localStorage.getItem(GUIDE_FUNNEL_STORAGE_KEY) ?? '[]'
  return (JSON.parse(raw) as { event: string }[]).map((e) => e.event)
}

beforeEach(() => {
  localStorage.clear()
  resetFirstValueForTests()
  vi.spyOn(console, 'info').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.doUnmock('@/lib/native-build')
})

describe('trackFirstValue', () => {
  it('sends a first value once per device, across reloads', async () => {
    expect(trackFirstValue('sing')).toBe(true)
    expect(trackFirstValue('sing')).toBe(false)

    vi.resetModules()
    const reloaded = await import('@/lib/first-value')
    expect(reloaded.trackFirstValue('sing')).toBe(false)

    expect(sentEvents().filter((e) => e === 'first_value_sing')).toHaveLength(1)
    expect(sentEvents()).toHaveLength(1)
  })

  it('counts each room on its own', () => {
    expect(trackFirstValue('sing')).toBe(true)
    expect(trackFirstValue('karaoke')).toBe(true)
    expect(sentEvents()).toEqual(['first_value_sing', 'first_value_karaoke'])
  })

  it('stores the time of each first value under the device-local key', () => {
    trackFirstValue('ear')
    const stored = JSON.parse(localStorage.getItem(FIRST_VALUE_KEY) ?? '{}')
    expect(Object.keys(stored)).toEqual(['ear'])
    expect(Number.isNaN(Date.parse(stored.ear))).toBe(false)
  })

  it('reports a room as seen only after its first value', () => {
    expect(firstValueSeen('guitar')).toBe(false)
    trackFirstValue('guitar')
    expect(firstValueSeen('guitar')).toBe(true)
    expect(firstValueSeen('piano')).toBe(false)
  })

  it('sends at most once per page when storage throws', () => {
    // The test setup replaces localStorage with a plain object, so a spy on
    // Storage.prototype would never touch it: stub the global itself.
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
      removeItem: () => {
        throw new Error('blocked')
      },
    })
    expect(trackFirstValue('sing')).toBe(true)
    expect(trackFirstValue('sing')).toBe(false)
    expect(firstValueSeen('sing')).toBe(true)
  })

  it('sends nothing from a native build', () => {
    expect(trackFirstValue('sing', { native: true })).toBe(false)
    expect(sentEvents()).toEqual([])
    expect(localStorage.getItem(FIRST_VALUE_KEY)).toBeNull()
    expect(firstValueSeen('sing')).toBe(false)
  })

  it('sends nothing from a native build when no option is passed', async () => {
    vi.resetModules()
    vi.doMock('@/lib/native-build', () => ({ IS_NATIVE_BUILD: true }))
    const native = await import('@/lib/first-value')
    expect(native.trackFirstValue('sing')).toBe(false)
    expect(sentEvents()).toEqual([])
    expect(localStorage.getItem(FIRST_VALUE_KEY)).toBeNull()
  })

  it('treats an unreadable stored map as empty instead of throwing', () => {
    localStorage.setItem(FIRST_VALUE_KEY, '{not json')
    expect(trackFirstValue('piano')).toBe(true)
    expect(sentEvents()).toEqual(['first_value_piano'])
  })
})

describe('firstValueForSession', () => {
  it('maps a saved run to the room it came from', () => {
    expect(firstValueForSession('practice')).toBe('sing')
    expect(firstValueForSession('challenge')).toBe('drill')
    expect(firstValueForSession('weekly')).toBe('drill')
    expect(firstValueForSession('exercise')).toBe('drill')
  })
})
