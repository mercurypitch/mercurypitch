// ── keepAwake refcount ───────────────────────────────────────────────
// Drive backups and device-sync transfers can overlap, and there is one
// wake sentinel per page: the count is what stops whichever finishes
// first from releasing the lock out from under the other — the shared
// half of REQ-SYNC-033 (device-sync-transfers.ears.md).

import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('platform.keepAwake', () => {
  beforeEach(() => {
    // The count lives at module scope; every test gets a fresh module.
    vi.resetModules()
  })

  it('holds the lock until the last holder lets go', async () => {
    const release = vi.fn(() => Promise.resolve())
    const sentinel = { addEventListener: vi.fn(), release }
    const request = vi.fn(() => Promise.resolve(sentinel))
    Object.defineProperty(navigator, 'wakeLock', {
      value: { request },
      configurable: true,
    })
    const { platform } = await import('@/lib/platform')

    await platform.keepAwake.enable() // a Drive backup starts
    await platform.keepAwake.enable() // a sync transfer starts too
    expect(request).toHaveBeenCalledTimes(1)

    await platform.keepAwake.disable() // the transfer finishes first
    expect(release).not.toHaveBeenCalled()

    await platform.keepAwake.disable() // the backup lands
    expect(release).toHaveBeenCalledTimes(1)
  })

  it('a disable with no enable stays a no-op', async () => {
    const { platform } = await import('@/lib/platform')
    await expect(platform.keepAwake.disable()).resolves.toBeUndefined()
  })
})
