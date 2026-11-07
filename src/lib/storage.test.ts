// Persisted signal writes reconcile account ownership before changing data.
import { createEffect, createRoot, createSignal, untrack } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { applyPersistedValue, createPersistedSignal, onBeforePersistedWrite, onPersistedWrite, } from './storage'

beforeEach(() => localStorage.clear())
afterEach(() => {
  onBeforePersistedWrite(null)
  onPersistedWrite(null)
})

describe('persisted write ownership boundary', () => {
  it('hides a foreign live value without overwriting its durable copy', () => {
    localStorage.setItem('owner-test', '["A"]')
    const [value] = createPersistedSignal('owner-test', [] as string[])
    const notify = vi.fn()
    onPersistedWrite(notify)

    applyPersistedValue('owner-test', '[]', { persist: false })

    expect(value()).toEqual([])
    expect(localStorage.getItem('owner-test')).toBe('["A"]')
    expect(notify).not.toHaveBeenCalled()
  })

  it('does not subscribe a writing effect to the ownership hook', () => {
    const [allowed, setAllowed] = createSignal(true)
    const [value, setValue] = createPersistedSignal('owner-test', 0)
    untrack(() => onBeforePersistedWrite(allowed))
    let writes = 0
    const dispose = createRoot((dispose) => {
      createEffect(() => {
        writes += 1
        setValue((previous) => previous + 1)
      })
      return dispose
    })
    try {
      expect(value()).toBe(1)
      setAllowed(false)
      expect(value()).toBe(1)
      expect(writes).toBe(1)
    } finally {
      dispose()
    }
  })

  it('does not subscribe a writing effect to the sync listener', () => {
    const [generation, setGeneration] = createSignal(0)
    const [value, setValue] = createPersistedSignal('owner-test', 0)
    untrack(() => onPersistedWrite(generation))
    const dispose = createRoot((dispose) => {
      createEffect(() => setValue((previous) => previous + 1))
      return dispose
    })
    try {
      expect(value()).toBe(1)
      setGeneration(1)
      expect(value()).toBe(1)
    } finally {
      dispose()
    }
  })

  it('rejects a stale absolute write after hydrating the new account', () => {
    const [value, setValue] = createPersistedSignal('owner-test', ['A'])
    const notify = vi.fn()
    onPersistedWrite(notify)
    onBeforePersistedWrite((key) => {
      applyPersistedValue(key, JSON.stringify(['B']))
      return false
    })

    expect(setValue(['A', 'stale-action'])).toEqual(['B'])
    expect(value()).toEqual(['B'])
    expect(JSON.parse(localStorage.getItem('owner-test')!)).toEqual(['B'])
    expect(notify).not.toHaveBeenCalled()
  })

  it('does not evaluate a rejected functional update', () => {
    const [value, setValue] = createPersistedSignal('owner-test', ['A'])
    const update = vi.fn((previous: string[]) => [...previous, 'stale-action'])
    onBeforePersistedWrite(() => false)

    expect(setValue(update)).toEqual(['A'])
    expect(value()).toEqual(['A'])
    expect(update).not.toHaveBeenCalled()
    expect(localStorage.getItem('owner-test')).toBeNull()
  })

  it('evaluates an allowed update using reconciled state and persists it', () => {
    const [value, setValue] = createPersistedSignal('owner-test', ['old'])
    const notify = vi.fn()
    onPersistedWrite(notify)
    onBeforePersistedWrite((key) => {
      applyPersistedValue(key, JSON.stringify(['current']))
      return true
    })

    expect(setValue((previous) => [...previous, 'new'])).toEqual([
      'current',
      'new',
    ])
    expect(value()).toEqual(['current', 'new'])
    expect(localStorage.getItem('owner-test')).toBe('["current","new"]')
    expect(notify).toHaveBeenCalledExactlyOnceWith(
      'owner-test',
      '["current","new"]',
    )
  })

  it('preserves ordinary writes when the ownership hook is removed', () => {
    const [value, setValue] = createPersistedSignal('ordinary-setting', 'old')
    onBeforePersistedWrite(() => false)
    onBeforePersistedWrite(null)
    expect(setValue('new')).toBe('new')
    expect(value()).toBe('new')
    expect(localStorage.getItem('ordinary-setting')).toBe('new')
  })
})

describe('a string kept under a default that is not one', () => {
  // The Jam room's chosen input: a device id or a label, or null.
  const isText = (value: unknown): value is string | null =>
    value === null || typeof value === 'string'
  const pick = () =>
    createPersistedSignal<string | null>('pick-test', null, {
      validator: isText,
    })

  it('comes back after a reload', () => {
    const [, setPick] = pick()
    setPick('a1b2c3d4')

    expect(localStorage.getItem('pick-test')).toBe('"a1b2c3d4"')
    expect(pick()[0]()).toBe('a1b2c3d4')
  })

  it('takes back one saved bare before, where the validator accepts it', () => {
    localStorage.setItem('pick-test', 'Scarlett 2i2 USB')

    expect(pick()[0]()).toBe('Scarlett 2i2 USB')
  })

  it('keeps the default for text it cannot read and nothing vouches for', () => {
    localStorage.setItem('pick-test', 'Scarlett 2i2 USB')
    const [value] = createPersistedSignal<string | null>('pick-test', null)

    expect(value()).toBeNull()
  })

  it('takes a synced value saved either way', () => {
    const [value] = pick()

    applyPersistedValue('pick-test', '"from-json"')
    expect(value()).toBe('from-json')
    applyPersistedValue('pick-test', 'saved-bare')
    expect(value()).toBe('saved-bare')
  })

  it('still keeps a string under a string default as it is', () => {
    const [, setMode] = createPersistedSignal('mode-test', 'voice')
    setMode('instrument')

    expect(localStorage.getItem('mode-test')).toBe('instrument')
  })
})
