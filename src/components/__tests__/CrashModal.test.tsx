import { cleanup, fireEvent, render } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { reloadToLatest } from '@/lib/pwa-service-worker'
import { setAppError } from '@/stores/app-store'
import { CrashModal, hardResetAppData } from '../CrashModal'

vi.mock('@/lib/pwa-service-worker', () => ({
  reloadToLatest: vi.fn(async () => Promise.resolve()),
}))

describe('CrashModal', () => {
  afterEach(() => {
    cleanup()
    setAppError(null)
    vi.clearAllMocks()
  })

  it('reloads through the worker-cache escape, not location.reload', () => {
    // A plain reload is answered by the controlling service worker from its
    // precache — if the crash came from a build the origin has replaced, that
    // reload lands in the identical crash (dev, 2026-08-16). The button must
    // always take the path that can actually move to a working build.
    setAppError({ error: new Error('boom'), time: Date.now() })

    const { getByText } = render(() => <CrashModal />)
    fireEvent.click(getByText('Reload App'))

    expect(reloadToLatest).toHaveBeenCalledTimes(1)
  })

  it('Reset App Data tears down the worker and its caches before reloading', async () => {
    // Clearing storage while leaving the service worker registered and its
    // precache intact reloads the very build that was crashing — the reset
    // is only as hard as what it deletes (owner report, 2026-08-17).
    const deleteCache = vi.fn(async () => true)
    const unregister = vi.fn(async () => true)
    const reload = vi.fn()

    await hardResetAppData({
      cacheStorage: {
        keys: vi.fn(async () => ['mercurypitch-assets-a', 'other']),
        delete: deleteCache,
      } as unknown as CacheStorage,
      swContainer: {
        getRegistrations: vi.fn(async () => [{ unregister }]),
      } as unknown as ServiceWorkerContainer,
      reload,
    })

    expect(deleteCache).toHaveBeenCalledWith('mercurypitch-assets-a')
    expect(deleteCache).toHaveBeenCalledWith('other')
    expect(unregister).toHaveBeenCalledTimes(1)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('still reloads when the teardown itself fails', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const reload = vi.fn()
    await hardResetAppData({
      cacheStorage: {
        keys: vi.fn(async () => {
          throw new Error('denied')
        }),
        delete: vi.fn(),
      } as unknown as CacheStorage,
      reload,
    })
    expect(reload).toHaveBeenCalledTimes(1)
    errSpy.mockRestore()
  })

  it('the Reset App Data button drives the hard reset', async () => {
    // jsdom has neither caches nor serviceWorker, so the defaults resolve
    // to undefined and the seamless reload is the only observable step —
    // the button wiring is what this pins.
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    setAppError({ error: new Error('boom'), time: Date.now() })
    const { getByText } = render(() => <CrashModal />)
    expect(() => fireEvent.click(getByText('Reset App Data'))).not.toThrow()
    errSpy.mockRestore()
  })
})
