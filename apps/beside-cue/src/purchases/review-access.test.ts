// ============================================================
// Review access — the build's digest decides, and the grant survives a launch
// ============================================================

import type { ReviewUnlock, ReviewUnlockStorage, } from '@irchiinnuss/purchase-kit'
import { createRoot } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
import { createLocalReviewStorage, createReviewAccess, resolveReviewUnlockDigest, sha256Hex, } from './review-access'

const DIGEST = 'a'.repeat(64)

function fakeUnlock(overrides: Partial<ReviewUnlock> = {}): ReviewUnlock {
  return {
    configured: true,
    restore: () => undefined,
    redeem: () => Promise.resolve({ outcome: 'rejected' as const }),
    revoke: () => {},
    ...overrides,
  }
}

describe('resolveReviewUnlockDigest', () => {
  it('accepts a digest whatever case or spacing it arrives in', () => {
    expect(
      resolveReviewUnlockDigest({
        VITE_REVIEW_UNLOCK_SHA256: ` ${DIGEST.toUpperCase()} `,
      }),
    ).toBe(DIGEST)
  })

  it('treats anything that is not a digest as none at all', () => {
    expect(resolveReviewUnlockDigest({})).toBeUndefined()
    expect(
      resolveReviewUnlockDigest({ VITE_REVIEW_UNLOCK_SHA256: '' }),
    ).toBeUndefined()
    expect(
      resolveReviewUnlockDigest({ VITE_REVIEW_UNLOCK_SHA256: 'deadbeef' }),
    ).toBeUndefined()
    expect(
      resolveReviewUnlockDigest({
        VITE_REVIEW_UNLOCK_SHA256: `${'z'.repeat(64)}`,
      }),
    ).toBeUndefined()
  })
})

describe('sha256Hex', () => {
  it('hashes the way the issued digest was made', async () => {
    await expect(sha256Hex('beside-cue:REV1EW')).resolves.toMatch(
      /^[0-9a-f]{64}$/u,
    )
    await expect(sha256Hex('abc')).resolves.toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })
})

describe('createLocalReviewStorage', () => {
  function fakeStore(): Storage {
    const values = new Map<string, string>()
    return {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => void values.set(key, value),
      removeItem: (key: string) => void values.delete(key),
      clear: () => values.clear(),
      key: () => null,
      get length() {
        return values.size
      },
    } as Storage
  }

  it('round-trips through the browser store and forgets on demand', () => {
    vi.stubGlobal('localStorage', fakeStore())
    const storage: ReviewUnlockStorage = createLocalReviewStorage('test:review')
    storage.write('kept')
    expect(storage.read()).toBe('kept')
    storage.remove()
    expect(storage.read()).toBeNull()
    vi.unstubAllGlobals()
  })

  it('stays quiet where the browser offers no usable store', () => {
    vi.stubGlobal('localStorage', { getItem: 'not a function' })
    const storage = createLocalReviewStorage('test:review')
    expect(() => storage.write('kept')).not.toThrow()
    expect(storage.read()).toBeNull()
    expect(() => storage.remove()).not.toThrow()
    vi.unstubAllGlobals()
  })
})

describe('createReviewAccess', () => {
  it('is off, and offers nothing, when the build carries no digest', () => {
    createRoot((dispose) => {
      const access = createReviewAccess({
        unlock: fakeUnlock({ configured: false }),
      })
      expect(access.configured).toBe(false)
      expect(access.active()).toBe(false)
      dispose()
    })
  })

  it('comes back on after a launch when a grant is stored', () => {
    createRoot((dispose) => {
      const grantedAt = new Date('2026-09-12T19:30:00.000Z')
      const access = createReviewAccess({
        unlock: fakeUnlock({ restore: () => ({ digest: DIGEST, grantedAt }) }),
      })
      expect(access.active()).toBe(true)
      expect(access.state()).toBe('unlocked')
      expect(access.grantedAt()).toEqual(grantedAt)
      dispose()
    })
  })

  it('opens on the right code and closes when it is turned off', async () => {
    const revoke = vi.fn()
    const grantedAt = new Date('2026-09-12T19:30:00.000Z')
    await createRoot(async (dispose) => {
      const access = createReviewAccess({
        unlock: fakeUnlock({
          redeem: () =>
            Promise.resolve({
              outcome: 'unlocked' as const,
              grant: { digest: DIGEST, grantedAt },
            }),
          revoke,
        }),
      })
      expect(access.active()).toBe(false)
      await expect(access.redeem('REVIEW-7K4M-93XQ')).resolves.toBe('unlocked')
      expect(access.active()).toBe(true)
      access.revoke()
      expect(revoke).toHaveBeenCalledOnce()
      expect(access.active()).toBe(false)
      expect(access.state()).toBe('idle')
      dispose()
    })
  })

  it('reports a wrong code without opening anything', async () => {
    await createRoot(async (dispose) => {
      const access = createReviewAccess({ unlock: fakeUnlock() })
      await expect(access.redeem('nope')).resolves.toBe('rejected')
      expect(access.state()).toBe('rejected')
      expect(access.active()).toBe(false)
      dispose()
    })
  })
})
