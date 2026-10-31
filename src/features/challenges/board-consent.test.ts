// Board consent persists on the profile created by lazy provisioning and fails closed.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CloudRequestError } from '@/db/adapters/server-adapter'
import type { UserProfile } from '@/db/entities'

type NewProfile = Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'>
const mocks = vi.hoisted(() => ({
  userId: 'singer-1',
  profile: null as UserProfile | null,
  findById: vi.fn<(id: string) => Promise<UserProfile | null>>(),
  create: vi.fn<(row: NewProfile) => Promise<UserProfile>>(),
  update:
    vi.fn<(id: string, patch: Partial<UserProfile>) => Promise<UserProfile>>(),
}))

vi.mock('@/db', () => ({
  getDb: async () => ({
    getRepository: () => ({
      findById: mocks.findById,
      create: mocks.create,
      update: mocks.update,
    }),
  }),
}))
vi.mock('@/db/seed', () => ({ getUserId: () => mocks.userId }))

import { grantBoardConsent, hasBoardConsent, revokeBoardConsent, } from './board-consent'

const existingProfile: UserProfile = {
  id: 'singer-1',
  displayName: 'Chosen name',
  joinDate: '2026-01-02T00:00:00.000Z',
  lastPracticeDate: null,
  currentStreak: 4,
  longestStreak: 12,
  leaderboardOptIn: false,
  createdAt: '2026-01-02T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.userId = 'singer-1'
  mocks.profile = null
  mocks.findById.mockImplementation(async () => mocks.profile)
  mocks.create.mockImplementation(async (row) => {
    mocks.profile = {
      ...row,
      id: mocks.userId,
      createdAt: existingProfile.createdAt,
      updatedAt: existingProfile.updatedAt,
    }
    return mocks.profile
  })
  mocks.update.mockImplementation(async (id, patch) => {
    if (mocks.profile === null || mocks.profile.id !== id)
      throw new Error('Missing profile')
    mocks.profile = { ...mocks.profile, ...patch }
    return mocks.profile
  })
})

