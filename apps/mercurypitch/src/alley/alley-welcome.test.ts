import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// A storage of its own rather than the environment's: CI's Node 22 has no
// `localStorage` global and local Node 25 has a different one, so a test that
// leaned on either would pass in one place only.
function memoryStorage(): Storage {
  const items = new Map<string, string>()
  return {
    get length() {
      return items.size
    },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => void items.delete(key),
    setItem: (key, value) => void items.set(key, String(value)),
  }
}

describe('the welcome flag', () => {
  let storage: Storage

  beforeEach(() => {
    storage = memoryStorage()
    vi.stubGlobal('localStorage', storage)
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('is not built, and storage is not read, at import', async () => {
    const read = vi.spyOn(storage, 'getItem')
    const module = await import('./alley-welcome')
    expect(module.welcomeFlagBuilt()).toBe(false)
    expect(read).not.toHaveBeenCalled()
    expect(module.welcomeSeen()).toBe(false)
    expect(module.welcomeFlagBuilt()).toBe(true)
    expect(read).toHaveBeenCalledWith(module.WELCOME_SEEN_KEY)
  })

  it('flips on the first open and persists', async () => {
    const module = await import('./alley-welcome')
    expect(module.welcomeSeen()).toBe(false)
    module.markWelcomeSeen()
    expect(module.welcomeSeen()).toBe(true)
    expect(storage.getItem(module.WELCOME_SEEN_KEY)).toBe('true')

    // A later launch reads it back.
    vi.resetModules()
    const again = await import('./alley-welcome')
    expect(again.welcomeSeen()).toBe(true)
  })

  it('is reset by the developer entry', async () => {
    const module = await import('./alley-welcome')
    module.markWelcomeSeen()
    module.resetWelcome()
    expect(module.welcomeSeen()).toBe(false)
    expect(storage.getItem(module.WELCOME_SEEN_KEY)).toBe('false')
  })
})
