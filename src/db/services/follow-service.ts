// ============================================================
// Follow Service — social graph for the Friends leaderboard
// ============================================================
//
// Rows live in the cloud `follows` table (private, JWT-scoped: you can
// only read/write your own follow list). The worker joins it server-side
// for the Friends leaderboard view.

import { getDb } from '@/db'
import type { Follow } from '@/db/entities'
import { getAuthHeaders, getUserId } from '@/db/services/user-service'
import { API_BASE_URL } from '@/lib/defaults'

// ── Friend codes ────────────────────────────────────────────────────
//
// Before this, the only way to add someone was to find them on the public
// leaderboard — which stops working once that board is opt-in and gated.
// A short code covers the ways people actually share: read it out, paste it
// into a chat, or send the link that carries it.

/** Group a raw code for display: K7QM2X4B → K7QM-2X4B. */
export function formatFriendCode(code: string): string {
  const clean = code.replace(/[\s-]/g, '').toUpperCase()
  return clean.length === 8 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean
}

/** A link that carries the code, for sharing where typing is a chore. */
export function friendInviteUrl(code: string): string {
  const clean = code.replace(/[\s-]/g, '').toUpperCase()
  return `${window.location.origin}/#/leaderboard?add=${encodeURIComponent(clean)}`
}

/**
 * This account's friend code, minted server-side on first request.
 * Returns null when signed out or still anonymous — codes are for
 * registered accounts, since an anonymous identity can vanish with a
 * cleared browser and leave dead entries in other people's lists.
 */
export async function getMyFriendCode(): Promise<string | null> {
  if (API_BASE_URL == null || API_BASE_URL === '') return null
  try {
    const res = await fetch(`${API_BASE_URL}/api/friends/code`, {
      headers: getAuthHeaders(),
    })
    if (!res.ok) return null
    return ((await res.json()) as { code?: string }).code ?? null
  } catch {
    return null
  }
}

export interface RedeemResult {
  ok: boolean
  displayName?: string
  error?: string
}

/** Redeem someone's code. Links both ways — sharing the code is the consent. */
export async function redeemFriendCode(code: string): Promise<RedeemResult> {
  if (API_BASE_URL == null || API_BASE_URL === '') {
    return { ok: false, error: 'Friends need a connection' }
  }
  try {
    const res = await fetch(`${API_BASE_URL}/api/friends/redeem`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ code }),
    })
    const data = (await res.json().catch(() => ({}))) as {
      displayName?: string
      error?: string
    }
    if (!res.ok)
      return { ok: false, error: data.error ?? 'Could not add friend' }
    return { ok: true, displayName: data.displayName }
  } catch {
    return { ok: false, error: 'Could not reach the server' }
  }
}

/** User ids the current user follows. Empty when signed out/offline. */
export async function getFollowing(): Promise<string[]> {
  try {
    const db = await getDb()
    const repo = db.getRepository<Follow>('follows')
    const rows = await repo.findAll()
    return rows.map((r) => r.followedUserId)
  } catch {
    return []
  }
}

export async function isFollowing(userId: string): Promise<boolean> {
  try {
    const db = await getDb()
    const repo = db.getRepository<Follow>('follows')
    const rows = await repo.findAll({ where: { followedUserId: userId } })
    return rows.length > 0
  } catch {
    return false
  }
}

/** Follow a user. Returns false when it failed (signed out, self, …). */
export async function follow(userId: string): Promise<boolean> {
  if (userId === '' || userId === getUserId()) return false
  try {
    const db = await getDb()
    const repo = db.getRepository<Follow>('follows')
    if (await isFollowing(userId)) return true
    await repo.create({ userId: getUserId(), followedUserId: userId })
    return true
  } catch {
    return false
  }
}

export async function unfollow(userId: string): Promise<boolean> {
  try {
    const db = await getDb()
    const repo = db.getRepository<Follow>('follows')
    const rows = await repo.findAll({ where: { followedUserId: userId } })
    await Promise.all(rows.map((r) => repo.delete(r.id)))
    return true
  } catch {
    return false
  }
}