describe('grantBoardConsent', () => {
  it('saves first-time consent on the profile provisioning made, preserving its other fields', async () => {
    mocks.create.mockImplementationOnce(async () => {
      mocks.profile = { ...existingProfile }
      throw new CloudRequestError(409, 'Profile already exists')
    })

    expect(await grantBoardConsent()).toBe(true)
    expect(mocks.create).toHaveBeenCalledOnce()
    expect(mocks.update).toHaveBeenCalledExactlyOnceWith('singer-1', {
      leaderboardOptIn: true,
      leaderboardOptInAt: expect.any(String),
    })
    expect(mocks.profile).toEqual({
      ...existingProfile,
      leaderboardOptIn: true,
      leaderboardOptInAt: expect.any(String),
    })
    expect(
      Number.isFinite(Date.parse(mocks.profile?.leaderboardOptInAt ?? '')),
    ).toBe(true)
    expect(await hasBoardConsent()).toBe(true)
  })

  it('creates consent when the local adapter has no provisioned profile', async () => {
    expect(await grantBoardConsent()).toBe(true)
    expect(mocks.profile).toMatchObject({
      id: 'singer-1',
      displayName: 'Singer-singer',
      leaderboardOptIn: true,
    })
    expect(mocks.create).toHaveBeenCalledOnce()
    expect(mocks.update).not.toHaveBeenCalled()
    expect(await hasBoardConsent()).toBe(true)
  })

  it('updates existing consent without creating or resetting a profile', async () => {
    mocks.profile = { ...existingProfile }

    expect(await grantBoardConsent()).toBe(true)
    expect(mocks.profile).toEqual({
      ...existingProfile,
      leaderboardOptIn: true,
      leaderboardOptInAt: expect.any(String),
    })
    expect(mocks.create).not.toHaveBeenCalled()
    expect(mocks.update).toHaveBeenCalledOnce()
  })

  it.each([403, 500])(
    'reports create failure %s without attempting an update',
    async (status) => {
      mocks.create.mockRejectedValueOnce(
        new CloudRequestError(status, 'Create failed'),
      )

      expect(await grantBoardConsent()).toBe(false)
      expect(mocks.update).not.toHaveBeenCalled()
      expect(mocks.profile).toBeNull()
    },
  )

  it('does not report consent when the recovery update fails', async () => {
    mocks.create.mockImplementationOnce(async () => {
      mocks.profile = { ...existingProfile }
      throw new CloudRequestError(409, 'Profile already exists')
    })
    mocks.update.mockRejectedValueOnce(
      new CloudRequestError(503, 'Update failed'),
    )

    expect(await grantBoardConsent()).toBe(false)
    expect(mocks.profile?.leaderboardOptIn).toBe(false)
    expect(await hasBoardConsent()).toBe(false)
  })

  it('does not retry the consent under an account selected during the conflicting create', async () => {
    mocks.create.mockImplementationOnce(async () => {
      mocks.userId = 'singer-2'
      mocks.profile = { ...existingProfile }
      throw new CloudRequestError(409, 'Profile already exists')
    })

    expect(await grantBoardConsent()).toBe(false)
    expect(mocks.update).not.toHaveBeenCalled()
    expect(mocks.profile?.leaderboardOptIn).toBe(false)
  })

  it('does not dispatch consent after an account switch during the profile read', async () => {
    mocks.findById.mockImplementationOnce(async () => {
      mocks.userId = 'singer-2'
      return null
    })

    expect(await grantBoardConsent()).toBe(false)
    expect(mocks.create).not.toHaveBeenCalled()
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('does not authorize a new account when the previous account finishes saving', async () => {
    mocks.profile = { ...existingProfile }
    mocks.update.mockImplementationOnce(async (id, patch) => {
      const saved = { ...existingProfile, ...patch, id }
      mocks.userId = 'singer-2'
      return saved
    })

    expect(await grantBoardConsent()).toBe(false)
    expect(mocks.update).toHaveBeenCalledExactlyOnceWith(
      'singer-1',
      expect.objectContaining({ leaderboardOptIn: true }),
    )
  })
})

describe('hasBoardConsent', () => {
  it('does not authorize an account selected while the previous consent read is pending', async () => {
    let finishRead!: (profile: UserProfile) => void
    mocks.findById.mockImplementationOnce(
      () => new Promise((resolve) => (finishRead = resolve)),
    )

    const pending = hasBoardConsent()
    await vi.waitFor(() =>
      expect(mocks.findById).toHaveBeenCalledExactlyOnceWith('singer-1'),
    )
    mocks.userId = 'singer-2'
    finishRead({ ...existingProfile, leaderboardOptIn: true })

    expect(await pending).toBe(false)
    expect(mocks.create).not.toHaveBeenCalled()
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('fails closed for missing profiles and failed reads', async () => {
    expect(await hasBoardConsent()).toBe(false)
    mocks.findById.mockRejectedValueOnce(new Error('Offline'))
    expect(await hasBoardConsent()).toBe(false)
  })
})

describe('a consent already given', () => {
  it('is kept with the date it was given on, not written again', async () => {
    mocks.profile = {
      ...existingProfile,
      leaderboardOptIn: true,
      leaderboardOptInAt: '2026-09-01T00:00:00.000Z',
    }
    expect(await grantBoardConsent()).toBe(true)
    expect(mocks.update).not.toHaveBeenCalled()
    expect(mocks.profile?.leaderboardOptInAt).toBe('2026-09-01T00:00:00.000Z')
  })
})

describe('revokeBoardConsent', () => {
  it('takes the name off every board, and its date with it', async () => {
    mocks.profile = {
      ...existingProfile,
      leaderboardOptIn: true,
      leaderboardOptInAt: '2026-10-01T00:00:00.000Z',
    }
    expect(await revokeBoardConsent()).toBe(true)
    expect(mocks.profile?.leaderboardOptIn).toBe(false)
    expect(mocks.profile?.leaderboardOptInAt).toBeNull()
    expect(mocks.profile?.displayName).toBe('Chosen name')
    expect(await hasBoardConsent()).toBe(false)
  })

  it('writes nothing for a singer with no profile, who never consented', async () => {
    expect(await revokeBoardConsent()).toBe(true)
    expect(mocks.create).not.toHaveBeenCalled()
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('says it was not stored when the write fails', async () => {
    mocks.profile = { ...existingProfile, leaderboardOptIn: true }
    mocks.update.mockRejectedValueOnce(new Error('offline'))
    expect(await revokeBoardConsent()).toBe(false)
  })

  it('belongs to the account that asked, not one signed in meanwhile', async () => {
    mocks.profile = { ...existingProfile, leaderboardOptIn: true }
    mocks.update.mockImplementationOnce(async (_id, patch) => {
      mocks.profile = { ...existingProfile, ...patch }
      mocks.userId = 'singer-2'
      return mocks.profile
    })
    expect(await revokeBoardConsent()).toBe(false)
  })
})
