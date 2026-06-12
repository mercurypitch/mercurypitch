// ============================================================
// User Identity & Auth Token Service
// ============================================================
//
// Canonical source of the current user id and auth token.
// The user id is a persisted anonymous UUID generated once per
// browser; logging in (email/password or Google) upgrades the
// same id server-side, so all local attribution stays valid.

import { createSignal } from 'solid-js'

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

/** Stable per-browser user id, generated once and persisted. */
export function getUserId(): string {
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

/** Headers for authenticated ServerAdapter / fetch calls. */
export function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken()
  if (token == null || token === '') return {}
  return { Authorization: `Bearer ${token}` }
}
