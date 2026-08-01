// ============================================================
// Public profile reads must not leak private columns
//
// userProfiles is publicly readable ('owner' access) so shared content and
// local leaderboards can resolve display names. But the row also carries a
// friend code (a linking credential), leaderboard consent state, league
// placement, and streak/practice telemetry. A non-owner read must see only
// the public identity columns; a naive SELECT * passthrough would hand every
// visitor every user's friend code.
// ============================================================

import { describe, expect, it } from 'vitest'
import { maskPublicRow, TABLES } from '../../workers/db-worker/src/tables'

const fullProfileRow = {
  id: 'user-1',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-07-01T00:00:00Z',
  displayName: 'Mira',
  avatarUrl: null,
  bio: 'singing daily',
  joinDate: '2026-01-01',
  lastPracticeDate: '2026-07-30',
  currentStreak: 12,
  longestStreak: 40,
  streakFreezes: 2,
  lastFreezeUsedDate: null,
  previousStreak: 0,
  streakResetDate: null,
  lastRepairDate: null,
  leaderboardOptIn: true,
  leaderboardOptInAt: '2026-06-01T00:00:00Z',
  friendCode: 'MP-SECRET-42',
  currentLeagueId: 'l3',
}

describe('maskPublicRow on userProfiles', () => {
  const def = TABLES.userProfiles!

  it('declares a public allowlist for userProfiles at all', () => {
    expect(def.publicCols).toBeDefined()
    expect(def.publicCols).not.toContain('friendCode')
    expect(def.publicCols).not.toContain('leaderboardOptIn')
    expect(def.publicCols).not.toContain('currentLeagueId')
    expect(def.publicCols).not.toContain('currentStreak')
  })

  it('hides credentials, consent, placement and telemetry from strangers', () => {
    const masked = maskPublicRow(def, fullProfileRow, 'someone-else', false)

    expect(masked).toEqual({
      id: 'user-1',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-07-01T00:00:00Z',
      displayName: 'Mira',
      avatarUrl: null,
      bio: 'singing daily',
      joinDate: '2026-01-01',
    })
    expect(masked).not.toHaveProperty('friendCode')
    expect(masked).not.toHaveProperty('leaderboardOptIn')
    expect(masked).not.toHaveProperty('currentLeagueId')
    expect(masked).not.toHaveProperty('currentStreak')
    expect(masked).not.toHaveProperty('lastPracticeDate')
  })

  it('hides the same columns from unauthenticated readers', () => {
    const masked = maskPublicRow(def, fullProfileRow, null, false)
    expect(masked).not.toHaveProperty('friendCode')
    expect(Object.keys(masked)).toEqual(def.publicCols!)
  })

  it('returns the full row to its owner', () => {
    const own = maskPublicRow(def, fullProfileRow, 'user-1', false)
    expect(own).toBe(fullProfileRow)
  })

  it('returns the full row to an admin', () => {
    const admin = maskPublicRow(def, fullProfileRow, null, true)
    expect(admin).toBe(fullProfileRow)
  })

  it('passes tables without a publicCols list through untouched', () => {
    const row = { id: 'l1', name: 'Mercling', isMystery: false }
    expect(maskPublicRow(TABLES.leagues!, row, 'anyone', false)).toBe(row)
  })
})
