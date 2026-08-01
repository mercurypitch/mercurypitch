// ============================================================
// Pending friend code — the handoff for invite links
// ============================================================
//
// Invite links look like `/#/leaderboard?add=CODE`. The hash router
// canonicalises the hash to `#/leaderboard` on its very first pass, so the
// query survives exactly one parse. parseHash stashes the code here, and the
// Friends panel takes it when it mounts — sessionStorage, so the handoff
// survives the rewrite (and a reload mid-navigation) but not the tab.

const KEY = 'pitchperfect_pending_friend_code'

export function stashPendingFriendCode(code: string): void {
  try {
    sessionStorage.setItem(KEY, code)
  } catch {
    // Storage denied (private mode hardening) — the link degrades to just
    // opening the leaderboard, which is still better than a dead click.
  }
}

/** Read without consuming — used to pick the initial leaderboard view. */
export function peekPendingFriendCode(): string | null {
  try {
    return sessionStorage.getItem(KEY)
  } catch {
    return null
  }
}

/** Read and clear — used by the panel that actually prefills the code. */
export function takePendingFriendCode(): string | null {
  try {
    const code = sessionStorage.getItem(KEY)
    if (code != null) sessionStorage.removeItem(KEY)
    return code
  } catch {
    return null
  }
}
