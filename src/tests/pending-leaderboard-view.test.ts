// The handoff between a tab that wants the leaderboard opened on a view and
// the lazily mounted leaderboard that picks its initial view. Take clears, so
// a later manual visit lands on the default rather than on a stale request.

import { describe, expect, it } from 'vitest'
import { stashRequestedLeaderboardView, takeRequestedLeaderboardView, } from '@/lib/pending-leaderboard-view'

describe('the requested leaderboard view', () => {
  it('is empty until something asks', () => {
    expect(takeRequestedLeaderboardView()).toBeNull()
  })

  it('hands over what was stashed, once', () => {
    stashRequestedLeaderboardView('legends')
    expect(takeRequestedLeaderboardView()).toBe('legends')
    // Taken. The next mount is an ordinary visit, not a replay of the link.
    expect(takeRequestedLeaderboardView()).toBeNull()
  })

  it('keeps only the latest request', () => {
    stashRequestedLeaderboardView('friends')
    stashRequestedLeaderboardView('legends')
    expect(takeRequestedLeaderboardView()).toBe('legends')
  })
})
