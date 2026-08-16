import { cleanup, fireEvent, render } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { reloadToLatest } from '@/lib/pwa-service-worker'
import { setAppError } from '@/stores/app-store'
import { CrashModal } from '../CrashModal'

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
})
