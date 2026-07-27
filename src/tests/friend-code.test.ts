// ============================================================
// Friend code helpers — display formatting and invite links
// ============================================================
//
// The code is meant to survive being read aloud, retyped, and pasted out of
// a chat message, so the forgiving cases are the ones worth pinning down.

import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/defaults', () => ({
  API_BASE_URL: 'http://api.test',
}))

import { formatFriendCode, friendInviteUrl } from '@/db/services/follow-service'

describe('formatFriendCode', () => {
  it('groups an 8-character code into two readable halves', () => {
    expect(formatFriendCode('K7QM2X4B')).toBe('K7QM-2X4B')
  })

  it('normalizes what a human is likely to paste back', () => {
    expect(formatFriendCode('k7qm2x4b')).toBe('K7QM-2X4B')
    expect(formatFriendCode('K7QM-2X4B')).toBe('K7QM-2X4B')
    expect(formatFriendCode(' k7qm 2x4b ')).toBe('K7QM-2X4B')
  })

  it('leaves unexpected lengths alone rather than mangling them', () => {
    // Better to show something obviously wrong than a plausible-looking
    // code that was silently truncated into a different person's.
    expect(formatFriendCode('ABC')).toBe('ABC')
    expect(formatFriendCode('ABCDEFGHIJ')).toBe('ABCDEFGHIJ')
  })
})

describe('friendInviteUrl', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      location: { origin: 'https://mercurypitch.com' },
    })
  })

  it('carries the bare code, whatever form it was given in', () => {
    expect(friendInviteUrl('K7QM-2X4B')).toBe(
      'https://mercurypitch.com/#/leaderboard?add=K7QM2X4B',
    )
    expect(friendInviteUrl('k7qm2x4b')).toBe(
      'https://mercurypitch.com/#/leaderboard?add=K7QM2X4B',
    )
  })
})
