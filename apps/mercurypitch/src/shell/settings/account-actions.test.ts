// ============================================================
// Account actions: each is a press on an Account screen
// ============================================================
//
// While the API is out of reach after a request that got no answer, a call
// the app makes by itself is refused before it is sent (api-reachability.ts).
// What the Account screens change is what a singer just pressed for, so the
// request that starts each change goes as their press: Save on the Name
// screen, the Public boards switch. Its answer opens the way for the writes
// after it.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UserProfile } from '@/db/entities'
import { grantBoardConsent, revokeBoardConsent, } from '@/features/challenges/board-consent'
import { saveAccountName, setPublicBoards } from './account-actions'

const stand = vi.hoisted(() => ({
  profile: null as UserProfile | null,
  findById: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
}))

vi.mock('@/db', () => ({
  getDb: async () => ({
    getRepository: () => ({
      findById: stand.findById,
      update: stand.update,
      create: stand.create,
    }),
  }),
}))
vi.mock('@/features/challenges/board-consent', () => ({
  grantBoardConsent: vi.fn(async () => true),
  revokeBoardConsent: vi.fn(async () => true),
}))
vi.mock('./account-state', () => ({
  forgetAccountCard: vi.fn(),
  keepBoardsAnswer: vi.fn(),
  refreshAccount: vi.fn(async () => undefined),
}))

const PROFILE = {
  id: 'user-1',
  displayName: 'Alex',
} as UserProfile

beforeEach(() => {
  stand.findById.mockReset().mockImplementation(async () => stand.profile)
  stand.update.mockReset().mockResolvedValue(PROFILE)
  stand.create.mockReset().mockResolvedValue(PROFILE)
  stand.profile = PROFILE
  vi.mocked(grantBoardConsent).mockClear()
  vi.mocked(revokeBoardConsent).mockClear()
})

describe('saving the name', () => {
  it('reads the profile as the singer, then writes the name', async () => {
    await saveAccountName('Alexandra')

    expect(stand.findById).toHaveBeenCalledExactlyOnceWith(expect.any(String), {
      userAction: true,
    })
    expect(stand.update).toHaveBeenCalledExactlyOnceWith(expect.any(String), {
      displayName: 'Alexandra',
    })
  })
})

describe('the public boards switch', () => {
  it('gives and takes back the consent as the singer', async () => {
    await setPublicBoards(true)
    await setPublicBoards(false)

    expect(grantBoardConsent).toHaveBeenCalledExactlyOnceWith({
      userAction: true,
    })
    expect(revokeBoardConsent).toHaveBeenCalledExactlyOnceWith({
      userAction: true,
    })
  })
})
