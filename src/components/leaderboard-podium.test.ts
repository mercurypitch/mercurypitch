import { describe, expect, it } from 'vitest'
import type { LeaderboardUser } from '@/types'
import { podiumPlaces } from './leaderboard-podium'

function singer(rank: number): LeaderboardUser {
  return {
    userId: `u${rank}`,
    displayName: `Singer ${rank}`,
    avatar: '',
    score: 1000 - rank,
    rank,
    streak: 0,
    longestStreak: 0,
    totalSessions: 1,
    bestScore: 90,
    accuracy: 90,
    joinDate: 0,
  }
}

const kinds = (users: LeaderboardUser[]) =>
  podiumPlaces(users).map((place) =>
    place.kind === 'singer' ? place.user.userId : place.kind,
  )

describe('the podium', () => {
  it('puts each singer on their own place', () => {
    expect(kinds([singer(1), singer(2), singer(3), singer(4)])).toEqual([
      'u1',
      'u2',
      'u3',
    ])
  })

  it('leaves a hidden singer’s place empty, and moves nobody into it', () => {
    // Second is blocked: third stays third, under bronze, not silver.
    expect(kinds([singer(1), singer(3), singer(4)])).toEqual([
      'u1',
      'hidden',
      'u3',
    ])
  })

  it('leaves the places nobody holds open', () => {
    expect(kinds([singer(1)])).toEqual(['u1', 'open', 'open'])
  })
})
