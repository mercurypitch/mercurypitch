// ============================================================
// platform.keepAwake — two holders, and a phone that locked itself
// ============================================================
//
// The web screen lock has two behaviours that a naive wrapper gets wrong,
// and both of them cost exactly the thing the lock was taken for:
//
//   * it is one lock per page, so two features holding it at once used to
//     mean whichever finished first released the other's;
//   * the platform revokes it the instant the page is hidden and never
//     hands it back — so a phone that locked mid-download came back with
//     no lock, which is the case the lock exists for.
//
// The counter is module state, so every test imports a fresh copy.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PlatformServices } from './index'

interface FakeSentinel {
  release: ReturnType<typeof vi.fn>
  listeners: (() => void)[]
  fireRelease: () => void
}

function fakeSentinel(): FakeSentinel {
  const listeners: (() => void)[] = []
  return {
    listeners,
    release: vi.fn().mockResolvedValue(undefined),
    fireRelease: () => listeners.forEach((fn) => fn()),
  }
}

function installWakeLock(request: (type: string) => Promise<unknown>): void {
  Object.defineProperty(navigator, 'wakeLock', {
    value: { request },
    configurable: true,
    writable: true,
  })
}

function removeWakeLock(): void {
  Reflect.deleteProperty(navigator as unknown as object, 'wakeLock')
}

/** A sentinel that records its release listeners, as the real one does. */
function grantable(sentinel: FakeSentinel): unknown {
  return {
    release: sentinel.release,
    addEventListener: (_type: string, fn: () => void) =>
      sentinel.listeners.push(fn),
  }
}

async function freshPlatform(): Promise<PlatformServices> {
  vi.resetModules()
  return (await import('./index')).platform
}

function setVisibility(state: DocumentVisibilityState): void {
  Object.defineProperty(document, 'visibilityState', {
    value: state,
    configurable: true,
  })
  document.dispatchEvent(new Event('visibilitychange'))
}

beforeEach(() => {
  setVisibility('visible')
})

afterEach(() => {
  removeWakeLock()
  vi.restoreAllMocks()
})

describe('two holders share one lock', () => {
  it('keeps the lock until the last holder lets go', async () => {
    const sentinel = fakeSentinel()
    const request = vi.fn().mockResolvedValue(grantable(sentinel))
    installWakeLock(request)
    const platform = await freshPlatform()

    await platform.keepAwake.enable()
    await platform.keepAwake.enable()
    expect(request).toHaveBeenCalledTimes(1)

    // The first holder finishing is not the end of the other's need.
    await platform.keepAwake.disable()
    expect(sentinel.release).not.toHaveBeenCalled()

    await platform.keepAwake.disable()
    expect(sentinel.release).toHaveBeenCalledTimes(1)
  })

  it('takes the lock again for the next holder after the last one released', async () => {
    const first = fakeSentinel()
    const second = fakeSentinel()
    const request = vi
      .fn()
      .mockResolvedValueOnce(grantable(first))
      .mockResolvedValueOnce(grantable(second))
    installWakeLock(request)
    const platform = await freshPlatform()

    await platform.keepAwake.enable()
    await platform.keepAwake.disable()
    await platform.keepAwake.enable()

    expect(request).toHaveBeenCalledTimes(2)
    await platform.keepAwake.disable()
    expect(second.release).toHaveBeenCalledTimes(1)
  })

  it('does not let an unmatched release take the count below zero', async () => {
    const sentinel = fakeSentinel()
    const request = vi.fn().mockResolvedValue(grantable(sentinel))
    installWakeLock(request)
    const platform = await freshPlatform()

    // A release with nothing held is a no-op, not a debt the next holder
    // has to pay off before the lock is taken.
    await platform.keepAwake.disable()
    await platform.keepAwake.enable()
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('releases a lock that arrived after the last holder had gone', async () => {
    const sentinel = fakeSentinel()
    let grant: (value: unknown) => void = () => undefined
    installWakeLock(
      () =>
        new Promise((resolve) => {
          grant = resolve
        }),
    )
    const platform = await freshPlatform()

    const pending = platform.keepAwake.enable()
    await platform.keepAwake.disable()
    grant(grantable(sentinel))
    await pending

    // Nobody wants it any more, so it must not be left held for the rest
    // of the session with no holder to release it.
    expect(sentinel.release).toHaveBeenCalledTimes(1)
  })
})

describe('a lock the platform took away', () => {
  it('is re-taken when the page is looked at again', async () => {
    const first = fakeSentinel()
    const second = fakeSentinel()
    const request = vi
      .fn()
      .mockResolvedValueOnce(grantable(first))
      .mockResolvedValueOnce(grantable(second))
    installWakeLock(request)
    const platform = await freshPlatform()

    await platform.keepAwake.enable()
    // What a phone locking its screen does: the platform revokes the lock
    // and fires `release` on the sentinel.
    first.fireRelease()
    setVisibility('hidden')
    setVisibility('visible')
    await Promise.resolve()

    expect(request).toHaveBeenCalledTimes(2)
    await platform.keepAwake.disable()
    expect(second.release).toHaveBeenCalledTimes(1)
  })

  it('is not re-taken once nobody wants it', async () => {
    const sentinel = fakeSentinel()
    const request = vi.fn().mockResolvedValue(grantable(sentinel))
    installWakeLock(request)
    const platform = await freshPlatform()

    await platform.keepAwake.enable()
    await platform.keepAwake.disable()
    setVisibility('visible')
    await Promise.resolve()

    expect(request).toHaveBeenCalledTimes(1)
  })

  it('does not re-request while the lock is still held', async () => {
    const sentinel = fakeSentinel()
    const request = vi.fn().mockResolvedValue(grantable(sentinel))
    installWakeLock(request)
    const platform = await freshPlatform()

    await platform.keepAwake.enable()
    setVisibility('visible')
    await Promise.resolve()

    expect(request).toHaveBeenCalledTimes(1)
  })
})

describe('hosts that cannot hold a lock at all', () => {
  it('is a no-op where the API is missing', async () => {
    removeWakeLock()
    const platform = await freshPlatform()

    await expect(platform.keepAwake.enable()).resolves.toBeUndefined()
    await expect(platform.keepAwake.disable()).resolves.toBeUndefined()
  })

  it('survives a refusal and asks again for the next holder', async () => {
    const sentinel = fakeSentinel()
    const request = vi
      .fn()
      .mockRejectedValueOnce(new Error('NotAllowedError'))
      .mockResolvedValueOnce(grantable(sentinel))
    installWakeLock(request)
    const platform = await freshPlatform()

    // Refused (low battery, hidden page) — the work carries on regardless.
    await expect(platform.keepAwake.enable()).resolves.toBeUndefined()
    await platform.keepAwake.disable()

    await platform.keepAwake.enable()
    expect(request).toHaveBeenCalledTimes(2)
    await platform.keepAwake.disable()
    expect(sentinel.release).toHaveBeenCalledTimes(1)
  })

  it('swallows a release the platform has already performed', async () => {
    const sentinel = fakeSentinel()
    sentinel.release.mockRejectedValue(new Error('already released'))
    installWakeLock(vi.fn().mockResolvedValue(grantable(sentinel)))
    const platform = await freshPlatform()

    await platform.keepAwake.enable()
    await expect(platform.keepAwake.disable()).resolves.toBeUndefined()
  })
})
