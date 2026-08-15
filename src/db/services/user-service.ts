// ============================================================
// User Identity & Auth Token Service
// ============================================================
//
// Canonical source of the current user id and auth token.
// The user id is a persisted anonymous UUID generated once per
// browser; logging in (email/password or Google) upgrades the
// same id server-side, so all local attribution stays valid.

import { createSignal } from 'solid-js'
import type { UserProfile } from '@/db/entities'
import type { Repository } from '@/db/types'
import { API_BASE_URL } from '@/lib/defaults'

const USER_ID_KEY = 'mp:userId'
const DEVICE_SECRET_KEY = 'mp:deviceSecret'
const AUTH_TOKEN_KEY = 'mp:authToken'

const [authVersionSignal, setAuthVersion] = createSignal(0)

/**
 * Bumped whenever the auth token changes (login, logout, anonymous
 * bootstrap). Read it inside a reactive scope to reload user-scoped
 * data when the signed-in identity changes.
 */
export const authVersion = authVersionSignal

let cachedUserId = ''

/** Extract the `sub` claim from a JWT without verifying it. */
function decodeTokenSub(token: string): string | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    const body = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(atob(body)) as { sub?: unknown }
    return typeof payload.sub === 'string' && payload.sub !== ''
      ? payload.sub
      : null
  } catch {
    return null
  }
}

/**
 * The current user id. When authenticated this is the JWT identity —
 * the server account id and this device's persisted id differ when
 * the account was not an in-place upgrade of this device (e.g. a
 * login to an account created elsewhere). Signed out, it's the
 * stable per-browser id, generated once and persisted.
 */
export function getUserId(): string {
  const token = getAuthToken()
  if (token != null && token !== '') {
    const sub = decodeTokenSub(token)
    if (sub !== null) return sub
  }

  let id = localStorage.getItem(USER_ID_KEY)
  if (id == null || id === '') {
    // Reuse the in-memory id if storage was cleared mid-session,
    // so attribution stays consistent until the next full reload.
    id = cachedUserId !== '' ? cachedUserId : window.crypto.randomUUID()
    localStorage.setItem(USER_ID_KEY, id)
  }
  cachedUserId = id
  return id
}

/**
 * This browser's persisted id, ignoring any token.
 *
 * Distinct from getUserId(), which prefers the JWT subject: an anonymous
 * identity IS this id (the worker keys /api/auth/anonymous on it), so
 * anything tagged with it was made by this device before it belonged to a
 * real account — and stays claimable afterwards. Returns '' rather than
 * minting one, because asking the question must never create an identity.
 */
export function getDeviceId(): string {
  try {
    return localStorage.getItem(USER_ID_KEY) ?? ''
  } catch {
    return ''
  }
}

// ── The device secret ───────────────────────────────────────────
//
// The device id used to be the whole credential for an anonymous account:
// `POST /api/auth/anonymous {deviceId}` returned a session, and the id was
// published as `userProfiles.id` and in every leaderboard row. So anyone
// could read the board, replay the ids, and hold other singers' practice
// history — or register over the row and own it permanently.
//
// The id stays public, because everything references it. What changes is
// that it is no longer sufficient: this secret is, and it is only ever sent
// in a request body, never in a URL or a public projection.

/**
 * This browser's anonymous credential, minted on first use.
 *
 * 256 bits from the CSPRNG rather than another UUID: a UUIDv4 carries 122
 * bits and looks like an identifier, which is how the last one ended up in
 * a public response. Returns '' when storage is unavailable — the worker
 * still accepts an account that has never bound one, so a private-mode
 * visitor is not locked out; they simply get no protection either.
 */
export function getDeviceSecret(): string {
  try {
    let secret = localStorage.getItem(DEVICE_SECRET_KEY)
    if (secret == null || secret === '') {
      const bytes = window.crypto.getRandomValues(new Uint8Array(32))
      secret = btoa(String.fromCharCode(...bytes))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')
      localStorage.setItem(DEVICE_SECRET_KEY, secret)
    }
    return secret
  } catch {
    return ''
  }
}

/**
 * Forget this browser's identity and mint a fresh one. Used after account
 * deletion: the device id is what /api/auth/anonymous keys on, so reusing it
 * would resurrect the same user id the erasure request just removed.
 *
 * The secret goes with it. Keeping it would leave the next identity holding
 * a credential the deleted one had already bound, and the worker would
 * rightly refuse to bind it to anything else.
 */
export function resetUserId(): string {
  const id = window.crypto.randomUUID()
  localStorage.setItem(USER_ID_KEY, id)
  try {
    localStorage.removeItem(DEVICE_SECRET_KEY)
  } catch {
    // Nothing to forget if storage is unavailable.
  }
  cachedUserId = id
  return id
}

/** JWT issued by the db-worker, or null when not authenticated. */
export function getAuthToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY)
}

export function setAuthToken(token: string | null): void {
  if (token === null) {
    localStorage.removeItem(AUTH_TOKEN_KEY)
  } else {
    localStorage.setItem(AUTH_TOKEN_KEY, token)
  }
  setAuthVersion((v) => v + 1)
}

/**
 * The current user's profile, or undefined when there isn't one yet.
 *
 * In cloud mode the row id IS the user id, and there is deliberately no
 * fallback: profiles are publicly readable, so an unfiltered findAll would
 * hand back a stranger's row. That was masked while every page load
 * provisioned a profile; with lazy provisioning a browse-only visitor
 * genuinely has none, and "no profile" must read as undefined.
 *
 * Locally the single seeded profile has a generated id, hence the fallback.
 */
export async function findOwnProfile(
  repo: Repository<UserProfile>,
  userId = getUserId(),
): Promise<UserProfile | undefined> {
  const byId = await repo.findById(userId)
  if (byId !== null) return byId
  if (API_BASE_URL != null && API_BASE_URL !== '') return undefined
  const profiles = await repo.findAll({ limit: 1 })
  return profiles[0]
}

/** Headers for authenticated ServerAdapter / fetch calls. */
export function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken()
  if (token == null || token === '') return {}
  return { Authorization: `Bearer ${token}` }
}
