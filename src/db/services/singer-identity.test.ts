// ============================================================
// The anonymous identity before the first offer (S7b E11)
// ============================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const auth = vi.hoisted(() => ({
  calls: 0,
  answer: Promise.resolve(true) as Promise<boolean>,
}))
vi.mock('@/db/services/auth-service', () => ({
  requireAuth: vi.fn(async () => {
    auth.calls += 1
    return auth.answer
  }),
}))

import { ensureSingerIdentity } from './singer-identity'

beforeEach(() => {
  auth.calls = 0
  auth.answer = Promise.resolve(true)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('ensureSingerIdentity', () => {
  it('answers whether the server can now name this singer', async () => {
    auth.answer = Promise.resolve(false)

    const named = await ensureSingerIdentity()

    expect(named).toBe(false)
    expect(auth.calls).toBe(1)
  })

  it('stops waiting at its bound and says no, while the request carries on', async () => {
    vi.useFakeTimers()
    let finish = (_named: boolean): void => undefined
    auth.answer = new Promise((resolve) => {
      finish = resolve
    })

    const waiting = ensureSingerIdentity({ withinMs: 2_000 })
    await vi.advanceTimersByTimeAsync(2_000)

    await expect(waiting).resolves.toBe(false)
    finish(true)
    expect(auth.calls).toBe(1)
  })

  it('answers yes inside its bound', async () => {
    const named = await ensureSingerIdentity({ withinMs: 2_000 })

    expect(named).toBe(true)
  })

  it('never throws, even when the request does', async () => {
    auth.answer = Promise.reject(new Error('offline'))

    await expect(ensureSingerIdentity()).resolves.toBe(false)
  })
})
