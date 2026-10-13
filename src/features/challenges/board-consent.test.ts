// A brand-new visitor's first consent. Their identity is minted by the very
// write that saves it: `create` provisions the anonymous account, and the
// server writes a default profile while doing so, so the create that follows
// finds the row already there and answers 409. That 409 is the consent's row
// existing, not a failure, and the consent belongs on it.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  profile: null as Record<string, unknown> | null,
  createError: null as Error | null,
  updates: [] as Array<[string, Record<string, unknown>]>,
}))

vi.mock('@/db', () => ({
  getDb: async () => ({
    getRepository: () => ({
      findById: async () => mocks.profile,
      create: async (row: Record<string, unknown>) => {
        if (mocks.createError !== null) throw mocks.createError
        return { id: 'singer-1', ...row }
      },
      update: async (id: string, patch: Record<string, unknown>) => {
        mocks.updates.push([id, patch])
        return { id, ...patch }
      },
    }),
  }),
}))
vi.mock('@/db/seed', () => ({ getUserId: () => 'singer-1' }))

import { CloudRequestError } from '@/db/adapters/server-adapter'
import { grantBoardConsent } from './board-consent'

beforeEach(() => {
  mocks.profile = null
  mocks.createError = null
  mocks.updates = []
})

describe('grantBoardConsent', () => {
  it('saves a first-time visitor’s consent on the profile provisioning made', async () => {
    mocks.createError = new CloudRequestError(409, 'Profile already exists')

    expect(await grantBoardConsent()).toBe(true)
    expect(mocks.updates).toEqual([
      [
        'singer-1',
        expect.objectContaining({
          leaderboardOptIn: true,
          leaderboardOptInAt: expect.any(String),
        }),
      ],
    ])
  })

  it('still reports a create that failed for any other reason', async () => {
    mocks.createError = new CloudRequestError(500, 'boom')

    expect(await grantBoardConsent()).toBe(false)
    expect(mocks.updates).toEqual([])
  })

  it('updates an existing profile without creating one', async () => {
    mocks.profile = { id: 'singer-1', leaderboardOptIn: false }

    expect(await grantBoardConsent()).toBe(true)
    expect(mocks.updates).toHaveLength(1)
  })
})
