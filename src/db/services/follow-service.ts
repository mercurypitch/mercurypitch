// ============================================================
// Follow Service — the friend graph behind the Friends leaderboard
// ============================================================
//
// A follow is half of a mutual agreement, not a subscription. Being in
// someone's friend list means reading their streak, longest streak, average
// and best score, accuracy and session count off the Friends board — so a row
// only counts once both sides have said yes:
//
//   pending   — asked. Grants nothing, to either of you.
//   accepted  — agreed. Both rows exist and both say accepted.
//
// The worker owns every write (see workers/db-worker/src/friends.ts); the
// generic `POST /api/follows` route answers 405 now, because the one thing it
// could write was the unagreed half. Reads stay generic: `GET /api/follows`
// returns your own rows, which is where `following()` and `pending()` come
// from without a second round trip.
//
// Redeeming a friend code still links both directions at once. Handing over
// the code is the yes, and asking its owner to approve afterwards would be
// asking them to agree twice.
//
// The whole feature needs a real account — password or Google — on both sides
// of every row. An anonymous identity is a device id in this browser's
// localStorage: it cannot be signed back into, so it can never answer a
// request from a second device and vanishes with the browser. The worker is
// the authority (workers/db-worker/src/friends.ts); the guards below only
// spare an anonymous singer a round trip whose answer is already known, and
// give the UI the same sentence the server would have sent. Removing is
// deliberately not guarded, mirroring the worker: leaving a row must never
// require an account that joining it did not.

import { getDb } from '@/db'
import type { Follow } from '@/db/entities'
import { hasUpgradedAccount } from '@/db/services/auth-service'
import { getAuthHeaders, getUserId } from '@/db/services/user-service'
import { API_BASE_URL } from '@/lib/defaults'

/** Word for word what the worker answers with, so the two cannot drift. */
export const FRIENDS_NEED_ACCOUNT = 'Create an account to add friends'

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
  if (!hasUpgradedAccount()) return null
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
  if (!hasUpgradedAccount()) {
    return { ok: false, error: FRIENDS_NEED_ACCOUNT }
  }
  const res = await friendAction('redeem', { code }, 'Could not add friend')
  return res.ok
    ? { ok: true, displayName: res.displayName }
    : { ok: false, error: res.error }
}

// ── Requests ────────────────────────────────────────────────────────

/** What a friend action did, or why it could not. */
export interface FriendActionResult {
  ok: boolean
  /** Where the pair ended up. 'accepted' when the other side had also asked. */
  status?: 'pending' | 'accepted'
  displayName?: string
  error?: string
}

/** Someone waiting on an answer, in either direction. */
export interface FriendRequest {
  userId: string
  displayName: string
  avatarUrl: string | null
  createdAt: string
}

const OFFLINE = 'Friends need a connection'

async function friendAction(
  route: 'request' | 'accept' | 'remove' | 'redeem',
  body: Record<string, string>,
  fallbackError: string,
): Promise<FriendActionResult> {
  if (API_BASE_URL == null || API_BASE_URL === '') {
    return { ok: false, error: OFFLINE }
  }
  try {
    const res = await fetch(`${API_BASE_URL}/api/friends/${route}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(body),
    })
    const data = (await res.json().catch(() => ({}))) as FriendActionResult
    if (!res.ok) return { ok: false, error: data.error ?? fallbackError }
    return { ok: true, status: data.status, displayName: data.displayName }
  } catch {
    return { ok: false, error: 'Could not reach the server' }
  }
}

/**
 * Ask to be someone's friend.
 *
 * Resolves `status: 'pending'` normally, and `'accepted'` when they had
 * already asked you — two yeses need no third step.
 */
export async function requestFriend(
  userId: string,
): Promise<FriendActionResult> {
  if (userId === '' || userId === getUserId()) {
    return { ok: false, error: 'You can’t friend yourself' }
  }
  if (!hasUpgradedAccount()) {
    return { ok: false, error: FRIENDS_NEED_ACCOUNT }
  }
  return friendAction('request', { userId }, 'Could not send the request')
}

/** Say yes to someone who asked. Links both directions. */
export async function acceptFriend(
  userId: string,
): Promise<FriendActionResult> {
  if (!hasUpgradedAccount()) {
    return { ok: false, error: FRIENDS_NEED_ACCOUNT }
  }
  return friendAction('accept', { userId }, 'Could not accept the request')
}

/**
 * Say no, or take back a yes. Clears both directions — ending a friendship
 * halfway would leave the person you removed still able to see you.
 */
export async function removeFriend(
  userId: string,
): Promise<FriendActionResult> {
  return friendAction('remove', { userId }, 'Could not remove that friend')
}

/**
 * Pending requests both ways. Incoming rows are owned by the person who sent
 * them, so the per-user list below cannot see them — this endpoint is the
 * only way to learn you have been asked.
 */
export async function listFriendRequests(): Promise<{
  incoming: FriendRequest[]
  outgoing: FriendRequest[]
}> {
  const empty = { incoming: [], outgoing: [] }
  if (API_BASE_URL == null || API_BASE_URL === '') return empty
  if (!hasUpgradedAccount()) return empty
  try {
    const res = await fetch(`${API_BASE_URL}/api/friends/requests`, {
      headers: getAuthHeaders(),
    })
    if (!res.ok) return empty
    const data = (await res.json()) as Partial<{
      incoming: FriendRequest[]
      outgoing: FriendRequest[]
    }>
    return { incoming: data.incoming ?? [], outgoing: data.outgoing ?? [] }
  } catch {
    return empty
  }
}

// ── Your own rows ───────────────────────────────────────────────────

/**
 * Your follow rows split by whether the other side agreed.
 *
 * One read serves both the Friends tab and the button states, and reading
 * them together is what keeps them from disagreeing: a singer cannot be shown
 * as a friend on one surface and as a pending ask on another.
 */
export async function loadFollowState(): Promise<{
  accepted: string[]
  pending: string[]
}> {
  try {
    const db = await getDb()
    const repo = db.getRepository<Follow>('follows')
    const rows = await repo.findAll()
    return {
      accepted: rows
        .filter((r) => r.status === 'accepted')
        .map((r) => r.followedUserId),
      // Rows written before the status column existed default to 'pending',
      // which is the honest reading: nobody ever agreed to them.
      pending: rows
        .filter((r) => r.status !== 'accepted')
        .map((r) => r.followedUserId),
    }
  } catch {
    return { accepted: [], pending: [] }
  }
}

/** User ids who agreed to be your friend. Empty when signed out/offline. */
export async function getFollowing(): Promise<string[]> {
  return (await loadFollowState()).accepted
}
