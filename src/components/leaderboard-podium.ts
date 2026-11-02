// ============================================================
// The Leaderboard's podium — the first three places, read by place
// ============================================================
//
// CommunityLeaderboard draws the board's first three places as medals. Each
// place is read by its rank, never by where a row sits in the list: a
// singer hidden by a block leaves their place empty and moves nobody up
// into it (REQ-RB-012 in docs/specs/reports-and-blocks.ears.md), so silver
// never goes to whoever came third. The worker drops a hidden singer that
// way, and the board drops a singer blocked from it the same way.

import type { LeaderboardUser } from '@/types'

export type PodiumPlace =
  | { kind: 'singer'; user: LeaderboardUser }
  /** Nobody holds the place yet: it is there to take. */
  | { kind: 'open' }
  /** Somebody holds it, hidden from this viewer by a block. */
  | { kind: 'hidden' }

/** First, second and third, each as the board has it. */
export function podiumPlaces(users: readonly LeaderboardUser[]): PodiumPlace[] {
  return [1, 2, 3].map((place): PodiumPlace => {
    const user = users.find((candidate) => candidate.rank === place)
    if (user !== undefined) return { kind: 'singer', user }
    return users.some((candidate) => candidate.rank > place)
      ? { kind: 'hidden' }
      : { kind: 'open' }
  })
}
