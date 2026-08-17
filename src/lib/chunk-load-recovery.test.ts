import { describe, expect, it, vi } from 'vitest'
import { CHUNK_RELOAD_COOLDOWN_MS, CHUNK_RELOAD_STORAGE_KEY, installChunkLoadRecovery, } from './chunk-load-recovery'
import { isStaleBuildError } from './global-error-handler'

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
  it('reloads once and lets Vite rethrow the real error', () => {
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

    // Never prevented. Vite's helper rethrows ONLY when the event is left
    // un-prevented; preventing it resolves the import with `undefined`, and
    // every `lazy(() => import(x).then((m) => ({ default: m.Thing })))` then
    // throws a TypeError that `isStaleBuildError` cannot recognise — which is
    // how a routine deploy rendered the crash modal instead of the recovery
    // screen (tablet, Progress tab, dev 2026-08-17).
    expect(event.defaultPrevented).toBe(false)
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

    expect(first.defaultPrevented).toBe(false)
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

    expect(laterFailure.defaultPrevented).toBe(false)
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

describe('what the app sees after a preload failure', () => {
  /**
   * Vite's real helper, transcribed from
   * node_modules/vite/dist/node/chunks/*.js:
   *
   *   function handlePreloadError(err) {
   *     const e = new Event('vite:preloadError', { cancelable: true })
   *     e.payload = err
   *     window.dispatchEvent(e)
   *     if (!e.defaultPrevented) { throw err }
   *   }
   *   return promise.then(() => baseModule().catch(handlePreloadError))
   *
   * The `.catch` is what makes prevention so costly: a handler that returns
   * normally converts a rejection into a RESOLUTION with `undefined`.
   */
  async function importThroughVite(
    target: EventTarget,
    failure: Error,
  ): Promise<unknown> {
    return Promise.reject(failure).catch((err: Error) => {
      const event = new Event('vite:preloadError', { cancelable: true })
      target.dispatchEvent(event)
      if (!event.defaultPrevented) throw err
      return undefined
    })
  }

  /** The shape all 39 `lazy()` call sites use, e.g. App.tsx's ProgressRoute. */
  const asRoute = (mod: unknown) => ({
    default: (mod as { ProgressRoute: unknown }).ProgressRoute,
  })

  const STALE = new Error(
    'Failed to fetch dynamically imported module: https://x/assets/ProgressRoute-abc123.js',
  )

  it('hands the boundary an error it can recognise as a new deployment', async () => {
    const target = new EventTarget()
    installChunkLoadRecovery({
      target,
      storage: new MemoryStorage(),
      reload: vi.fn(),
      now: () => 10_000,
    })

    const caught = await importThroughVite(target, STALE)
      .then(asRoute)
      .then(() => null)
      .catch((e: unknown) => e)

    // This is the whole bug: the boundary decides between "a new version is
    // ready" and "the application crashed" purely by classifying this value.
    expect(isStaleBuildError(caught)).toBe(true)
    expect(caught).toBe(STALE)
  })

  it('does not turn a deployment into a TypeError, the way prevention did', async () => {
    // The old behaviour, reproduced by preventing the event exactly as the
    // handler used to. Kept as a test so the cost is visible rather than
    // remembered: this is what put the crash modal on the Progress tab.
    const target = new EventTarget()
    target.addEventListener('vite:preloadError', (e) => {
      e.preventDefault()
    })

    const caught = await importThroughVite(target, STALE)
      .then(asRoute)
      .then(() => null)
      .catch((e: unknown) => e)

    expect(caught).toBeInstanceOf(TypeError)
    expect(isStaleBuildError(caught)).toBe(false)
  })
})
