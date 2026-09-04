// ============================================================
// Requested leaderboard view — the handoff for "See past challenges"
// ============================================================
//
// The Leaderboard page is lazy and owns its own view state, so another tab
// that wants it to open on a particular view — Home's Legend card sending
// someone to the Legends archive — has nowhere to put the request except a
// module both sides import. The card stashes, the leaderboard takes on mount.
//
// A module variable rather than sessionStorage, unlike pending-friend-code:
// that one has to survive the hash router rewriting `?add=CODE` out of the
// URL and a reload mid-navigation. This is an in-app tap and the leaderboard
// mounts on the very next frame, so there is nothing to survive. Taking
// clears it, so a later manual visit lands on the default view rather than
// wherever the last link pointed.

import type { LeaderboardView } from '@/types'

let requested: LeaderboardView | null = null

export function stashRequestedLeaderboardView(view: LeaderboardView): void {
  requested = view
}

/** Read and clear — the leaderboard's initial-view pick. */
export function takeRequestedLeaderboardView(): LeaderboardView | null {
  const view = requested
  requested = null
  return view
}
