import { describe, expect, it, vi } from 'vitest'
import { CHUNK_RELOAD_COOLDOWN_MS, CHUNK_RELOAD_STORAGE_KEY, installChunkLoadRecovery, } from './chunk-load-recovery'

class MemoryStorage {
  private readonly values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }
}

describe('chunk-load recovery', () => {
  it('suppresses the stale import error and reloads the app once', () => {
    const target = new EventTarget()
    const storage = new MemoryStorage()
    const reload = vi.fn()
    const dispose = installChunkLoadRecovery({
      target,
      storage,
      reload,
      now: () => 10_000,
    })

    const event = new Event('vite:preloadError', { cancelable: true })
    target.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
    expect(reload).toHaveBeenCalledOnce()
    expect(storage.getItem(CHUNK_RELOAD_STORAGE_KEY)).toBe('10000')
    dispose()
  })

  it('lets a repeated failure surface instead of entering a reload loop', () => {
    const target = new EventTarget()
    const storage = new MemoryStorage()
    const reload = vi.fn()
    let now = 10_000
    installChunkLoadRecovery({
      target,
      storage,
      reload,
      now: () => now,
    })

    const first = new Event('vite:preloadError', { cancelable: true })
    target.dispatchEvent(first)

    now += CHUNK_RELOAD_COOLDOWN_MS - 1
    const repeated = new Event('vite:preloadError', { cancelable: true })
    target.dispatchEvent(repeated)

    expect(first.defaultPrevented).toBe(true)
    expect(repeated.defaultPrevented).toBe(false)
    expect(reload).toHaveBeenCalledOnce()
  })

  it('allows recovery again after the cooldown expires', () => {
    const target = new EventTarget()
    const storage = new MemoryStorage()
    const reload = vi.fn()
    let now = 10_000
    installChunkLoadRecovery({
      target,
      storage,
      reload,
      now: () => now,
    })

    target.dispatchEvent(new Event('vite:preloadError', { cancelable: true }))
    now += CHUNK_RELOAD_COOLDOWN_MS
    const laterFailure = new Event('vite:preloadError', {
      cancelable: true,
    })
    target.dispatchEvent(laterFailure)

    expect(laterFailure.defaultPrevented).toBe(true)
    expect(reload).toHaveBeenCalledTimes(2)
  })

  it('surfaces the error when storage cannot persist the reload guard', () => {
    const target = new EventTarget()
    const reload = vi.fn()
    installChunkLoadRecovery({
      target,
      storage: {
        getItem: () => {
          throw new Error('storage denied')
        },
        setItem: vi.fn(),
      },
      reload,
    })

    const event = new Event('vite:preloadError', { cancelable: true })
    target.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(false)
    expect(reload).not.toHaveBeenCalled()
  })
})
