// ============================================================
// Start fresh: a new identity for this phone (REQ-NAM-023)
// ============================================================
//
// The device id is rotated and its secret dropped, as resetUserId already
// does after a deletion, and the old identity's session goes with it: a
// token left behind would keep the phone wearing the identity it was asked
// to leave. Then the app starts again, so nothing in memory still belongs
// to the old one.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resetUserId, setAuthToken } from '@/db/services/user-service'
import { restartApp } from './app-restart'
import { startFresh } from './start-fresh'

const order = vi.hoisted(() => [] as string[])

vi.mock('@/db/services/user-service', () => ({
  setAuthToken: vi.fn(() => order.push('token')),
  resetUserId: vi.fn(() => {
    order.push('identity')
    return 'fresh-id'
  }),
}))
vi.mock('./app-restart', () => ({
  restartApp: vi.fn(() => order.push('restart')),
}))

beforeEach(() => {
  order.length = 0
  vi.mocked(setAuthToken).mockClear()
  vi.mocked(resetUserId).mockClear()
  vi.mocked(restartApp).mockClear()
})

describe('Start fresh', () => {
  it("drops the old identity's session, mints a new one, then restarts", () => {
    startFresh()

    expect(setAuthToken).toHaveBeenCalledWith(null)
    expect(order).toEqual(['token', 'identity', 'restart'])
  })
})
