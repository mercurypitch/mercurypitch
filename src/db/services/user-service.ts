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

const USER_ID_KEY = 'mp:userId'
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
 * The current user's profile. In cloud mode the row id IS the user id
 * (and profiles are publicly readable, so an unfiltered findAll would
 * return other users' rows); locally the single seeded profile has a
 * generated id, hence the fallback.
 */
export async function findOwnProfile(
  repo: Repository<UserProfile>,
): Promise<UserProfile | undefined> {
  const byId = await repo.findById(getUserId())
  if (byId !== null) return byId
  const profiles = await repo.findAll({ limit: 1 })
  return profiles[0]
}

/** Headers for authenticated ServerAdapter / fetch calls. */
export function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken()
  if (token == null || token === '') return {}
  return { Authorization: `Bearer ${token}` }
}
