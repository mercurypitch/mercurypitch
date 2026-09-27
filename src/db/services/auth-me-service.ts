// ============================================================
// Auth me service — the account read that says WHY it has none
// ============================================================
//
// fetchMe() in auth-service answers null for a signed-out phone and for a
// phone with no network alike, and the web's account card is built on that
// null. The native Account screen has to tell the two apart: a phone with no
// signal is still signed in (S6 audit D1, REQ-NAM-049). This reads the same
// /api/auth/me and keeps the answers apart.
//
// Kept out of auth-service.ts, as auth-email-code-service is: that file loads
// on the first paint of every surface, and only the native shell asks this.

import { API_BASE_URL } from '@/lib/defaults'
import type { MeResponse } from './auth-service'
import { accountHeld, handleAuthErrorResponse } from './auth-service'
import { getAuthToken } from './user-service'

/**
 * What reading the account came back with, and WHY when it has no account.
 *
 * `signed-out` is a phone with no session, or one the server refused;
 * `unreachable` is a network or a server that could not answer.
 */
export type MeRead =
  | { status: 'ok'; me: MeResponse }
  | { status: 'signed-out' }
  | { status: 'unreachable' }

/** The account's own record, or why there is none. See `MeRead`. */
export async function readMe(): Promise<MeRead> {
  const token = getAuthToken()
  if (token == null || token === '') return { status: 'signed-out' }
  if (API_BASE_URL == null || API_BASE_URL === '') {
    return { status: 'unreachable' }
  }
  let res: Response
  try {
    res = await fetch(`${API_BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch {
    // Offline, CORS, or a worker that is down.
    return { status: 'unreachable' }
  }
  if (!res.ok) {
    // A suspended account is told so here exactly as fetchMe's callers are.
    const body = await res.text().catch(() => '')
    handleAuthErrorResponse(res.status, body)
    return res.status === 401 || res.status === 403
      ? { status: 'signed-out' }
      : { status: 'unreachable' }
  }
  try {
    return { status: 'ok', me: (await res.json()) as MeResponse }
  } catch {
    return { status: 'unreachable' }
  }
}

/**
 * The provider the held token names, when it names a real account, or null.
 *
 * Local work, so it answers with no network: a phone that cannot reach the
 * server still knows it signed in with Apple. Reactive, like `accountHeld`.
 */
export function heldAccountProvider(): string | null {
  if (!accountHeld()) return null
  const body = (getAuthToken() ?? '').split('.')[1] ?? ''
  try {
    const payload = JSON.parse(
      atob(body.replace(/-/g, '+').replace(/_/g, '/')),
    ) as { provider?: unknown }
    return typeof payload.provider === 'string' ? payload.provider : null
  } catch {
    return null
  }
}
