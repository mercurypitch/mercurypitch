// Microphone preference tests — direct entry, explicit recovery and late fallback ownership.

import { micManager } from '@irchiinnuss/pitch-engine'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createBrowserMicrophoneInput } from './microphone-input'

const key = 'beside-cue:input-device'
let storage: Map<string, string>

beforeEach(() => {
  storage = new Map()
  vi.stubGlobal('localStorage', {
    getItem: (name: string) => storage.get(name) ?? null,
    setItem: (name: string, value: string) => storage.set(name, value),
    removeItem: (name: string) => storage.delete(name),
  })
  vi.spyOn(micManager, 'setPreferredDevice').mockResolvedValue()
  vi.spyOn(micManager, 'getPreferredDevice').mockReturnValue(null)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('browser microphone preference', () => {
  it('applies the product input on direct entry without needing another game first', async () => {
    storage.set(key, 'scarlett')
    const route = createBrowserMicrophoneInput(key)
    expect(route.input.selected()).toBe('scarlett')
    await route.forStart().prepareMicrophone()
    expect(micManager.setPreferredDevice).toHaveBeenCalledExactlyOnceWith(
      'scarlett',
    )
  })

  it('remembers a recovery choice without stopping or opening any microphone', async () => {
    const route = createBrowserMicrophoneInput(key)
    await route.input.select('scarlett')
    expect(micManager.setPreferredDevice).not.toHaveBeenCalled()
    expect(route.input.selected()).toBe('scarlett')
    expect(createBrowserMicrophoneInput(key).input.selected()).toBe('scarlett')
    await route.input.select('')
    expect(storage.has(key)).toBe(false)
    await route.forStart().prepareMicrophone()
    expect(micManager.setPreferredDevice).toHaveBeenCalledWith(null)
  })

  it('keeps a choice for this visit when storage is unavailable', async () => {
    vi.stubGlobal('localStorage', {
      getItem() {
        throw new Error('Storage unavailable')
      },
      setItem() {
        throw new Error('Storage unavailable')
      },
    })
    const route = createBrowserMicrophoneInput(key)
    await route.input.select('scarlett')
    expect(route.input.selected()).toBe('scarlett')
    await route.forStart().prepareMicrophone()
    expect(micManager.setPreferredDevice).toHaveBeenCalledWith('scarlett')
  })

  it('forgets a vanished exact device only after the default successfully opens', async () => {
    storage.set(key, 'unplugged')
    const route = createBrowserMicrophoneInput(key)
    const start = route.forStart()
    await start.prepareMicrophone()
    expect(storage.get(key)).toBe('unplugged')
    start.microphoneOpened()
    expect(route.input.selected()).toBe('')
    expect(storage.has(key)).toBe(false)
  })

  it('a late fallback cannot erase a newer recovery choice', async () => {
    storage.set(key, 'unplugged')
    const route = createBrowserMicrophoneInput(key)
    const old = route.forStart()
    await old.prepareMicrophone()
    await route.input.select('new-microphone')
    old.microphoneOpened()
    expect(route.input.selected()).toBe('new-microphone')
    expect(storage.get(key)).toBe('new-microphone')
  })

  it('a late fallback cannot erase a device explicitly selected again', async () => {
    storage.set(key, 'reconnected')
    const route = createBrowserMicrophoneInput(key)
    const old = route.forStart()
    await old.prepareMicrophone()
    await route.input.select('another-microphone')
    await route.input.select('reconnected')
    old.microphoneOpened()
    expect(route.input.selected()).toBe('reconnected')
    expect(storage.get(key)).toBe('reconnected')
  })
})
