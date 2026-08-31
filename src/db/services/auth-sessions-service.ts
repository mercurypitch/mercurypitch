// ============================================================
// Auth Sessions Service — the devices an account is signed in on
// ============================================================
//
// Backed by the db-worker's `authSessions` table (migration 0038). Signing
// out used to revoke every token the account held, so "sign out" on a phone
// took the laptop and the television with it. Each device now has its own row
// and its own end.
//
// Kept out of auth-service.ts, which is already 40 KB and is imported on the
// first paint of every surface with an account chip. Nothing here is needed
// before someone opens their settings.

import { API_BASE_URL } from '@/lib/defaults'
import { getAuthToken } from './user-service'

/** One signed-in device, as the settings list shows it. */
export interface AuthSession {
  id: string
  provider: string | null
  /** "Chrome on Mac". Derived server-side from the stored user agent. */
  label: string
  ip: string | null
  createdAt: string
  lastSeenAt: string
  /** The device asking. Its row is the one that must not be ended by mistake. */
  current: boolean
}

function requireAuthorized(): { base: string; token: string } {
  const base = API_BASE_URL
  const token = getAuthToken()
  if (base == null || base === '') {
    throw new Error('auth-sessions: VITE_API_BASE_URL is not configured')
  }
  if (token == null || token === '') throw new Error('Not signed in')
  return { base, token }
}

/** Where this account is signed in, most recently seen first. */
export async function fetchSessions(): Promise<AuthSession[]> {
  const { base, token } = requireAuthorized()
  const res = await fetch(`${base}/api/auth/sessions`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Could not load your devices')
  const body = (await res.json()) as { sessions?: AuthSession[] }
  return body.sessions ?? []
}

/**
 * End one device.
 *
 * The server scopes the delete to the caller's own rows, so naming someone
 * else's id answers 404 rather than ending their session — this cannot be
 * turned into a probe for which ids exist.
 */
export async function revokeSession(sessionId: string): Promise<void> {
  const { base, token } = requireAuthorized()
  const res = await fetch(
    `${base}/api/auth/sessions/${encodeURIComponent(sessionId)}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } },
  )
  if (!res.ok) throw new Error('Could not sign that device out')
}

/**
 * Sign out everywhere, including here.
 *
 * The caller is responsible for dropping the local token afterwards — this
 * only tells the server. Separate from `logout()` in auth-service, which now
 * ends this device alone.
 */
export async function revokeAllSessions(): Promise<void> {
  const { base, token } = requireAuthorized()
  const res = await fetch(`${base}/api/auth/logout-all`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Could not sign out everywhere')
}
